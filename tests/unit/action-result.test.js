import test from 'node:test';
import assert from 'node:assert/strict';
import { runAction } from '../../public/js/ui/action-result.js';

test('successful action refreshes once and retains the endpoint response', async () => {
    const events = [];
    const result = await runAction(async () => { events.push('mutation'); return 0; },
        async () => { events.push('refresh'); }, () => { throw new Error('unexpected error'); });
    assert.deepEqual(result, {ok:true,value:0});
    assert.deepEqual(events, ['mutation','refresh']);
});

test('failed mutation reports an explicit failure and never refreshes', async () => {
    const failed = new Error('HTTP 500');
    let refreshed = false;
    let reported;
    const result = await runAction(async () => { throw failed; },
        async () => { refreshed = true; }, error => { reported = error; });
    assert.equal(result.ok, false);
    assert.equal(result.error, failed);
    assert.equal(reported, failed);
    assert.equal(refreshed, false);
});

test('failed refresh is not misreported as successful completion', async () => {
    const result = await runAction(async () => ({id:'saved'}),
        async () => { throw new Error('Failed to reload'); }, () => {});
    assert.equal(result.ok, false);
});
