import { MODEL_SIZE, segment } from './model.js';
import { analyzeBottleMask, cutoutOutputSize, tightenedCrop, visibleAlphaRows } from './crop.js';
import { sharpenCutoutAlpha } from './edge.js';

async function loadImage(url) {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    if (typeof image.decode === 'function') await image.decode();
    else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Foto konnte nicht geöffnet werden');
    return image;
}

function canvas(width, height) {
    const result = document.createElement('canvas');
    result.width = width;
    result.height = height;
    return result;
}

/** Composite a precomputed segmentation mask; keeps inference separate from image geometry. */
export function composeCutout(image, rawMask) {
    const geometry = analyzeBottleMask(rawMask, MODEL_SIZE, MODEL_SIZE, image.naturalWidth, image.naturalHeight);
    const sourceMask = canvas(MODEL_SIZE, MODEL_SIZE);
    const maskContext = sourceMask.getContext('2d');
    const pixels = maskContext.createImageData(MODEL_SIZE, MODEL_SIZE);
    for (let i = 0; i < geometry.mask.length; i++) {
        pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = 255;
        pixels.data[i * 4 + 3] = geometry.mask[i];
    }
    maskContext.putImageData(pixels, 0, 0);

    function render(crop, size) {
        const result = canvas(size.width, size.height);
        const context = result.getContext('2d', {willReadFrequently:true});
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        const scale = size.height / crop.height;
        // Both the photograph and its segmentation mask use precisely the same transform.
        context.setTransform(scale, 0, 0, scale, -crop.x * scale, -crop.y * scale);
        context.translate(geometry.center.x, geometry.center.y);
        context.rotate(geometry.rotation);
        context.translate(-geometry.center.x, -geometry.center.y);
        context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
        context.globalCompositeOperation = 'destination-in';
        context.drawImage(sourceMask, 0, 0, image.naturalWidth, image.naturalHeight);
        context.globalCompositeOperation = 'source-over';
        context.resetTransform();
        // The segmentation model produces a wide semi-transparent halo at glass edges.
        // Refine the final-resolution alpha after resampling, but retain a narrow
        // antialias transition so rounded bottle edges do not become pixelated.
        const frame = context.getImageData(0, 0, size.width, size.height);
        sharpenCutoutAlpha(frame.data);
        context.putImageData(frame, 0, 0);
        return result;
    }

    for (const maxSide of [1600, 1280, 1024, 800]) {
        let crop = geometry.crop;
        let size = cutoutOutputSize(crop, maxSide);
        let output = render(crop, size);
        // Model-pixel boundaries and canvas interpolation can leave a blank output row.
        // Check the actual alpha pixels and remove that row without changing the 2:3 ratio.
        if (geometry.verticallyTight) {
            for (let pass = 0; pass < 2; pass++) {
                const context = output.getContext('2d', {willReadFrequently:true});
                const visible = visibleAlphaRows(context.getImageData(0, 0, size.width, size.height).data,
                    size.width, size.height);
                const next = tightenedCrop(crop, size, visible, geometry.objectWidth);
                if (next === crop) break;
                crop = next;
                size = cutoutOutputSize(crop, maxSide);
                output = render(crop, size);
            }
        }
        const data = output.toDataURL('image/png');
        if (data.length < 13000000) return data;
    }
    throw new Error('Freigestelltes Bild ist zu groß');
}

/** Segment locally in the browser, then composite without changing the original photo. */
export async function cutoutImage(url, onProgress = () => {}) {
    onProgress('loading');
    const image = await loadImage(url);
    const input = canvas(MODEL_SIZE, MODEL_SIZE);
    const inputContext = input.getContext('2d', {willReadFrequently:true});
    inputContext.drawImage(image, 0, 0, MODEL_SIZE, MODEL_SIZE);
    onProgress('segmenting');
    const mask = await segment(inputContext.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE));
    onProgress('compositing');
    return composeCutout(image, mask);
}
