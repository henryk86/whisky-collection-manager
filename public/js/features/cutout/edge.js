import { t } from '../../i18n/index.js';
/** Reduce the broad, semi-transparent U2Netp fringe without introducing a hard jagged contour.
 * The input is unpremultiplied RGBA from Canvas ImageData; RGB remains untouched.
 * Apply AFTER resampling/rotation, so the transition is narrow in final image pixels.
 */
export const EDGE_ALPHA_LOW = 110;
export const EDGE_ALPHA_HIGH = 190;

export function sharpenCutoutAlpha(rgba) {
    if (!rgba || rgba.length % 4 !== 0) throw new Error(t('errors.images.invalidRgba'));
    for (let index = 3; index < rgba.length; index += 4) {
        const alpha = rgba[index];
        if (alpha <= EDGE_ALPHA_LOW) {
            rgba[index] = 0;
        } else if (alpha >= EDGE_ALPHA_HIGH) {
            rgba[index] = 255;
        } else {
            const t = (alpha - EDGE_ALPHA_LOW) / (EDGE_ALPHA_HIGH - EDGE_ALPHA_LOW);
            // Smoothstep preserves a short antialias band rather than a jagged hard threshold.
            rgba[index] = Math.round(255 * t * t * (3 - 2 * t));
        }
    }
    return rgba;
}
