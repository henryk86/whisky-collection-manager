/**
 * Represents an API error with stable, locale-independent identifiers.
 *
 * Its internal message is used for diagnostics and is not sent verbatim to
 * clients; translations are selected from the error code.
 */
export class HttpError extends Error {
  /**
 * Creates an API error with a stable code and internal diagnostic message.
 *
 * @param {string} message Internal message, never exposed verbatim.
 * @param {number=} status HTTP response status.
 * @param {?string=} code Localizable error identifier.
 * @param {!Object=} params Safe structured translation arguments.
 */
  constructor(message, status = 400, code = null, params = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.params = params;
  }
}
/**
 * Builds a coded HTTP error without throwing it.
 *
 * @param {string} message Internal diagnostic message.
 * @param {number=} status HTTP status code.
 * @param {?string=} code Stable error identifier for localization.
 * @param {!Object=} params Safe structured translation parameters.
 * @return {!HttpError} Error object for the caller to throw.
 */
export function fail(message, status = 400, code = null, params = {}) {
  return new HttpError(message, status, code, params);
}

/**
 * Throws a coded HTTP error when a precondition is false.
 *
 * @param {boolean} condition Whether the precondition is satisfied.
 * @param {string} message Internal diagnostic message.
 * @param {number=} status HTTP status code.
 * @param {?string=} code Stable error identifier for localization.
 * @param {!Object=} params Safe structured translation parameters.
 * @throws {HttpError} When the condition is false.
 */
export function assert(condition, message, status = 400, code = null,
  params = {}) {
  if (!condition) throw new HttpError(message, status, code, params);
}
