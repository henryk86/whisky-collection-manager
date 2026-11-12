import test from 'node:test';
import assert from 'node:assert/strict';
import { splitDistilleryNames, matchImportedDistilleries } from '../../public/js/features/whiskybase/distillery-matching.js';
import { importChoice } from '../../public/js/features/whiskybase/choice-template.js';
import { validateExtensionPayload } from '../../public/js/features/whiskybase/payload.js';

const distilleries = [
    { id: 'd-caol', name: 'Caol Ila' }, { id: 'd-bow', name: 'Bowmore' },
    { id: 'd-ard', name: 'Ardbeg' }, { id: 'd-port', name: 'Port Ellen' },
];

test('Whiskybase: a comma-separated distillery field creates four individual contributors', () => {
    assert.deepEqual(splitDistilleryNames(' Caol Ila, Bowmore, Ardbeg, Port Ellen '),
        ['Caol Ila', 'Bowmore', 'Ardbeg', 'Port Ellen']);
    assert.deepEqual(matchImportedDistilleries(' Caol Ila, Bowmore, Ardbeg, Port Ellen ', distilleries), [
        { name: 'Caol Ila', id: 'd-caol' }, { name: 'Bowmore', id: 'd-bow' },
        { name: 'Ardbeg', id: 'd-ard' }, { name: 'Port Ellen', id: 'd-port' },
    ]);
});

test('Whiskybase: one distillery still imports normally; names are normalized and duplicates removed', () => {
    assert.deepEqual(splitDistilleryNames('  caol   ila,  BOWMORE ; Caol Ila\nPort Ellen,  '),
        ['caol ila', 'BOWMORE', 'Port Ellen']);
    assert.deepEqual(matchImportedDistilleries('  caol   ila,  BOWMORE ; Caol Ila\nPort Ellen,  ', distilleries), [
        { name: 'caol ila', id: 'd-caol' }, { name: 'BOWMORE', id: 'd-bow' },
        { name: 'Port Ellen', id: 'd-port' },
    ]);
    assert.deepEqual(matchImportedDistilleries('Ardbeg', distilleries), [{ name: 'Ardbeg', id: 'd-ard' }]);
});

test('Whiskybase: commas inside a historical distillery name do not split the name', () => {
    assert.deepEqual(splitDistilleryNames("John O'Groats (original, 1826), Bowmore"),
        ["John O'Groats (original, 1826)", 'Bowmore']);
});

test('Whiskybase: unknown contributors are listed separately, disabled and escaped in preview', () => {
    const matches = matchImportedDistilleries('Ardbeg, New & <Scotch> Works', distilleries);
    assert.deepEqual(matches, [{ name: 'Ardbeg', id: 'd-ard' }, { name: 'New & <Scotch> Works', id: null }]);
    const known = importChoice({ label: 'Destillerie', value: matches[0].name,
        distillery: true, distilleryId: matches[0].id, checked: true });
    const unknown = importChoice({ label: 'Destillerie', value: matches[1].name,
        distillery: true, disabled: true });
    assert.match(known, /name="wb-distillery" value="d-ard" checked/);
    assert.match(unknown, /name="wb-distillery" disabled/);
    assert.match(unknown, /New &amp; &lt;Scotch&gt; Works/);
    assert.doesNotMatch(unknown, /<Scotch>/);
    assert.match(unknown, /Nicht gefunden/);
});

test('Whiskybase: longer contributor lists are not truncated midway through a name', () => {
    const names = Array.from({ length: 14 }, (_, n) => `Brennerei ${n + 1} mit extra langen Namen`);
    const raw = names.join(', ');
    assert.ok(raw.length > 150);
    const payload = validateExtensionPayload({
        version: 2, source: 'external', distilleryName: raw,
        fields: { whiskybaseId: '9999', name: 'Test Blend',
            whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/9999/test' },
    });
    assert.deepEqual(splitDistilleryNames(payload.distilleryName), names);
});


test('new fragment schema rejects old and unmarked payload versions', () => {
    const fields = { whiskybaseId: '9999', name: 'Test',
        whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/9999/test' };
    assert.throws(() => validateExtensionPayload({ version: 1, fields }));
    assert.throws(() => validateExtensionPayload({ version: 2, fields }));
    assert.equal(validateExtensionPayload({ version: 2, source: 'external', fields }).version, 2);
});
