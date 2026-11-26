/** Account file contract shared by authentication and recovery. */
/**
 * Safe account metadata sent to clients; no password hash or salt.
 * @typedef {{id: string, username: string, role: 'admin'|'user', mustChangePassword: boolean}} PublicUser
 */
/** @typedef {{salt: string, passwordHash: string}} PasswordCredential */
/** @typedef {PublicUser & PasswordCredential} StoredUser */
/** @typedef {{schemaVersion: 1, loginRequired: boolean, users: StoredUser[]}} AuthStore */

/**
 * Validates authentication records and requires at least one administrator; rejects duplicate IDs and usernames.
 *
 * @param {*} value Untrusted parsed user.json data.
 * @return {AuthStore} Validated store, preserving its existing object identity.
 * @throws {Error} If schema, credentials or uniqueness constraints are invalid.
 */
export function validateStore(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.loginRequired !== 'boolean' || !Array.isArray(value.users) || !value.users.some(u => u?.role === 'admin') ||
    value.users.length > 200 || value.users.some(u => !u || typeof u.id !== 'string' || !u.id || typeof u.username !== 'string' || !/^[a-z0-9._-]{3,32}$/.test(u.username) || !['admin', 'user'].includes(u.role) ||
      typeof u.mustChangePassword !== 'boolean' || typeof u.salt !== 'string' || !/^[a-f0-9]{32}$/.test(u.salt) ||
      typeof u.passwordHash !== 'string' || !/^[a-f0-9]{128}$/.test(u.passwordHash))) {
    throw Error('user.json ist ungueltig. Der Anmeldeschutz wird nicht abgeschaltet.');
  }
  if (new Set(value.users.map(u => u.username)).size !== value.users.length ||
    new Set(value.users.map(u => u.id)).size !== value.users.length) throw Error('Doppelte Benutzer in user.json.');
  return value;
}
