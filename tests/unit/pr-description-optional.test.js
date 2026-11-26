import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('pull requests do not receive a mandatory description template', () => {
  const template = path.join(root, '.github/pull_request_template.md');
  assert.equal(fs.existsSync(template), false);
});

test('CI accepts pull requests without a description', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /run: npm run check/);
  assert.doesNotMatch(workflow, /github\.event\.pull_request\.body/);
  assert.doesNotMatch(workflow, /DOCS_DECLARATION|Docs-Impact|check-doc-impact/);
});

test('documentation checks do not require a PR template', () => {
  const checker = fs.readFileSync(path.join(root, 'scripts/check-docs.js'), 'utf8');
  assert.doesNotMatch(checker, /pull_request_template/);
});
