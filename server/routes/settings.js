import * as settings from '../services/settings.js';

/**
 * Collection-wide configuration and saved-view routes.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const settingsRoutes = [
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
];
