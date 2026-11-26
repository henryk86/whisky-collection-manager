/**
 * HTTP contract in one place. Routes delegate business logic; they do not write
 * files.
 */
import {readJson} from './http/request.js';
import {send, attachment, fileAttachment} from './http/response.js';
import {fail} from './domain/errors.js';
import * as collection from './services/collection.js';
import * as warehouse from './services/warehouse.js';
import * as settings from './services/settings.js';
import * as auth from './services/auth.js';
import * as bottlings from './services/bottlings.js';
import * as tastings from './services/tastings.js';
import * as standaloneTastings from './services/standalone-tastings.js';
import * as tastingFlights from './services/tasting-flights.js';
import * as bottles from './services/bottles.js';
import * as distilleries from './services/distilleries.js';
import {findDistilleryLocations} from './services/distillery-geocoding.js';
import * as exports from './services/exports.js';
import * as stagedImages from './services/staged-images.js';
import * as backups from './services/backups.js';
import * as recovery from './services/backup-recovery.js';
import fs from 'node:fs';
import {collectionETag} from './storage/collection-store.js';
import {warehouseETag} from './storage/warehouse-store.js';
import {withMutationTracking} from './domain/mutation-tracker.js';
// Parameters match existing IDs (UUIDs as well as IDs from imported
// collections).
const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const routes = [
  {
    method: 'GET', path: /^\/api\/version$/,
    /**
     * Reports the running package version.
     * @return {{version: string}} Installed application version.
     */
    run: () => ({version}),
  },
  {
    method: 'GET',
    path: /^\/api\/auth\/session$/,
    /**
     * Reports the login requirement and active session without returning credentials.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof auth.sessionInfo>} Authentication status.
     */
    run: (_, _body, req) => auth.sessionInfo(req),
  },
  {
    method: 'POST',
    path: /^\/api\/auth\/login$/,
    /**
     * Authenticates credentials and lets the service set the session cookie.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Username and password fields.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @param {import('node:http').ServerResponse} res Response whose session cookie is set or expired.
     * @return {ReturnType<typeof auth.login>} Authenticated session status.
     */
    run: (_, body, req, res) => auth.login(req, body, res),
  },
  {
    method: 'POST',
    path: /^\/api\/auth\/logout$/,
    skipBody: true,
    /**
     * Ends the current session and expires its cookie.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @param {import('node:http').ServerResponse} res Response whose session cookie is set or expired.
     * @return {ReturnType<typeof auth.logout>} Logged-out authentication status.
     */
    run: (_, _body, req, res) => auth.logout(req, res),
  },
  {
    method: 'POST',
    path: /^\/api\/auth\/password$/,
    /**
     * Replaces the current account password and rotates its session cookie.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Current and replacement password fields.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @param {import('node:http').ServerResponse} res Response whose session cookie is set or expired.
     * @return {ReturnType<typeof auth.changePassword>} Updated session status.
     */
    run: (_, body, req, res) => auth.changePassword(req, body, res),
  },
  {
    method: 'GET',
    path: /^\/api\/auth\/users$/,
    /**
     * Lists public account metadata for the authorized administrator.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof auth.listUsers>} User-management state.
     */
    run: (_, _body, req) => auth.listUsers(req),
  },
  {
    method: 'POST',
    path: /^\/api\/auth\/users$/,
    status: 201,
    /**
     * Creates a standard account that must change its password at first login.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Username and initial password.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof auth.createUser>} New public account.
     */
    run: (_, body, req) => auth.createUser(req, body),
  },
  {
    method: 'POST',
    path: /^\/api\/auth\/users\/([\w-]+)\/reset-password$/,
    /**
     * Sets a temporary password for another account and invalidates its sessions.
     *
     * @param {string[]} items Captured user identifier or route value.
     * @param {*} body Untrusted JSON: Replacement password.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof auth.resetPassword>} Updated public account.
     */
    run: ([id], body, req) => auth.resetPassword(req, id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/auth\/users\/([\w-]+)$/,
    /**
     * Removes a non-admin account and invalidates its sessions.
     *
     * @param {string[]} items Captured user identifier or route value.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof auth.removeUser>} Deletion confirmation.
     */
    run: ([id], _body, req) => auth.removeUser(req, id),
  },
  {
    method: 'PATCH',
    path: /^\/api\/auth\/config$/,
    /**
     * Persists the administrator’s optional-login preference.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Boolean required setting.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof auth.setLoginRequired>} Updated login requirement.
     */
    run: (_, body, req) => auth.setLoginRequired(req, body),
  },
  {
    method: 'GET',
    path: /^\/api\/warehouse$/,
    /**
     * Loads the current warehouse, including its projected inventory.
     * @return {ReturnType<typeof warehouse.getWarehouse>} Current warehouse state.
     */
    run: () => warehouse.getWarehouse(),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms\/export$/,
    /**
     * Exports selected room layouts with optional inventory assignments.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Room IDs and assignment inclusion option.
     * @return {ReturnType<typeof warehouse.exportRooms>} Room-transfer document.
     */
    run: (_, body) => warehouse.exportRooms(body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms\/import\/preview$/,
    /**
     * Computes import conflicts and a preview without committing warehouse changes.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Room-transfer document and conflict/assignment options.
     * @return {ReturnType<typeof warehouse.previewRoomImport>} Proposed import summary.
     */
    run: (_, body) => warehouse.previewRoomImport(body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms\/import$/,
    /**
     * Applies the validated room transfer in a warehouse mutation.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Room-transfer document and conflict/assignment options.
     * @return {ReturnType<typeof warehouse.importRooms>} Committed import summary.
     */
    run: (_, body) => warehouse.importRooms(body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms$/,
    status: 201,
    /**
     * Adds a storage room after its dimensions and name are validated.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: New room fields.
     * @return {ReturnType<typeof warehouse.createRoom>} Created room.
     */
    run: (_, body) => warehouse.createRoom(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/rooms\/([\w-]+)$/,
    /**
     * Updates the selected room while retaining layout constraints.
     *
     * @param {string[]} items Captured room identifier or route value.
     * @param {*} body Untrusted JSON: Room changes.
     * @return {ReturnType<typeof warehouse.updateRoom>} Updated room.
     */
    run: ([id], body) => warehouse.updateRoom(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/warehouse\/rooms\/([\w-]+)$/,
    /**
     * Deletes the selected room; the query option controls whether assigned bottles may be unassigned.
     *
     * @param {string[]} items Captured room identifier or route value.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof warehouse.deleteRoom>} Room deletion result.
     * @throws {import('./domain/errors.js').HttpError} HTTP 400 for an invalid unassignBottles query value.
     */
    run: ([id], _body, req) => {
      const option = new URL(req.url, 'http://localhost').searchParams.get('unassignBottles');
      if (option !== null && option !== 'true' && option !== 'false') throw fail('Ungültige Löschoption', 400, "api.errors.invalidDeletionOption");
      return warehouse.deleteRoom(id, {unassignBottles: option === 'true'});
    },
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/rooms\/([\w-]+)\/furniture$/,
    status: 201,
    /**
     * Creates a furniture item inside the identified room.
     *
     * @param {string[]} items Captured room identifier or route value.
     * @param {*} body Untrusted JSON: Furniture layout fields.
     * @return {ReturnType<typeof warehouse.createFurniture>} Created furniture item.
     */
    run: ([id], body) => warehouse.createFurniture(id, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/furniture\/bulk$/,
    /**
     * Applies selected bulk furniture changes together.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Selected furniture IDs and update fields.
     * @return {ReturnType<typeof warehouse.bulkUpdateFurniture>} Bulk mutation result.
     */
    run: (_, body) => warehouse.bulkUpdateFurniture(body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/furniture\/bulk\/delete$/,
    /**
     * Deletes the selected furniture in a bulk mutation.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Selected furniture IDs and deletion options.
     * @return {ReturnType<typeof warehouse.bulkDeleteFurniture>} Bulk deletion result.
     */
    run: (_, body) => warehouse.bulkDeleteFurniture(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)$/,
    /**
     * Updates the selected furniture layout and configuration.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Furniture changes.
     * @return {ReturnType<typeof warehouse.updateFurniture>} Updated furniture item.
     */
    run: ([id], body) => warehouse.updateFurniture(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)$/,
    /**
     * Deletes the selected furniture subject to assignment constraints.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @return {ReturnType<typeof warehouse.deleteFurniture>} Furniture deletion result.
     */
    run: ([id]) => warehouse.deleteFurniture(id),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/photos$/,
    status: 201,
    /**
     * Stores a photo for the selected furniture item.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Encoded image data.
     * @return {ReturnType<typeof warehouse.addFurniturePhoto>} Added furniture photo.
     */
    run: ([id], body) => warehouse.addFurniturePhoto(id, body),
  },
  {
    method: 'PUT',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/photos\/order$/,
    /**
     * Persists the requested order of existing furniture photos.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Ordered photo IDs.
     * @return {ReturnType<typeof warehouse.reorderFurniturePhotos>} Updated photo order.
     */
    run: ([id], body) => warehouse.reorderFurniturePhotos(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/photos\/([\w-]+)$/,
    /**
     * Removes a specified photo from its owning furniture item.
     *
     * @param {string[]} items Captured furniture and photo identifiers or route values, in that order.
     * @return {ReturnType<typeof warehouse.deleteFurniturePhoto>} Furniture photo deletion result.
     */
    run: ([id, photoId]) => warehouse.deleteFurniturePhoto(id, photoId),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/copy$/,
    status: 201,
    /**
     * Copies the selected furniture into the requested storage location.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Copy destination and options.
     * @return {ReturnType<typeof warehouse.copyFurniture>} Copied furniture item.
     */
    run: ([id], body) => warehouse.copyFurniture(id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/furniture\/([\w-]+)\/shelves$/,
    status: 201,
    /**
     * Creates a compartment in the selected furniture item.
     *
     * @param {string[]} items Captured furniture identifier or route value.
     * @param {*} body Untrusted JSON: Shelf configuration.
     * @return {ReturnType<typeof warehouse.createShelf>} Created shelf.
     */
    run: ([id], body) => warehouse.createShelf(id, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/shelves\/([\w-]+)\/move$/,
    /**
     * Moves a shelf according to the requested target and ordering.
     *
     * @param {string[]} items Captured shelf identifier or route value.
     * @param {*} body Untrusted JSON: Target compartment position.
     * @return {ReturnType<typeof warehouse.moveShelf>} Shelf movement result.
     */
    run: ([id], body) => warehouse.moveShelf(id, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/warehouse\/shelves\/([\w-]+)$/,
    /**
     * Updates a shelf’s name, capacity or front and height settings.
     *
     * @param {string[]} items Captured shelf identifier or route value.
     * @param {*} body Untrusted JSON: Shelf changes.
     * @return {ReturnType<typeof warehouse.updateShelf>} Updated shelf.
     */
    run: ([id], body) => warehouse.updateShelf(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/warehouse\/shelves\/([\w-]+)$/,
    /**
     * Removes the selected shelf subject to storage constraints.
     *
     * @param {string[]} items Captured shelf identifier or route value.
     * @return {ReturnType<typeof warehouse.deleteShelf>} Shelf deletion result.
     */
    run: ([id]) => warehouse.deleteShelf(id),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/shelves\/([\w-]+)\/copy$/,
    status: 201,
    /**
     * Copies the selected shelf to the requested furniture or position.
     *
     * @param {string[]} items Captured shelf identifier or route value.
     * @param {*} body Untrusted JSON: Copy destination and options.
     * @return {ReturnType<typeof warehouse.copyShelf>} Copied shelf.
     */
    run: ([id], body) => warehouse.copyShelf(id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/warehouse\/bottles\/bulk$/,
    /**
     * Applies a batch of physical bottle location assignments.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Physical bottle IDs and target assignments.
     * @return {ReturnType<typeof warehouse.assignBottles>} Assignment mutation result.
     */
    run: (_, body) => warehouse.assignBottles(body),
  },
  {
    method: 'PUT',
    path: /^\/api\/warehouse\/bottles\/([\w-]+)$/,
    /**
     * Assigns or unassigns the selected physical bottle.
     *
     * @param {string[]} items Captured bottle identifier or route value.
     * @param {*} body Untrusted JSON: Requested storage location.
     * @return {ReturnType<typeof warehouse.assignBottle>} Updated bottle assignment.
     */
    run: ([id], body) => warehouse.assignBottle(id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/map\/find-distillery$/,
    /**
     * Requests geocoding candidates for the supplied distillery metadata.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} body Untrusted JSON: Distillery search fields.
     * @return {ReturnType<typeof findDistilleryLocations>} Location search results.
     */
    run: (_args, body) => findDistilleryLocations(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/settings$/,
    /**
     * Persists collection-wide settings independently of physical bottle records.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} body Untrusted JSON: Settings changes.
     * @return {ReturnType<typeof settings.updateSettings>} Updated collection settings.
     */
    run: (_args, body) => settings.updateSettings(body),
  },
  {
    method: 'PUT',
    path: /^\/api\/settings\/saved-views$/,
    /**
     * Replaces the saved collection view configurations.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} body Untrusted JSON: Saved-view configurations.
     * @return {ReturnType<typeof settings.updateSavedViews>} Updated saved views.
     */
    run: (_args, body) => settings.updateSavedViews(body),
  },
  {
    method: 'POST',
    path: /^\/api\/backups\/password$/,
    /**
     * Changes the configured ZIP archive password through the authorized backup service.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} body Untrusted JSON: New ZIP password.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof backups.setZipPassword>} Password update status without the secret.
     */
    run: (_args, body, req) => backups.setZipPassword(req, body),
  },
  {
    method: 'GET',
    path: /^\/api\/backups$/,
    /**
     * Loads backup profiles, job state and available targets for the administrator.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof backups.getDashboard>} Backup dashboard.
     */
    run: (_args, _body, req) => backups.getDashboard(req),
  },
  {
    method: 'POST',
    path: /^\/api\/backups\/import-zip$/,
    binaryUpload: true,
    status: 201,
    /**
     * Stages an uploaded ZIP archive from the raw HTTP request for recovery.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof recovery.receiveZip>} Prepared archive status.
     */
    run: (_args, _body, req) => recovery.receiveZip(req),
  },
  {
    method: 'POST',
    path: /^\/api\/backups\/import-zip\/([\w-]+)\/unlock$/,
    /**
     * Unlocks a staged archive using the supplied password.
     *
     * @param {string[]} items Captured prepared archive identifier or route value.
     * @param {*} body Untrusted JSON: Archive password.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof recovery.unlockPreparedZip>} Prepared archive status after validation.
     */
    run: ([id], body, req) => recovery.unlockPreparedZip(req, id, body),
  },
  {
    method: 'GET',
    path: /^\/api\/backups\/import-zip\/([\w-]+)$/,
    /**
     * Loads the preview of a prepared recovery archive.
     *
     * @param {string[]} items Captured prepared archive identifier or route value.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof recovery.previewZip>} Recovery preview.
     */
    run: ([id], _body, req) => recovery.previewZip(req, id),
  },
  {
    method: 'GET',
    path: /^\/api\/backups\/import-zip\/([\w-]+)\/download$/,
    downloadFile: true,
    /**
     * Returns a prepared ZIP archive as a download.
     *
     * @param {string[]} items Captured prepared archive identifier or route value.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof recovery.downloadPreparedZip>} Archive download descriptor.
     */
    run: ([id], _body, req) => recovery.downloadPreparedZip(req, id),
  },
  {
    method: 'POST',
    path: /^\/api\/backups\/import-zip\/([\w-]+)\/apply$/,
    /**
     * Applies the selected prepared archive using the requested recovery options.
     *
     * @param {string[]} items Captured prepared archive identifier or route value.
     * @param {*} body Untrusted JSON: Restore options and confirmation.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof recovery.applyZip>} Recovery result.
     */
    run: ([id], body, req) => recovery.applyZip(req, id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/backups$/,
    status: 201,
    /**
     * Creates a new ZIP backup profile through the authorized backup service.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} body Untrusted JSON: Backup profile fields.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof backups.createProfile>} Created profile.
     */
    run: (_args, body, req) => backups.createProfile(req, body),
  },
  {
    method: 'PUT',
    path: /^\/api\/backups\/([\w-]+)$/,
    /**
     * Updates the selected backup profile.
     *
     * @param {string[]} items Captured backup profile identifier or route value.
     * @param {*} body Untrusted JSON: Backup profile fields.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof backups.updateProfile>} Updated profile.
     */
    run: ([id], body, req) => backups.updateProfile(req, id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/backups\/([\w-]+)$/,
    /**
     * Deletes the selected backup profile through the authorized service.
     *
     * @param {string[]} items Captured backup profile identifier or route value.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof backups.deleteProfile>} Profile deletion result.
     */
    run: ([id], _body, req) => backups.deleteProfile(req, id),
  },
  {
    method: 'POST',
    path: new RegExp('^\\/api\\/backups\\/([\\w-]+)\\/(run|check' + '|test|snapshots|restore|prepare)$'),
    status: 202,
    /**
     * Queues the requested worker operation for the selected backup profile.
     *
     * @param {string[]} items Captured backup profile and job type identifiers or route values, in that order.
     * @param {*} body Untrusted JSON: Operation-specific arguments.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof backups.queueJob>} Queued job status.
     */
    run: ([id, type], body, req) => backups.queueJob(req, id, type, body),
  },
  {
    method: 'GET',
    path: /^\/api\/backups\/([\w-]+)\/files\/(whisky-backup-[\w-]+\.zip)$/,
    downloadFile: true,
    /**
     * Resolves a local ZIP download belonging to the selected profile.
     *
     * @param {string[]} items Captured backup profile and archive filename identifiers or route values, in that order.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof backups.downloadLocalZip>} Local archive download descriptor.
     */
    run: ([id, filename], _body, req) =>
      backups.downloadLocalZip(req, id, filename),
  },
  {
    method: 'POST',
    path: /^\/internal\/backup\/snapshot\/([\w-]+)$/,
    /**
     * Creates the consistent collection snapshot for an authenticated backup worker.
     *
     * @param {string[]} items Captured snapshot job identifier or route value.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof backups.createSourceSnapshot>} Snapshot descriptor.
     */
    run: ([id], _body, req) => backups.createSourceSnapshot(req, id),
  },

  {
    method: 'POST',
    path: /^\/api\/import-image\/stage$/,
    status: 201,
    /**
     * Stages an imported image before attaching it to a physical bottle.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Encoded imported image.
     * @return {ReturnType<typeof stagedImages.stageImage>} Pending-image token and staging status.
     */
    run: (_, body) => stagedImages.stageImage(body),
  },
  {
    method: 'GET',
    path: /^\/api\/import-image\/stage\/([\w-]+)$/,
    inlineImage: true,
    /**
     * Returns the temporary image represented by the staging token.
     *
     * @param {string[]} items Captured staged image token identifier or route value.
     * @return {ReturnType<typeof stagedImages.previewImage>} Staged image response.
     */
    run: ([token]) => stagedImages.previewImage(token),
  },
  {
    method: 'POST',
    path: /^\/api\/bottles\/([\w-]+)\/photos\/from-stage$/,
    status: 201,
    /**
     * Attaches the staged image to the selected physical bottle.
     *
     * @param {string[]} items Captured bottle identifier or route value.
     * @param {*} body Untrusted JSON: Staging token.
     * @return {ReturnType<typeof stagedImages.attachImageToBottle>} Created photo and attachment status.
     */
    run: ([id], body) => stagedImages.attachImageToBottle(id, body),
  },
  {
    method: 'GET',
    path: /^\/api\/collection$/,
    /**
     * Loads the collection with its nested physical inventory.
     * @return {ReturnType<typeof collection.getCollection>} Current collection.
     */
    run: () => collection.getCollection(),
  },
  {
    method: 'GET',
    path: /^\/api\/suggest-number$/,
    /**
     * Suggests the next available inventory number without creating a bottle.
     * @return {ReturnType<typeof collection.getNextInventoryNumber>} Inventory-number suggestion.
     */
    run: () => collection.getNextInventoryNumber(),
  },
  {
    method: 'POST',
    path: /^\/api\/bottlings$/,
    status: 201,
    /**
     * Creates a new release record independent of physical bottle ownership.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Bottling fields.
     * @return {ReturnType<typeof bottlings.createBottling>} Created bottling.
     */
    run: (_, body) => bottlings.createBottling(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/bottlings\/([\w-]+)$/,
    /**
     * Updates metadata of the identified release.
     *
     * @param {string[]} items Captured bottling identifier or route value.
     * @param {*} body Untrusted JSON: Bottling changes.
     * @return {ReturnType<typeof bottlings.updateBottling>} Updated bottling.
     */
    run: ([id], body) => bottlings.updateBottling(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/bottlings\/([\w-]+)$/,
    /**
     * Deletes the identified release through the collection service.
     *
     * @param {string[]} items Captured bottling identifier or route value.
     * @return {ReturnType<typeof bottlings.deleteBottling>} Bottling deletion result.
     */
    run: ([id]) => bottlings.deleteBottling(id),
  },
  {
    method: 'GET',
    path: /^\/api\/tasting-flights$/,
    /**
     * Lists stored tasting sessions, including planned flights.
     * @return {ReturnType<typeof tastingFlights.list>} Tasting flights.
     */
    run: () => tastingFlights.list(),
  },
  {
    method: 'POST',
    path: /^\/api\/tasting-flights$/,
    status: 201,
    /**
     * Creates a tasting session, optionally with a validated plan of physical bottles.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} body Untrusted JSON: Flight metadata and optional plan.
     * @return {ReturnType<typeof tastingFlights.create>} Created flight.
     */
    run: (_args, body) => tastingFlights.create(body),
  },
  {
    method: 'GET',
    path: /^\/api\/tasting-flights\/([\w-]+)$/,
    /**
     * Looks up the identified tasting session.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @return {ReturnType<typeof tastingFlights.get>} Requested flight.
     */
    run: ([id]) => tastingFlights.get(id),
  },
  {
    method: 'PATCH',
    path: /^\/api\/tasting-flights\/([\w-]+)$/,
    /**
     * Updates the identified session metadata, lifecycle or planned members.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @param {*} body Untrusted JSON: Flight changes.
     * @return {ReturnType<typeof tastingFlights.update>} Updated flight.
     */
    run: ([id], body) => tastingFlights.update(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/tasting-flights\/([\w-]+)$/,
    /**
     * Removes the session grouping without duplicating or deleting individual tasting notes.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @return {ReturnType<typeof tastingFlights.remove>} Flight deletion result.
     */
    run: ([id]) => tastingFlights.remove(id),
  },
  {
    method: 'PUT',
    path: /^\/api\/tasting-flights\/([\w-]+)\/tastings$/,
    /**
     * Replaces the ordered tasting references of the selected flight.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @param {*} body Untrusted JSON: Ordered tasting IDs.
     * @return {ReturnType<typeof tastingFlights.setTastings>} Updated flight membership.
     */
    run: ([id], body) => tastingFlights.setTastings(id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/tasting-flights\/([\w-]+)\/tastings$/,
    status: 201,
    /**
     * Creates a new tasting and associates it with the selected flight.
     *
     * @param {string[]} items Captured flight identifier or route value.
     * @param {*} body Untrusted JSON: Tasting data and subject selection.
     * @return {ReturnType<typeof tastingFlights.createTasting>} Created tasting and flight update.
     */
    run: ([id], body) => tastingFlights.createTasting(id, body),
  },
  {
    method: 'GET',
    path: /^\/api\/external-tastings$/,
    /**
     * Lists tastings of whiskies not owned as inventory.
     * @return {ReturnType<typeof standaloneTastings.list>} Standalone tastings.
     */
    run: () => standaloneTastings.list(),
  },
  {
    method: 'GET',
    path: /^\/api\/external-tastings\/([\w-]+)$/,
    /**
     * Loads the standalone tasting with its embedded whisky reference.
     *
     * @param {string[]} items Captured standalone tasting identifier or route value.
     * @return {ReturnType<typeof standaloneTastings.get>} Requested standalone tasting.
     */
    run: ([id]) => standaloneTastings.get(id),
  },
  {
    method: 'POST',
    path: /^\/api\/external-tastings$/,
    status: 201,
    /**
     * Creates an independent tasting of a whisky outside the inventory.
     *
     * @param {string[]} _a Unused route captures.
     * @param {*} body Untrusted JSON: Tasting and embedded whisky fields.
     * @return {ReturnType<typeof standaloneTastings.create>} Created standalone tasting.
     */
    run: (_a, body) => standaloneTastings.create(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/external-tastings\/([\w-]+)$/,
    /**
     * Updates an external tasting and its embedded whisky metadata.
     *
     * @param {string[]} items Captured standalone tasting identifier or route value.
     * @param {*} body Untrusted JSON: Tasting or subject changes.
     * @return {ReturnType<typeof standaloneTastings.update>} Updated standalone tasting.
     */
    run: ([id], body) => standaloneTastings.update(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/external-tastings\/([\w-]+)$/,
    /**
     * Removes the selected standalone tasting.
     *
     * @param {string[]} items Captured standalone tasting identifier or route value.
     * @return {ReturnType<typeof standaloneTastings.remove>} Standalone tasting deletion result.
     */
    run: ([id]) => standaloneTastings.remove(id),
  },
  {
    method: 'POST',
    path: /^\/api\/external-tastings\/([\w-]+)\/assign$/,
    /**
     * Moves the standalone tasting to the selected owned bottling.
     *
     * @param {string[]} items Captured standalone tasting identifier or route value.
     * @param {*} body Untrusted JSON: Target bottling identifier.
     * @return {ReturnType<typeof standaloneTastings.assignToBottling>} Assignment result.
     */
    run: ([id], body) => standaloneTastings.assignToBottling(id, body),
  },
  {
    method: 'GET',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings$/,
    /**
     * Lists recorded tastings of the selected owned release.
     *
     * @param {string[]} items Captured bottling identifier or route value.
     * @return {ReturnType<typeof tastings.listTastings>} Owned tastings for the bottling.
     */
    run: ([id]) => tastings.listTastings(id),
  },
  {
    method: 'GET',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings\/([\w-]+)$/,
    /**
     * Loads an individual tasting from its owning bottling.
     *
     * @param {string[]} items Captured bottling and tasting identifiers or route values, in that order.
     * @return {ReturnType<typeof tastings.getTasting>} Requested tasting.
     */
    run: ([id, tastingId]) => tastings.getTasting(id, tastingId),
  },
  {
    method: 'POST',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings$/,
    status: 201,
    /**
     * Creates an independent dated tasting on the selected release.
     *
     * @param {string[]} items Captured bottling identifier or route value.
     * @param {*} body Untrusted JSON: Tasting fields.
     * @return {ReturnType<typeof tastings.createTasting>} Created tasting.
     */
    run: ([id], body) => tastings.createTasting(id, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings\/([\w-]+)$/,
    /**
     * Updates the specified tasting without changing its owning release.
     *
     * @param {string[]} items Captured bottling and tasting identifiers or route values, in that order.
     * @param {*} body Untrusted JSON: Tasting changes.
     * @return {ReturnType<typeof tastings.updateTasting>} Updated tasting.
     */
    run: ([id, tastingId], body) => tastings.updateTasting(id, tastingId, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/bottlings\/([\w-]+)\/tastings\/([\w-]+)$/,
    /**
     * Removes the specified owned tasting and its flight references.
     *
     * @param {string[]} items Captured bottling and tasting identifiers or route values, in that order.
     * @return {ReturnType<typeof tastings.deleteTasting>} Tasting deletion result.
     */
    run: ([id, tastingId]) => tastings.deleteTasting(id, tastingId),
  },
  {
    method: 'POST',
    path: /^\/api\/bottles$/,
    status: 201,
    /**
     * Creates physical inventory associated with a release.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Bottle data and owning bottling identifier.
     * @return {ReturnType<typeof bottles.createBottle>} Created physical bottle.
     */
    run: (_, body) => bottles.createBottle(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/bottles\/([\w-]+)$/,
    /**
     * Updates the selected physical bottle’s inventory metadata.
     *
     * @param {string[]} items Captured bottle identifier or route value.
     * @param {*} body Untrusted JSON: Bottle changes.
     * @return {ReturnType<typeof bottles.updateBottle>} Updated physical bottle.
     */
    run: ([id], body) => bottles.updateBottle(id, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/bottles\/([\w-]+)$/,
    /**
     * Removes the selected physical bottle and associated inventory resources.
     *
     * @param {string[]} items Captured bottle identifier or route value.
     * @return {ReturnType<typeof bottles.deleteBottle>} Bottle deletion result.
     */
    run: ([id]) => bottles.deleteBottle(id),
  },
  {
    method: 'POST',
    path: /^\/api\/bottles\/([\w-]+)\/photos$/,
    status: 201,
    /**
     * Stores an original image for the selected physical bottle.
     *
     * @param {string[]} items Captured bottle identifier or route value.
     * @param {*} body Untrusted JSON: Encoded image data.
     * @return {ReturnType<typeof bottles.addPhoto>} Created photo.
     */
    run: ([id], body) => bottles.addPhoto(id, body),
  },
  {
    method: 'PUT',
    path: /^\/api\/bottles\/([\w-]+)\/photos\/order$/,
    /**
     * Persists the requested order of the physical bottle’s photos.
     *
     * @param {string[]} items Captured bottle identifier or route value.
     * @param {*} body Untrusted JSON: Ordered photo IDs.
     * @return {ReturnType<typeof bottles.reorderPhotos>} Updated photo order.
     */
    run: ([id], body) => bottles.reorderPhotos(id, body),
  },
  {
    method: 'PUT',
    path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/cutout$/,
    /**
     * Stores a transparent cutout derivative without replacing the original image.
     *
     * @param {string[]} items Captured bottle and photo identifiers or route values, in that order.
     * @param {*} body Untrusted JSON: Cutout image data and options.
     * @return {ReturnType<typeof bottles.savePhotoCutout>} Updated photo derivative state.
     */
    run: ([id, photoId], body) => bottles.savePhotoCutout(id, photoId, body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/cutout$/,
    /**
     * Changes whether the transparent cutout is the active image source.
     *
     * @param {string[]} items Captured bottle and photo identifiers or route values, in that order.
     * @param {*} body Untrusted JSON: Cutout selection state.
     * @return {ReturnType<typeof bottles.selectPhotoCutout>} Updated photo selection.
     */
    run: ([id, photoId], body) => bottles.selectPhotoCutout(id, photoId, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/cutout$/,
    /**
     * Removes the generated cutout while retaining the original image.
     *
     * @param {string[]} items Captured bottle and photo identifiers or route values, in that order.
     * @return {ReturnType<typeof bottles.removePhotoCutout>} Updated photo state.
     */
    run: ([id, photoId]) => bottles.removePhotoCutout(id, photoId),
  },
  {
    method: 'PUT',
    path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/adjustments$/,
    /**
     * Stores edited image data and slider settings for the chosen source.
     *
     * @param {string[]} items Captured bottle and photo identifiers or route values, in that order.
     * @param {*} body Untrusted JSON: Adjusted image data and settings.
     * @return {ReturnType<typeof bottles.savePhotoAdjustments>} Updated adjustment state.
     */
    run: ([id, photoId], body) =>
      bottles.savePhotoAdjustments(id, photoId, body),
  },
  {
    method: 'DELETE',
    path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)\/adjustments$/,
    /**
     * Removes saved photo adjustments while retaining the base image.
     *
     * @param {string[]} items Captured bottle and photo identifiers or route values, in that order.
     * @return {ReturnType<typeof bottles.removePhotoAdjustments>} Updated photo state.
     */
    run: ([id, photoId]) => bottles.removePhotoAdjustments(id, photoId),
  },
  {
    method: 'DELETE',
    path: /^\/api\/bottles\/([\w-]+)\/photos\/([\w-]+)$/,
    /**
     * Deletes the selected photo and its generated derivatives.
     *
     * @param {string[]} items Captured bottle and photo identifiers or route values, in that order.
     * @return {ReturnType<typeof bottles.removePhoto>} Photo deletion result.
     */
    run: ([id, photoId]) => bottles.removePhoto(id, photoId),
  },
  {
    method: 'POST',
    path: /^\/api\/bottles\/([\w-]+)\/files$/,
    status: 201,
    /**
     * Stores a supporting document for a physical bottle.
     *
     * @param {string[]} items Captured bottle identifier or route value.
     * @param {*} body Untrusted JSON: Document name and encoded bytes.
     * @return {ReturnType<typeof bottles.addFile>} Created document metadata.
     */
    run: ([id], body) => bottles.addFile(id, body),
  },
  {
    method: 'GET',
    path: /^\/api\/bottles\/([\w-]+)\/files\/([\w-]+)\/preview$/,
    inlinePdf: true,
    /**
     * Resolves a stored PDF for inline preview.
     *
     * @param {string[]} items Captured bottle and attachment identifiers or route values, in that order.
     * @return {ReturnType<typeof bottles.previewPdf>} PDF response descriptor.
     */
    run: ([id, fileId]) => bottles.previewPdf(id, fileId),
  },
  {
    method: 'GET',
    path: /^\/api\/bottles\/([\w-]+)\/files\/([\w-]+)$/,
    download: true,
    /**
     * Resolves the selected supporting document for download.
     *
     * @param {string[]} items Captured bottle and attachment identifiers or route values, in that order.
     * @return {ReturnType<typeof bottles.downloadFile>} Document download descriptor.
     */
    run: ([id, fileId]) => bottles.downloadFile(id, fileId),
  },
  {
    method: 'DELETE',
    path: /^\/api\/bottles\/([\w-]+)\/files\/([\w-]+)$/,
    /**
     * Removes the selected supporting document from inventory.
     *
     * @param {string[]} items Captured bottle and attachment identifiers or route values, in that order.
     * @return {ReturnType<typeof bottles.removeFile>} Attachment deletion result.
     */
    run: ([id, fileId]) => bottles.removeFile(id, fileId),
  },
  {
    method: 'POST',
    path: /^\/api\/distilleries$/,
    status: 201,
    /**
     * Creates a distillery reference that can be linked to releases.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Distillery metadata.
     * @return {ReturnType<typeof distilleries.createDistillery>} Created distillery.
     */
    run: (_, body) => distilleries.createDistillery(body),
  },
  {
    method: 'PATCH',
    path: /^\/api\/distilleries\/([\w-]+)$/,
    /**
     * Updates the metadata of the selected distillery reference.
     *
     * @param {string[]} items Captured distillery identifier or route value.
     * @param {*} body Untrusted JSON: Distillery changes.
     * @return {ReturnType<typeof distilleries.updateDistillery>} Updated distillery.
     */
    run: ([id], body) => distilleries.updateDistillery(id, body),
  },
  {
    method: 'POST',
    path: /^\/api\/import\/json$/,
    /**
     * Imports and validates collection data through the collection service.
     *
     * @param {string[]} _ Unused route captures.
     * @param {*} body Untrusted JSON: Collection import document.
     * @return {ReturnType<typeof collection.importCollection>} Collection import result.
     */
    run: (_, body) => collection.importCollection(body),
  },
  {
    method: 'GET',
    path: /^\/api\/export\/json$/,
    download: true,
    /**
     * Returns the stored collection JSON as an attachment.
     * @return {ReturnType<typeof exports.exportJson>} JSON download descriptor.
     */
    run: () => exports.exportJson(),
  },
  {
    method: 'GET',
    path: /^\/api\/export\/csv$/,
    download: true,
    /**
     * Exports physical inventory and release metadata as CSV.
     * @return {ReturnType<typeof exports.exportCsv>} CSV download descriptor.
     */
    run: () => exports.exportCsv(),
  },
  {
    method: 'GET',
    path: /^\/api\/export\/zip$/,
    downloadFile: true,
    /**
     * Builds an authorized encrypted ZIP backup for manual download.
     *
     * @param {string[]} _args Unused route captures.
     * @param {*} _body Unused parsed request body.
     * @param {import('node:http').IncomingMessage} req Incoming request used for authorization or request metadata.
     * @return {ReturnType<typeof exports.exportZip>} ZIP download descriptor.
     */
    run: (_args, _body, req) => exports.exportZip(req),
  },
];
/**
 * Matches and dispatches API routes, including authorization, conditional caching and response handling.
 *
 * @param {!Object} request Incoming request.
 * @param {!Object} response Outgoing response.
 * @param {URL} url Parsed request URL.
 * @return {!Promise<*>} Completion after dispatching or rejecting the API request.
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
    if (request.method === 'GET' && (url.pathname === '/api/collection' || url.pathname === '/api/warehouse')) {
      const etag = url.pathname === '/api/collection' ? collectionETag()
        : `W/"${collectionETag().slice(3, -1)}:${warehouseETag().slice(3, -1)}"`;
      cacheHeaders = {
        'Cache-Control': 'private, no-cache',
        ETag: etag,
        Vary: 'Accept-Encoding',
        ...(url.pathname === '/api/warehouse' ? {'X-WCM-Store-ETag': warehouseETag()} : {}),
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
      return response.end(result.bytes);
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
