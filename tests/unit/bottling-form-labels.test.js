import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const visibleBottlingLabelKeys = [
    'forms.bottling.abv',
    'forms.bottling.ageYears',
    'forms.bottling.bottlingDate',
    'forms.bottling.distillationDate',
    'forms.bottling.nominalVolume',
    'forms.bottling.participatingDistilleries',
    'forms.bottle.additionalPhotos',
    'forms.bottle.attachments',
    'forms.bottle.autoInventoryNumber',
    'forms.bottle.initialPhotos',
    'forms.bottle.initialSize',
    'forms.bottle.inventoryNumberOptional',
    'forms.bottle.rating',
    'forms.bottle.size',
    'detail.actions.addAttachments',
];

for (const language of ['de', 'en']) {
    test(`${language}: bottling detail and edit labels have no explanatory parentheses`, () => {
        const catalog = JSON.parse(fs.readFileSync(new URL(`../../public/locales/${language}.json`, import.meta.url), 'utf8'));
        for (const key of visibleBottlingLabelKeys) {
            assert.equal(typeof catalog[key], 'string', `${key} must remain translated`);
            assert.doesNotMatch(catalog[key], /\([^)]*\)/u, `${key} must have a concise visible label`);
        }
        // Counts on the read-only page are actual data, not explanatory label suffixes.
        assert.match(catalog['detail.statistics.photoCount'], /\{count\}/u);
    });
}
