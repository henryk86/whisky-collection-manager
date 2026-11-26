import test from 'node:test';
import assert from 'node:assert/strict';
import {LoginAttemptLimiter} from '../../server/domain/login-attempts.js';

test('parallel login reservations cannot lose failures or overbook the account budget', () => {
  let now = 1000;
  const limiter = new LoginAttemptLimiter(() => now);
  const address = '192.0.2.10';
  const reserve = () => limiter.reserve(address, 'admin');
  const first = Array.from({length: 4}, reserve);
  assert.ok(first.every(Boolean));
  assert.equal(reserve(), null, 'process-wide verification limit');
  // Finish in a different order from admission. All failures must be counted.
  first.reverse().forEach(finish => finish('failed'));
  const fifth = reserve();
  assert.ok(fifth);
  assert.equal(reserve(), null, 'the last available account slot is already reserved');
  fifth('failed');
  assert.equal(reserve(), null, 'five failed attempts lock the account/address pair');
  now += 59_999;
  assert.equal(reserve(), null);
  now++;
  const retry = reserve();
  assert.ok(retry);
  assert.equal(reserve(), null, 'only one retry after cooldown');
  retry('failed');
  assert.equal(reserve(), null);
  now += 5 * 60_000;
  assert.ok(reserve(), 'idle failure history eventually expires');
});

test('address budget includes failures against different and unknown usernames', () => {
  let now = 1000;
  const limiter = new LoginAttemptLimiter(() => now);
  const address = '192.0.2.11';
  for (let i = 0; i < 19; i++) {
    const finish = limiter.reserve(address, `account-${i}`);
    assert.ok(finish);
    finish('failed');
  }
  const last = limiter.reserve(address, 'other-account');
  assert.ok(last);
  assert.equal(limiter.reserve(address, 'yet-another-account'), null);
  last('failed');
  assert.equal(limiter.reserve(address, 'admin'), null);
  const otherAddress = limiter.reserve('192.0.2.12', 'admin');
  assert.ok(otherAddress, 'unrelated direct peer is not locked out');
  otherAddress('accepted');
  now += 60_000;
  const retry = limiter.reserve(address, 'admin');
  assert.ok(retry);
  retry('accepted');
  // A success clears the account history, but not the address history.
  const probe = limiter.reserve(address, 'admin');
  assert.ok(probe);
  assert.equal(limiter.reserve(address, 'another'), null);
  probe('failed');
  assert.equal(limiter.reserve(address, 'another'), null);
});

test('successful and aborted verifications release reservations without discarding parallel failures', () => {
  const limiter = new LoginAttemptLimiter(() => 1000);
  const reserve = () => limiter.reserve('192.0.2.13', 'admin');
  const success = reserve();
  const failed = reserve();
  const aborted = reserve();
  assert.ok(success && failed && aborted);
  failed('failed');
  success('accepted');
  aborted('aborted');
  aborted('failed'); // Completion is idempotent.
  for (let i = 0; i < 4; i++) {
    const next = reserve();
    assert.ok(next);
    next('failed');
  }
  const last = reserve();
  assert.ok(last, 'success reset the earlier account failure');
  assert.equal(reserve(), null);
  last('aborted');
  assert.ok(reserve(), 'an aborted KDF did not consume a failure');
});

test('in-flight reservations survive expiry and bound the total verification work', () => {
  let now = 1000;
  const limiter = new LoginAttemptLimiter(() => now);
  const reservations = Array.from({length: 4}, (_, i) => limiter.reserve(`192.0.2.${i}`, 'admin'));
  assert.ok(reservations.every(Boolean));
  now += 10 * 60_000;
  assert.equal(limiter.reserve('192.0.2.100', 'other'), null);
  reservations[0]('aborted');
  const next = limiter.reserve('192.0.2.100', 'other');
  assert.ok(next);
  next('accepted');
  reservations.slice(1).forEach(finish => finish('failed'));
});


test('failure bucket capacity is bounded and recovers after expiry', () => {
  let now = 1000;
  const limiter = new LoginAttemptLimiter(() => now);
  // Distinct addresses and account names create two buckets per failed login.
  for (let i = 0; i < 2048; i++) {
    const finish = limiter.reserve(`address-${i}`, 'admin');
    assert.ok(finish);
    finish('failed');
  }
  assert.equal(limiter.reserve('new-address', 'admin'), null);
  now += 5 * 60_000;
  const next = limiter.reserve('new-address', 'admin');
  assert.ok(next);
  next('accepted');
});
