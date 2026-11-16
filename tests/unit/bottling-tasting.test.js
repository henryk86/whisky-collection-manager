import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBottling, normalizeBottle } from '../../server/domain/normalization.js';
import { createTastingHistory } from '../../public/js/domain/tasting-history.js';
import { glencairnRating } from '../../public/js/ui/glencairn-rating.js';
import { analyzeCollection } from '../../public/js/domain/analytics.js';
import { parseTastingScore } from '../../shared/tasting.js';
import { WHISKY_COLORS } from '../../shared/whisky-colors.js';
import { whiskyColorSelector } from '../../public/js/ui/whisky-color-selector.js';
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

test('help only expands substantial backup procedures and warehouse furniture photos stay under shelves without sort buttons', async () => {
    const {HELP_GUIDES} = await import('../../public/js/views/help-guides.js');
    assert.deepEqual(Object.keys(HELP_GUIDES),['backups']);
    // Verify the view template itself: read-only structure assertion; controls are backed by browser tests.
    const fs = await import('node:fs');
    const furnitureSource = fs.readFileSync('public/js/views/warehouse-presentation.js','utf8');
    assert.ok(furnitureSource.indexOf('warehouse-shelves${') < furnitureSource.indexOf('warehouse-furniture-photos'));
    assert.match(furnitureSource,/data-furniture-photos/);
    assert.match(furnitureSource,/capture="environment"/);
    assert.doesNotMatch(furnitureSource,/data-act="warehouse-photo-move"/);
});
