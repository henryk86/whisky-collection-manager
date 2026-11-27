import http from 'node:http';
import {handleApi} from './routes/index.js';
import {serveStatic} from './http/static-files.js';
import {send} from './http/response.js';
import {fail} from './domain/errors.js';
import {publicErrorResponse} from './domain/public-error-response.js';
import {allowedExtensionOrigin, requireSameOriginMutation, requireAllowedHost}
  from './http/request-security.js';
import {initialize} from './storage/collection-store.js';
import {initWarehouse} from './storage/warehouse-store.js';
import {initializeAuth, authorizeRequest} from './services/auth.js';
import {authorizeAdmin} from './services/backups.js';
import {RestoreGate} from './storage/restore-gate.js';
import {hasInterruptedRestore, recoverInterruptedRestore} from './storage/restore-transaction.js';
import {ROOT} from './storage/paths.js';
/**
 * Initializes persisted stores and returns the secured HTTP request dispatcher.
 * @return {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>} Asynchronous request handler.
 */
export function createRequestHandler() {
  // Recovery must precede initialization: a missing live directory may be temporarily parked.
  recoverInterruptedRestore(ROOT);
  const restoreGate = new RestoreGate();
  initialize();
  initWarehouse();
  initializeAuth();
  return (
    /**
     * Routes an HTTP request through security checks and application handlers.
     *
     * @param {!http.IncomingMessage} request Incoming HTTP request.
     * @param {!http.ServerResponse} response Outgoing HTTP response.
     * @return {!Promise<void>} Completion of request handling.
     */
    async function handleRequest(request, response) {
      try {
        requireAllowedHost(request);
        const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        // The local image staging endpoint may be called directly by the
        // Chrome/Edge extension origins (optionally restricted by
        // EXTENSION_IDS).
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
        requireSameOriginMutation(request, url, {extensionStage: url.pathname === '/api/import-image/stage'});
        if (hasInterruptedRestore(ROOT)) throw fail('Wiederherstellung muss vor weiteren Zugriffen abgeschlossen werden', 503, 'api.errors.restoreRecoveryRequired');
        authorizeRequest(request, url);
        const exclusiveRestore = request.method === 'POST' && /^\/api\/backups\/import-zip\/[\w-]+\/apply$/.test(url.pathname);
        if (exclusiveRestore) authorizeAdmin(request);
        return await restoreGate.run(exclusiveRestore, async () => {
          authorizeRequest(request, url);
          if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/internal/backup/')) {
            return await handleApi(request, response, url);
          }
          if (request.method !== 'GET') {
            throw fail('Methode nicht erlaubt', 405, 'api.errors.methodNotAllowed');
          }
          await serveStatic(request, response, url);
        });
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
    }
  );
}

/**
 * Creates the HTTP server using the initialized application request handler.
 * @return {import('node:http').Server} Server instance; the caller starts listening.
 */
export function createServer() {
  return http.createServer(createRequestHandler());
}
