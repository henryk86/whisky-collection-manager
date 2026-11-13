import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_PHOTO_ADJUSTMENTS, PHOTO_ADJUSTMENT_FIELDS, photoAdjustmentsChanged,
    validatePhotoAdjustments, adjustPhotoPixels, autoPhotoAdjustments,
    resetPhotoAdjustmentGroup, whiteBalanceFromArea} from '../../public/js/features/photo-editor/adjustments.js';
import {basePhotoPath, displayPhotoPath, editorPhotoSourceSettings} from '../../public/js/domain/photo-images.js';

test('photo corrections accept only bounded, finite, explicitly supported controls', () => {
    assert.equal(PHOTO_ADJUSTMENT_FIELDS.length, 9);
    assert.deepEqual(validatePhotoAdjustments({}), EMPTY_PHOTO_ADJUSTMENTS);
    for (const value of [{exposure:2.5},{contrast:101},{temperature:-101},{sharpen:-1},
        {shadows:'50'},{exposure:Infinity},{exposure:NaN},{foo:1},null,[]])
        assert.throws(() => validatePhotoAdjustments(value));
    assert.equal(photoAdjustmentsChanged({}), false);
    assert.equal(photoAdjustmentsChanged({highlights:-15}), true);
});

test('pixel corrections preserve alpha, keep a neutral edit pixel-exact, and process all light/color controls', () => {
    const pixels = {width:3,height:2,data: new Uint8ClampedArray([
        20,35,50,255, 100,100,100,255, 240,225,215,255,
        250,250,250,0, 90,40,20,128, 12,18,25,255
    ])};
    assert.deepEqual(adjustPhotoPixels(pixels, {}), pixels);
    const all = {exposure:.5,contrast:16,highlights:-30,shadows:35,temperature:-15,
        tint:10,saturation:12,clarity:15,sharpen:22};
    const result = adjustPhotoPixels(pixels, all);
    assert.equal(result.data.length, pixels.data.length);
    assert.equal(result.data[15],0);
    assert.equal(result.data[19],128);
    assert.notDeepEqual(result.data,pixels.data);
    assert.equal(pixels.data[0],20,'source bytes must not be mutated');
    assert.deepEqual(adjustPhotoPixels(pixels,all).data,result.data,'repeatable render');
    assert.equal(adjustPhotoPixels({width:1,height:1,data:new Uint8ClampedArray([40,50,60,255])},{exposure:1}).data[0] > 40,true);
    assert.equal(adjustPhotoPixels({width:1,height:1,data:new Uint8ClampedArray([40,50,60,255])},{exposure:-1}).data[0] < 40,true);
    assert.throws(() => adjustPhotoPixels({width:2,height:1,data:new Uint8Array(4)},{}));
});

test('automatic correction only samples the opaque subject and remains within accepted slider limits', () => {
    const source = {width:2,height:2,data:new Uint8ClampedArray([
        30,25,18,255, 25,25,25,255, 255,255,255,0, 28,24,20,255
    ])};
    const result = autoPhotoAdjustments(source);
    assert.deepEqual(validatePhotoAdjustments(result),result);
    assert.ok(result.exposure > 0);
    assert.deepEqual(autoPhotoAdjustments({data:new Uint8ClampedArray(0)}),EMPTY_PHOTO_ADJUSTMENTS);
});

test('edited image only overrides its source, retaining original/cutout independent', () => {
    const photo = {path:'images/example/original.png',cutout:{path:'images/example/cutout.png',selected:false},
        adjustment:{path:'images/example/edit.webp',sourcePath:'images/example/original.png',settings:{}}};
    assert.equal(displayPhotoPath(photo),photo.adjustment.path);
    photo.cutout.selected = true;
    assert.equal(basePhotoPath(photo),photo.cutout.path);
    assert.equal(displayPhotoPath(photo),photo.cutout.path);
    photo.cutout.selected = false;
    assert.equal(displayPhotoPath(photo),photo.adjustment.path);
});


test('reset icons clear only their own adjustment group', () => {
    const current = {exposure: .8, contrast: 20, shadows: 15, highlights: -18,
        temperature: -25, tint: 12, saturation: 9, clarity: 30, sharpen: 40};
    const light = resetPhotoAdjustmentGroup(current, 'light');
    assert.deepEqual([light.exposure, light.contrast, light.shadows, light.highlights], [0,0,0,0]);
    assert.equal(light.temperature, -25);
    assert.equal(light.clarity, 30);
    assert.equal(resetPhotoAdjustmentGroup(current, 'color').temperature, 0);
    assert.equal(resetPhotoAdjustmentGroup(current, 'color').exposure, .8);
    assert.equal(resetPhotoAdjustmentGroup(current, 'detail').sharpen, 0);
    assert.equal(current.exposure, .8, 'original values must not mutate');
    assert.throws(() => resetPhotoAdjustmentGroup(current, 'unknown'), RangeError);
});

test('white-balance eyedropper neutralizes selected gray region and leaves other sliders alone', () => {
    const original = {width: 24, height: 18, data: new Uint8ClampedArray(24*18*4)};
    for (let y=0; y<18; y++) for (let x=0; x<24; x++) {
        const i=(y*24+x)*4;
        original.data.set(x < 4 ? [0,255,0,0] : [168,150,128,255],i);
    }
    const originalCopy = new Uint8ClampedArray(original.data);
    const base = {contrast: 9, exposure: .2, temperature: 50, tint: -10, sharpen: 8};
    const result = whiteBalanceFromArea(original, {x: 5,y: 2,width: 17,height: 12}, base);
    assert.ok(result.temperature < 0, `expected cooler compensation, received ${result.temperature}`);
    assert.ok(result.tint !== base.tint);
    assert.equal(result.exposure, base.exposure);
    assert.equal(result.contrast, base.contrast);
    assert.equal(result.sharpen, base.sharpen);
    assert.deepEqual(original.data, originalCopy, 'sampling must never alter the original');
    const corrected = adjustPhotoPixels(original,result).data.slice(4*6,4*6+3);
    assert.ok(Math.max(...corrected)-Math.min(...corrected) < 4,
        `neutral reference should render close to gray: ${corrected}`);
    // Picking a different area, containing no opaque reference, does not guess.
    assert.throws(() => whiteBalanceFromArea(original,{x:0,y:0,width:3,height:12},base),RangeError);
    assert.throws(() => whiteBalanceFromArea(original,{x:-100,y:0,width:10,height:5},base),RangeError);
    assert.throws(() => whiteBalanceFromArea(original,{x:5,y:2,width:-1,height:6},base),RangeError);
});

test('white-balance eyedropper rejects clipped highlights instead of inventing settings', () => {
    const source={width:8,height:8,data:new Uint8ClampedArray(8*8*4)};
    for(let i=0;i<source.data.length;i+=4)source.data.set([255,255,255,255],i);
    assert.throws(() => whiteBalanceFromArea(source,{x:0,y:0,width:8,height:8}),RangeError);
});

test('photo editor opens a newly uploaded image without cutout or adjustments', () => {
    for (const photo of [
        {id:'fresh', path:'photos/new.png'},
        {id:'fresh-without-image-path'},
        {id:'fresh-null-cutout', path:'photos/new.png', cutout:null},
        {id:'fresh-empty-cutout', path:'photos/new.png', cutout:{}},
        {id:'fresh-null-adjustment', path:'photos/new.png', adjustment:null}
    ]) {
        const settings = editorPhotoSourceSettings(photo);
        assert.deepEqual(settings,{original:null,cutout:null});
        assert.deepEqual(validatePhotoAdjustments(settings.original || EMPTY_PHOTO_ADJUSTMENTS),EMPTY_PHOTO_ADJUSTMENTS);
    }
});

test('photo editor preserves original and cutout settings independently', () => {
    const photo = {path:'photos/original.jpg',adjustment:{sourcePath:'photos/original.jpg',settings:{exposure:.7}},
        cutout:{path:'photos/cutout.png',selected:true,adjustment:{sourcePath:'photos/cutout.png',settings:{contrast:12}}}};
    assert.deepEqual(editorPhotoSourceSettings(photo),{original:{exposure:.7},cutout:{contrast:12}});
    delete photo.cutout.adjustment;
    assert.deepEqual(editorPhotoSourceSettings(photo),{original:{exposure:.7},cutout:{exposure:.7}},
        'legacy cutouts inherit the original adjustments when no cutout correction exists');
    photo.adjustment={sourcePath:photo.cutout.path,settings:{shadows:15}};
    assert.deepEqual(editorPhotoSourceSettings(photo),{original:null,cutout:{shadows:15}});
});
