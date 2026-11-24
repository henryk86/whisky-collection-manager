/**
 * Server-safe photo adjustment validation; no translation or DOM dependencies.
 */
export const ADJUSTMENT_LIMITS = Object.freeze({
  exposure: [-2, 2],
  contrast: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  temperature: [-100, 100],
  tint: [-100, 100],
  saturation: [-100, 100],
  clarity: [-100, 100],
  sharpen: [0, 100],
});
export function validateAdjustmentValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some(key => !Object.hasOwn(ADJUSTMENT_LIMITS, key))) {
    const error = new RangeError('Invalid photo adjustments'); error.code =
      'INVALID_ADJUSTMENTS'; throw error;
  }
  const normalized = {};
  for (const [key, [min, max]] of Object.entries(ADJUSTMENT_LIMITS)) {
    const number = value[key] ?? 0;
    if (typeof number !== 'number' || !Number.isFinite(number) || number <
      min || number > max) {
      const error = new RangeError('Invalid adjustment value');
      error.code = 'INVALID_ADJUSTMENT_FIELD'; error.field = key; throw error;
    }
    normalized[key] = number;
  }
  return normalized;
}
