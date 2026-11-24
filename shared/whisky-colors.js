/** Immutable, theme-independent twelve-step whisky colour reference scale. */
export const WHISKY_COLORS = Object.freeze([
  {key: 'new_make', hex: '#f9f6de'}, {key: 'white_wine', hex: '#f6efb6'},
  {key: 'butter', hex: '#f3e579'}, {key: 'straw', hex: '#efd04b'},
  {key: 'honey', hex: '#e8b12b'}, {key: 'gold', hex: '#e49a1b'},
  {key: 'amber', hex: '#d17b20'}, {key: 'reddish_brown', hex: '#b65c2a'},
  {key: 'rust', hex: '#ad4628'}, {key: 'copper', hex: '#922c2a'},
  {key: 'brandy', hex: '#824044'}, {key: 'chocolate', hex: '#50392d'},
]);

const CUSTOM_PREFIX = 'custom:';
const CUSTOM_HEX = /^#[0-9a-f]{6}$/i;
const clamp = value => Math.max(
  0,
  Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0)
);

function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), difference =
    max - min;
  const lightness = (max + min) / 2;
  const saturation = difference === 0 ? 0 : difference / (1 - Math.abs(2 *
    lightness - 1));
  let hue = 0;
  if (difference !== 0) {
    if (max === r) hue = ((g - b) / difference) % 6;
    else if (max === g) hue = (b - r) / difference + 2;
    else hue = (r - g) / difference + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return {hue, saturation, lightness};
}

/**
 * Validate real HEX shades in the warm whisky range, including red and rose.
 */
export function isAllowedWhiskyHex(hex) {
  if (typeof hex !== 'string' || !CUSTOM_HEX.test(hex)) return false;
  const {hue, saturation, lightness} = hexToHsl(hex);
  // No green, blue, grey or neon-magenta. Pale straw, dark brown, red and rose
  // remain possible.
  return (hue >= 338 || hue <= 60) && saturation >= 0.20 && lightness >=
    0.15 && lightness <= 0.94;
}

function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const channel = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Position in the constrained 2D picker -> actual 24-bit RGB colour, not a
 * palette index.
 */
export function whiskyPickerHex(x, y) {
  const h = (340 + 78 * clamp(x)) % 360;
  const depth = clamp(y);
  return hslToHex(h, 0.53 + 0.19 * depth, 0.89 - 0.67 * depth);
}

/** Position the picker marker when editing a previously saved HEX colour. */
export function whiskyPickerPosition(hex) {
  const {hue, lightness} = hexToHsl(hex);
  const unwrapped = hue < 338 ? hue + 360 : hue;
  return {
    x: clamp((unwrapped - 340) / 78), y: clamp((0.89 -
      lightness) / 0.67),
  };
}

/**
 * Saved data: existing fixed colour keys or a validated custom:#rrggbb value.
 */
export function normalizeWhiskyColor(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Ungültige Whiskyfarbe');
  if (WHISKY_COLORS.some(color => color.key === value)) return value;
  if (value.startsWith(CUSTOM_PREFIX) &&
    isAllowedWhiskyHex(value.slice(CUSTOM_PREFIX.length)))
    return `${CUSTOM_PREFIX}${value.slice(CUSTOM_PREFIX.length).toLowerCase()}`;
  throw new Error('Ungültige Whiskyfarbe');
}

export function isCustomWhiskyColor(value) {
  return typeof value === 'string' && value.startsWith(CUSTOM_PREFIX) &&
    isAllowedWhiskyHex(value.slice(CUSTOM_PREFIX.length));
}

export function resolveWhiskyColor(value) {
  const fixed = WHISKY_COLORS.find(color => color.key === value);
  if (fixed) return fixed;
  if (isCustomWhiskyColor(value)) return {key: value, hex: value.slice(CUSTOM_PREFIX.length).toLowerCase()};
  return null;
}
