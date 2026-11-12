import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const configUrl = new URL('../../server/config.js', import.meta.url).href;
const expected = {
    PORT: '3100', HOST: '0.0.0.0', WHISKY_DATA_DIR: '.', HTTP_ENABLED: 'false',
    HTTPS_ENABLED: 'true', HTTPS_PORT: '3543',
    HTTPS_CERT_FILE: 'certs/server-cert.pem', HTTPS_KEY_FILE: 'certs/server-key.pem'
};
function values(text) {
    return Object.fromEntries(text.split(/\r?\n/).filter(line => /^\w+=/.test(line)).map(line => {
        const i = line.indexOf('=');
        return [line.slice(0, i), line.slice(i + 1)];
    }));
}
function runConfig(cwd, overrides = {}) {
    const env = {
        ...process.env
    };
    for (const key of Object.keys(expected)) {
        delete env[key];
    }
    const script = `import * as c from ${JSON.stringify(configUrl)};console.log(JSON.stringify({HTTP_ENABLED:c.HTTP_ENABLED,HTTPS_ENABLED:c.HTTPS_ENABLED,HTTPS_PORT:c.HTTPS_PORT,PORT:c.PORT}));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd, env: {
            ...env, ...overrides
        }, encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
}
test('distributed env template defaults to HTTPS on 3543 with HTTP disabled', () => {
    const template = fs.readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
    assert.deepEqual(values(template), expected);
});
test('server defaults without env match HTTPS-only configuration', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-config-'));
    try {
        assert.deepEqual(runConfig(dir), {
            HTTP_ENABLED: false, HTTPS_ENABLED: true, HTTPS_PORT: 3543, PORT: 3100
        });
    }
    finally {
        fs.rmSync(dir, {
            recursive: true, force: true
        });
    }
});
test('env template loads correctly and explicit environment variables take precedence', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-config-'));
    try {
        fs.copyFileSync(new URL('../../.env.example', import.meta.url), path.join(dir, '.env'));
        assert.deepEqual(runConfig(dir), {
            HTTP_ENABLED: false, HTTPS_ENABLED: true, HTTPS_PORT: 3543, PORT: 3100
        });
        assert.deepEqual(runConfig(dir, {
            HTTP_ENABLED: 'true', HTTPS_ENABLED: 'false', HTTPS_PORT: '4543'
        }), {
            HTTP_ENABLED: true, HTTPS_ENABLED: false, HTTPS_PORT: 4543, PORT: 3100
        });
    }
    finally {
        fs.rmSync(dir, {
            recursive: true, force: true
        });
    }
});
