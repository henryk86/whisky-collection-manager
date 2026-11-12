import fs from 'node:fs';
import path from 'node:path';
// Load configuration before modules access process.env. Existing environment
// variables take precedence, so CI, containers and test runs can override .env.
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match) {
            continue;
        }
        const [, key, raw] = match;
        if (Object.hasOwn(process.env, key)) {
            continue;
        }
        let value = raw.trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        else {
            value = value.replace(/\s+#.*$/, '').trim();
        }
        process.env[key] = value;
    }
}
const configuredPort = Number(process.env.PORT ?? 3100);
if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
    throw new Error('PORT muss eine ganze Zahl zwischen 1 und 65535 sein.');
}
export const PORT = configuredPort;
export const HOST = process.env.HOST || '0.0.0.0';
export const DATA_ROOT = path.resolve(process.env.WHISKY_DATA_DIR || process.cwd());
function boolConfig(name, fallback) {
    const value = String(process.env[name] ?? fallback).toLowerCase();
    if (!['true', 'false', '1', '0'].includes(value)) {
        throw new Error(`${name} muss true oder false sein.`);
    }
    return value === 'true' || value === '1';
}
function portConfig(name, fallback) {
    const p = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
        throw new Error(`${name} muss eine ganze Zahl zwischen 1 und 65535 sein.`);
    }
    return p;
}
export const HTTPS_ENABLED = boolConfig('HTTPS_ENABLED', true);
export const HTTP_ENABLED = boolConfig('HTTP_ENABLED', false);
export const HTTPS_PORT = portConfig('HTTPS_PORT', 3543);
export const HTTPS_CERT_FILE = path.resolve(process.env.HTTPS_CERT_FILE || 'certs/server-cert.pem');
export const HTTPS_KEY_FILE = path.resolve(process.env.HTTPS_KEY_FILE || 'certs/server-key.pem');
if (!HTTPS_ENABLED && !HTTP_ENABLED) {
    throw new Error('Mindestens HTTP_ENABLED oder HTTPS_ENABLED muss true sein.');
}
if (HTTPS_ENABLED && HTTP_ENABLED && HTTPS_PORT === PORT) {
    throw new Error('HTTPS_PORT und PORT muessen unterschiedlich sein.');
}

/** Browser requests may only address configured local/certificate hosts.
 * Loopback is always retained for the Docker healthcheck and backup worker.
 * CERT_* are injected by docker-compose from the same .env used to issue TLS.
 */
export const ALLOWED_HOSTS = new Set([
    'localhost', '127.0.0.1', '::1',
    ...['ALLOWED_HOSTS', 'CERT_DNS_NAMES', 'CERT_IP_ADDRESSES']
        .flatMap(name => String(process.env[name] || '').split(','))
        .map(value => value.trim().toLowerCase().replace(/^\[|\]$/g, ''))
        .filter(Boolean),
]);
