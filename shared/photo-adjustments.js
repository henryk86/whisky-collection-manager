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
/**
 * Complete normalized editing state; exposure is in stops, other adjustments
 * use the signed slider range (sharpen is non-negative).
 * @typedef {Record<keyof typeof ADJUSTMENT_LIMITS, number>} PhotoAdjustments
 */
/**
 * Validates the adjustment object against the supported slider limits.
 *
 * @param {*} value Untrusted adjustment object; omitted fields default to zero.
 * @return {PhotoAdjustments} Complete finite, range-checked adjustment values.
 * @throws {RangeError} For a non-object, an unknown key or an out-of-range field.
 */
export function validateAdjustmentValues(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some(key => !Object.hasOwn(ADJUSTMENT_LIMITS, key))) {
    throw Object.assign(new RangeError('Invalid photo adjustments'), {code: 'INVALID_ADJUSTMENTS'});
  }
  const normalized = {};
  for (const [key, [min, max]] of Object.entries(ADJUSTMENT_LIMITS)) {
    const number = value[key] ?? 0;
    if (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max) {
      throw Object.assign(new RangeError('Invalid adjustment value'), {code: 'INVALID_ADJUSTMENT_FIELD', field: key});
    }
    normalized[key] = number;
  }
  // The loop assigns every key in ADJUSTMENT_LIMITS before returning.
  return /** @type {PhotoAdjustments} */ (normalized);
}
