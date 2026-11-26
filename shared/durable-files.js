/** Filesystem durability primitives for the single-instance local stores. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** A file is already visible, but its directory could not be synchronized. */
export class PublishedWriteError extends Error {
  /**
   * Reports a failed metadata flush after the destination has already been published.
   * @param {string} filename Published file whose durability is uncertain.
   * @param {unknown} cause Original directory-sync error.
   */
  constructor(filename, cause) {
    super(`File published but directory synchronization failed: ${filename}`, {cause});
    this.name = 'PublishedWriteError';
  }
}

/**
 * Flushes directory metadata after a create, rename or removal. Windows does not expose directory fsync through Node's filesystem API.
 * @param {string} directory Directory to synchronize.
 * @throws {Error} If synchronization fails on a supported platform.
 */
export function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(directory, 'r');
  try {fs.fsyncSync(fd);}
  finally {fs.closeSync(fd);}
}

/**
 * Creates missing ancestors and flushes each new directory entry in its parent.
 * @param {string} directory Absolute or relative directory path.
 * @param {number=} mode Permissions for new directories.
 */
export function ensureDurableDirectory(directory, mode = 0o700) {
  const absolute = path.resolve(directory);
  if (fs.existsSync(absolute)) {
    if (!fs.statSync(absolute).isDirectory()) throw Error(`Not a directory: ${absolute}`);
    return;
  }
  const parent = path.dirname(absolute);
  ensureDurableDirectory(parent, mode);
  try {fs.mkdirSync(absolute, {mode});}
  catch (error) {if (error.code !== 'EEXIST' || !fs.statSync(absolute).isDirectory()) throw error;}
  syncDirectory(parent);
}

/**
 * Flushes an existing regular file before publishing a directory or backup.
 * @param {string} filename File to synchronize.
 */
export function syncFile(filename) {
  // Windows FlushFileBuffers requires a write-capable handle, even when no bytes are changed.
  const fd = fs.openSync(filename, process.platform === 'win32' ? 'r+' : 'r');
  try {fs.fsyncSync(fd);}
  finally {fs.closeSync(fd);}
}

/**
 * Atomically publishes fully flushed bytes and then flushes the parent directory.
 * Exclusive creation uses a hard link so an existing destination cannot be overwritten.
 * @param {string} filename Destination path on the same filesystem as its temporary file.
 * @param {string|Buffer} content Complete file contents.
 * @param {{exclusive?: boolean}=} options Exclusive creation for new account stores or attachments.
 * @throws {PublishedWriteError} If publication succeeded but directory synchronization failed. Callers must not delete newly referenced media in this case.
 */
export function writeDurableFile(filename, content, {exclusive = false} = {}) {
  const parent = path.dirname(filename);
  ensureDurableDirectory(parent);
  const temporary = `${filename}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, content);
      fs.fsyncSync(fd);
    } finally {fs.closeSync(fd);}
    if (exclusive) fs.linkSync(temporary, filename);
    else fs.renameSync(temporary, filename);
    try {
      if (exclusive) fs.unlinkSync(temporary);
      syncDirectory(parent);
    } catch (error) {throw new PublishedWriteError(filename, error);}
  } finally {if (fs.existsSync(temporary)) fs.rmSync(temporary, {force: true});}
}

/**
 * Flushes all files and directory entries in a complete tree, children first.
 * Refuses symbolic links and special files rather than following them.
 * @param {string} directory Root directory of the tree.
 */
export function syncTree(directory) {
  if (!fs.lstatSync(directory).isDirectory()) throw Error(`Not a regular directory: ${directory}`);
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) syncTree(filename);
    else if (entry.isFile()) syncFile(filename);
    else throw Error(`Unsupported file in durable tree: ${filename}`);
  }
  syncDirectory(directory);
}
