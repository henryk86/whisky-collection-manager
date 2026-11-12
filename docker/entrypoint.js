/** Single container supervisor for HTTPS app + backup background process.
 * Each child is isolated by a separate process but shares the configured
 * volumes. If either exits unexpectedly, the container exits so Docker can
 * restart the complete service. No plaintext listener and no SSH tunnel. */
import fs from 'node:fs';
import https from 'node:https';
import { spawn } from 'node:child_process';

const children = new Map();
let shuttingDown = false;
let exitCode = 0;

function stop(signal = 'SIGTERM') {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children.values()) {
        if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    }
    // Keep the supervisor alive until both children have ended; allow a hard
    // shutdown if either of them ignores SIGTERM.
    const force = setTimeout(() => {
        for (const child of children.values()) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 8000);
    force.unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => stop(signal));
}

function launch(name, script) {
    const child = spawn(process.execPath, [script], { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
    children.set(name, child);
    child.on('error', error => {
        console.error(`${name}: Prozess konnte nicht gestartet werden:`, error);
        exitCode = 1;
        stop();
    });
    child.on('exit', (code, signal) => {
        children.delete(name);
        if (!shuttingDown) {
            console.error(`${name} wurde unerwartet beendet (${code ?? signal}).`);
            exitCode = code || 1;
            stop();
        }
        if (!children.size) process.exit(exitCode);
    });
    return child;
}

function httpsReady() {
    const ca = fs.readFileSync(process.env.HTTPS_CERT_FILE || '/run/certs/server-cert.pem');
    const url = new URL('/api/version', process.env.APP_INTERNAL_URL || 'https://127.0.0.1:3543');
    if (url.protocol !== 'https:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
        throw Error('APP_INTERNAL_URL muss eine HTTPS-Loopback-Adresse sein.');
    }
    return new Promise(resolve => {
        const request = https.get(url, { ca, timeout: 2000 }, response => {
            response.resume();
            response.on('end', () => resolve(response.statusCode === 200));
        });
        request.on('timeout', () => request.destroy());
        request.on('error', () => resolve(false));
    });
}

async function main() {
    launch('app', 'server/index.js');
    for (let attempt = 0; attempt < 60 && !shuttingDown; attempt++) {
        if (await httpsReady()) {
            if (!shuttingDown) launch('backup', 'worker/backup-worker.js');
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!shuttingDown) {
        console.error('App-HTTPS auf 127.0.0.1:3543 wurde nicht bereit.');
        exitCode = 1;
        stop();
    }
}
main().catch(error => { console.error(error); exitCode = 1; stop(); });
