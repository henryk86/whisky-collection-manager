import * as stagedImages from '../services/staged-images.js';

/**
 * Temporary extension image staging, preview and attachment routes.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const stagedImagesRoutes = [
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
];
