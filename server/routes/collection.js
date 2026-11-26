import * as collection from '../services/collection.js';
import * as bottlings from '../services/bottlings.js';
import * as bottles from '../services/bottles.js';
import * as exports from '../services/exports.js';

/**
 * Collection, bottling, bottle, document and JSON/CSV transfer routes.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const collectionRoutes = [
  {
    method: 'GET',
    path: /^\/api\/collection$/,
    cacheResource: 'collection',
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
    method: 'PATCH',
    path: /^\/api\/bottles\/([\w-]+)\/files\/([\w-]+)$/,
    /**
     * Updates the user-designated purpose of an attachment without changing its bytes.
     * @param {string[]} items Bottle and attachment identifiers.
     * @param {*} body Untrusted designation.
     * @return {ReturnType<typeof bottles.markPurchaseEvidence>} Updated attachment metadata.
     */
    run: ([id, fileId], body) => bottles.markPurchaseEvidence(id, fileId, body),
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
];
