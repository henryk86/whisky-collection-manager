/** Entry point: configuration, TLS and process startup only. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from './app.js';
import { PORT, HOST, HTTPS_ENABLED, HTTP_ENABLED, HTTPS_PORT, HTTPS_CERT_FILE, HTTPS_KEY_FILE, ALLOWED_HOSTS } from './config.js';
export { createServer } from './app.js';
export function startServers() {
    let tlsOptions;
    if (HTTPS_ENABLED) {
        if (!fs.existsSync(HTTPS_KEY_FILE) || !fs.existsSync(HTTPS_CERT_FILE)) {
            throw new Error('HTTPS-Zertifikat fehlt. Bitte npm run https:setup -- --ip <LAPTOP-IP> ausfuehren.');
        }
        tlsOptions = {
            key: fs.readFileSync(HTTPS_KEY_FILE), cert: fs.readFileSync(HTTPS_CERT_FILE)
        };
    }
    console.log(`Erlaubte Hosts: ${[...ALLOWED_HOSTS].sort().join(', ')} (zusaetzliche Adressen: ALLOWED_HOSTS)`);
    const handler = createRequestHandler();
    const servers = [];
    if (HTTPS_ENABLED) {
        const secure = https.createServer(tlsOptions, handler);
        secure.listen(HTTPS_PORT, HOST, () => console.log(`Whisky Collection Manager HTTPS: https://localhost:${HTTPS_PORT} (LAN: https://<LAPTOP-IP>:${HTTPS_PORT})`));
        servers.push(secure);
    }
    if (HTTP_ENABLED) {
        const plain = http.createServer(handler);
        plain.listen(PORT, HOST, () => console.log(`Whisky Collection Manager HTTP: http://localhost:${PORT} (LAN: http://<LAPTOP-IP>:${PORT})`));
        servers.push(plain);
    }
    return servers;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        startServers();
    }
    catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
