#!/usr/bin/env node
/** Verify the names of files inside a release archive (stdin: unzip -Z1). */
import fs from 'node:fs';

export function prohibitedReleasePath(name) {
    const path = name.replaceAll('\\', '/').replace(/^\.\//, '');
    if (!path || path.includes('..') || path.startsWith('/') || /[\x00-\x1f]/.test(path)) return true;
    const parts = path.replace(/\/$/, '').split('/');
    if (parts.some(part => ['node_modules', 'certs', '.git', 'test-artifacts', 'coverage'].includes(part))) return true;
    if (['data', 'images', 'documents', 'backups'].includes(parts[0])) return true;
    if (parts[0] === 'deploy' && ['storage', 'secrets', 'rclone', 'backup-control', 'backup-targets'].includes(parts[1])) return true;
    if (parts.some(part => part === '.env' || (part.startsWith('.env.') && part !== '.env.example'))) return true;
    if (parts.some(part => /^(?:collection\.json|rclone\.conf|restic-password|backup-admin-token|backup-worker-token|server-key\.pem)$/i.test(part))) return true;
    return false;
}

if (process.argv[1]?.endsWith('/verify-release-files.js')) {
    const lines = fs.readFileSync(0, 'utf8').split('\n').filter(Boolean);
    if (!lines.length) {
        console.error('Release ZIP is empty');
        process.exit(1);
    }
    const unsafe = lines.filter(prohibitedReleasePath);
    if (unsafe.length) {
        console.error('Private or unsafe files found in release ZIP:', unsafe.join(', '));
        process.exit(1);
    }
    for (const required of ['package.json', 'package-lock.json', 'public/index.html', 'docker-compose.yml', '.github/workflows/release.yml']) {
        if (!lines.includes(required)) {
            console.error(`Missing release file: ${required}`);
            process.exit(1);
        }
    }
    if (lines.some(name => name.replaceAll('\\', '/').startsWith('extension/'))) {
        console.error('Private extension code must not be part of public WCM releases.');
        process.exit(1);
    }
    console.log(`Release archive checked: ${lines.length} files, no runtime data, extension source or secrets.`);
}
