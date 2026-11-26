import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Every integration test uses an isolated temporary collection and a separate
 * process.
 *
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export async function startTestServer({parentDirectory = os.tmpdir()} = {}) {
  const dir = fs.mkdtempSync(path.join(parentDirectory, 'whisky-test-'));
  const backupControl = process.env.BACKUP_CONTROL_DIR || path.join(dir, 'backup-control');
  fs.mkdirSync(backupControl, {recursive: true});
  const passfile = path.join(backupControl, 'backup-zip-password');
  if (!fs.existsSync(passfile)) fs.writeFileSync(passfile, 'SicheresTestpasswort-2026-mindestens-14!\n', {mode: 0o600});

  // Never probe and release a "free" port before spawning the child. Parallel
  // test workers can receive the same port and accidentally hit one another's
  // server (or kill it while a request is in flight).
  const child = spawn(process.execPath, ['tests/helpers/isolated-server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKUP_CONTROL_DIR: backupControl,
      BACKUP_ADMIN_TOKEN: process.env.BACKUP_ADMIN_TOKEN || 'a'.repeat(64),
      WHISKY_DATA_DIR: dir,
      HOST: '127.0.0.1',
      HTTP_ENABLED: 'true',
      HTTPS_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let diagnostics = '';
  child.stderr.on('data', chunk => {diagnostics += chunk;});

  /**
   * Performs the stop lifecycle action.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function stop() {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    fs.rmSync(dir, {recursive: true, force: true});
  }
  try {
    // Readiness is a message from THIS child after its own socket has
    // started listening, never an HTTP response from a potentially unrelated
    // process on a port that was once available.
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error(`Test server did not become ready: ${diagnostics}`)), 20000);
      /**
       * Updates the cleanup state for its caller.
       */
      function cleanup() {
        clearTimeout(timeout);
        child.off('message', onMessage);
        child.off('error', onError);
        child.off('exit', onExit);
      }

      /**
       * Updates the finish state for its caller.
       *
       * @param {*} error Error to handle or propagate.
       * @param {*} value Value to process.
       */
      function finish(error, value) {
        cleanup();
        if (error) reject(error);
        else resolve(value);
      }

      /**
       * Handles the message interaction.
       *
       * @param {*} message Message to display or use for diagnostics.
       */
      function onMessage(message) {
        if (message?.type !== 'test-server-ready') return;
        if (!Number.isInteger(message.port) || message.port < 1 || message.port > 65535) {
          finish(new Error('Test server reported an invalid port.'));
          return;
        }
        finish(null, message.port);
      }

      /**
       * Handles the error interaction.
       *
       * @param {*} error Error to handle or propagate.
       */
      function onError(error) {finish(error);}

      /**
       * Handles the exit interaction.
       *
       * @param {*} code Code used to identify a specific outcome.
       * @param {*} signal Value used by this operation.
       */
      function onExit(code, signal) {
        finish(new Error(`Test server exited before listening (${code ?? signal}): ${diagnostics}`));
      }
      child.on('message', onMessage);
      child.once('error', onError);
      child.once('exit', onExit);
    });
    return {base: `http://127.0.0.1:${port}`, dir, child, stop};
  }
  catch (error) {
    await stop();
    throw error;
  }
}

/**
 * Loads json for server.
 *
 * @param {*} base Base used by this operation.
 * @param {string} url URL of the requested resource.
 * @param {string=} method HTTP method for the operation.
 * @param {!Object} data Input data for the operation.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export async function requestJson(base, url, method = 'GET', data) {
  const response = await fetch(base + url, {
    method,
    headers: data ? {'Content-Type': 'application/json'} : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  return {status: response.status, data: await response.json()};
}
