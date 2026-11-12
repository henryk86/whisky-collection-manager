#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const certDir = path.join(root, 'certs');
const key = path.join(certDir, 'server-key.pem');
const cert = path.join(certDir, 'server-cert.pem');
const args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log('Aufruf: npm run https:setup -- --ip 192.168.1.50 [--hostname whisky.local]');
    process.exit(0);
}
const envPath = path.join(root, '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : 'PORT=3100\nHOST=0.0.0.0\nWHISKY_DATA_DIR=.\n';
// Keep the configured HTTPS port when certificates are regenerated.
const portMatch = env.match(/^\s*(?:export\s+)?HTTPS_PORT\s*=\s*(.*?)\s*$/m);
let portValue = portMatch ? portMatch[1].trim() : '3543';
if ((portValue.startsWith('"') && portValue.endsWith('"')) || (portValue.startsWith("'") && portValue.endsWith("'"))) {
    portValue = portValue.slice(1, -1);
}
else {
    portValue = portValue.replace(/\s+#.*$/, '').trim();
}
const httpsPort = Number(portValue);
if (!Number.isInteger(httpsPort) || httpsPort < 1 || httpsPort > 65535) {
    throw Error('HTTPS_PORT muss eine ganze Zahl zwischen 1 und 65535 sein.');
}
const ips = ['127.0.0.1'];
const names = ['localhost'];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ip') {
        const ip = args[++i];
        if (!ip || net.isIP(ip) === 0) {
            throw Error('Nach --ip muss eine gueltige IP-Adresse folgen.');
        }
        ips.push(ip);
    }
    else if (args[i] === '--hostname') {
        const name = args[++i];
        if (!name || name.length > 253 || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(name)) {
            throw Error('Ungueltiger Hostname.');
        }
        names.push(name);
    }
    else {
        throw Error(`Unbekanntes Argument: ${args[i]}`);
    }
}
if (ips.length === 1) {
    const found = Object.values(os.networkInterfaces()).flat().filter(x => x && !x.internal && x.family === 'IPv4').map(x => x.address);
    if (found.length === 1) {
        ips.push(found[0]);
        console.log(`Erkannte LAN-IP: ${found[0]}`);
    }
    else {
        console.warn('Mehrere oder keine LAN-IPs erkannt. Bitte --ip <Laptop-IP> angeben, damit das Zertifikat auf dem Smartphone funktioniert.');
    }
}
const sans = [...new Set([...names.map(x => 'DNS:' + x), ...ips.map(x => 'IP:' + x)])];
fs.mkdirSync(certDir, {
    recursive: true
});
function command(binary, argv) {
    return spawnSync(binary, argv, {
        stdio: 'inherit'
    });
}
let generatedBy = 'openssl';
const mkcert = spawnSync('mkcert', ['-version'], {
    stdio: 'ignore'
});
if (!mkcert.error && mkcert.status === 0) {
    generatedBy = 'mkcert';
    // Requires mkcert -install on the development PC; deliberately not run automatically.
    const result = command('mkcert', ['-cert-file', cert, '-key-file', key, ...names, ...ips]);
    if (result.error || result.status !== 0) {
        throw Error('mkcert-Zertifikat konnte nicht erstellt werden.');
    }
}
else {
    const result = command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '825', '-keyout', key, '-out', cert, '-subj', '/CN=Whisky Collection Manager', '-addext', `subjectAltName=${sans.join(',')}`]);
    if (result.error || result.status !== 0) {
        throw Error('OpenSSL fehlgeschlagen. Installiere OpenSSL oder mkcert.');
    }
}
try {
    fs.chmodSync(key, 0o600);
}
catch {
}
function setEnv(k, v) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^\\s*(?:export\\s+)?${k}\\s*=.*$`, 'm');
    env = re.test(env) ? env.replace(re, line) : env.trimEnd() + '\n' + line + '\n';
}
// Keep the TLS certificate's actual SANs in sync with the default Host allowlist.
setEnv('CERT_DNS_NAMES', [...new Set(names)].join(','));
setEnv('CERT_IP_ADDRESSES', [...new Set(ips)].join(','));
setEnv('HTTPS_ENABLED', 'true');
setEnv('HTTPS_PORT', String(httpsPort));
setEnv('HTTPS_CERT_FILE', 'certs/server-cert.pem');
setEnv('HTTPS_KEY_FILE', 'certs/server-key.pem');
// No insecure HTTP endpoint after setup; can be deliberately enabled later.
setEnv('HTTP_ENABLED', 'false');
fs.writeFileSync(envPath, env.endsWith('\n') ? env : env + '\n');
console.log(`\nZertifikat erstellt (${generatedBy}). HTTPS in .env aktiviert, HTTP deaktiviert.`);
console.log('Server starten: npm start');
console.log(`URL: https://${ips.at(-1)}:${httpsPort}/`);
if (generatedBy === 'mkcert') {
    console.log('WICHTIG: mkcert -install auf dem Laptop und Root-CA auf dem Smartphone als vertrauenswuerdig installieren.');
}
else {
    console.log('WARNUNG: Selbstsigniertes Zertifikat. Der Browser wird es ohne explizite Vertrauensstellung ablehnen; Kamera/Scanner sind dann nicht garantiert verfuegbar. mkcert wird empfohlen.');
}
console.log('Zertifikat bei IP-/Hostname-Wechsel neu erzeugen. Private Keys niemals hochladen.');
