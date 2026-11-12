import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
export async function freePort() {
    const socket = net.createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    return port;
}
/** Every integration test uses an isolated temporary collection and a separate process. */
export async function startTestServer() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-test-'));
    const port = await freePort();
    const backupControl = process.env.BACKUP_CONTROL_DIR || path.join(dir, 'backup-control');
    fs.mkdirSync(backupControl, { recursive: true });
    const passfile = path.join(backupControl, 'backup-zip-password');
    if (!fs.existsSync(passfile)) fs.writeFileSync(passfile, 'SicheresTestpasswort-2026-mindestens-14!\n', { mode: 0o600 });
    const child = spawn(process.execPath, ['server/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env, BACKUP_CONTROL_DIR: backupControl,
            BACKUP_ADMIN_TOKEN: process.env.BACKUP_ADMIN_TOKEN || 'a'.repeat(64),
            WHISKY_DATA_DIR: dir, PORT: String(port), HOST: '127.0.0.1', HTTP_ENABLED: 'true', HTTPS_ENABLED: 'false'
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let diagnostics = '';
    child.stderr.on('data', chunk => {
        diagnostics += chunk;
    });
    const base = `http://127.0.0.1:${port}`;
    async function stop() {
        if (child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit');
            child.kill();
            await exited;
        }
        fs.rmSync(dir, {
            recursive: true, force: true
        });
    }
    try {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (child.exitCode !== null) {
                throw new Error(`Test server exited: ${diagnostics}`);
            }
            try {
                const response = await fetch(base + '/api/collection');
                if (response.ok) {
                    return {
                        base, dir, child, stop
                    };
                }
            }
            catch { /* Wait for the listening socket, not for an arbitrary fixed delay. */
            }
            await new Promise(resolve => setTimeout(resolve, 40));
        }
        throw new Error(`Test server did not become ready: ${diagnostics}`);
    }
    catch (error) {
        await stop();
        throw error;
    }
}
export async function requestJson(base, url, method = 'GET', data) {
    const response = await fetch(base + url, {
        method,
        headers: data ? {
            'Content-Type': 'application/json'
        } : {},
        body: data ? JSON.stringify(data) : undefined,
    });
    return {
        status: response.status, data: await response.json()
    };
}
