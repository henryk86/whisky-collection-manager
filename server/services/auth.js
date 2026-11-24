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

const scrypt = promisify(crypto.scrypt);
const FILE = path.join(DATA_DIR, 'user.json');
const SCRYPT_OPTIONS = {N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024};
const COOKIE = 'wcm_session';
const SESSION_AGE = 12 * 60 * 60 * 1000;
const IDLE_AGE = 2 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
let current = null;
let fileIdentity = null;
let queue = Promise.resolve();
/**
 * Derives the auth error result from the supplied values.
 *
 * @param {*} key Key used to select or group values.
 * @param {*} status Status value determining the next action.
 * @return {*} Result computed from the supplied inputs.
 */
const authError = (key, status) => fail(key, status, `api.errors.${key}`);

/**
 * Produces the identity text used by the caller.
 * @return {string} Resulting text.
 */
const identity = () => {
  const stat = fs.statSync(FILE);
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
};

/**
 * Validates store against its constraints.
 *
 * @param {*} value Value to process.
 * @return {*} Entries transformed for the consuming code.
 */
function validateStore(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.loginRequired !==
    'boolean' ||
    !Array.isArray(value.users) || !value.users.some(u => u.role === 'admin') ||
    value.users.length > 200 || value.users.some(u => !u || typeof u.id !==
      'string' ||
      !/^[a-z0-9._-]{3,32}$/.test(u.username) || !['admin', 'user']
        .includes(u.role) ||
      typeof u.mustChangePassword !== 'boolean' || !/^[a-f0-9]{32}$/
        .test(u.salt) ||
      !/^[a-f0-9]{128}$/.test(u.passwordHash))) {
    throw Error('user.json ist ungueltig. Der Anmeldeschutz wird nicht abgeschaltet.');
  }
  if (new Set(value.users.map(u => u.username)).size !== value.users.length ||
    new Set(value.users.map(u => u.id)).size !== value.users
      .length) throw Error('Doppelte Benutzer in user.json.');
  return value;
}

/**
 * Reads store data from the local filesystem.
 * @return {*} Parsed JSON value.
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
 * Writes save data to the local filesystem.
 *
 * @param {*} value Value to process.
 */
function save(value) {
  validateStore(value);
  const temporary = `${FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(
      temporary,
      JSON.stringify(value, null, 2) + '\n',
      {flag: 'wx', mode: 0o600}
    );
    fs.renameSync(temporary, FILE);
    current = value;
    fileIdentity = identity();
  } finally {fs.rmSync(temporary, {force: true});}
}

/**
 * Derives the serialize result from the supplied values.
 *
 * @param {*} task Task to execute or examine.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
function serialize(task) {
  const job = queue.then(task);
  queue = job.catch(() => {});
  return job;
}

/**
 * Tests input text against the password check pattern.
 *
 * @param {*} password Password or secret supplied by the caller.
 */
function passwordCheck(password) {
  if (typeof password !== 'string' || password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 256 ||
    /[\u0000-\u001f\u007f]/u
      .test(password)) throw authError('invalidPassword', 400);
}

/**
 * Tests input text against the username check pattern.
 *
 * @param {*} username Value used by this operation.
 */
function usernameCheck(username) {
  if (typeof username !== 'string' || !/^[a-z0-9._-]{3,32}$/
    .test(username)) throw authError('invalidUsername', 400);
}

/**
 * Coordinates asynchronous work for hash password.
 *
 * @param {*} password Password or secret supplied by the caller.
 * @param {*=} salt Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function hashPassword(password, salt = crypto.randomBytes(16)
  .toString('hex')) {
  passwordCheck(password);
  return {
    salt,
    passwordHash: (await scrypt(password, Buffer.from(salt, 'hex'), 64, SCRYPT_OPTIONS)).toString('hex'),
  };
}

/**
 * Derives the hash password sync result from the supplied values.
 *
 * @param {*} password Password or secret supplied by the caller.
 * @param {*=} salt Value used by this operation.
 * @return {!Object} Structured result assembled from the input data.
 */
function hashPasswordSync(password, salt = crypto.randomBytes(16)
  .toString('hex')) {
  passwordCheck(password);
  return {
    salt,
    passwordHash: crypto.scryptSync(
      password,
      Buffer.from(salt, 'hex'),
      64,
      SCRYPT_OPTIONS
    ).toString('hex'),
  };
}

/**
 * Normalizes the session token text for subsequent processing.
 *
 * @param {*} request Value used by this operation.
 * @return {string} Resulting text.
 */
function sessionToken(request) {
  const cookies = String(request.headers.cookie || '').split(';');
  const entry = cookies.find(cookie => cookie.trim().startsWith(`${COOKIE}=`));
  return entry?.trim().slice(COOKIE.length + 1) || '';
}

/**
 * Produces the cookie headers text used by the caller.
 *
 * @param {*} request Value used by this operation.
 * @param {string=} token Token submitted for validation.
 * @param {number=} maxAge Value used by this operation.
 * @return {string} Resulting text.
 */
function cookieHeaders(request, token = '', maxAge = 0) {
  // TLS is provided by the app even when behind its optional TLS reverse proxy.
  const secure = request.socket?.encrypted ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${maxAge}`;
}

/**
 * Updates the prune state for its caller.
 */
function prune() {
  const now = Date.now();
  for (const [token, record] of sessions) if (record.expires <= now ||
    record.lastSeen + IDLE_AGE <= now) sessions.delete(token);
  for (const [key, record] of attempts) if (record.at + 5 * 60000 <
    now) attempts.delete(key);
}

/**
 * Initializes the authentication state and any initial admin account.
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
        JSON.stringify(
          {schemaVersion: 1, loginRequired: false, users: [user]},
          null,
          2
        ) + '\n',
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
 * Resolves the authenticated user from an active session.
 *
 * @param {!Object} req Incoming HTTP request.
 * @return {*} Computed value, or null when the input has no match.
 */
export function sessionUser(req) {
  const token = sessionToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  prune();
  const record = sessions.get(token);
  if (!record) return null;
  const user = store().users.find(item => item.id === record.id);
  if (!user) {sessions.delete(token); return null;}
  record.lastSeen = Date.now();
  return user;
}

/**
 * Returns the safe public representation of a user record.
 *
 * @param {*} user User record being authenticated or modified.
 * @return {*} Result computed from the supplied inputs.
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
 * Returns the current session's authentication details.
 *
 * @param {!Object} req Incoming HTTP request.
 * @return {!Object} Structured result for the caller.
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
 * Enforces the user precondition.
 *
 * @param {*} req Incoming request to authorize.
 * @param {boolean=} admin Value used by this operation.
 * @param {boolean=} allowChange Value used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
function requireUser(req, admin = false, allowChange = false) {
  const user = sessionUser(req);
  if (!user) throw authError('loginRequired', 401);
  if (user.mustChangePassword &&
    !allowChange) throw authError('passwordChangeRequired', 403);
  if (admin && user.role !== 'admin') throw authError('adminRequired', 403);
  return user;
}

/**
 * Enforces the authentication and permission rules for a request.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {string} url URL of the requested resource.
 */
export function authorizeRequest(req, url) {
  const pathname = url.pathname;
  if (pathname.startsWith('/internal/backup/')) return; // Separate worker-token authorization.
  if (pathname === '/api/version' && req.method ===
    'GET') return; // Docker healthcheck.
  if (pathname === '/api/auth/session' && req.method === 'GET') return;
  if (pathname === '/api/auth/login' && req.method === 'POST') return;
  if (pathname === '/api/auth/logout' && req.method === 'POST') return;
  if (pathname === '/api/auth/password' && req.method ===
    'POST') {requireUser(req, false, true); return;}
  if (pathname.startsWith('/api/auth/')) {requireUser(req, true); return;}
  if (!store().loginRequired) return;
  if (pathname.startsWith('/api/') || pathname.startsWith('/images/')) {
    requireUser(req);
  }
  // Public website code/CSS/fonts/logo are not personal data. The app itself
  // does not fetch collection data until /api/auth/session has authorized it.
}

/**
 * Authenticates supplied credentials and creates a user session.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {*} body Request or response body.
 * @param {!Object} response Outgoing response.
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export async function login(req, body, response) {
  const username = typeof body?.username === 'string' ? body.username
    .toLowerCase().trim() : '';
  const password = body?.password;
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || typeof password !== 'string' ||
    password.length > 256 || Buffer.byteLength(password, 'utf8') >
    256) throw authError('invalidCredentials', 401);
  prune();
  const address = (req.socket?.remoteAddress || '').slice(0, 60);
  const key = `${address}:${username}`;
  const ipKey = `ip:${address}`;
  const prior = attempts.get(key);
  const ipPrior = attempts.get(ipKey);
  if (ipPrior?.until > Date.now() || prior?.until >
    Date.now()) throw authError('tooManyAttempts', 429);
  const user = store().users.find(item => item.username === username);
  // Verify against a valid dummy hash even for unknown accounts.
  const check = user || {...hashDummy, username};
  const computed = await scrypt(password, Buffer.from(check.salt, 'hex'), 64, SCRYPT_OPTIONS);
  const equal = crypto.timingSafeEqual(computed, Buffer.from(check.passwordHash, 'hex'));
  if (!user || !equal) {
    const failures = (prior?.failures || 0) + 1;
    attempts.set(
      key,
      {
        failures, at: Date.now(), until: failures >= 5 ? Date.now() +
          60000 : 0,
      }
    );
    const addressFailures = (ipPrior?.failures || 0) + 1;
    attempts.set(
      ipKey,
      {
        failures: addressFailures,
        at: Date.now(),
        until: addressFailures >= 20 ? Date.now() + 60000 : 0,
      }
    );
    throw authError('invalidCredentials', 401);
  }
  attempts.delete(key);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(
    token,
    {id: user.id, expires: Date.now() + SESSION_AGE, lastSeen: Date.now()}
  );
  // Bound in-memory state; sessions never persist to the user store.
  while (sessions.size > 2048) sessions.delete(sessions.keys().next().value);
  response.setHeader(
    'Set-Cookie',
    cookieHeaders(req, token, Math.floor(SESSION_AGE / 1000))
  );
  return sessionInfoWithUser(user);
}
// A constant valid scrypt value. No separate KDF for invalid usernames.
const hashDummy = {salt: '00000000000000000000000000000000', passwordHash: '0'.repeat(128)};
/**
 * Derives the session info with user result from the supplied values.
 *
 * @param {*} user Value used by this operation.
 * @return {!Object} Structured result assembled from the input data.
 */
function sessionInfoWithUser(user) {
  return {
    required: store().loginRequired,
    user: publicUser(user),
    canManageUsers: user.role === 'admin' && !user.mustChangePassword,
  };
}

/**
 * Ends the current user session and removes its cookie.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {!Object} response Outgoing response.
 * @return {!Object} Structured result for the caller.
 */
export function logout(req, response) {
  sessions.delete(sessionToken(req));
  response.setHeader('Set-Cookie', cookieHeaders(req));
  return {required: store().loginRequired, user: null, canManageUsers: false};
}

/**
 * Updates the invalidate user state for its caller.
 *
 * @param {*} id Identifier of the affected record.
 */
function invalidateUser(id) {
  for (const [token, session] of sessions) if (session.id ===
    id) sessions.delete(token);
}

/**
 * Updates a user's password after validating the request.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {*} body Request or response body.
 * @param {!Object} response Outgoing response.
 * @return {!Promise<void>} Promise fulfilled when the operation completes.
 */
export async function changePassword(req, body, response) {
  return serialize(async () => {
    const user = requireUser(req, false, true);
    if (typeof body?.currentPassword !== 'string' ||
      typeof body?.newPassword !==
      'string') throw authError('invalidPassword', 400);
    const candidate = await scrypt(
      body.currentPassword,
      Buffer.from(user.salt, 'hex'),
      64,
      SCRYPT_OPTIONS
    );
    if (!crypto.timingSafeEqual(
      candidate,
      Buffer.from(user.passwordHash, 'hex')
    )) throw authError('invalidCredentials', 401);
    if (body.currentPassword ===
      body.newPassword) throw authError('newPasswordMustDiffer', 400);
    const change = await hashPassword(body.newPassword);
    const data = structuredClone(store());
    const updated = data.users.find(item => item.id === user.id);
    Object.assign(updated, change, {mustChangePassword: false});
    save(data);
    // Rotate session on privilege transition, including first-login flow.
    invalidateUser(user.id);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(
      token,
      {id: user.id, expires: Date.now() + SESSION_AGE, lastSeen: Date.now()}
    );
    response.setHeader(
      'Set-Cookie',
      cookieHeaders(req, token, Math.floor(SESSION_AGE / 1000))
    );
    return sessionInfoWithUser(updated);
  });
}

/**
 * Lists user accounts visible to an authorized administrator.
 *
 * @param {!Object} req Incoming HTTP request.
 * @return {!Object} Structured result for the caller.
 */
export function listUsers(req) {
  requireUser(req, true);
  return {
    required: store().loginRequired, users: store().users
      .map(publicUser),
  };
}

/**
 * Creates user for auth.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {*} body Request or response body.
 * @return {!Promise<void>} Promise fulfilled when the operation completes.
 */
export async function createUser(req, body) {
  return serialize(async () => {
    requireUser(req, true);
    const username = typeof body?.username === 'string' ? body.username
      .trim().toLowerCase() : body?.username;
    usernameCheck(username);
    const data = structuredClone(store());
    if (data.users.some(item => item.username ===
      username)) throw authError('usernameExists', 409);
    if (data.users.length >= 200) throw authError('tooManyUsers', 409);
    const credential = await hashPassword(body?.password);
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
 * Clears password for auth.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {string} id Identifier used to select the relevant record.
 * @param {*} body Request or response body.
 * @return {!Promise<void>} Promise fulfilled when the operation completes.
 */
export async function resetPassword(req, id, body) {
  return serialize(async () => {
    const admin = requireUser(req, true);
    const data = structuredClone(store());
    const user = data.users.find(item => item.id === id);
    if (!user) throw authError('userNotFound', 404);
    if (user.id === admin.id) throw authError('changeOwnPassword', 400);
    Object.assign(
      user,
      await hashPassword(body?.password),
      {mustChangePassword: true}
    );
    save(data);
    invalidateUser(id);
    return publicUser(user);
  });
}

/**
 * Clears user for auth.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {string} id Identifier used to select the relevant record.
 * @return {!Promise<void>} Promise fulfilled when the operation completes.
 */
export function removeUser(req, id) {
  return serialize(() => {
    const admin = requireUser(req, true);
    if (id === admin.id) throw authError('cannotDeleteSelf', 400);
    const data = structuredClone(store());
    const before = data.users.length;
    data.users = data.users.filter(item => item.id !== id || item.role ===
      'admin');
    if (before === data.users.length) throw authError('userNotFound', 404);
    save(data);
    invalidateUser(id);
    return {success: true};
  });
}

/**
 * Changes the optional-login requirement in server settings.
 *
 * @param {!Object} req Incoming HTTP request.
 * @param {*} body Request or response body.
 * @return {!Promise<void>} Promise fulfilled when the operation completes.
 */
export function setLoginRequired(req, body) {
  return serialize(() => {
    requireUser(req, true);
    if (typeof body?.required !==
      'boolean') throw authError('invalidLoginSetting', 400);
    const data = structuredClone(store());
    data.loginRequired = body.required;
    save(data);
    return {required: data.loginRequired};
  });
}

/**
 * Operator-only recovery (execute locally on the server, never exposed over
 * HTTP).
 *
 * @return {!Promise<!Object>} Promise fulfilled when the operation completes.
 */
export async function resetAdminPassword() {
  const data = structuredClone(store());
  const admin = data.users.find(user => user.role === 'admin');
  const password = crypto.randomBytes(18).toString('base64url');
  Object.assign(
    admin,
    await hashPassword(password),
    {mustChangePassword: true}
  );
  save(data);
  invalidateUser(admin.id);
  return {username: admin.username, password};
}
