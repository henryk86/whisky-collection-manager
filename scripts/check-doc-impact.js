#!/usr/bin/env node
/** Require an explicit documentation decision for changes affecting product code. */
import {spawnSync} from 'node:child_process';

const rangeIndex = process.argv.indexOf('--range');
const range = rangeIndex >= 0 ? process.argv[rangeIndex + 1] : '';
if (!range || !/^[\w^~.\-/]+\.\.[\w^~.\-/]+$/.test(range)) {
  console.error('Usage: node scripts/check-doc-impact.js --range BASE..HEAD');
  process.exit(2);
}
function git(args) {
  const result = spawnSync('git', args, {encoding: 'utf8'});
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `git ${args.join(' ')} failed`);
    process.exit(2);
  }
  return result.stdout;
}
const changed = git(['diff', '--name-only', '--diff-filter=ACDMRT', '-z', range]).split('\0').filter(Boolean);
const relevant = changed.filter(file => /^(?:public|server|shared|worker|scripts|tests|docker|deploy|extension)\//.test(file) ||
  /^\.github\/(?:workflows\/|dependabot\.yml$)/.test(file) ||
  /^(?:package(?:-lock)?\.json|docker-compose(?:\.[\w-]+)?\.ya?ml|Dockerfile)$/.test(file));
if (!relevant.length) {
  console.log('Documentation impact: no application, test or deployment files changed.');
  process.exit(0);
}
const docs = changed.filter(file => file.endsWith('.md') && file !== 'CHANGELOG.md');
if (docs.length) {
  console.log(`Documentation impact: ${relevant.length} relevant file(s), ${docs.length} current documentation file(s) updated.`);
  process.exit(0);
}
const commitMessages = git(['log', '--format=%B', range]);
const declaration = `${process.env.DOCS_DECLARATION || ''}\n${commitMessages}`;
// An exception needs a nonempty concrete explanation; generic "none" is not sufficient.
const exception = /^Docs-Impact:\s*none\s*-\s*([^\r\n]{12,})\s*$/gmi;
const reasons = [...declaration.matchAll(exception)].map(match => match[1].trim());
if (reasons.length) {
  console.log(`Documentation impact: no update required; reason: ${reasons[0]}`);
  process.exit(0);
}
console.error('Documentation impact: product/test/deployment code changed, but no current Markdown documentation was updated.');
console.error('Update README.md, AGENTS.md or the affected docs/*.md in the same change, OR explain why no update is needed:');
console.error('  Docs-Impact: none - <specific explanation of why all current docs remain accurate>');
console.error('Use this line in the PR description or as a commit footer. CHANGELOG.md alone does not count.');
console.error('Relevant files:\n' + relevant.slice(0, 20).map(file => '  - ' + file).join('\n'));
process.exitCode = 1;
