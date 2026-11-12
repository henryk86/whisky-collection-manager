import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { modelInput, normalizedMask, MODEL_SIZE } from '../../public/js/features/cutout/model.js';
import { displayPhotoPath } from '../../public/js/domain/photo-images.js';
import { analyzeBottleMask, bottleCropRect, cutoutOutputSize } from '../../public/js/features/cutout/crop.js';

const size = MODEL_SIZE * MODEL_SIZE;
test('U2Netp normalization uses NCHW, ImageNet means and preserves ordering', () => {
    const data = new Uint8ClampedArray(size * 4);
    data[0] = 255; data[1] = 128; data[2] = 0; data[3] = 255;
    const input = modelInput({width:MODEL_SIZE,height:MODEL_SIZE,data});
    assert.equal(input.length,size * 3);
    assert.ok(Math.abs(input[0] - ((1 - .485) / .229)) < .00001);
    assert.ok(Math.abs(input[size] - (((128 / 255) - .456) / .224)) < .00001);
    assert.ok(Math.abs(input[size * 2] - ((0 - .406) / .225)) < .00001);
});

test('normalized mask preserves low and high values and rejects invalid inference outputs', () => {
    const model = new Float32Array(size).fill(.5);
    model[0] = 0; model[1] = 1;
    const mask = normalizedMask(model);
    assert.equal(mask[0],0); assert.equal(mask[1],255); assert.equal(mask[2],128);
    assert.throws(() => normalizedMask(new Float32Array(size)), /Keine Flasche/);
    assert.throws(() => normalizedMask([Number.NaN,...new Array(size-1).fill(0)]), /Ungültige/);
});

test('photo rendering selects the cutout only when the user requested it', () => {
    const photo = {path:'images/old/original.png',cutout:{path:'images/old/cutout.png',selected:true}};
    assert.equal(displayPhotoPath(photo),'images/old/cutout.png');
    photo.cutout.selected=false;
    assert.equal(displayPhotoPath(photo),'images/old/original.png');
    assert.equal(displayPhotoPath({path:'images/old/original.png'}),'images/old/original.png');
});

test('AI assets are obtained at image build time and CSP only grants WebAssembly execution', () => {
    const docker = fs.readFileSync('docker/app.Dockerfile','utf8');
    const staticFiles = fs.readFileSync('server/http/static-files.js','utf8');
    assert.match(docker,/RUN node scripts\/prepare-cutout-assets\.js/);
    assert.match(staticFiles,/wasm-unsafe-eval/);
    assert.doesNotMatch(staticFiles,/'unsafe-eval'/);
});


function sampleMask(rect) {
    const mask = new Uint8ClampedArray(size);
    for (let y = rect.top; y < rect.bottom; y++) for (let x = rect.left; x < rect.right; x++)
        mask[y * MODEL_SIZE + x] = 255;
    return mask;
}

test('automatic 2:3 crop reaches bottle top and bottom and ignores detached segmentation speckles', () => {
    const mask = sampleMask({left:120, top:20, right:200, bottom:300});
    mask[0] = 255; // stray high-confidence background pixel must not determine the crop
    const rect = bottleCropRect(mask, MODEL_SIZE, MODEL_SIZE, 640, 960);
    assert.equal(rect.x, 40);
    assert.equal(rect.y, 60);
    assert.equal(rect.width, 560);
    assert.equal(rect.height, 840);
    assert.equal(rect.width * 3, rect.height * 2);
    const output = cutoutOutputSize(rect, 1600);
    assert.deepEqual(output, {width:560, height:840});
});

test('2:3 crop never truncates a wide bottle and can pad beyond original photo boundaries', () => {
    const mask = sampleMask({left:60, top:20, right:260, bottom:70});
    const rect = bottleCropRect(mask, MODEL_SIZE, MODEL_SIZE, 900, 900);
    assert.equal(rect.width, 562.5);
    assert.equal(rect.height, 843.75);
    assert.ok(rect.y < 0, 'a wide bottle gets transparent vertical margins, not clipped sides');
    assert.deepEqual(cutoutOutputSize(rect, 800), {width:532, height:798});
});

test('2:3 crop keeps transparency outside the source frame instead of scaling bottle unnaturally', () => {
    const mask = sampleMask({left:0, top:10, right:61, bottom:310});
    const rect = bottleCropRect(mask, MODEL_SIZE, MODEL_SIZE, 1200, 800);
    assert.ok(rect.x < 0, 'transparent margins may extend past the left edge of the photo');
    assert.equal(rect.y, 25);
    assert.ok(rect.width > 0 && rect.height > 0);
    for (const maxSide of [1600,1280,1024,800]) {
        const output = cutoutOutputSize(rect, maxSide);
        assert.equal(output.width * 3, output.height * 2);
        assert.ok(output.height <= maxSide);
        assert.ok(output.height <= rect.height);
    }
});

test('2:3 crop rejects masks without a meaningful foreground component', () => {
    assert.throws(() => bottleCropRect(new Uint8ClampedArray(size), 320, 320, 640, 960), /Keine Flasche erkannt/);
    const noise = new Uint8ClampedArray(size);
    noise[10] = 255;
    assert.throws(() => bottleCropRect(noise, 320, 320, 640, 960), /Keine Flasche erkannt/);
});

test('isolation keeps the main central connected bottle and removes disconnected bright and faint speckles', async () => {
    const {analyzeBottleMask} = await import('../../public/js/features/cutout/crop.js');
    const mask = sampleMask({left:132,top:35,right:190,bottom:290});
    // A separate, substantial dark background object at the photo edge.
    for (let y = 60; y < 220; y++) for (let x = 0; x < 37; x++) mask[y * MODEL_SIZE + x] = 255;
    mask[0] = 255;
    mask[MODEL_SIZE * (MODEL_SIZE - 1) + MODEL_SIZE - 1] = 30;
    mask[34 * MODEL_SIZE + 132] = 20; // soft transition touching the bottle
    const result = analyzeBottleMask(mask, MODEL_SIZE, MODEL_SIZE, 960, 1280);
    assert.equal(result.mask[150 * MODEL_SIZE + 160], 255);
    assert.equal(result.mask[100 * MODEL_SIZE + 10], 0);
    assert.equal(result.mask[0], 0);
    assert.equal(result.mask[MODEL_SIZE * (MODEL_SIZE - 1) + MODEL_SIZE - 1], 0);
    assert.equal(result.mask[34 * MODEL_SIZE + 132], 20);
    assert.equal(result.crop.width * 3, result.crop.height * 2);
    assert.ok(result.verticallyTight);
});

test('slightly tilted bottles are rotated upright in original image pixel geometry', async () => {
    const {analyzeBottleMask} = await import('../../public/js/features/cutout/crop.js');
    const mask = new Uint8ClampedArray(size);
    // 7 degrees physical tilt after accounting for a non-square original image.
    const physicalSlope = Math.tan(7 * Math.PI / 180);
    const scaleX = 1000 / MODEL_SIZE;
    const scaleY = 800 / MODEL_SIZE;
    for (let y = 28; y < 288; y++) {
        const middle = 160 + (y - 160) * physicalSlope * scaleY / scaleX;
        for (let x = Math.ceil(middle - 28); x < middle + 28; x++) mask[y * MODEL_SIZE + x] = 255;
    }
    mask[0] = 255;
    const result = analyzeBottleMask(mask, MODEL_SIZE, MODEL_SIZE, 1000, 800);
    assert.ok(Math.abs(result.rotation * 180 / Math.PI - 7) < 1.5, `rotation: ${result.rotation}`);
    assert.ok(result.verticallyTight);
    const cx = result.center.x;
    const cy = result.center.y;
    const rotateX = (x, y) => cx + (x - cx) * Math.cos(result.rotation)
        - (y - cy) * Math.sin(result.rotation);
    const topCenterX = 160 * scaleX + (28 - 160) * physicalSlope * scaleY;
    const bottomCenterX = 160 * scaleX + (287 - 160) * physicalSlope * scaleY;
    assert.ok(Math.abs(rotateX(topCenterX, 28 * scaleY) - rotateX(bottomCenterX, 287 * scaleY)) < 9,
        'the centre line is vertical after applying the rotation');
    assert.equal(result.mask[0], 0);
    assert.equal(result.crop.width * 3, result.crop.height * 2);
});

test('moderately tilted bottles at +/-16 degrees are straightened without clipping', async () => {
    const {analyzeBottleMask} = await import('../../public/js/features/cutout/crop.js');
    const sourceWidth = 1056, sourceHeight = 1408; // portrait photo, not the square AI input
    const scaleX = sourceWidth / MODEL_SIZE, scaleY = sourceHeight / MODEL_SIZE;
    for (const angle of [-16, 16]) {
        const mask = new Uint8ClampedArray(size);
        const slope = Math.tan(angle * Math.PI / 180) * scaleY / scaleX;
        for (let y = 34; y < 285; y++) {
            const centerX = 160 + (y - 160) * slope;
            for (let x = Math.ceil(centerX - 23); x <= centerX + 23; x++) {
                if (x >= 0 && x < MODEL_SIZE) mask[y * MODEL_SIZE + x] = 255;
            }
        }
        const result = analyzeBottleMask(mask, MODEL_SIZE, MODEL_SIZE, sourceWidth, sourceHeight);
        assert.ok(Math.abs(result.rotation * 180 / Math.PI - angle) < 1.5,
            `tilt ${angle} was not corrected: ${result.rotation * 180 / Math.PI}`);
        assert.equal(result.crop.width * 3, result.crop.height * 2);
        assert.ok(result.verticallyTight);
    }
});

test('transparent bottle with disconnected glass rim uses the outer centreline, not the opaque pixel mass', () => {
    const sourceWidth = 1536, sourceHeight = 2048;
    const scaleX = sourceWidth / MODEL_SIZE, scaleY = sourceHeight / MODEL_SIZE;
    for (const degrees of [-15, 15]) {
        const mask = new Uint8ClampedArray(size);
        const slope = Math.tan(degrees * Math.PI / 180) * scaleY / scaleX;
        for (let y = 22; y < 300; y++) {
            // Realistic silhouette: neck, shoulders, waist, body and rounded foot.
            const halfWidth = y < 45 ? 15 : y < 85 ? 32 : y < 135 ? 42
                : y < 157 ? 31 : y < 240 ? 49 : 37;
            const centerX = 163 + (y - 160) * slope;
            for (let x = Math.floor(centerX - halfWidth); x <= Math.ceil(centerX + halfWidth); x++) {
                if (x < 0 || x >= MODEL_SIZE) continue;
                // In the clear upper half, the model mostly identifies one glass rim.
                // Abrupt changes of width leave detached fragments that are filtered out.
                if (y < 170 && x > centerX - 17 && x < centerX + halfWidth - 4) continue;
                mask[y * MODEL_SIZE + x] = 255;
            }
        }
        const result = analyzeBottleMask(mask, MODEL_SIZE, MODEL_SIZE, sourceWidth, sourceHeight);
        assert.ok(Math.abs(result.rotation * 180 / Math.PI - degrees) < 1.5,
            `the ${degrees} degree PET bottle stayed slanted: ${result.rotation * 180 / Math.PI}`);
        assert.equal(result.crop.width * 3, result.crop.height * 2);
        assert.ok(result.verticallyTight);
    }
});

test('near-square silhouettes and steep shapes never trigger a large automatic rotation', async () => {
    const {analyzeBottleMask} = await import('../../public/js/features/cutout/crop.js');
    const square = analyzeBottleMask(sampleMask({left:80,top:80,right:240,bottom:240}),
        MODEL_SIZE, MODEL_SIZE, 960, 960);
    assert.equal(square.rotation, 0);
    const steep = new Uint8ClampedArray(size);
    for (let y = 30; y < 280; y++) {
        const middle = 160 + (y - 160) * .5;
        for (let x = Math.ceil(middle - 13); x <= middle + 13; x++) steep[y * MODEL_SIZE + x] = 255;
    }
    const result = analyzeBottleMask(steep, MODEL_SIZE, MODEL_SIZE, 960, 960);
    assert.equal(result.rotation, 0);
});

test('raster-level trim eliminates vertical transparent rows but does not clip wide bottles', async () => {
    const {visibleAlphaRows, tightenedCrop} = await import('../../public/js/features/cutout/crop.js');
    const width = 40, height = 60;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 2; y < height - 3; y++) rgba[(y * width + 20) * 4 + 3] = 255;
    assert.deepEqual(visibleAlphaRows(rgba, width, height), {top:2,bottom:56});
    const old = {x:10,y:5,width:40,height:60};
    const trimmed = tightenedCrop(old, {width,height}, {top:2,bottom:56}, 25);
    assert.ok(Math.abs(trimmed.x - (11 + 2/3)) < 1e-10);
    assert.equal(trimmed.y, 7);
    assert.equal(trimmed.height, 55);
    assert.equal(trimmed.width * 3, trimmed.height * 2);
    assert.equal(tightenedCrop(old, {width,height}, {top:2,bottom:56}, 39), old,
        'a wide shape is never clipped in order to eliminate vertical margins');
});
