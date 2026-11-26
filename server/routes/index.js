/** HTTP dispatch shared by all feature route modules. */
import {readJson} from '../http/request.js';
import {send, attachment, fileAttachment} from '../http/response.js';
import {fail} from '../domain/errors.js';
import {collectionETag} from '../storage/collection-store.js';
import {warehouseETag} from '../storage/warehouse-store.js';
import {withMutationTracking} from '../domain/mutation-tracker.js';
import {systemRoutes} from './system.js';
import {authRoutes} from './auth.js';
import {warehouseRoutes} from './warehouse.js';
import {distilleriesRoutes} from './distilleries.js';
import {settingsRoutes} from './settings.js';
import {recoveryRoutes} from './recovery.js';
import {backupsRoutes} from './backups.js';
import {stagedImagesRoutes} from './staged-images.js';
import {collectionRoutes} from './collection.js';
import {tastingsRoutes} from './tastings.js';

// First matching method and path wins. Preserve each feature's route order.
const routes = [
  ...systemRoutes,
  ...authRoutes,
  ...warehouseRoutes,
  ...distilleriesRoutes,
  ...settingsRoutes,
  ...recoveryRoutes,
  ...backupsRoutes,
  ...stagedImagesRoutes,
  ...collectionRoutes,
  ...tastingsRoutes,
];

/**
 * Dispatches an already authorized API request, including conditional caching and response handling.
 * Authentication, Host and origin checks are enforced by the application request handler.
 *
 * @param {import('node:http').IncomingMessage} request Incoming request.
 * @param {import('node:http').ServerResponse} response Outgoing response.
 * @param {URL} url Parsed request URL.
 * @return {Promise<void>} Completion after writing the response; rejects with the API error on failure.
 */
export async function handleApi(request, response, url) {
  for (const route of routes) {
    if (route.method !== request.method) {
      continue;
    }
    const match = url.pathname.match(route.path);
    if (!match) {
      continue;
    }
    // The warehouse response also contains projected collection bottles.
    // Both revisions must enter its validator to avoid stale bottle labels.
    let cacheHeaders = null;
    if (route.method === 'GET' && route.cacheResource) {
      const etag = route.cacheResource === 'collection' ? collectionETag()
        : `W/"${collectionETag().slice(3, -1)}:${warehouseETag().slice(3, -1)}"`;
      cacheHeaders = {
        'Cache-Control': 'private, no-cache',
        ETag: etag,
        Vary: 'Accept-Encoding',
        ...(route.cacheResource === 'warehouse' ? {'X-WCM-Store-ETag': warehouseETag()} : {}),
      };
      const conditional = request.headers['if-none-match'];
      if (typeof conditional === 'string' &&
        (conditional.trim() === '*' || conditional.split(',').some(token => token.trim() === etag))) {
        response.writeHead(304, cacheHeaders);
        response.end();
        return;
      }
    }
    const body = ['POST', 'PATCH', 'PUT'].includes(request.method) && !route.binaryUpload && !route.skipBody ? await readJson(request) :
      undefined;
    // Opt-in response envelope keeps the existing external API unchanged.
    // Only successfully committed store writes appear in the response.
    const wantsDelta = request.headers['x-wcm-state-delta'] === '1' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    const tracked = wantsDelta
      ? await withMutationTracking(() => route.run(match.slice(1), body, request, response))
      : {
        value: await route.run(match.slice(1), body, request, response),
        updates: [],
      };
    const result = tracked.value;
    if (route.inlineImage) {
      response.writeHead(200, {
        'Content-Type': result.type, 'Content-Length': result.bytes.length,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
      });
      response.end(result.bytes);
      return;
    }
    if (route.inlinePdf) {
      return attachment(response, result, {inline: true});
    }
    if (route.download) {
      return attachment(response, result);
    }
    if (route.downloadFile) {
      return await fileAttachment(response, result);
    }
    return send(response, route.status || 200,
      wantsDelta && tracked.updates.length ? {__wcmStateDelta: 1, result, updates: tracked.updates} : result,
      'application/json; charset=utf-8', cacheHeaders || {});
  }
  throw fail('API-Endpunkt nicht gefunden', 404, "api.errors.apiEndpointNotFound");
}
