/** Coordinates ordinary requests with a complete storage replacement. */
import {fail} from '../domain/errors.js';

/** A restore waits for active requests and prevents new requests from accessing the old state. */
export class RestoreGate {
  /** Creates an idle gate for the application's shared HTTP/HTTPS handler. */
  constructor() {
    /** @type {Set<Promise<unknown>>} */
    this.active = new Set();
    this.restoring = false;
  }

  /**
   * Runs an ordinary request concurrently, or reserves exclusive access for a restore and drains active requests first.
   * @template T
   * @param {boolean} exclusive True only for the confirmed restore endpoint.
   * @param {() => T|Promise<T>} operation Request handler including its asynchronous side effects.
   * @return {Promise<T>} Result of the operation.
   * @throws {import('../domain/errors.js').HttpError} If a restore is already waiting or running.
   */
  async run(exclusive, operation) {
    if (this.restoring) throw fail('Wiederherstellung läuft', 503, 'api.errors.restoreInProgress');
    if (exclusive) {
      this.restoring = true;
      try {
        await Promise.allSettled([...this.active]);
        return await operation();
      } finally {this.restoring = false;}
    }
    const work = Promise.resolve().then(operation);
    this.active.add(work);
    try {return await work;}
    finally {this.active.delete(work);}
  }
}
