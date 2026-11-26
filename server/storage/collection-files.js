/** Physical collection layout, shared by live storage and ZIP migration. */
import fs from 'node:fs';
import path from 'node:path';
import {validate} from '../domain/validation.js';
import {migrateCollectionToCurrent} from './migrations.js';
import {PublishedWriteError, syncDirectory, writeDurableFile} from '../../shared/durable-files.js';

const JOURNAL = '.collection-transaction.json';
const LEGACY_PARTS = /** @type {const} */ (['settings', 'externalTastings', 'tastingFlights']);
const PARTS = /** @type {const} */ ([...LEGACY_PARTS, 'distilleries']);
export const COLLECTION_FILES = Object.freeze(['collection.json', ...PARTS.map(key => `${key}.json`)]);
/** @typedef {import('../../shared/types.js').Collection} Collection */
/** @typedef {{[filename: string]: string}} SerializedFiles */
/** @typedef {'complete'|'pending'|'syncUnconfirmed'} CleanupStatus */

/** A visible write is not safe to repeat blindly; its final state may require recovery. */
export class CollectionCommitError extends PublishedWriteError {
  /**
   * Creates a localized HTTP error without implying that a published change was rolled back.
   * @param {string} filename Published file or journal.
   * @param {unknown} cause Underlying storage failure.
   * @param {'pending'|'unconfirmed'} outcome Whether the redo commit is durable or its persistence is uncertain.
   */
  constructor(filename, cause, outcome) {
    super(filename, cause);
    this.status = 503;
    this.code = outcome === 'pending' ? 'api.errors.collectionCommitPending' : 'api.errors.collectionCommitUnconfirmed';
  }
}

/**
 * Serializes a validated logical snapshot, including the older four-file layout for recovery of a schema-8 journal.
 * @param {Collection} collection Complete logical collection.
 * @param {8|9=} version Physical layout version.
 * @return {SerializedFiles} Complete physical layout with newline-terminated JSON.
 */
export function serializeCollectionFiles(collection, version = 9) {
  validate(collection);
  const core = {...collection, schemaVersion: Number(version)};
  const files = {};
  for (const key of version === 8 ? LEGACY_PARTS : PARTS) {
    files[`${key}.json`] = {schemaVersion: 1, [key]: core[key] ?? null};
    delete core[key];
  }
  return Object.fromEntries(Object.entries({'collection.json': core, ...files}).map(([name, value]) => [name, JSON.stringify(value, null, 2) + '\n']));
}

/**
 * Reads one JSON file without accepting symbolic links or nonregular files.
 * @param {string} filename Storage file path.
 * @return {*} Parsed, not yet validated content.
 */
function readJson(filename) {
  if (!fs.lstatSync(filename).isFile()) throw Error(`Invalid collection file: ${filename}`);
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

/**
 * Loads the complete legacy or split collection. Missing or conflicting sidecars are errors, not empty defaults.
 * @param {string} directory Data directory.
 * @return {{collection: Collection, changed: boolean, conflicts: Array<*>, legacySnapshot?: string}} Validated snapshot, migration information and complete legacy schema-8 export if applicable.
 */
export function loadCollectionFiles(directory) {
  if (hasCollectionTransaction(directory)) throw Error('Unfinished collection transaction');
  const core = readJson(path.join(directory, 'collection.json'));
  if (![8, 9].includes(core?.schemaVersion)) {
    if (PARTS.some(key => fs.existsSync(path.join(directory, `${key}.json`)))) {
      throw Error('Legacy collection has conflicting separate data files');
    }
    return migrateCollectionToCurrent(core);
  }
  const legacy = core.schemaVersion === 8;
  if (legacy && fs.existsSync(path.join(directory, 'distilleries.json'))) throw Error('Legacy collection has conflicting separate data files');
  for (const key of legacy ? LEGACY_PARTS : PARTS) {
    if (Object.hasOwn(core, key)) throw Error(`Duplicate collection data: ${key}`);
    const part = readJson(path.join(directory, `${key}.json`));
    if (part?.schemaVersion !== 1 || !Object.hasOwn(part, key) || Object.keys(part).length !== 2) {
      throw Error(`Invalid or unsupported collection part: ${key}`);
    }
    if (key !== 'settings' || part[key] !== null) core[key] = part[key];
  }
  if (legacy) return {...migrateCollectionToCurrent(core), legacySnapshot: JSON.stringify(core, null, 2) + '\n'};
  validate(core);
  return {collection: core, changed: false, conflicts: []};
}

/**
 * Checks for a durable, unfinished multi-file commit.
 * @param {string} directory Data directory.
 * @return {boolean} Whether recovery is required.
 */
export function hasCollectionTransaction(directory) {
  try {fs.lstatSync(path.join(directory, JOURNAL)); return true;}
  catch (error) {if (error.code === 'ENOENT') return false; throw error;}
}

/**
 * Compares a previously published file with its committed contents. Missing files require replay; unexpected file types fail closed.
 * @param {string} filename Destination file path.
 * @param {string} content Expected serialized content.
 * @return {boolean} Whether replacement is unnecessary.
 */
function matchesContent(filename, content) {
  try {
    if (!fs.lstatSync(filename).isFile()) throw Error(`Invalid collection file: ${filename}`);
    return fs.readFileSync(filename, 'utf8') === content;
  } catch (error) {if (error.code === 'ENOENT') return false; throw error;}
}

/**
 * Removes the redo record after all destinations are durable. A cleanup failure cannot undo the commit.
 * @param {string} directory Data directory.
 * @return {CleanupStatus} Cleanup state after one retry.
 */
function cleanup(directory) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (hasCollectionTransaction(directory)) fs.unlinkSync(path.join(directory, JOURNAL));
      syncDirectory(directory);
      return 'complete';
    } catch (error) {
      if (attempt === 1) console.warn('Committed collection: journal cleanup failed.', error);
    }
  }
  try {return hasCollectionTransaction(directory) ? 'pending' : 'syncUnconfirmed';}
  catch {return 'pending';}
}

/**
 * Replays an already published full snapshot. All destinations are derived from the validated data, never from journal-supplied paths.
 * @param {string} directory Data directory.
 * @return {CleanupStatus} Cleanup outcome; throws only if the journal or data cannot be confirmed durable.
 */
export function recoverCollectionTransaction(directory) {
  if (!hasCollectionTransaction(directory)) return 'complete';
  const filename = path.join(directory, JOURNAL);
  const journal = readJson(filename);
  if (journal?.version !== 1 || ![8, 9].includes(journal.collection?.schemaVersion)) throw Error('Unsupported collection transaction');
  const files = serializeCollectionFiles(migrateCollectionToCurrent(journal.collection).collection, journal.collection.schemaVersion);
  // Persist a visible journal before replay, including any earlier published file renames.
  syncDirectory(directory);
  for (const [name, content] of Object.entries(files)) {
    const destination = path.join(directory, name);
    if (!matchesContent(destination, content)) writeDurableFile(destination, content);
  }
  return cleanup(directory);
}

/**
 * Confirms publication of a file whose bytes have already been flushed. Never reports a definite rollback of a visible write.
 * @param {string} directory Data directory.
 * @param {string} filename Published file path.
 * @param {string} content New contents.
 */
function publish(directory, filename, content) {
  try {writeDurableFile(filename, content);}
  catch (error) {
    if (!(error instanceof PublishedWriteError)) throw error;
    try {syncDirectory(directory);}
    catch (cause) {throw new CollectionCommitError(filename, cause, 'unconfirmed');}
  }
}

/**
 * Commits only changed files. A multi-file change publishes a durable redo record before replacing any data file; recovery is idempotent.
 * @param {string} directory Data directory.
 * @param {Collection} collection Validated target state.
 * @param {Collection|null=} previous Previously committed snapshot, or null for initialization and migration.
 * @return {CleanupStatus} Acknowledged commit and cleanup state. A durable redo that cannot yet be replayed raises a pending-commit error.
 */
export function writeCollectionFiles(directory, collection, previous = null) {
  if (hasCollectionTransaction(directory)) throw Error('Unfinished collection transaction');
  const files = serializeCollectionFiles(collection);
  const before = previous ? serializeCollectionFiles(previous) : {};
  const changed = COLLECTION_FILES.filter(name => files[name] !== before[name]);
  if (!changed.length) return 'complete';
  if (changed.length === 1) {
    const name = changed[0];
    publish(directory, path.join(directory, name), files[name]);
    return 'complete';
  }
  const journal = path.join(directory, JOURNAL);
  publish(directory, journal, JSON.stringify({version: 1, collection}) + '\n');
  try {return recoverCollectionTransaction(directory);}
  catch {
    try {return recoverCollectionTransaction(directory);}
    catch (error) {throw new CollectionCommitError(journal, error, 'pending');}
  }
}
