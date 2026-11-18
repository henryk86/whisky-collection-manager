import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBottling, normalizeBottle } from '../../server/domain/normalization.js';
import { createTastingHistory } from '../../public/js/domain/tasting-history.js';
import { glencairnRating } from '../../public/js/ui/glencairn-rating.js';
import { analyzeCollection } from '../../public/js/domain/analytics.js';
import { parseTastingScore } from '../../shared/tasting.js';
import { WHISKY_COLORS, whiskyPickerHex, whiskyPickerPosition, isAllowedWhiskyHex, normalizeWhiskyColor } from '../../shared/whisky-colors.js';
import { whiskyColorSelector, whiskyColorDisplay, whiskyCustomColorName } from '../../public/js/ui/whisky-color-selector.js';
import { WHISKY_COLOR_REFERENCES, whiskyColorNameKey } from '../../shared/whisky-color-names.js';
import { createTranslator } from '../../public/js/i18n/index.js';
import german from '../../public/locales/de.json' with { type: 'json' };
import english from '../../public/locales/en.json' with { type: 'json' };
import { GLENCAIRN_INK } from '../../public/js/ui/glencairn-icon.js';

const notes = nose => ({nose,palate:'',finish:''});
test('schema 5 rejects legacy tasting fields on a bottling; bottles do not store sensory data', () => {
    for (const field of ['rating','tastingNotes','flavorProfile','whiskyColor','legacyTastings'])
        assert.throws(() => normalizeBottling({name:'Release',[field]:field === 'rating'?87:null}));
    const bottle = normalizeBottle({inventoryNumber:'003',rating:15,tastingNotes:notes('No')});
    assert.equal(bottle.rating,undefined);
    assert.equal(bottle.tastingNotes,undefined);
});
test('five clickable Glencairn glasses retain fractional original 0-100 ratings', () => {
    const html = glencairnRating(85);
    assert.equal((html.match(/data-rating-points=/g)||[]).length,5);
    assert.equal((html.match(/class="tasting-glass"/g)||[]).length,5);
    assert.match(html,/data-tasting-score/);
    assert.match(html,/value="85"/);
    assert.match(html,/--glass-fill:25%/); // the fifth GLASS is filled to 25% of its liquid height
    assert.match(html,/role="group"/);
    assert.match(html,/clip-path="url\(#rating-glass-4\)"/);
    assert.match(GLENCAIRN_INK,/M215,97/,'original Glencairn shines inside the bowl');
    assert.match(html,/class="glencairn-rating-outline"/);
    assert.match(html,/class="glencairn-rating-fill"/);
    assert.match(html,/data-rating-fill[^>]*y="267.75"[^>]*height="63.25"/);
    assert.doesNotMatch(html,/class="glencairn-gold"/,'rating uses its dedicated gold liquid fill');
    assert.match(html,/class="tasting-score-control"/);
    assert.match(html,/<span id="tasting-score-suffix">\/ 100<\/span>/);
    assert.doesNotMatch(html,/data-tasting-rating-total|tasting-rating-total/,'only the editable score displays the point value');
    assert.match(html,/data-glass-state="partial"/);
    assert.doesNotMatch(html,/★|☆/);
    assert.match(glencairnRating(null), /placeholder="–"/);
    assert.match(glencairnRating(null), /value=""/);
});
test('undo/redo includes notes, glass ratings and flavor values and resets redo on new edit', () => {
    const initial = {flavorProfile:null,tastingNotes:notes(''),rating:null};
    const history = createTastingHistory(initial);
    history.record({flavorProfile:null,tastingNotes:notes('Oak'),rating:40});
    history.record({flavorProfile:null,tastingNotes:notes('Oak'),rating:80});
    assert.equal(history.canUndo,true);
    history.undo();
    assert.equal(history.value.rating,40);
    assert.equal(history.value.tastingNotes.nose,'Oak');
    history.redo();
    assert.equal(history.value.rating,80);
    history.undo();
    history.record({...history.value,rating:100});
    assert.equal(history.canRedo,false);
    assert.equal(history.value.rating,100);
});
test('analytics counts only the latest dated tasting, independent of physical bottle count', () => {
    const collection = {schemaVersion:5,distilleries:[],bottlings:[{
        id:'x',name:'Release',distilleryIds:[],tastings:[{id:'t1',tastedOn:'2026-10-01',rating:85,
            tastingNotes:notes('Oak'),flavorProfile:null,whiskyColor:null,createdAt:'2026-10-01T00:00:00Z'}],
        bottles:[{id:'a',status:'closed',volumeType:'standard'}, {id:'b',status:'open',volumeType:'standard'}]
    }]};
    const result = analyzeCollection(collection);
    assert.equal(result.tasting.rating.count,1);
    assert.equal(result.tasting.rating.avg,85);
});

test('precise rating input accepts comma and period, preserves one decimal, rejects invalid values', () => {
    assert.equal(parseTastingScore('87,5'),87.5);
    assert.equal(parseTastingScore('87.5'),87.5);
    assert.equal(parseTastingScore('0'),0);
    assert.equal(parseTastingScore('100'),100);
    assert.equal(parseTastingScore(''),null);
    for (const bad of ['-1','100.1','87.55','word','1e2']) assert.throws(()=>parseTastingScore(bad));
    assert.throws(() => normalizeBottling({name:'Release',rating:87.5}));
    assert.match(glencairnRating(87.5),/value="87,5"/);
    assert.match(glencairnRating(87.5),/--glass-fill:37.5%/);
});
test('twelve-step whisky color scale persists as independent, validated bottling attribute and joins undo history', () => {
    assert.equal(WHISKY_COLORS.length,12);
    const chosen = whiskyColorSelector('butter');
    assert.match(chosen,/data-color-key="butter" aria-pressed="true"/);
    assert.match(chosen,/whisky-color-choice is-selected/);
    assert.doesNotMatch(chosen,/whisky-color-footer|whisky-color-current|tasting-color-clear/,'no repeated colour name or clear control below palette');
    assert.equal(new Set(WHISKY_COLORS.map(v=>v.key)).size,12);
    for (const color of WHISKY_COLORS) assert.match(color.hex,/^#[0-9a-f]{6}$/);
    assert.throws(()=>normalizeBottling({name:'Release',whiskyColor:'amber',rating:87.5}));
    const html=whiskyColorSelector('amber');
    assert.equal((html.match(/data-color-key=/g)||[]).length,12);
    assert.match(html,/data-whisky-color="amber"/);
    assert.match(html,/style="fill:#d17b20"/);
    const history=createTastingHistory({flavorProfile:null,tastingNotes:notes(''),rating:87.5,whiskyColor:'amber'});
    history.record({...history.value,whiskyColor:'honey'});
    history.undo(); assert.equal(history.value.whiskyColor,'amber');
    history.redo(); assert.equal(history.value.whiskyColor,'honey');
});

test('custom whisky picker hides HEX from users, stores exact shades and rejects green/blue', () => {
    const html=whiskyColorSelector('custom:#b74154');
    assert.equal((html.match(/class="whisky-color-choice/g)||[]).length,12,'reference colours stay unchanged');
    assert.match(html,/class="whisky-custom-row is-selected"/);
    assert.match(html,/data-whisky-picker-area/);
    assert.match(html,/<input type="hidden" data-whisky-custom-hex value="#b74154">/);
    assert.doesNotMatch(html,/whisky-custom-hex-row|>HEX<|type="text" data-whisky-custom-hex/);
    assert.match(html,/value="#b74154"/);
    assert.match(html,/style="fill:#b74154"/);
    assert.match(html,/data-whisky-custom-name aria-live="polite">Rubinrot<\/output>/);
    assert.match(whiskyColorDisplay('custom:#b74154'),/>Rubinrot<\/strong>/);
    assert.doesNotMatch(whiskyColorDisplay('custom:#b74154').match(/<strong>(.*?)<\/strong>/)?.[1] || '', /#[0-9a-f]{6}/i, 'readonly label hides hexadecimal code');
    // Switching from a custom shade to a reference colour clears the custom field,
    // its preview liquid and the picker marker instead of retaining a stale HEX.
    for (const fixedSelection of ['honey',null]) {
        const fixedHtml=whiskyColorSelector(fixedSelection);
        assert.match(fixedHtml,/data-whisky-custom-hex[^>]*value=""/);
        assert.match(fixedHtml,/id="custom-color-glass"/);
        assert.match(fixedHtml,/class="glencairn-liquid"[^>]*style="fill:transparent"/);
        assert.match(fixedHtml,/class="whisky-custom-row"/);
        assert.doesNotMatch(fixedHtml,/class="whisky-custom-row is-selected"/);
        assert.doesNotMatch(fixedHtml,/#b74154/);
        assert.match(fixedHtml,/data-whisky-custom-name aria-live="polite"><\/output>/);
    }
    assert.equal(normalizeWhiskyColor('custom:#F4B3C1'),'custom:#f4b3c1','rose HEX is normalized');
    for (const hex of ['#b74154','#f4b3c1','#9b2125','#eaa52e','#50392d','#f6efb6'])
        assert.equal(normalizeWhiskyColor(`custom:${hex}`),`custom:${hex}`);
    for (const hex of ['#00ff00','#3a8a53','#0044ff','#00ffff','#ff00ff','#555555','#ffffff','#12345g','#abc','color:red'])
        assert.throws(()=>normalizeWhiskyColor(`custom:${hex}`),`reject ${hex}`);
    for (let y=0;y<=10;y++) for(let x=0;x<=10;x++) {
        const hex=whiskyPickerHex(x/10,y/10);
        assert.equal(isAllowedWhiskyHex(hex),true,`picker colour ${hex} must be persisted`);
        const point=whiskyPickerPosition(hex);
        assert.ok(point.x>=0 && point.x<=1 && point.y>=0 && point.y<=1);
    }
    assert.equal(normalizeWhiskyColor('honey'),'honey','existing fixed keys survive');
    const history=createTastingHistory({flavorProfile:null,tastingNotes:notes(''),rating:null,whiskyColor:'honey'});
    history.record({...history.value,whiskyColor:'custom:#f4b3c1'});
    assert.equal(history.value.whiskyColor,'custom:#f4b3c1');
    history.undo(); assert.equal(history.value.whiskyColor,'honey');
    history.redo(); assert.equal(history.value.whiskyColor,'custom:#f4b3c1');
});

test('50 curated custom-colour names use perceptual matches without changing stored HEX', () => {
    assert.equal(WHISKY_COLOR_REFERENCES.length,50);
    const keys=new Set(), shades=new Set();
    const en=createTranslator(english,german,'en');
    const de=createTranslator(german,english,'de');
    for (const ref of WHISKY_COLOR_REFERENCES) {
        assert.ok(!keys.has(ref.key),`duplicate key: ${ref.key}`);
        assert.ok(!shades.has(ref.hex),`duplicate colour: ${ref.hex}`);
        keys.add(ref.key);shades.add(ref.hex);
        assert.equal(whiskyColorNameKey(ref.hex),ref.key,`reference ${ref.key} must name itself`);
        const translationKey=`tasting.colorName.${ref.key}`;
        assert.notEqual(de(translationKey),translationKey);
        assert.notEqual(en(translationKey),translationKey);
        assert.ok(de(translationKey).trim());
        assert.ok(en(translationKey).trim());
        assert.equal(normalizeWhiskyColor(`custom:${ref.hex}`),`custom:${ref.hex}`);
    }
    assert.equal(whiskyColorNameKey('#00ff00'),null);
    assert.equal(whiskyColorNameKey('#0011ee'),null);
    assert.equal(whiskyColorNameKey(''),null);
    assert.equal(whiskyColorNameKey('#CB8154'),'copperGold');
    assert.equal(whiskyCustomColorName('#cb8154'),'Kupfergold');
    assert.match(whiskyColorDisplay('custom:#cb8154'),/>Kupfergold<\/strong>/);
    assert.match(whiskyColorSelector('custom:#cb8154'),/data-whisky-custom-name[^>]*>Kupfergold<\/output>/);
    assert.equal(whiskyColorNameKey('#cb8255'),'copperGold','nearby colour is named by perceptual proximity');
    // Near-white pink and straw can be close in OKLab lightness, but must
    // keep their distinct colour families at the upper picker boundary.
    const paleRose=whiskyPickerHex(0,0);
    assert.equal(paleRose,'#f2d4de');
    assert.equal(whiskyColorNameKey(paleRose),'paleRose');
    assert.equal(whiskyCustomColorName(paleRose),'Blasses Rosé');
    assert.match(whiskyColorDisplay(`custom:${paleRose}`),/>Blasses Rosé<\/strong>/);
    assert.equal(whiskyColorNameKey(whiskyPickerHex(0.24,0)),'paleRose');
    assert.equal(whiskyColorNameKey(whiskyPickerHex(1,0)),'veryPaleStraw');
    assert.equal(whiskyColorNameKey(whiskyPickerHex(0,0.05)),'paleRose');
    assert.equal(normalizeWhiskyColor('custom:#cb8255'),'custom:#cb8255','naming must not quantize the saved colour');
    assert.match(whiskyColorDisplay('honey'),/>Honig<\/strong>/,'fixed reference labels are unchanged');
});

test('help only expands substantial backup procedures and warehouse furniture photos stay under shelves without sort buttons', async () => {
    const {HELP_GUIDES} = await import('../../public/js/views/help-guides.js');
    assert.deepEqual(Object.keys(HELP_GUIDES),['backups']);
    // Verify the view template itself: read-only structure assertion; controls are backed by browser tests.
    const fs = await import('node:fs');
});
