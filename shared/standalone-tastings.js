/**
 * A standalone tasting owns its whisky reference; it is not an inventory
 * bottling.
 */
import {normalizeTastingSubject} from './tasting-subject.js';
import {normalizeTastingRecord, VALID_TASTING_FIELDS}
  from './tasting-records.js';

const ALLOWED = new Set(['bottling', ...VALID_TASTING_FIELDS]);
/**
 * Validates a standalone tasting together with its embedded, non-inventory whisky reference.
 *
 * @param {*} input Untrusted tasting and optional subject fields.
 * @param {Partial<import('./types.js').StandaloneTasting>=} previous Previous record retained on update.
 * @return {Omit<import('./types.js').StandaloneTasting, 'id'|'createdAt'|'updatedAt'>} Validated subject and tasting fields, without persistence metadata.
 * @throws {Error} For invalid subject or tasting fields.
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
 * @param {import('./types.js').Collection} collection Stored collection.
 * @return {import('./types.js').StandaloneTasting[]} Existing external tasting array, or an empty array for legacy collections.
 */
export function allStandaloneTastings(collection) {
  return collection.externalTastings || [];
}
