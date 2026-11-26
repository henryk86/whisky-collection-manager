import fs from 'node:fs';
import path from 'node:path';

/**
 * Creates a reusable collection fixture for automated tests.
 *
 * @return {!Object} Structured result for the caller.
 */
export function collectionFixture() {
  return {
    schemaVersion: 9,
    nextInventoryNumber: 124,
    reservedInventoryNumbers: ['000123'],
    distilleries: [{
      id: 'distillery-a', name: 'Test Distillery',
    }],
    bottlings: [{
      id: 'bottling-a',
      name: 'Test Blend',
      distilleryIds: ['distillery-a'],
      whiskyType: 'blended_malt',
      bottler: 'Example Bottler',
      abv: 46,
      ageYears: 5,
      volumeMl: 700,
      compositionComplete: false,
      bottles: [{
        id: 'bottle-a',
        inventoryNumber: '000123',
        volumeType: 'standard',
        volumeMl: 700,
        status: 'closed',
        photos: [],
        files: [],
      }],
    }],
  };
}

/** Recreates the legacy monolithic on-disk layout in an isolated test directory. */
export function removeSeparateCollectionFiles(directory) {
  for (const name of ['settings.json', 'externalTastings.json', 'tastingFlights.json', 'distilleries.json']) fs.rmSync(path.join(directory, name), {force: true});
}
