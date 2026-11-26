import * as auth from '../services/auth.js';

/**
 * Session, password and account-management routes. Authorization remains in the request handler and auth service.
 * @type {import('./contract.js').ApiRoute[]}
 */
export const authRoutes = [
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
];
