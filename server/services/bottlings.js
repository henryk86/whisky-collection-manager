import {change} from '../storage/collection-store.js';
import {normalizeBottle, normalizeBottling} from '../domain/normalization.js';
import {markNumber} from '../domain/inventory.js';
import {now, uid} from '../domain/collection.js';
import {fail} from '../domain/errors.js';
import {detachTastings} from '../../shared/tasting-flights.js';
/**
 * Validates distilleries against its constraints.
 *
 * @param {*} collection Collection data to process.
 * @param {*} bottling Bottling record being inspected or updated.
 */
function checkDistilleries(collection, bottling) {
  const knownIds = new Set(collection.distilleries.map(distillery => distillery.id));
  if (bottling.distilleryIds.some(id => !knownIds.has(id))) {
    throw fail('Unbekannte Destillerie', 400, "api.errors.unknownDistillery");
  }
}

/**
 * Create a bottling and its first physical bottle in one transaction.
 *
 * @param {*} input Input to process.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export function createBottling(input) {
  return change(collection => {
    const timestamp = now();
    const bottling = {
      ...normalizeBottling(input),
      id: uid(),
      bottles: [],
      tastings: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    checkDistilleries(collection, bottling);
    const bottle = {
      ...normalizeBottle(input.firstBottle || {}),
      id: uid(),
      photos: [],
      files: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    if (bottle.volumeType === 'standard' && bottle.volumeMl == null && bottling.volumeMl != null) {
      bottle.volumeMl = bottling.volumeMl;
    }
    markNumber(collection, bottle.inventoryNumber);
    bottling.bottles.push(bottle);
    collection.bottlings.push(bottling);
    return {
      bottling, bottle,
    };
  });
}

/**
 * Updates bottling for bottlings.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} input Input to process.
 * @return {Promise<import('../../shared/types.js').Bottling>} Promise fulfilled when the operation
 * completes.
 */
export function updateBottling(id, input) {
  return change(collection => {
    const bottling = collection.bottlings.find(entry => entry.id === id);
    if (!bottling) {
      throw fail('Abfüllung nicht gefunden', 404, "api.errors.bottlingNotFound");
    }
    if ([
      'rating',
      'tastingNotes',
      'flavorProfile',
      'whiskyColor',
      'legacyTastings',
    ].some(key => Object.hasOwn(input, key)))
      throw fail(
        'Verkostungsdaten dürfen nur innerhalb einer Verkostung geändert werden',
        400,
        "api.errors.tastingDataRequiresTasting"
      );
    const updated = normalizeBottling(input, bottling);
    checkDistilleries(collection, updated);
    Object.assign(bottling, updated, {updatedAt: now(), });
    return bottling;
  });
}

/**
 * Clears bottling for bottlings.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export function deleteBottling(id) {
  return change(collection => {
    const index = collection.bottlings.findIndex(entry => entry.id === id);
    if (index < 0) {
      throw fail('Abfüllung nicht gefunden', 404, "api.errors.bottlingNotFound");
    }
    if (collection.bottlings[index].bottles.length) {
      throw fail('Zuerst alle zugeordneten Flaschen löschen', 409, "api.errors.deleteAllAssignedBottlesFirst");
    }
    detachTastings(collection, (collection.bottlings[index].tastings || []).map(t => t.id));
    collection.bottlings.splice(index, 1);
    return {ok: true, };
  });
}
