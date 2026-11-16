import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog = JSON.parse(fs.readFileSync(new URL('../../seed/distillery.json', import.meta.url), 'utf8'));
test('published distilleries have countries; Scottish names are not UK/GB and key regions are curated', () => {
    assert.equal(catalog.length, 450);
    assert.ok(catalog.every(site => site.country));
    assert.ok(catalog.filter(site => site.region).length >= 180);
    for (const [name, region] of [['Ardbeg', 'Islay'], ['Springbank', 'Campbeltown'],
        ['Glenfiddich', 'Speyside'], ['Auchentoshan', 'Lowland'], ['Highland Park', 'Highland']]) {
        const site = catalog.find(entry => entry.name === name);
        assert.equal(site.country, 'Schottland');
        assert.equal(site.region, region);
    }
    assert.equal(catalog.find(site => site.name === 'Yamazaki').country, 'Japan');
    assert.equal(catalog.find(site => site.name === 'Penderyn').country, 'Wales');
});
