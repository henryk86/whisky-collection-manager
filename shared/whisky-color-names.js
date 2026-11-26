import {isAllowedWhiskyHex} from './whisky-colors.js';

/** Curated reference shades for describing *custom* whisky colours.
 * These are naming anchors, not choices in the twelve-colour selector.
 * Names are localized by the UI via `tasting.colorName.<key>`.
 */
export const WHISKY_COLOR_REFERENCES = Object.freeze([
  // Straw and pale yellow (1-7)
  ['veryPaleStraw', '#f7e9be'],
  ['paleWhiteWineYellow', '#f4e6b1'],
  ['lightStraw', '#f2de9b'],
  ['strawYellow', '#efd07a'],
  ['warmStraw', '#e9c366'],
  ['goldenStraw', '#deb75a'],
  ['darkStraw', '#cda44e'],
  // Gold and honey (8-16)
  ['lightGold', '#f2d06b'],
  ['yellowGold', '#eac252'],
  ['warmGold', '#e4b344'],
  ['richGold', '#dba13b'],
  ['darkGold', '#c59137'],
  ['lightHoneyGold', '#e8b85d'],
  ['honeyGold', '#dca44d'],
  ['darkHoneyGold', '#be8738'],
  ['antiqueGold', '#a8792f'],
  // Amber (17-25)
  ['paleAmber', '#e5ad63'],
  ['goldenAmber', '#dfa151'],
  ['lightAmber', '#d99545'],
  ['orangeAmber', '#d48237'],
  ['richAmber', '#c67832'],
  ['warmAmber', '#b86e31'],
  ['darkAmber', '#a9622f'],
  ['amberBrown', '#96562d'],
  ['deepAmber', '#854a29'],
  // Copper and rust (26-33)
  ['lightCopper', '#d58e67'],
  ['copperGold', '#cb8154'],
  ['copperOrange', '#c87342'],
  ['warmCopper', '#bd663e'],
  ['reddishCopper', '#b5573c'],
  ['copperRed', '#a94e36'],
  ['darkCopper', '#944a32'],
  ['rustCopper', '#87432e'],
  // Brown and caramel (34-40)
  ['lightCaramel', '#bc814c'],
  ['caramelBrown', '#a66b3c'],
  ['darkCaramel', '#90582f'],
  ['lightChestnutBrown', '#99603f'],
  ['chestnutBrown', '#814a34'],
  ['mahoganyBrown', '#713e31'],
  ['darkChocolateBrown', '#513028'],
  // Red and wine-red (41-45)
  ['brickRed', '#b45243'],
  ['rubyRed', '#a83e3e'],
  ['darkRubyRed', '#8b3237'],
  ['mahoganyRed', '#76312f'],
  ['wineRed', '#742d3a'],
  // Rosé and rosewood (46-50)
  ['paleRose', '#e6b6ab'],
  ['warmRose', '#d99a95'],
  ['roseGold', '#d08c80'],
  ['darkRose', '#bc7475'],
  ['rosewood', '#a96569'],
].map(([key, hex]) => Object.freeze({key, hex})));

/**
 * sRGB -> OKLab. Perceptual distance is much more useful for naming adjacent
 * warm shades than raw RGB or hue distances.
 *
 * @param {*} hex Hex used by this operation.
 * @return {!Array<number>} Resulting list of values.
 */
function oklab(hex) {
  const rgb = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
const references = WHISKY_COLOR_REFERENCES.map(({key, hex}) => {
  const lab = oklab(hex);
  return {key, lab, chroma: Math.hypot(lab[1], lab[2])};
});

// Plain OKLab distance can name a pale pink as pale straw: their lightness
// matches even though their hue differs greatly. Weight the hue separation
// more strongly, while still comparing lightness and chroma continuously.
const HUE_WEIGHT = 8;
/**
 * Calculates the naming distance numeric value.
 *
 * @param {*} lab Value used by this operation.
 * @param {*} chroma Value used by this operation.
 * @param {*} reference Reference value to compare against.
 * @return {number} Calculated numeric value.
 */
function namingDistance(lab, chroma, reference) {
  const lightnessDifference = lab[0] - reference.lab[0];
  const chromaDifference = chroma - reference.chroma;
  const chromaDot = lab[1] * reference.lab[1] + lab[2] * reference.lab[2];
  // 2 * C1 * C2 * (1 - cos(delta hue)), without angular discontinuities.
  const hueDifferenceSquared = Math.max(0, 2 * (chroma * reference.chroma - chromaDot));
  return lightnessDifference ** 2 + chromaDifference ** 2 + HUE_WEIGHT * hueDifferenceSquared;
}

/**
 * Stable, locale-independent name key. The original HEX is never rounded or
 * changed.
 *
 * @param {*} hex Hex used by this operation.
 * @return {?string} Translation key of the closest named whisky color, or null for disallowed colors.
 */
export function whiskyColorNameKey(hex) {
  if (!isAllowedWhiskyHex(hex)) return null;
  const lab = oklab(hex), chroma = Math.hypot(lab[1], lab[2]);
  let nearest = null, minimum = Infinity;
  for (const ref of references) {
    const distance = namingDistance(lab, chroma, ref);
    if (distance < minimum) {minimum = distance; nearest = ref.key;}
  }
  return nearest;
}
