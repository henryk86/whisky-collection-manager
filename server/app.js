import http from 'node:http';
import { handleApi } from './routes.js';
import { serveStatic } from './http/static-files.js';
import { send } from './http/response.js';
import { fail } from './domain/errors.js';
import { publicErrorResponse } from './domain/public-error-response.js';
import { allowedExtensionOrigin, requireSameOriginMutation, requireAllowedHost } from './http/request-security.js';
import { initialize } from './storage/collection-store.js';
import { initWarehouse } from './storage/warehouse-store.js';
/** One shared handler for HTTP and HTTPS; neither protocol owns application state. */
export function createRequestHandler() {
    initialize();
    initWarehouse();
    return async function handleRequest(request, response) {
        try {
            requireAllowedHost(request);
            const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
            // The local image staging endpoint may be called directly by the
            // Chrome/Edge extension origins (optionally restricted by EXTENSION_IDS).
            // By default any syntactically valid extension ID is permitted for
            // this staging route only, to preserve existing installations.
            // No wildcard CORS
            // headers are exposed for the collection or its files.
            const origin = request.headers.origin || '';
            const isExtension = allowedExtensionOrigin(origin);
            if (url.pathname === '/api/import-image/stage' && isExtension) {
                response.setHeader('Access-Control-Allow-Origin', origin);
                response.setHeader('Vary', 'Origin');
                response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                response.setHeader('Access-Control-Allow-Private-Network', 'true');
            }
            if (request.method === 'OPTIONS') {
                response.writeHead(url.pathname === '/api/import-image/stage' && isExtension ? 204 : 405);
                response.end();
                return;
            }
            requireSameOriginMutation(request, url, { extensionStage: url.pathname === '/api/import-image/stage' });
            if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/internal/backup/')) {
                return await handleApi(request, response, url);
            }
            if (request.method !== 'GET') {
                throw fail('Methode nicht erlaubt', 405);
            }
            await serveStatic(request, response, url);
        }
        catch (error) {
            // Closing a download (navigation, mobile connectivity, etc.) is not
            // a server failure. Keep genuine read/stream errors visible in logs.
            const connectionClosed = ['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET', 'EPIPE', 'ABORT_ERR'].includes(error.code);
            // A client that closes mid-upload cannot receive an error response.
            // Do not treat that normal disconnect as an internal server failure.
            const abortedUpload = connectionClosed && !request.complete && (request.aborted || request.destroyed);
            if (connectionClosed && (response.headersSent || abortedUpload)) {
                response.destroy();
                return;
            }
            if (!response.headersSent) {
                send(response, error.status || 500, publicErrorResponse(error));
            }
            else {
                response.destroy();
            }
            if (!error.status) {
                console.error(error);
            }
        }
    };
}
export function createServer() {
    return http.createServer(createRequestHandler());
}
