#!/usr/bin/env node
/** Static registry check. Translation is always by keys, never by source phrases. */
import fs from 'node:fs';
import path from 'node:path';

const catalog = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
const walk = directory => fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.js') ? [file] : [];
});
const files = walk('public/js').concat('public/app.js');
const keys = new Set();
for (const file of files) {
    if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
    const source = fs.readFileSync(file, 'utf8');
    // Translation identifiers are domain keys, never concatenated pieces of source text.
    if (/\bt\(\s*['"][^'"]+['"]\s*\+/u.test(source)) {
        throw new Error(`Dynamically assembled translation key in ${file}`);
    }
    for (const match of source.matchAll(/\bt\(\s*(['"])([a-zA-Z][a-zA-Z0-9.]*)\1/gu)) {
        if (!match[2].endsWith('.')) keys.add(match[2]);
    }
}
for (const key of keys) {
    if (!Object.hasOwn(catalog, key)) throw new Error(`Missing German translation key: ${key}`);
}
for (const key of Object.keys(catalog)) {
    if (!/^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+$/u.test(key)) {
        throw new Error(`Invalid translation key: ${key}`);
    }
    if (/[äöüß]/iu.test(key) || /(?:\.[a-z]{1,2}){3,}/u.test(key) || /\.[a-z0-9]{40,}/u.test(key)) {
        throw new Error(`Unstable/generated translation key: ${key}`);
    }
}
// Explicit lookup tables for persisted type/front/camera IDs must also point to valid keys.
const warehouseSource = fs.readFileSync('public/js/views/warehouse.js', 'utf8');
for (const [, key] of warehouseSource.matchAll(/['"](warehouse\.(?:furniture\.types|front|camera|navigation)\.[a-zA-Z]+)['"]/gu)) {
    if (!Object.hasOwn(catalog, key)) throw new Error(`Missing dynamic warehouse translation key: ${key}`);
}
const registry = JSON.parse(fs.readFileSync('public/locales/index.json', 'utf8'));
for (const code of Object.keys(registry)) {
    if (code === 'de') continue;
    const other = JSON.parse(fs.readFileSync(`public/locales/${code}.json`, 'utf8'));
    const sourceKeys = Object.keys(catalog).sort();
    const translatedKeys = Object.keys(other).sort();
    if (JSON.stringify(translatedKeys) !== JSON.stringify(sourceKeys)) {
        const missing = sourceKeys.filter(key => !Object.hasOwn(other, key));
        const extra = translatedKeys.filter(key => !Object.hasOwn(catalog, key));
        throw new Error(`Incomplete ${code} catalog: missing ${missing.join(', ') || '-'}, extra ${extra.join(', ') || '-'}`);
    }
    for (const [key, value] of Object.entries(other)) {
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Invalid translated text in ${code}: ${key}`);
        }
        const params = message => [
            ...[...message.matchAll(/\{([a-zA-Z]\w*)\}/gu)].map(match => match[1]),
            ...[...message.matchAll(/\{([a-zA-Z]\w*),\s*plural,/gu)].map(match => match[1])
        ].sort().join(',');
        if (params(value) !== params(catalog[key])) {
            throw new Error(`Translation placeholders differ (${code}): ${key}`);
        }
    }
}
console.log(`${keys.size} referenced translation keys, ${Object.keys(catalog).length} German entries: OK`);
