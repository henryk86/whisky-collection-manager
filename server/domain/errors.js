/** An expected validation/API error. Unexpected errors are never exposed to clients. */
export class HttpError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}
export function fail(message, status = 400) {
    return new HttpError(message, status);
}
export function assert(condition, message, status = 400) {
    if (!condition) {
        throw new HttpError(message, status);
    }
}
