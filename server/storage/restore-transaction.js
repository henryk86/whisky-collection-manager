/** Crash-recoverable replacement of the three live storage directories. */
import fs from 'node:fs';
import path from 'node:path';
import {syncDirectory, syncTree, writeDurableFile} from '../../shared/durable-files.js';

export const RESTORE_FOLDERS = Object.freeze(['data', 'images', 'documents']);
const JOURNAL = '.restore-transaction.json';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Durable restore intent. The prepared phase always rolls back; committed always keeps the new state.
 * @typedef {{version: 1, id: string, phase: 'prepared'|'committed', originals: string[]}} RestoreJournal
 */

/**
 * Checks whether an unfinished transaction must be resolved before serving requests.
 * @param {string} root Application data root.
 * @return {boolean} Whether the restore journal exists.
 */
export function hasInterruptedRestore(root) {
  try {
    fs.lstatSync(path.join(root, JOURNAL));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Derives restore paths from a validated transaction ID, never from arbitrary journal paths.
 * @param {string} root Application data root.
 * @param {string} id Transaction UUID.
 * @return {{fresh: string, parked: string}} Sibling directories on the live filesystem.
 */
export function restoreDirectories(root, id) {
  if (!UUID.test(id)) throw Error('Invalid restore transaction ID');
  return {fresh: path.join(root, `.restore-new-${id}`), parked: path.join(root, `.restore-old-${id}`)};
}

/**
 * Checks whether a directory exists without accepting symbolic links or other file types.
 * @param {string} filename Expected directory path.
 * @return {boolean} True if a regular directory exists.
 */
function directoryExists(filename) {
  try {
    if (!fs.lstatSync(filename).isDirectory()) throw Error(`Unexpected restore path: ${filename}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Reads and validates a journal before using any of its fields to touch storage.
 * @param {string} root Application data root.
 * @return {RestoreJournal} Validated persisted transaction state.
 */
function readJournal(root) {
  const filename = path.join(root, JOURNAL);
  if (!fs.lstatSync(filename).isFile()) throw Error('Restore journal is not a regular file');
  const journal = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (journal?.version !== 1 || typeof journal.id !== 'string' || !UUID.test(journal.id) ||
    !['prepared', 'committed'].includes(journal.phase) || !Array.isArray(journal.originals) ||
    journal.originals.some(name => !RESTORE_FOLDERS.includes(name)) ||
    new Set(journal.originals).size !== journal.originals.length) {
    throw Error('Invalid restore journal; manual recovery required');
  }
  return journal;
}

/**
 * Writes a complete transaction state and flushes its directory before returning.
 * @param {string} root Application data root.
 * @param {RestoreJournal} journal Transaction state to persist.
 */
function writeJournal(root, journal) {
  writeDurableFile(path.join(root, JOURNAL), JSON.stringify(journal, null, 2) + '\n');
}

/**
 * Renames a directory and synchronizes both parent directories, destination first.
 * @param {string} source Original directory path.
 * @param {string} destination New directory path on the same filesystem.
 */
function moveDirectory(source, destination) {
  fs.renameSync(source, destination);
  syncDirectory(path.dirname(destination));
  syncDirectory(path.dirname(source));
}

/**
 * Removes a restore-owned directory and persists the removal of its entry.
 * @param {string} directory Directory to remove if present.
 */
function removeDirectory(directory) {
  if (directoryExists(directory)) {
    fs.rmSync(directory, {recursive: true});
    syncDirectory(path.dirname(directory));
  }
}

/**
 * Discards uncommitted staging left before journal creation. Refuses ambiguous old-style backups instead of guessing which data is live.
 * @param {string} root Application data root.
 */
function cleanUnjournaledStaging(root) {
  if (!fs.existsSync(root)) return;
  const entries = fs.readdirSync(root).filter(name => /^\.restore-(old|new)-[0-9a-f]{8}-[0-9a-f-]{20,50}$/i.test(name));
  const parked = entries.filter(name => name.startsWith('.restore-old-'));
  for (const name of parked) {
    const directory = path.join(root, name);
    if (!directoryExists(directory) || fs.readdirSync(directory).length) {
      throw Error('Unjournaled restore contains original data; manual recovery required');
    }
  }
  for (const name of entries) removeDirectory(path.join(root, name));
}

/**
 * Reverses a prepared transaction. The parked original remains intact until the replacement is removed and its rename is durable. Safe to repeat after another interruption.
 * @param {string} root Application data root.
 * @param {RestoreJournal} journal Prepared transaction state.
 * @param {string} parked Directory holding original folders already moved aside.
 */
function rollback(root, journal, parked) {
  for (const name of RESTORE_FOLDERS) {
    const live = path.join(root, name);
    const original = path.join(parked, name);
    if (directoryExists(original)) {
      if (!journal.originals.includes(name)) throw Error(`Unexpected parked restore directory: ${name}`);
      removeDirectory(live);
      moveDirectory(original, live);
    } else if (journal.originals.includes(name)) {
      if (!directoryExists(live)) throw Error(`Missing original restore directory: ${name}`);
    } else {
      removeDirectory(live);
    }
  }
}

/**
 * Resolves a previously interrupted restore before stores can initialize. A durable committed marker keeps the new directories; any prepared marker restores the originals. Cleanup is repeatable and the marker is removed last.
 * @param {string} root Application data root.
 * @return {'committed'|'rolledBack'|null} Recovered outcome, or null when no journal was present.
 * @throws {Error} If the filesystem or journal cannot be recovered safely; startup must stop.
 */
export function recoverInterruptedRestore(root) {
  if (!hasInterruptedRestore(root)) {
    cleanUnjournaledStaging(root);
    return null;
  }
  const journal = readJournal(root);
  const {fresh, parked} = restoreDirectories(root, journal.id);
  // Persist an already visible journal before acting on it (including after a reported post-publication sync failure).
  syncDirectory(root);
  if (journal.phase === 'prepared') rollback(root, journal, parked);
  else {
    for (const name of RESTORE_FOLDERS) {
      if (!directoryExists(path.join(root, name))) throw Error(`Missing committed restore directory: ${name}`);
    }
  }
  removeDirectory(fresh);
  removeDirectory(parked);
  fs.unlinkSync(path.join(root, JOURNAL));
  syncDirectory(root);
  return journal.phase === 'committed' ? 'committed' : 'rolledBack';
}

/**
 * Installs an already validated restore tree. A caller must hold exclusive storage access and create a verified safety archive first.
 * @param {string} root Application data root.
 * @param {string} id UUID used to stage the replacement under the data root.
 * @throws {Error} If preparation or installation fails. A failed rollback preserves the journal and blocks further requests.
 */
export function installRestore(root, id) {
  if (hasInterruptedRestore(root)) throw Error('An unfinished restore must be recovered first');
  const {fresh, parked} = restoreDirectories(root, id);
  /** @type {RestoreJournal} */
  const journal = {version: 1, id, phase: 'prepared', originals: []};
  try {
    // Both sides must be durable before the journal permits any live rename.
    for (const name of RESTORE_FOLDERS) {
      const live = path.join(root, name);
      syncTree(path.join(fresh, name));
      if (directoryExists(live)) {
        syncTree(live);
        journal.originals.push(name);
      }
    }
    syncDirectory(fresh);
    fs.mkdirSync(parked, {mode: 0o700});
    syncDirectory(root);
    writeJournal(root, journal);
    for (const name of RESTORE_FOLDERS) {
      const live = path.join(root, name);
      if (journal.originals.includes(name)) moveDirectory(live, path.join(parked, name));
      moveDirectory(path.join(fresh, name), live);
    }
    writeJournal(root, {...journal, phase: 'committed'});
    recoverInterruptedRestore(root);
  } catch (error) {
    if (hasInterruptedRestore(root)) {
      // If recovery itself fails, leave every remaining copy and the journal in place.
      if (recoverInterruptedRestore(root) === 'committed') return;
    } else {
      // No live changes precede the journal. A failed final directory sync may also arrive here after a committed cleanup.
      removeDirectory(fresh);
      if (directoryExists(parked) && !fs.readdirSync(parked).length) removeDirectory(parked);
    }
    throw error;
  }
}
