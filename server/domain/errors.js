/** Domain/API errors carry stable, locale-independent codes at the throw site.
 * Internal messages remain for diagnostics; HTTP responses never expose them. */
export class HttpError extends Error {
  constructor(message, status = 400, code = null, params = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.params = params;
  }
}
export function fail(message, status = 400, code = null, params = {}) {
  return new HttpError(message, status, code, params);
}
export function assert(condition, message, status = 400, code = null, params = {}) {
  if (!condition) throw new HttpError(message, status, code, params);
}
