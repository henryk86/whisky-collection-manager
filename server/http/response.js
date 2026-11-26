/**
 * Consistent JSON responses and downloadable files.
 *
 * @param {!Object} res Outgoing HTTP response.
 * @param {*} status HTTP or entity status used for validation.
 * @param {!Object} data Input data for the operation.
 * @param {string=} type Response media type; determines whether the body is JSON-encoded.
 * @param {!Object=} extraHeaders Additional response headers, merged with the defaults.
 */
export function send(
  res,
  status,
  data,
  type = 'application/json; charset=utf-8',
  extraHeaders = {}
) {
  res.writeHead(status, {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

/**
 * Sets download headers for a response attachment.
 *
 * @param {!Object} response Outgoing response.
 * @param {!Object} options2 Destructured options for this operation.
 * @param {!Object=} options3 Destructured options for this operation.
 */
export function attachment(response, {filename, type, bytes},
  {inline = false} = {}) {
  // HTTP response headers must stay ASCII; the RFC 5987 name preserves umlauts.
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/[\\";\r\n]/g, '_');
  const disposition = `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
  response.writeHead(200, {
    'Content-Type': type,
    'Content-Disposition': disposition,
    'Content-Length': Buffer.byteLength(bytes),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  response.end(bytes);
}

/**
 * Stream large backups without reading the whole archive into Pi memory.
 *
 * @param {!Object} response Outgoing response.
 * @param {!Object} options2 Destructured options for this operation.
 */
export async function fileAttachment(response, {filename, type, path: file,
  cleanup = false}) {
  const fs = await import('node:fs');
  const {pipeline} = await import('node:stream/promises');
  const size = fs.statSync(file).size;
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/[\\";\r\n]/g, '_');
  response.writeHead(200, {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Content-Length': size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  try {
    await pipeline(fs.createReadStream(file), response);
  } finally {
    if (cleanup) fs.rmSync(file, {force: true});
  }
}
