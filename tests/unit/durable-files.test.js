import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PublishedWriteError, syncFile, syncTree, writeDurableFile} from '../../shared/durable-files.js';
import {RestoreGate} from '../../server/storage/restore-gate.js';

test('durable file publication flushes bytes before renaming, then flushes directory metadata', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-durable-'));
  const filename = path.join(root, 'data.json');
  const calls = [];
  const sync = fs.fsyncSync;
  const rename = fs.renameSync;
  t.mock.method(fs, 'fsyncSync', fd => {calls.push(fs.fstatSync(fd).isDirectory() ? 'directory' : 'file'); return sync(fd);});
  t.mock.method(fs, 'renameSync', (...args) => {calls.push('rename'); return rename(...args);});
  try {
    writeDurableFile(filename, 'complete');
    assert.equal(fs.readFileSync(filename, 'utf8'), 'complete');
    assert.deepEqual(calls, process.platform === 'win32' ? ['file', 'rename'] : ['file', 'rename', 'directory']);
    assert.deepEqual(fs.readdirSync(root), ['data.json']);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('existing files and directory trees can be flushed without changing their contents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-durable-'));
  const filename = path.join(root, 'data.json');
  const bytes = Buffer.from('original bytes');
  try {
    fs.writeFileSync(filename, bytes);
    syncFile(filename);
    syncTree(root);
    assert.deepEqual(fs.readFileSync(filename), bytes);
    const missing = path.join(root, 'missing.json');
    assert.throws(() => syncFile(missing), {code: 'ENOENT'});
    assert.equal(fs.existsSync(missing), false);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('Windows flushes an existing file using a write-capable handle and propagates real flush errors', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-durable-'));
  const filename = path.join(root, 'data.json');
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const open = fs.openSync;
  const sync = fs.fsyncSync;
  const handles = new Map();
  let fail = false;
  try {
    fs.writeFileSync(filename, 'original');
    Object.defineProperty(process, 'platform', {...platform, value: 'win32'});
    t.mock.method(fs, 'openSync', (file, flags, ...args) => {
      const fd = open(file, flags, ...args);
      handles.set(fd, flags);
      return fd;
    });
    t.mock.method(fs, 'fsyncSync', fd => {
      if (handles.get(fd) !== 'r+' || fail) throw Object.assign(Error('operation not permitted, fsync'), {code: 'EPERM'});
      return sync(fd);
    });
    syncFile(filename);
    fail = true;
    assert.throws(() => syncFile(filename), {code: 'EPERM'});
    assert.equal(fs.readFileSync(filename, 'utf8'), 'original');
  } finally {
    Object.defineProperty(process, 'platform', platform);
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('a failed file flush preserves the old file and removes the incomplete temporary file', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-durable-'));
  const filename = path.join(root, 'data.json');
  try {
    writeDurableFile(filename, 'original');
    t.mock.method(fs, 'fsyncSync', () => {throw Error('simulated file flush failure');});
    assert.throws(() => writeDurableFile(filename, 'replacement'), /simulated file flush failure/);
    assert.equal(fs.readFileSync(filename, 'utf8'), 'original');
    assert.deepEqual(fs.readdirSync(root), ['data.json']);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('a failed directory flush reports the already published file rather than pretending it rolled back', {skip: process.platform === 'win32'}, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-durable-'));
  const filename = path.join(root, 'data.json');
  const sync = fs.fsyncSync;
  try {
    writeDurableFile(filename, 'original');
    t.mock.method(fs, 'fsyncSync', fd => {
      if (fs.fstatSync(fd).isDirectory()) throw Error('simulated directory flush failure');
      return sync(fd);
    });
    assert.throws(() => writeDurableFile(filename, 'replacement'), PublishedWriteError);
    assert.equal(fs.readFileSync(filename, 'utf8'), 'replacement');
    assert.deepEqual(fs.readdirSync(root), ['data.json']);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('exclusive durable creation does not overwrite an existing account store', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-durable-'));
  const filename = path.join(root, 'user.json');
  try {
    writeDurableFile(filename, 'original', {exclusive: true});
    assert.throws(() => writeDurableFile(filename, 'replacement', {exclusive: true}), {code: 'EEXIST'});
    assert.equal(fs.readFileSync(filename, 'utf8'), 'original');
    assert.deepEqual(fs.readdirSync(root), ['user.json']);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('restore gate drains all active operations, rejects further requests and releases on failure', async () => {
  const gate = new RestoreGate();
  const order = [];
  let release;
  const blocker = new Promise(resolve => {release = resolve;});
  const ordinary = gate.run(false, async () => {await blocker; order.push('write finished');});
  const failing = gate.run(false, async () => {await blocker; throw Error('failed request');});
  const failure = assert.rejects(failing, /failed request/);
  const restore = gate.run(true, () => {order.push('restore'); throw Error('failed restore');});
  const restoreFailure = assert.rejects(restore, /failed restore/);
  await assert.rejects(gate.run(false, () => assert.fail('must not execute')), {status: 503, code: 'api.errors.restoreInProgress'});
  await assert.rejects(gate.run(true, () => assert.fail('must not execute')), {status: 503, code: 'api.errors.restoreInProgress'});
  assert.deepEqual(order, []);
  release();
  await Promise.all([ordinary, failure, restoreFailure]);
  assert.deepEqual(order, ['write finished', 'restore']);
  assert.equal(await gate.run(false, () => 'ready'), 'ready');
});
