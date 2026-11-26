import * as backups from '../services/backups.js';
import * as exports from '../services/exports.js';

/**
 * Backup profiles, job scheduling, archive downloads and the separately authenticated worker endpoint.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const backupsRoutes = [
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
