/** Physical collection layout, shared by live storage and ZIP migration. */
import fs from 'node:fs';
import path from 'node:path';
import {validate} from '../domain/validation.js';
import {migrateCollectionToCurrent} from './migrations.js';
import {PublishedWriteError, syncDirectory, writeDurableFile} from '../../shared/durable-files.js';

export const COLLECTION_FILES = Object.freeze(['collection.json', 'settings.json', 'externalTastings.json', 'tastingFlights.json']);
const JOURNAL = '.collection-transaction.json';
const PARTS = /** @type {const} */ (['settings', 'externalTastings', 'tastingFlights']);
/** @typedef {import('../../shared/types.js').Collection} Collection */
/** @typedef {{[filename: string]: string}} SerializedFiles */

/**
 * Serializes a validated API snapshot into four independently versioned documents.
 * @param {Collection} collection Complete logical collection.
 * @return {SerializedFiles} Complete physical layout with newline-terminated JSON.
 */
export function serializeCollectionFiles(collection) {
  validate(collection);
  const {settings, externalTastings, tastingFlights, ...core} = collection;
  return Object.fromEntries(Object.entries({
    'collection.json': core,
    'settings.json': {schemaVersion: 1, settings: settings ?? null},
    'externalTastings.json': {schemaVersion: 1, externalTastings},
    'tastingFlights.json': {schemaVersion: 1, tastingFlights},
  }).map(([name, value]) => [name, JSON.stringify(value, null, 2) + '\n']));
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
 * Loads either a complete legacy collection or all four current documents. Missing or conflicting sidecars are errors, not empty defaults.
 * @param {string} directory Data directory.
 * @return {{collection: Collection, changed: boolean, conflicts: Array<*>}} Validated logical snapshot and migration information.
 */
export function loadCollectionFiles(directory) {
  if (hasCollectionTransaction(directory)) throw Error('Unfinished collection transaction');
  const core = readJson(path.join(directory, 'collection.json'));
  if (core?.schemaVersion !== 8) {
    if (PARTS.some(key => fs.existsSync(path.join(directory, `${key}.json`)))) {
      throw Error('Legacy collection has conflicting separate data files');
    }
    return migrateCollectionToCurrent(core);
  }
  for (const key of PARTS) {
    if (Object.hasOwn(core, key)) throw Error(`Duplicate collection data: ${key}`);
    const part = readJson(path.join(directory, `${key}.json`));
    if (part?.schemaVersion !== 1 || !Object.hasOwn(part, key) || Object.keys(part).length !== 2) {
      throw Error(`Invalid or unsupported collection part: ${key}`);
    }
    if (key !== 'settings' || part[key] !== null) core[key] = part[key];
  }
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
 * Replays an already published full snapshot. All destinations are derived from the validated data, never from journal-supplied paths.
 * @param {string} directory Data directory.
 */
export function recoverCollectionTransaction(directory) {
  if (!hasCollectionTransaction(directory)) return;
  const filename = path.join(directory, JOURNAL);
  const journal = readJson(filename);
  if (journal?.version !== 1) throw Error('Unsupported collection transaction');
  const files = serializeCollectionFiles(journal.collection);
  // Do not act on a visible journal until its directory entry is durable.
  syncDirectory(directory);
  for (const name of COLLECTION_FILES) {
    const destination = path.join(directory, name);
    if (!matchesContent(destination, files[name])) writeDurableFile(destination, files[name]);
  }
  fs.unlinkSync(filename);
  syncDirectory(directory);
}

/**
 * Commits only changed files. A multi-file change publishes a durable redo record before replacing any data file; recovery is idempotent.
 * @param {string} directory Data directory.
 * @param {Collection} collection Validated target state.
 * @param {Collection|null=} previous Previously committed snapshot, or null for initialization and migration.
 */
export function writeCollectionFiles(directory, collection, previous = null) {
  if (hasCollectionTransaction(directory)) throw Error('Unfinished collection transaction');
  const files = serializeCollectionFiles(collection);
  const before = previous ? serializeCollectionFiles(previous) : {};
  const changed = COLLECTION_FILES.filter(name => files[name] !== before[name]);
  if (!changed.length) return;
  if (changed.length === 1) {
    const name = changed[0];
    writeDurableFile(path.join(directory, name), files[name]);
    return;
  }
  const journal = path.join(directory, JOURNAL);
  writeDurableFile(journal, JSON.stringify({version: 1, collection}) + '\n');
  try {recoverCollectionTransaction(directory);}
  catch (error) {
    // The journal is committed, so callers must retain any newly referenced media.
    throw new PublishedWriteError(journal, error);
  }
}
