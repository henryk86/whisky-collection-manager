import { t } from '../../i18n/index.js';
/** Reversible editing parameters: original/cutout image files are never modified. */
export const PHOTO_ADJUSTMENT_GROUPS = Object.freeze([
    { key: 'light', sliders: [
        { key: 'exposure', min: -2, max: 2, step: .05 },
        { key: 'contrast', min: -100, max: 100, step: 1 },
        { key: 'highlights', min: -100, max: 100, step: 1 },
        { key: 'shadows', min: -100, max: 100, step: 1 }
    ] },
    { key: 'color', sliders: [
        { key: 'temperature', min: -100, max: 100, step: 1 },
        { key: 'tint', min: -100, max: 100, step: 1 },
        { key: 'saturation', min: -100, max: 100, step: 1 }
    ] },
    { key: 'detail', sliders: [
        { key: 'clarity', min: -100, max: 100, step: 1 },
        { key: 'sharpen', min: 0, max: 100, step: 1 }
    ] }
]);
export const PHOTO_ADJUSTMENT_FIELDS = Object.freeze(PHOTO_ADJUSTMENT_GROUPS.flatMap(group => group.sliders));
export const EMPTY_PHOTO_ADJUSTMENTS = Object.freeze(Object.fromEntries(PHOTO_ADJUSTMENT_FIELDS.map(({key}) => [key, 0])));
const clip = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/** Reject unknown keys and non-finite numeric values at the server boundary. */
export function validatePhotoAdjustments(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !PHOTO_ADJUSTMENT_FIELDS.some(field => field.key === key)))
        throw new RangeError(t('errors.photoEditor.invalidAdjustments'));
    const result = {};
    for (const {key, min, max} of PHOTO_ADJUSTMENT_FIELDS) {
        const number = value[key] ?? 0;
        if (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max)
            throw new RangeError(t('errors.photoEditor.invalidAdjustmentValue', {field: key}));
        result[key] = number;
    }
    return result;
}
export const photoAdjustmentsChanged = value => PHOTO_ADJUSTMENT_FIELDS.some(({key}) => Number(value?.[key] || 0) !== 0);

/** Reset only one editor group; all other adjustments remain untouched. */
export function resetPhotoAdjustmentGroup(current, groupKey) {
    const group = PHOTO_ADJUSTMENT_GROUPS.find(entry => entry.key === groupKey);
    if (!group) throw new RangeError(t('errors.photoEditor.invalidGroup'));
    const next = validatePhotoAdjustments(current);
    for (const {key} of group.sliders) next[key] = 0;
    return next;
}

/**
 * Derive a neutral white balance from a user-selected rectangle in ORIGINAL image pixels.
 * Existing non-WB adjustments are taken into account; original pixels are never changed.
 * Transparent, nearly black and clipped pixels cannot provide reliable color information.
 */
export function whiteBalanceFromArea(source, area, current = EMPTY_PHOTO_ADJUSTMENTS) {
    const settings = validatePhotoAdjustments(current);
    const {width, height, data} = source || {};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        !data || data.length !== width * height * 4 ||
        !area || ![area.x,area.y,area.width,area.height].every(Number.isFinite) ||
        area.width <= 0 || area.height <= 0)
        throw new RangeError(t('errors.photoEditor.invalidWhiteBalanceArea'));
    const x0 = Math.max(0, Math.floor(area.x));
    const x1 = Math.min(width, Math.ceil(area.x + area.width));
    const y0 = Math.max(0, Math.floor(area.y));
    const y1 = Math.min(height, Math.ceil(area.y + area.height));
    if (x1 <= x0 || y1 <= y0) throw new RangeError(t('errors.photoEditor.invalidWhiteBalanceArea'));
    // Do not compensate the pre-existing WB a second time. Estimate both WB controls
    // afresh from the reference, while preserving exposure and other corrections.
    const neutral = adjustPhotoPixels(source, {...settings, temperature: 0, tint: 0});
    const stride = Math.max(1, Math.floor(Math.sqrt((x1-x0)*(y1-y0)/32000)));
    let r = 0, g = 0, b = 0, count = 0;
    for (let y = y0; y < y1; y += stride) for (let x = x0; x < x1; x += stride) {
        const i = (y * width + x) * 4;
        const red = neutral.data[i], green = neutral.data[i+1], blue = neutral.data[i+2];
        if (data[i+3] < 192 || Math.min(red,green,blue) < 12 || Math.max(red,green,blue) > 247) continue;
        r += red; g += green; b += blue; count++;
    }
    if (!count) throw new RangeError(t('errors.photoEditor.noWhiteBalancePixels'));
    r /= count; g /= count; b /= count;
    // Invert the exact RGB gain model used by adjustPhotoPixels:
    // r*(1+.18*T+.065*I) = g*(1-.12*I) = b*(1-.18*T+.065*I)
    // where T/I are temperature/tint divided by 100.
    const a = .18*r, c = .065*r + .12*g;
    const d = -.18*b, e = .065*b + .12*g;
    const det = a*e - c*d;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-6)
        throw new RangeError(t('errors.photoEditor.noWhiteBalancePixels'));
    const temperature = Math.round(clip(((g-r)*e - c*(g-b))/det*100, -100, 100));
    const tint = Math.round(clip((a*(g-b) - d*(g-r))/det*100, -100, 100));
    return {...settings, temperature, tint};
}

/** Separable alpha-aware box blur of luminance for local contrast / unsharp masking. */
function blurLuma(data, width, height, radius) {
    const count = width * height;
    const temp = new Float32Array(count);
    const dest = new Float32Array(count);
    const luma = new Float32Array(count);
    const alpha = new Float32Array(count);
    for (let p = 0; p < count; p++) {
        const i = p * 4;
        alpha[p] = data[i + 3] / 255;
        luma[p] = (.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]) / 255 * alpha[p];
    }
    const tempAlpha = new Float32Array(count);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let total = 0, weight = 0;
        for (let offset = -radius; offset <= radius; offset++) {
            const q = y * width + Math.max(0, Math.min(width - 1, x + offset));
            total += luma[q]; weight += alpha[q];
        }
        const p = y * width + x;
        temp[p] = total;
        tempAlpha[p] = weight;
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let total = 0, weight = 0;
        for (let offset = -radius; offset <= radius; offset++) {
            const q = Math.max(0, Math.min(height - 1, y + offset)) * width + x;
            total += temp[q]; weight += tempAlpha[q];
        }
        dest[y * width + x] = weight ? total / weight : 0;
    }
    return dest;
}

/** Pure image processing, independent of Canvas/DOM. Preserves every alpha byte. */
export function adjustPhotoPixels(source, values) {
    const settings = validatePhotoAdjustments(values);
    const {width, height, data} = source;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        !data || data.length !== width * height * 4)
        throw new TypeError(t('errors.images.invalidData'));
    const result = new Uint8ClampedArray(data);
    if (!photoAdjustmentsChanged(settings)) return {width, height, data:result};
    const ev = 2 ** settings.exposure;
    const contrast = 1 + settings.contrast / 125;
    const temperature = settings.temperature / 100;
    const tint = settings.tint / 100;
    const saturation = 1 + settings.saturation / 100;
    const rFactor = 1 + temperature * .18 + tint * .065;
    const gFactor = 1 - tint * .12;
    const bFactor = 1 - temperature * .18 + tint * .065;
    const clarity = settings.clarity / 100;
    const sharpen = settings.sharpen / 100;
    const broad = clarity ? blurLuma(data, width, height, 4) : null;
    const narrow = sharpen ? blurLuma(data, width, height, 1) : null;
    for (let i = 0; i < result.length; i += 4) {
        const alpha = result[i + 3];
        if (!alpha) continue;
        const oldR = data[i] / 255, oldG = data[i + 1] / 255, oldB = data[i + 2] / 255;
        // EV in an approximate linear-light domain (sRGB exponent 2).
        let r = Math.sqrt(oldR * oldR * ev) * rFactor;
        let g = Math.sqrt(oldG * oldG * ev) * gFactor;
        let b = Math.sqrt(oldB * oldB * ev) * bFactor;
        const luminosity = clip(.2126 * r + .7152 * g + .0722 * b);
        const shadowMask = (1 - luminosity) ** 2;
        const highlightMask = luminosity ** 2;
        const change = settings.shadows / 100 * .60 * shadowMask +
            settings.highlights / 100 * .55 * highlightMask;
        // A multiplicative lift/reduction respects dark glass and avoids hard edges.
        const gain = Math.max(0, 1 + change);
        r *= gain; g *= gain; b *= gain;
        r = (r - .5) * contrast + .5;
        g = (g - .5) * contrast + .5;
        b = (b - .5) * contrast + .5;
        const gray = .2126 * r + .7152 * g + .0722 * b;
        r = gray + (r - gray) * saturation;
        g = gray + (g - gray) * saturation;
        b = gray + (b - gray) * saturation;
        const pixel = i / 4;
        const sourceLuma = .2126 * oldR + .7152 * oldG + .0722 * oldB;
        const detailGain = (broad ? (sourceLuma - broad[pixel]) * clarity * .85 : 0) +
            (narrow ? (sourceLuma - narrow[pixel]) * sharpen * 1.10 : 0);
        result[i] = Math.round(clip(r + detailGain) * 255);
        result[i + 1] = Math.round(clip(g + detailGain) * 255);
        result[i + 2] = Math.round(clip(b + detailGain) * 255);
    }
    return {width, height, data:result};
}

/** Conservative automatic correction from opaque image samples only. */
export function autoPhotoAdjustments(source) {
    const {data} = source;
    if (!data?.length) return {...EMPTY_PHOTO_ADJUSTMENTS};
    let total = 0, rTotal = 0, bTotal = 0, samples = 0, min = 1, max = 0;
    const stride = Math.max(1, Math.floor(data.length / 4 / 35000));
    for (let i = 0; i < data.length; i += 4 * stride) {
        if (data[i + 3] < 192) continue;
        const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
        const y = .2126 * r + .7152 * g + .0722 * b;
        // Ignore near-white background, which otherwise dominates bottle cutouts.
        if (y > .97 && Math.max(r,g,b) - Math.min(r,g,b) < .025) continue;
        total += y; min = Math.min(min, y); max = Math.max(max, y);
        if (y > .17 && y < .84 && Math.max(r,g,b) - Math.min(r,g,b) < .32) {
            rTotal += r - b; bTotal++;
        }
        samples++;
    }
    if (!samples) return {...EMPTY_PHOTO_ADJUSTMENTS};
    const mean = total / samples;
    const temp = bTotal ? Math.round(clip(-rTotal / bTotal * 140, -30, 30)) : 0;
    return {
        ...EMPTY_PHOTO_ADJUSTMENTS,
        exposure: Math.round(clip(Math.log2(.43 / Math.max(.12, mean)), -.5, .65) * 20) / 20,
        contrast: max - min < .55 ? 12 : 4,
        highlights: max > .89 ? -22 : -8,
        shadows: min < .18 ? 22 : 8,
        temperature: temp,
        clarity: 9,
        sharpen: 12
    };
}
