/** Explicit file discovery works consistently on Windows, macOS and Linux shells. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
function collect(directory) {
    return fs.readdirSync(directory, {
        withFileTypes: true
    }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? collect(file) : file.endsWith('.test.js') ? [file] : [];
    });
}
const directories = process.argv.includes('--browser') ? ['tests/browser'] : ['tests/unit', 'tests/integration'];
const files = directories.flatMap(collect).sort();
if (!files.length) {
    throw new Error('No test files found');
}
const result = spawnSync(process.execPath, ['--test', ...files], {
    stdio: 'inherit'
});
if (result.error) {
    throw result.error;
}
process.exitCode = result.status ?? 1;
