/**
 * API route metadata shared by feature modules and the HTTP dispatcher.
 * The parsed JSON body remains untrusted until validated by its service.
 *
 * @typedef {Object} ApiRoute
 * @property {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method HTTP method to match.
 * @property {RegExp} path Exact pathname pattern; capture groups identify resources.
 * @property {function(string[], Record<string, unknown>|undefined, import('node:http').IncomingMessage, import('node:http').ServerResponse): unknown} run Service delegate; may return a promise.
 * @property {number=} status Successful JSON response status (default 200).
 * @property {boolean=} skipBody Skip JSON parsing for an action with no body.
 * @property {boolean=} binaryUpload Leave the request stream to the binary upload service.
 * @property {boolean=} inlineImage Send the returned image bytes with their media type.
 * @property {boolean=} inlinePdf Send the returned PDF descriptor with inline disposition.
 * @property {boolean=} download Send an in-memory attachment descriptor.
 * @property {boolean=} downloadFile Stream a file attachment descriptor and honor its cleanup flag.
 * @property {('collection'|'warehouse')=} cacheResource Conditional GET validator for the selected resource.
 */
export {};
