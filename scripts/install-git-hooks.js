#!/usr/bin/env node
/** Opt-in, repository-local setup; never changes a user's global Git config. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Executes Git in the project root and reports unsuccessful invocations.
 * @param {...string} args Git command arguments.
 * @return {string} Trimmed command output.
 */
function git(...args) {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
  if (result.error || (result.status !== 0 && !(args[0] === 'config' && args[1] === '--local' && args[2] === '--get' && result.status === 1))) {
    throw new Error(result.error?.message || result.stderr?.trim() || `Git exit ${result.status}`);
  }
  return result.stdout.trim();
}
try {
  if (path.resolve(git('rev-parse', '--show-toplevel')) !== root)
    throw new Error('Bitte aus dem Repository-Root ausfuehren.');
  const current = git('config', '--local', '--get', 'core.hooksPath');
  if (current && current !== '.githooks')
    throw new Error(`Ein anderer core.hooksPath ist bereits gesetzt: ${current}. Bestehende Hooks zuerst integrieren.`);
  if (!current) {
    const defaultHook = git('rev-parse', '--git-path', 'hooks/commit-msg');
    if (fs.existsSync(path.resolve(root, defaultHook)))
      throw new Error(`Ein vorhandener commit-msg-Hook wuerde ersetzt: ${defaultHook}. Bestehende Hooks zuerst integrieren.`);
  }
  git('config', '--local', 'core.hooksPath', '.githooks');
  console.log('Commit-Validierung aktiviert (nur dieses Repository: .githooks/commit-msg).');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
