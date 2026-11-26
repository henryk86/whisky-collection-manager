/** In-process admission control for asynchronous password verification. */
const ACCOUNT_LIMIT = 5;
const ADDRESS_LIMIT = 20;
const LOCK_MS = 60_000;
const WINDOW_MS = 5 * 60_000;
// A single scrypt verification uses approximately 128 MiB of working memory.
// Bound work submitted to the native thread pool, even across many addresses.
const MAX_PENDING = 4;
const MAX_BUCKETS = 4096;

/** @typedef {{failures: number, pending: number, at: number, until: number}} AttemptBucket */
/** @typedef {'accepted'|'failed'|'aborted'} AttemptOutcome */
/** @typedef {function(AttemptOutcome): void} FinishAttempt */

/**
 * Tracks failed logins and reserves capacity before the asynchronous KDF starts.
 * Reservations remain live until the caller finishes, including on exceptions.
 */
export class LoginAttemptLimiter {
  /**
   * Creates a limiter with an injectable clock for expiry tests.
   * @param {function(): number=} now Clock returning milliseconds.
   */
  constructor(now = Date.now) {
    this.now = now;
    /** @type {Map<string, AttemptBucket>} */
    this.buckets = new Map();
    this.pending = 0;
  }

  /**
   * Reserves one verification against both account/address and address budgets.
   * After a lock expires, one retry is admitted until a successful login or
   * expiry of the failure history. Concurrent requests cannot reuse that slot.
   * @param {string} address Direct peer address, not a forwarded header.
   * @param {string} username Normalized account name, including unknown accounts.
   * @return {FinishAttempt|null} Idempotent completion callback, or null if admission is denied.
   */
  reserve(address, username) {
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      if (!bucket.pending && bucket.at + WINDOW_MS <= now) this.buckets.delete(key);
    }
    if (this.pending >= MAX_PENDING) return null;
    const keys = [`account:${address}:${username}`, `ip:${address}`];
    const limits = [ACCOUNT_LIMIT, ADDRESS_LIMIT];
    const existing = keys.map(key => this.buckets.get(key));
    if (existing.some((bucket, index) => bucket && (bucket.until > now ||
      bucket.pending >= Math.max(1, limits[index] - bucket.failures)))) return null;
    if (this.buckets.size + existing.filter(bucket => !bucket).length > MAX_BUCKETS) return null;
    const reserved = keys.map((key, index) => {
      const bucket = existing[index] || {failures: 0, pending: 0, at: now, until: 0};
      bucket.pending++;
      this.buckets.set(key, bucket);
      return bucket;
    });
    this.pending++;
    let finished = false;
    return outcome => {
      if (finished) return;
      finished = true;
      this.pending--;
      const completed = this.now();
      reserved.forEach((bucket, index) => {
        bucket.pending--;
        if (outcome === 'failed') {
          bucket.failures++;
          bucket.at = completed;
          if (bucket.failures >= limits[index]) bucket.until = completed + LOCK_MS;
        } else if (outcome === 'accepted' && index === 0) {
          // A valid password resets only this account's failure history, not
          // failures against other accounts from the same address.
          bucket.failures = 0;
          bucket.until = 0;
          bucket.at = completed;
        }
        if (!bucket.pending && !bucket.failures) this.buckets.delete(keys[index]);
      });
    };
  }
}
