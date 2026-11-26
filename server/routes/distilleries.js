import * as distilleries from '../services/distilleries.js';
import {findDistilleryLocations} from '../services/distillery-geocoding.js';

/**
 * Distillery catalog and geocoding routes.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const distilleriesRoutes = [
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
];
