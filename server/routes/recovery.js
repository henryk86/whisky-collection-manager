import * as recovery from '../services/backup-recovery.js';

/**
 * Binary archive staging, preview, unlocking, download and restore routes.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const recoveryRoutes = [
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
];
