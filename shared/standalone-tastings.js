/**
 * A standalone tasting owns its whisky reference; it is not an inventory
 * bottling.
 */
import {normalizeTastingSubject} from './tasting-subject.js';
import {normalizeTastingRecord, VALID_TASTING_FIELDS}
  from './tasting-records.js';

const ALLOWED = new Set(['bottling', ...VALID_TASTING_FIELDS]);
/**
 * Normalizes standalone tasting for standalone tastings.
 *
 * @param {*} input Input to process.
 * @param {!Object=} previous Previous used by this operation.
 * @return {*} Structured result assembled from the input data.
 */
export function normalizeStandaloneTasting(input, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !ALLOWED.has(key))) throw new Error('Ungültige externe Verkostung');
  const bottling = normalizeTastingSubject(input.bottling ?? previous.bottling ?? {}, previous.bottling ?? {});
  const tastingInput = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'bottling'));
  const {id, createdAt, updatedAt, bottling: previousBottling, ...previousTasting} = previous;
  return {bottling, ...normalizeTastingRecord(tastingInput, previousTasting)};
}

/**
 * Collects the standalone tastings stored outside owned bottlings.
 *
 * @param {!Object} collection Collection data being processed.
 * @return {*} Result computed from the supplied inputs.
 */
export function allStandaloneTastings(collection) {
  return collection.externalTastings || [];
}
