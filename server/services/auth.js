/**
 * Optional app login, independent of collection.json and backup-worker
 * credentials.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {promisify} from 'node:util';
import {DATA_DIR} from '../storage/paths.js';
import {fail} from '../domain/errors.js';
import {LoginAttemptLimiter} from '../domain/login-attempts.js';

/** @typedef {import('node:http').IncomingMessage} AuthRequest */
/** @typedef {import('node:http').ServerResponse} AuthResponse */
/**
 * Safe account metadata sent to clients; no password hash or salt.
 * @typedef {{id: string, username: string, role: 'admin'|'user', mustChangePassword: boolean}} PublicUser
 */
/** @typedef {{salt: string, passwordHash: string}} PasswordCredential */
/** @typedef {PublicUser & PasswordCredential} StoredUser */
/** @typedef {{schemaVersion: 1, loginRequired: boolean, users: StoredUser[]}} AuthStore */
/** @typedef {{required: boolean, user: PublicUser|null, canManageUsers: boolean}} SessionInfo */

// Node's promisify declaration selects the overload without ScryptOptions.
const scrypt = /** @type {(password: import('node:crypto').BinaryLike, salt: import('node:crypto').BinaryLike, keylen: number, options: import('node:crypto').ScryptOptions) => Promise<Buffer>} */ (promisify(crypto.scrypt));
const FILE = path.join(DATA_DIR, 'user.json');
const SCRYPT_OPTIONS = {N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024};
const COOKIE = 'wcm_session';
const SESSION_AGE = 12 * 60 * 60 * 1000;
const IDLE_AGE = 2 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new LoginAttemptLimiter();
let current = null;
let fileIdentity = null;
/** @type {Promise<unknown>} */
let queue = Promise.resolve();
/**
 * Creates a localized HTTP authentication error without exposing secret values.
 *
 * @param {string} code Full stable authentication error identifier.
 * @param {number} status HTTP status code.
 * @return {import('../domain/errors.js').HttpError} Error object to be thrown by the caller.
 */
const authError = (code, status) => fail(code, status, code);

/**
 * Reads the authentication file metadata used to detect replacement or edits.
 *
 * @return {string} Device, inode, size and modification/change time fingerprint.
 */
const identity = () => {
  const stat = fs.statSync(FILE);
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
};

/**
 * Validates authentication records and requires at least one administrator; rejects duplicate IDs and usernames.
 *
 * @param {*} value Untrusted parsed user.json data.
 * @return {AuthStore} Validated store, preserving its existing object identity.
 * @throws {Error} If schema, credentials or uniqueness constraints are invalid.
 */
function validateStore(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.loginRequired !== 'boolean' || !Array.isArray(value.users) || !value.users.some(u => u.role === 'admin') ||
    value.users.length > 200 || value.users.some(u => !u || typeof u.id !== 'string' || !/^[a-z0-9._-]{3,32}$/.test(u.username) || !['admin', 'user'].includes(u.role) ||
      typeof u.mustChangePassword !== 'boolean' || !/^[a-f0-9]{32}$/.test(u.salt) ||
      !/^[a-f0-9]{128}$/.test(u.passwordHash))) {
    throw Error('user.json ist ungueltig. Der Anmeldeschutz wird nicht abgeschaltet.');
  }
  if (new Set(value.users.map(u => u.username)).size !== value.users.length ||
    new Set(value.users.map(u => u.id)).size !== value.users.length) throw Error('Doppelte Benutzer in user.json.');
  return value;
}

/**
 * Reads and caches user.json; a file replacement or manual edit invalidates every active session.
 *
 * @return {AuthStore} Validated current account store.
 * @throws {Error} If the file is missing or invalid; authentication does not silently fall back to anonymous access.
 */
function store() {
  if (!fs.existsSync(FILE)) throw Error('user.json fehlt; Anmeldung wird aus Sicherheitsgruenden nicht deaktiviert.');
  const signature = identity();
  if (!current || signature !== fileIdentity) {
    // Restores and manual edits revoke all sessions, including administrator
    // sessions.
    current = validateStore(JSON.parse(fs.readFileSync(FILE, 'utf8')));
    fileIdentity = signature;
    sessions.clear();
  }
  return current;
}

/**
 * Validates and atomically replaces user.json with owner-only permissions; refreshes the in-process cache.
 *
 * @param {AuthStore} value New account store.
 * @throws {Error} If validation or a filesystem operation fails.
 */
function save(value) {
  validateStore(value);
  const temporary = `${FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    fs.renameSync(temporary, FILE);
    current = value;
    fileIdentity = identity();
  } finally {fs.rmSync(temporary, {force: true});}
}

/**
 * Queues account mutations; a rejected mutation does not block later mutations.
 *
 * @template T
 * @param {function(): (T|Promise<T>)} task Mutation to run after the preceding queued operation.
 * @return {Promise<T>} Settles with the mutation result or its original rejection.
 */
function serialize(task) {
  const job = queue.then(task);
  queue = job.catch(() => {});
  return job;
}

/**
 * Rejects passwords shorter than 12 characters, over 256 UTF-8 bytes, or containing control characters.
 *
 * @param {*} password Untrusted password candidate.
 * @throws {import('../domain/errors.js').HttpError} If the password does not meet the stored-account policy.
 */
function passwordCheck(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 256 ||
    /[\u0000-\u001f\u007f]/u.test(password)) throw authError('api.errors.invalidPassword', 400);
}

/**
 * Accepts only lowercase account names of 3–32 ASCII letters, digits, dots, underscores or hyphens.
 *
 * @param {*} username Untrusted normalized username.
 * @throws {import('../domain/errors.js').HttpError} If the username does not meet the account policy.
 */
function usernameCheck(username) {
  if (typeof username !== 'string' || !/^[a-z0-9._-]{3,32}$/.test(username)) throw authError('api.errors.invalidUsername', 400);
}

/**
 * Derives a scrypt credential without retaining the plaintext password.
 *
 * @param {*} password Password candidate validated before hashing.
 * @param {string=} salt Hex-encoded salt; defaults to 16 random bytes.
 * @return {Promise<PasswordCredential>} Salt and 64-byte hex-encoded hash, or rejects if validation or hashing fails.
 */
async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  passwordCheck(password);
  return {
    salt,
    passwordHash: (await scrypt(password, Buffer.from(salt, 'hex'), 64, SCRYPT_OPTIONS)).toString('hex'),
  };
}

/**
 * Derives the initial-account scrypt credential synchronously at startup.
 *
 * @param {*} password Password candidate validated before hashing.
 * @param {string=} salt Hex-encoded salt; defaults to 16 random bytes.
 * @return {PasswordCredential} Salt and 64-byte hex-encoded hash.
 * @throws {Error} If password validation or hashing fails.
 */
function hashPasswordSync(password, salt = crypto.randomBytes(16).toString('hex')) {
  passwordCheck(password);
  return {
    salt,
    passwordHash: crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64, SCRYPT_OPTIONS).toString('hex'),
  };
}

/**
 * Reads the authentication cookie without decoding or validating other cookies.
 *
 * @param {AuthRequest} request Request carrying the Cookie header.
 * @return {string} Session token or empty text if absent.
 */
function sessionToken(request) {
  const cookies = String(request.headers.cookie || '').split(';');
  const entry = cookies.find(cookie => cookie.trim().startsWith(`${COOKIE}=`));
  return entry?.trim().slice(COOKIE.length + 1) || '';
}

/**
 * Builds a host-scoped HttpOnly, SameSite=Strict session cookie; adds Secure on TLS.
 *
 * @param {AuthRequest} request Request used to determine TLS state.
 * @param {string=} token Token to set; empty by default.
 * @param {number=} maxAge Cookie lifetime in seconds; zero expires the cookie.
 * @return {string} Set-Cookie header value.
 */
function cookieHeaders(request, token = '', maxAge = 0) {
  // TLS is provided by the app even when behind its optional TLS reverse proxy.
  const secure = /** @type {import("node:tls").TLSSocket} */ (request.socket)?.encrypted ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${maxAge}`;
}

/**
 * Removes expired and idle sessions.
 */
function prune() {
  const now = Date.now();
  for (const [token, record] of sessions) if (record.expires <= now || record.lastSeen + IDLE_AGE <= now) sessions.delete(token);
}

/**
 * Creates the account store once if absent and logs the initial admin password only on successful creation; then clears sessions and validates the store.
 *
 * @throws {Error} If the store cannot be initialized or validated.
 */
export function initializeAuth() {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  if (!fs.existsSync(FILE)) {
    const password = crypto.randomBytes(18).toString('base64url');
    const user = {
      id: crypto.randomUUID(), username: 'admin', role: 'admin',
      ...hashPasswordSync(password), mustChangePassword: true,
    };
    // O_EXCL: simultaneous startup never overwrites an existing account store.
    try {
      fs.writeFileSync(
        FILE,
        JSON.stringify({schemaVersion: 1, loginRequired: false, users: [user]}, null, 2) + '\n',
        {flag: 'wx', mode: 0o600}
      );
      console.log(`WCM Erstzugang: Benutzer admin, einmaliges Startpasswort: ${password}`);
      console.log('Das Passwort muss bei der ersten Anmeldung geaendert werden. Es wird nicht erneut angezeigt.');
    } catch (error) {if (error.code !== 'EEXIST') throw error;}
  }
  current = null; fileIdentity = null; sessions.clear();
  store();
}

/**
 * Resolves an active session and updates its last-seen timestamp; stale sessions are removed.
 *
 * @param {AuthRequest} req Request carrying the session cookie.
 * @return {StoredUser|null} Authenticated stored account, or null for an invalid or expired session.
 */
export function sessionUser(req) {
  const token = sessionToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  prune();
  // Reload before looking up the token: a changed file revokes all sessions.
  const data = store();
  const record = sessions.get(token);
  if (!record) return null;
  const user = data.users.find(item => item.id === record.id);
  if (!user) {sessions.delete(token); return null;}
  record.lastSeen = Date.now();
  return user;
}

/**
 * Projects account metadata without including the password salt or hash.
 *
 * @param {StoredUser|null|undefined} user Stored account or no matching user.
 * @return {PublicUser|null|undefined} Safe public account, preserving null or undefined input.
 */
export function publicUser(user) {
  return user && {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Reports whether login is required, which account is active and whether it can manage users.
 *
 * @param {AuthRequest} req Request carrying the session cookie.
 * @return {SessionInfo} Authentication state for the client.
 */
export function sessionInfo(req) {
  const data = store();
  const user = sessionUser(req);
  return {
    required: data.loginRequired,
    user: publicUser(user),
    canManageUsers: user?.role === 'admin' && !user.mustChangePassword,
  };
}

/**
 * Requires a valid session and enforces password-change and administrator restrictions.
 *
 * @param {AuthRequest} req Request carrying the session cookie.
 * @param {boolean=} admin Require administrator privileges.
 * @param {boolean=} allowChange Allow a session that still requires a password change.
 * @return {StoredUser} Authenticated account satisfying the requested restrictions.
 * @throws {import('../domain/errors.js').HttpError} HTTP 401 for no session or 403 for an unmet access restriction.
 */
function requireUser(req, admin = false, allowChange = false) {
  const user = sessionUser(req);
  if (!user) throw authError('api.errors.loginRequired', 401);
  if (user.mustChangePassword && !allowChange) throw authError('api.errors.passwordChangeRequired', 403);
  if (admin && user.role !== 'admin') throw authError('api.errors.adminRequired', 403);
  return user;
}

/**
 * Enforces optional login for API and image requests while allowing the explicit public authentication routes and separately authorized worker routes.
 *
 * @param {AuthRequest} req Request whose method and session are inspected.
 * @param {URL} url Parsed request URL.
 * @throws {import('../domain/errors.js').HttpError} If the route requires a session or administrator permission not held by the requester.
 */
export function authorizeRequest(req, url) {
  const pathname = url.pathname;
  if (pathname.startsWith('/internal/backup/'))
    return; // Separate worker-token authorization.
  if (pathname === '/api/version' && req.method === 'GET') return; // Docker healthcheck.
  if (pathname === '/api/auth/session' && req.method === 'GET') return;
  if (pathname === '/api/auth/login' && req.method === 'POST') return;
  if (pathname === '/api/auth/logout' && req.method === 'POST') return;
  if (pathname === '/api/auth/password' && req.method === 'POST') {requireUser(req, false, true); return;}
  if (pathname.startsWith('/api/auth/')) {requireUser(req, true); return;}
  if (!store().loginRequired) return;
  if (pathname.startsWith('/api/') || pathname.startsWith('/images/')) {
    requireUser(req);
  }
  // Public website code/CSS/fonts/logo are not personal data. The app itself
  // does not fetch collection data until /api/auth/session has authorized it.
}

/**
 * Checks credentials with per-account/IP rate limits, creates a bounded in-memory session, and sets the session cookie.
 *
 * @param {AuthRequest} req Request used for the client address and cookie security.
 * @param {*} body Untrusted username and password fields.
 * @param {AuthResponse} response Response on which Set-Cookie is written.
 * @return {Promise<SessionInfo>} New authenticated session state; rejects with an authentication or rate-limit error.
 */
export async function login(req, body, response) {
  const username = typeof body?.username === 'string' ? body.username.toLowerCase().trim() : '';
  const password = body?.password;
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || typeof password !== 'string' || password.length > 256 || Buffer.byteLength(password, 'utf8') > 256) throw authError('api.errors.invalidCredentials', 401);
  prune();
  const address = (req.socket?.remoteAddress || '').slice(0, 60);
  const finish = loginAttempts.reserve(address, username);
  if (!finish) throw authError('api.errors.tooManyAttempts', 429);
  /** @type {import('../domain/login-attempts.js').AttemptOutcome} */
  let outcome = 'aborted';
  try {
    const user = store().users.find(item => item.username === username);
    // Verify against a valid dummy hash even for unknown accounts.
    const check = user || hashDummy;
    const computed = await scrypt(password, Buffer.from(check.salt, 'hex'), 64, SCRYPT_OPTIONS);
    const equal = crypto.timingSafeEqual(computed, Buffer.from(check.passwordHash, 'hex'));
    if (!user || !equal) {
      outcome = 'failed';
      throw authError('api.errors.invalidCredentials', 401);
    }
    // Password changes, account deletion and external restores may occur while
    // scrypt is running. Never establish a session from obsolete credentials.
    const verifiedUser = store().users.find(item => item.id === user.id && item.username === username);
    if (!verifiedUser || verifiedUser.salt !== user.salt || verifiedUser.passwordHash !== user.passwordHash) {
      outcome = 'failed';
      throw authError('api.errors.invalidCredentials', 401);
    }
    outcome = 'accepted';
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {id: verifiedUser.id, expires: Date.now() + SESSION_AGE, lastSeen: Date.now()});
    // Bound in-memory state; sessions never persist to the user store.
    while (sessions.size > 2048) sessions.delete(sessions.keys().next().value);
    response.setHeader('Set-Cookie', cookieHeaders(req, token, Math.floor(SESSION_AGE / 1000)));
    return sessionInfoWithUser(verifiedUser);
  } finally {
    finish(outcome);
  }
}
// A constant valid scrypt value. No separate KDF for invalid usernames.
const hashDummy = {
  salt: '00000000000000000000000000000000', passwordHash: '0'.repeat(128),
};
/**
 * Builds authentication status for an already verified account.
 *
 * @param {StoredUser} user Account whose session has just been established or updated.
 * @return {SessionInfo} Login setting, public account and administrator capability.
 */
function sessionInfoWithUser(user) {
  return {
    required: store().loginRequired,
    user: publicUser(user),
    canManageUsers: user.role === 'admin' && !user.mustChangePassword,
  };
}

/**
 * Invalidates the current in-memory session and expires the client cookie.
 *
 * @param {AuthRequest} req Request carrying the current session cookie.
 * @param {AuthResponse} response Response on which the expired cookie is written.
 * @return {SessionInfo} Logged-out state with no account or management permission.
 */
export function logout(req, response) {
  sessions.delete(sessionToken(req));
  response.setHeader('Set-Cookie', cookieHeaders(req));
  return {required: store().loginRequired, user: null, canManageUsers: false};
}

/**
 * Revokes all in-memory sessions associated with one account.
 *
 * @param {string} id Stable user identifier.
 */
function invalidateUser(id) {
  for (const [token, session] of sessions) if (session.id === id) sessions.delete(token);
}

/**
 * Validates the current password, saves a distinct replacement, revokes old sessions and rotates the cookie after a successful write.
 *
 * @param {AuthRequest} req Authenticated request; a first-login session is allowed.
 * @param {*} body Untrusted currentPassword and newPassword fields.
 * @param {AuthResponse} response Response receiving the rotated session cookie.
 * @return {Promise<SessionInfo>} Updated authenticated state, or rejection if validation or persistence fails.
 */
export async function changePassword(req, body, response) {
  return serialize(async () => {
    const user = requireUser(req, false, true);
    if (typeof body?.currentPassword !== 'string' || typeof body?.newPassword !== 'string') throw authError('api.errors.invalidPassword', 400);
    if (body.currentPassword.length > 256 || Buffer.byteLength(body.currentPassword, 'utf8') > 256) throw authError('api.errors.invalidCredentials', 401);
    const candidate = await scrypt(body.currentPassword, Buffer.from(user.salt, 'hex'), 64, SCRYPT_OPTIONS);
    if (!crypto.timingSafeEqual(candidate, Buffer.from(user.passwordHash, 'hex'))) throw authError('api.errors.invalidCredentials', 401);
    if (body.currentPassword === body.newPassword) throw authError('api.errors.newPasswordMustDiffer', 400);
    const change = await hashPassword(body.newPassword);
    requireUser(req, false, true);
    const data = structuredClone(store());
    const updated = data.users.find(item => item.id === user.id);
    Object.assign(updated, change, {mustChangePassword: false});
    save(data);
    // Rotate session on privilege transition, including first-login flow.
    invalidateUser(user.id);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {id: user.id, expires: Date.now() + SESSION_AGE, lastSeen: Date.now()});
    response.setHeader('Set-Cookie', cookieHeaders(req, token, Math.floor(SESSION_AGE / 1000)));
    return sessionInfoWithUser(updated);
  });
}

/**
 * Lists safe public account metadata and the login requirement for an administrator.
 *
 * @param {AuthRequest} req Request requiring administrator permission.
 * @return {{required: boolean, users: PublicUser[]}} Account management state.
 * @throws {import('../domain/errors.js').HttpError} If administrator access is denied.
 */
export function listUsers(req) {
  requireUser(req, true);
  return {
    required: store().loginRequired, users: store().users.map(publicUser),
  };
}

/**
 * Creates a non-admin account with a unique username and mandatory first-login password change; persists it before returning.
 *
 * @param {AuthRequest} req Administrator request.
 * @param {*} body Untrusted username and initial password.
 * @return {Promise<PublicUser>} Created account without credentials, or rejection on authorization, validation, account limit or write failure.
 */
export async function createUser(req, body) {
  return serialize(async () => {
    requireUser(req, true);
    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : body?.username;
    usernameCheck(username);
    const data = structuredClone(store());
    if (data.users.some(item => item.username === username)) throw authError('api.errors.usernameExists', 409);
    if (data.users.length >= 200) throw authError('api.errors.tooManyUsers', 409);
    const credential = await hashPassword(body?.password);
    requireUser(req, true);
    /** @type {StoredUser} */
    const user = {
      id: crypto.randomUUID(),
      username,
      role: 'user',
      ...credential,
      mustChangePassword: true,
    };
    data.users.push(user);
    save(data);
    return publicUser(user);
  });
}

/**
 * Sets another account’s temporary password, requires a password change and invalidates all of its sessions.
 *
 * @param {AuthRequest} req Administrator request.
 * @param {string} id Target account identifier, not the requesting administrator.
 * @param {*} body Untrusted replacement password field.
 * @return {Promise<PublicUser>} Updated public account, or rejection when the reset is not permitted or cannot be saved.
 */
export async function resetPassword(req, id, body) {
  return serialize(async () => {
    const admin = requireUser(req, true);
    const data = structuredClone(store());
    const user = data.users.find(item => item.id === id);
    if (!user) throw authError('api.errors.userNotFound', 404);
    if (user.id === admin.id) throw authError('api.errors.changeOwnPassword', 400);
    const credential = await hashPassword(body?.password);
    requireUser(req, true);
    Object.assign(user, credential, {mustChangePassword: true});
    save(data);
    invalidateUser(id);
    return publicUser(user);
  });
}

/**
 * Deletes a non-administrator account and revokes its sessions; prevents removing the current administrator.
 *
 * @param {AuthRequest} req Administrator request.
 * @param {string} id Target account identifier.
 * @return {Promise<{success: true}>} Confirmation after persisting the deletion, or rejection if denied or not found.
 */
export function removeUser(req, id) {
  return serialize(() => {
    const admin = requireUser(req, true);
    if (id === admin.id) throw authError('api.errors.cannotDeleteSelf', 400);
    const data = structuredClone(store());
    const before = data.users.length;
    data.users = data.users.filter(item => item.id !== id || item.role === 'admin');
    if (before === data.users.length) throw authError('api.errors.userNotFound', 404);
    save(data);
    invalidateUser(id);
    return {success: true};
  });
}

/**
 * Persists the administrator’s optional-login setting independently of collection data.
 *
 * @param {AuthRequest} req Administrator request.
 * @param {*} body Untrusted object containing the boolean required field.
 * @return {Promise<{required: boolean}>} Persisted login requirement, or rejection on authorization, validation or write failure.
 */
export function setLoginRequired(req, body) {
  return serialize(() => {
    requireUser(req, true);
    if (typeof body?.required !== 'boolean') throw authError('api.errors.invalidLoginSetting', 400);
    const data = structuredClone(store());
    data.loginRequired = body.required;
    save(data);
    return {required: data.loginRequired};
  });
}

/**
 * Generates a new temporary admin password for local operator recovery, persists its hash and revokes the admin’s sessions. Never expose this function through HTTP.
 *
 * @return {Promise<{username: string, password: string}>} Administrator name and newly generated plaintext password for the local operator.
 */
export async function resetAdminPassword() {
  const data = structuredClone(store());
  const admin = data.users.find(user => user.role === 'admin');
  const password = crypto.randomBytes(18).toString('base64url');
  Object.assign(admin, await hashPassword(password), {mustChangePassword: true});
  save(data);
  invalidateUser(admin.id);
  return {username: admin.username, password};
}
