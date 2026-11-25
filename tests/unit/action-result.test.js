import test from 'node:test';
import assert from 'node:assert/strict';
import {runAction} from '../../public/js/ui/action-result.js';

test(
  'successful action refreshes once and retains the endpoint response',
  async () => {
    const events = [];
    const result = await runAction(
      async () => {events.push('mutation'); return 0;},
      async () => {events.push('refresh');},
      () => {throw new Error('unexpected error');}
    );
    assert.deepEqual(result, {ok: true, value: 0});
    assert.deepEqual(events, ['mutation', 'refresh']);
  }
);

test(
  'failed mutation reports an explicit failure and never refreshes',
  async () => {
    const failed = new Error('HTTP 500');
    let refreshed = false;
    let reported;
    const result = await runAction(async () => {throw failed;},
      async () => {refreshed = true;}, error => {reported = error;});
    assert.equal(result.ok, false);
    assert.equal(result.error, failed);
    assert.equal(reported, failed);
    assert.equal(refreshed, false);
  }
);

test(
  'failed refresh retains mutation success and reports only the refresh \
failure',
  async () => {
    const failure = new Error('Failed to reload');
    let mutationErrorCalled = false;
    let refreshWarning;
    const result = await runAction(async () => ({id: 'saved'}),
      async () => {throw failure;},
      () => {mutationErrorCalled = true;},
      error => {refreshWarning = error;});
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {id: 'saved'});
    assert.equal(result.refreshError, failure);
    assert.equal(refreshWarning, failure);
    assert.equal(mutationErrorCalled, false);
  }
);
