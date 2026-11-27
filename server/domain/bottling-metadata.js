/** Derived response metadata; never part of persisted collection records. */

/**
 * Adds the complete release label without altering the canonical input fields.
 * @template {{name: string, subtitle?: string|null}} T
 * @param {T} bottling Validated owned or external release metadata.
 * @return {T & {fullName: string}} Independent response record with derived name.
 */
export function bottlingMetadata(bottling) {
  return {...bottling, fullName: [bottling.name, bottling.subtitle?.trim()].filter(Boolean).join(' · ')};
}

/**
 * Adds release metadata to an external tasting response.
 * @param {import('../../shared/types.js').StandaloneTasting} record Stored external tasting.
 * @return {import('../../shared/types.js').StandaloneTasting} Response with derived release name.
 */
export function externalTastingMetadata(record) {
  return {...record, bottling: bottlingMetadata(record.bottling)};
}

/**
 * Projects the complete collection response and state-delta baseline from canonical storage.
 * @param {import('../../shared/types.js').Collection} collection Validated logical collection.
 * @return {import('../../shared/types.js').Collection} Response snapshot with derived release labels.
 */
export function collectionMetadata(collection) {
  return {
    ...collection,
    bottlings: collection.bottlings.map(bottlingMetadata),
    externalTastings: collection.externalTastings.map(externalTastingMetadata),
  };
}

/**
 * Removes read-only metadata from a submitted collection snapshot before migration and validation.
 * @param {*} source Untrusted JSON import; malformed shapes remain subject to validation.
 * @return {*} Independent canonical import candidate.
 */
export function canonicalCollectionInput(source) {
  const collection = structuredClone(source);
  if (Array.isArray(collection?.bottlings)) {
    for (const bottling of collection.bottlings) {
      if (bottling && typeof bottling === 'object') delete bottling.fullName;
    }
  }
  if (Array.isArray(collection?.externalTastings)) {
    for (const record of collection.externalTastings) {
      if (record?.bottling && typeof record.bottling === 'object') delete record.bottling.fullName;
    }
  }
  return collection;
}
