import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test(
  'home hero preserves the established descriptive copy without hard-coded line breaks',
  () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(
      de['home.hero.description'],
      'Von der besonderen Abfüllung bis zum letzten Dram. Entdecke, erfasse und verwalte deine Whisky-Sammlung.'
    );
    assert.equal(
      en['home.hero.description'],
      'From a special bottling to the last dram. Discover, document and manage your whisky collection.'
    );
    for (const catalog of [de, en]) {
      assert.doesNotMatch(catalog['home.hero.description'], /\n|<br\s*\/?\s*>/i);
    }
  }
);
