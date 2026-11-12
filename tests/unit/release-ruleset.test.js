import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');

test('main ruleset protects only main, without bypass', () => {
    const ruleset = JSON.parse(read('.github/rulesets/main.json'));
    assert.equal(ruleset.target, 'branch');
    assert.equal(ruleset.enforcement, 'active');
    assert.deepEqual(ruleset.bypass_actors, []);
    assert.deepEqual(ruleset.conditions.ref_name.include, ['refs/heads/main']);
    assert.deepEqual(ruleset.conditions.ref_name.exclude, []);
    const rules = new Map(ruleset.rules.map(rule => [rule.type, rule]));
    assert.ok(rules.has('deletion'));
    assert.ok(rules.has('non_fast_forward'));
    const pr = rules.get('pull_request')?.parameters;
    assert.ok(pr, 'Pull requests must be required');
    assert.equal(pr.required_approving_review_count, 0, 'Solo developers must not require self-approval');
    assert.equal(pr.required_review_thread_resolution, true);
    assert.ok(pr.allowed_merge_methods.includes('merge'));
    assert.ok(!rules.has('creation'), 'Do not restrict creation of initial branches');
});

test('main ruleset requires the actual PR test job and checks develop as source', () => {
    const ruleset = JSON.parse(read('.github/rulesets/main.json'));
    const checks = ruleset.rules.find(rule => rule.type === 'required_status_checks')?.parameters;
    assert.equal(checks.strict_required_status_checks_policy, true);
    assert.deepEqual(checks.required_status_checks, [{context: 'test'}]);
    const workflow = read('.github/workflows/check.yml');
    assert.match(workflow, /^  test:\s*$/m);
    assert.match(workflow, /PR_SOURCE:.*github\.head_ref/);
    assert.match(workflow, /PR_SOURCE_REPO:.*github\.event\.pull_request\.head\.repo\.full_name/);
    assert.match(workflow, /test "\$PR_SOURCE" = develop/);
    assert.match(workflow, /"\$PR_SOURCE_REPO" = "\$GITHUB_REPOSITORY"/);
    assert.match(workflow, /node scripts\/release-version\.js check --fresh/);
    assert.match(workflow, /npm run test:browser/);
});
