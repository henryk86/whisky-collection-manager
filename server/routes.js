/** HTTP contract in one place. Routes delegate business logic; they do not write files. */
import { readJson } from './http/request.js';
import { send, attachment, fileAttachment } from './http/response.js';
import { fail } from './domain/errors.js';
import * as collection from './services/collection.js';
import * as warehouse from './services/warehouse.js';
import * as settings from './services/settings.js';
import * as bottlings from './services/bottlings.js';
import * as bottles from './services/bottles.js';
import * as distilleries from './services/distilleries.js';
import { findDistilleryLocations } from './services/distillery-geocoding.js';
import * as exports from './services/exports.js';
import * as stagedImages from './services/staged-images.js';
import * as backups from './services/backups.js';
import * as recovery from './services/backup-recovery.js';
import fs from 'node:fs';
// Parameters match existing IDs (UUIDs as well as IDs from imported collections).
const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const routes = [
    { method: 'GET', path: /^\/api\/version$/, run: () => ({ version }) },
    { method: 'GET', path: /^\/api\/warehouse$/, run: () => warehouse.getWarehouse() },
    { method: 'POST', path: /^\/api\/warehouse\/rooms$/, status: 201, run: (_, body) => warehouse.createRoom(body) },
    { method: 'PATCH', path: /^\/api\/warehouse\/rooms\/([\w-]+)$/, run: ([id], body) => warehouse.updateRoom(id, body) },
    { method: 'DELETE', path: /^\/api\/warehouse\/rooms\/([\w-]+)$/, run: ([id]) => warehouse.deleteRoom(id) },
    { method: 'POST', path: /^\/api\/warehouse\/rooms\/([\w-]+)\/furniture$/, status: 201, run: ([id], body) => warehouse.createFurniture(id, body) },
    { method: 'PATCH', path: /^\/api\/warehouse\/furniture\/bulk$/, run: (_, body) => warehouse.bulkUpdateFurniture(body) },
    { method: 'POST', path: /^\/api\/warehouse\/furniture\/bulk\/delete$/, run: (_, body) => warehouse.bulkDeleteFurniture(body) },
    { method: 'PATCH', path: /^\/api\/warehouse\/furniture\/([\w-]+)$/, run: ([id], body) => warehouse.updateFurniture(id, body) },
    { method: 'DELETE', path: /^\/api\/warehouse\/furniture\/([\w-]+)$/, run: ([id]) => warehouse.deleteFurniture(id) },
    { method: 'POST', path: /^\/api\/warehouse\/furniture\/([\w-]+)\/copy$/, status: 201, run: ([id], body) => warehouse.copyFurniture(id, body) },
    { method: 'POST', path: /^\/api\/warehouse\/furniture\/([\w-]+)\/shelves$/, status: 201, run: ([id], body) => warehouse.createShelf(id, body) },
    { method: 'PATCH', path: /^\/api\/warehouse\/shelves\/([\w-]+)\/move$/, run: ([id], body) => warehouse.moveShelf(id, body) },
    { method: 'PATCH', path: /^\/api\/warehouse\/shelves\/([\w-]+)$/, run: ([id], body) => warehouse.updateShelf(id, body) },
    { method: 'DELETE', path: /^\/api\/warehouse\/shelves\/([\w-]+)$/, run: ([id]) => warehouse.deleteShelf(id) },
    { method: 'POST', path: /^\/api\/warehouse\/shelves\/([\w-]+)\/copy$/, status: 201, run: ([id], body) => warehouse.copyShelf(id, body) },
    { method: 'PUT', path: /^\/api\/warehouse\/bottles\/([\w-]+)$/, run: ([id], body) => warehouse.assignBottle(id, body) },
    { method: 'POST', path: /^\/api\/map\/find-distillery$/, run: (_args, body) => findDistilleryLocations(body) },
    { method: 'PATCH', path: /^\/api\/settings$/, run: (_args, body) => settings.updateSettings(body) },
    { method: 'POST', path: /^\/api\/backups\/password$/, run: (_args, body, req) => backups.setZipPassword(req, body) },
    { method: 'GET', path: /^\/api\/backups$/, run: (_args, _body, req) => backups.getDashboard(req) },
    { method: 'POST', path: /^\/api\/backups\/import-zip$/, binaryUpload: true, status: 201, run: (_args, _body, req) => recovery.receiveZip(req) },
    { method: 'POST', path: /^\/api\/backups\/import-zip\/([\w-]+)\/unlock$/, run: ([id], body, req) => recovery.unlockPreparedZip(req, id, body) },
    { method: 'GET', path: /^\/api\/backups\/import-zip\/([\w-]+)$/, run: ([id], _body, req) => recovery.previewZip(req, id) },
    { method: 'GET', path: /^\/api\/backups\/import-zip\/([\w-]+)\/download$/, downloadFile: true, run: ([id], _body, req) => recovery.downloadPreparedZip(req, id) },
    { method: 'POST', path: /^\/api\/backups\/import-zip\/([\w-]+)\/apply$/, run: ([id], body, req) => recovery.applyZip(req, id, body) },
    { method: 'POST', path: /^\/api\/backups$/, status: 201, run: (_args, body, req) => backups.createProfile(req, body) },
    { method: 'PUT', path: /^\/api\/backups\/([\w-]+)$/, run: ([id], body, req) => backups.updateProfile(req, id, body) },
    { method: 'DELETE', path: /^\/api\/backups\/([\w-]+)$/, run: ([id], _body, req) => backups.deleteProfile(req, id) },
    { method: 'POST', path: /^\/api\/backups\/([\w-]+)\/(run|check|test|snapshots|restore|prepare)$/, status: 202, run: ([id, type], body, req) => backups.queueJob(req, id, type, body) },
    { method: 'GET', path: /^\/api\/backups\/([\w-]+)\/files\/(whisky-backup-[\w-]+\.zip)$/, downloadFile: true, run: ([id, filename], _body, req) => backups.downloadLocalZip(req, id, filename) },
    { method: 'POST', path: /^\/internal\/backup\/snapshot\/([\w-]+)$/, run: ([id], _body, req) => backups.createSourceSnapshot(req, id) },

    {
        method: 'POST', path: /^\/api\/import-image\/stage$/, status: 201, run: (_, body) => stagedImages.stageImage(body)
    },
    {
        method: 'GET', path: /^\/api\/import-image\/stage\/([\w-]+)$/, inlineImage: true, run: ([token]) => stagedImages.previewImage(token)
    },
    {
        method: 'POST', path: /^\/api\/bottles\/([\w-]+)\/photos\/from-stage$/, status: 201,
        run: ([id], body) => stagedImages.attachImageToBottle(id, body)
    },
    {
        method: 'GET', path: /^\/api\/collection$/, run: () => collection.getCollection()
    },
    {
        method: 'GET', path: /^\/api\/suggest-number$/, run: () => collection.getNextInventoryNumber()
    },
    {
        method: 'POST', path: /^\/api\/bottlings$/, status: 201, run: (_, body) => bottlings.createBottling(body)
    },
    {
        method: 'PATCH', path: /^\/api\/bottlings\/([\w-]+)$/, run: ([id], body) => bottlings.updateBottling(id, body)
    },
    {
        method: 'DELETE', path: /^\/api\/bottlings\/([\w-]+)$/, run: ([id]) => bottlings.deleteBottling(id)
    },
    {
        method: 'POST', path: /^\/api\/bottles$/, status: 201, run: (_, body) => bottles.createBottle(body)
    },
    {
        method: 'PATCH', path: /^\/api\/bottles\/([\w-]+)$/, run: ([id], body) => bottles.updateBottle(id, body)
    },
    {
        method: 'DELETE', path: /^\/api\/bottles\/([\w-]+)$/, run: ([id]) => bottles.deleteBottle(id)
    },
    {
        method: 'POST', path: /^\/api\/bottles\/([\w-]+)\/photos$/, status: 201, run: ([id], body) => bottles.addPhoto(id, body)
    },
    {
        method: 'PUT', path: /^\/api\/bottles\/([\w-]+)\/photos\/order$/, run: ([id], body) => bottles.reorderPhotos(id, body)
    },
    {
        method: 'PUT', path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/cutout$/, run: ([id, photoId], body) => bottles.savePhotoCutout(id, photoId, body)
    },
    {
        method: 'PATCH', path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/cutout$/, run: ([id, photoId], body) => bottles.selectPhotoCutout(id, photoId, body)
    },
    {
        method: 'DELETE', path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/cutout$/, run: ([id, photoId]) => bottles.removePhotoCutout(id, photoId)
    },
    {
        method: 'PUT', path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/adjustments$/, run: ([id, photoId], body) => bottles.savePhotoAdjustments(id, photoId, body)
    },
    {
        method: 'DELETE', path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/adjustments$/, run: ([id, photoId]) => bottles.removePhotoAdjustments(id, photoId)
    },
    {
        method: 'DELETE', path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)$/, run: ([id, photoId]) => bottles.removePhoto(id, photoId)
    },
    {
        method: 'POST', path: /^\/api\/bottles\/([\w-]+)\/files$/, status: 201, run: ([id], body) => bottles.addFile(id, body)
    },
    {
        method: 'GET', path: /^\/api\/bottles\/([\w-]+)\/files\/([\w-]+)$/, download: true, run: ([id, fileId]) => bottles.downloadFile(id, fileId)
    },
    {
        method: 'DELETE', path: /^\/api\/bottles\/([\w-]+)\/files\/([\w-]+)$/, run: ([id, fileId]) => bottles.removeFile(id, fileId)
    },
    {
        method: 'POST', path: /^\/api\/distilleries$/, status: 201, run: (_, body) => distilleries.createDistillery(body)
    },
    {
        method: 'PATCH', path: /^\/api\/distilleries\/([\w-]+)$/, run: ([id], body) => distilleries.updateDistillery(id, body)
    },
    {
        method: 'POST', path: /^\/api\/import\/json$/, run: (_, body) => collection.importCollection(body)
    },
    {
        method: 'GET', path: /^\/api\/export\/json$/, download: true, run: () => exports.exportJson()
    },
    {
        method: 'GET', path: /^\/api\/export\/csv$/, download: true, run: () => exports.exportCsv()
    },
    {
        method: 'GET', path: /^\/api\/export\/zip$/, downloadFile: true, run: (_args, _body, req) => exports.exportZip(req)
    },
];
export async function handleApi(request, response, url) {
    for (const route of routes) {
        if (route.method !== request.method) {
            continue;
        }
        const match = url.pathname.match(route.path);
        if (!match) {
            continue;
        }
        const body = ['POST', 'PATCH', 'PUT'].includes(request.method) && !route.binaryUpload ? await readJson(request) : undefined;
        const result = await route.run(match.slice(1), body, request);
        if (route.inlineImage) {
            response.writeHead(200, { 'Content-Type': result.type, 'Content-Length': result.bytes.length,
                'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
            return response.end(result.bytes);
        }
        if (route.download) {
            return attachment(response, result);
        }
        if (route.downloadFile) {
            return await fileAttachment(response, result);
        }
        return send(response, route.status || 200, result);
    }
    throw fail('API-Endpunkt nicht gefunden', 404);
}
