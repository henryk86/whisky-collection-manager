#!/usr/bin/env node
/** Validates a local commit using the same classifier as GitHub's release checks. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {classifyCommit} from './release-automation.js';

export function validateMessage(contents) {
  const [subject = '', ...body] = contents.replace(/\r\n/g, '\n').split('\n');
  return classifyCommit(subject, body.join('\n'));
}

function activeMerge() {
  try {
    // Git produces its own merge message; merge commits are not release entries.
    // Do not blindly accept messages beginning with "Merge" outside a merge.
    const file = execFileSync('git', ['rev-parse', '--git-path', 'MERGE_HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return fs.existsSync(path.resolve(file));
  } catch {return false;}
}

function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: validate-commit-message.js COMMIT_MSG_FILE');
  if (activeMerge()) return;
  const result = validateMessage(fs.readFileSync(file, 'utf8'));
  console.log(`Commit-Nachricht OK: ${result.type}${result.scope ? `(${result.scope})` : ''} -> ${result.level}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {main();} catch (error) {
    console.error(`Commit abgelehnt: ${error.message}`);
    console.error('Erwartet z. B. fix(warehouse): Fehler korrigieren oder feat: neue Funktion');
    process.exitCode = 1;
  }
}
