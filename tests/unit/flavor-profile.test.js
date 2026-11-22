import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBottling} from '../../server/domain/normalization.js';
import {normalizeTastingRecord} from '../../shared/tasting-records.js';
import {FLAVOR_AXES, LEGACY_FLAVOR_AXES, NEW_FLAVOR_AXES, normalizeFlavorProfile} from '../../shared/flavor-profile.js';
import {flavorChart, flavorPolygon} from '../../public/js/ui/flavor-profile.js';
import german from '../../public/locales/de.json' with {type:'json'};
import english from '../../public/locales/en.json' with {type:'json'};

const profile = Object.fromEntries(FLAVOR_AXES.map((key,i) => [key,i]));
test('flavor profile is owned by a dated tasting, not by the bottling', () => {
    const value = normalizeTastingRecord({tastedOn:'2026-11-15',flavorProfile:profile});
    assert.deepEqual(value.flavorProfile,profile);
    assert.deepEqual(normalizeTastingRecord({rating:88},value).flavorProfile,profile);
    assert.equal(normalizeTastingRecord({flavorProfile:null},value).flavorProfile,null);
    assert.throws(()=>normalizeBottling({name:'Sample',flavorProfile:profile}));
});
test('flavor values require the legacy eight or all ten axes; new axes may be unassessed only in older tastings', () => {
    for (const invalid of [{woody:5},{...profile,woody:11},{...profile,peaty:-1},{...profile,fruity:'3'},{...profile,winey:2.5},{...profile,unexpected:3},{...profile,smoky:null,medicinal:null,woody:null},
        {...profile,smoky:null,medicinal:undefined},[]]) {
        assert.throws(() => normalizeFlavorProfile(invalid));
        assert.throws(() => normalizeTastingRecord({tastedOn:'2026-11-15',flavorProfile:invalid}));
    }
    assert.deepEqual(normalizeFlavorProfile(Object.fromEntries(FLAVOR_AXES.map(key=>[key,10]))),Object.fromEntries(FLAVOR_AXES.map(key=>[key,10])));
});
test('flavor chart has ten axes and sliders and does not misrepresent missing profile as zero', () => {
    const editor=flavorChart(profile,{editable:true});
    assert.equal((editor.match(/data-flavor-range=/g)||[]).length,10);
    assert.equal((editor.match(/data-flavor-point=/g)||[]).length,10);
    assert.match(editor,/data-flavor-set="1"/);
    assert.match(flavorChart(null,{editable:true}),/data-flavor-set=""/);
    assert.equal((flavorPolygon(profile).match(/ /g)||[]).length,9);
    assert.match(flavorChart(null),/Noch kein Geschmacksprofil/);
});
test('German and English axis names are localized, with German Alkoholisch for English Feinty', () => {
    assert.equal(german['flavor.axis.feinty'],'Alkoholisch');
    assert.equal(english['flavor.axis.feinty'],'Feinty');
    for (const axis of FLAVOR_AXES) {
        assert.ok(german[`flavor.axis.${axis}`]);
        assert.ok(english[`flavor.axis.${axis}`]);
    }
});
test('optional color column is emitted before the ten-axis radar chart', () => {
    const html=flavorChart(profile,{editable:true,colorSection:'<div class="tasting-color-column" data-test="palette"></div>'});
    assert.match(html,/class="flavor-editor is-editable has-color"/);
    assert.ok(html.indexOf('data-test="palette"')<html.indexOf('<svg class="flavor-chart"'));
    assert.ok(html.indexOf('<svg class="flavor-chart"')<html.indexOf('<div class="flavor-sliders"'));
    assert.equal((html.match(/data-flavor-range=/g)||[]).length,10);
});


test('older eight-axis tasting remains valid without fabricating ratings for new aromas', () => {
    const older=Object.fromEntries(LEGACY_FLAVOR_AXES.map((key,i) => [key,i]));
    const normalized=normalizeFlavorProfile(older);
    for (const axis of LEGACY_FLAVOR_AXES) assert.equal(normalized[axis],older[axis]);
    for (const axis of NEW_FLAVOR_AXES) assert.equal(normalized[axis],null);
    assert.deepEqual(normalizeFlavorProfile(normalized),normalized,'normalized old record can be saved again');
    const readOnly=flavorChart(normalized);
    for (const name of ['Rauchig','Medizinisch']) assert.match(readOnly,new RegExp(name));
    assert.equal((readOnly.match(/<strong>–<\/strong>/g)||[]).length,2);
    assert.equal((readOnly.match(/visibility="hidden"/g)||[]).length,2);
    const editor=flavorChart(normalized,{editable:true});
    assert.equal((editor.match(/data-flavor-unset="1"/g)||[]).length,2);
    assert.equal(flavorPolygon(normalized).trim().split(/\s+/).length,8,'unassessed axes are not plotted as zero');
});

test('both newly added flavor dimensions accept real zero but not missing legacy scores', () => {
    const complete={...profile};
    for (const axis of NEW_FLAVOR_AXES) complete[axis]=0;
    assert.deepEqual(normalizeFlavorProfile(complete),complete);
    for (const axis of NEW_FLAVOR_AXES) complete[axis]=null;
    assert.deepEqual(normalizeFlavorProfile(complete),complete);
    assert.throws(()=>normalizeFlavorProfile({...complete,cereal:null}));
    assert.throws(()=>normalizeFlavorProfile({...complete,fruity:undefined}));
});

test('obsolete eleven-axis payload is accepted but fiery is not part of the new ten-axis profile', () => {
    const eleven={...profile,fiery:7};
    assert.deepEqual(normalizeFlavorProfile(eleven),profile);
    assert.deepEqual(normalizeFlavorProfile({...eleven,fiery:null}),profile);
    assert.throws(()=>normalizeFlavorProfile({...eleven,fiery:'7'}));
    assert.equal(FLAVOR_AXES.length,10);
    assert.equal(flavorChart(normalizeFlavorProfile(eleven)).includes('Brennend'),false);
});

test('compact tasting radar uses the original ten-axis graphic without duplicating sliders', () => {
    const preview=flavorChart(profile,{compact:true});
    assert.match(preview,/class="flavor-editor is-preview"/);
    assert.match(preview,/<svg class="flavor-chart"/);
    assert.equal((preview.match(/class="flavor-axis-text"/g)||[]).length,10);
    assert.doesNotMatch(preview,/flavor-sliders|flavor-scale|data-flavor-range/);
    assert.equal((flavorChart(profile).match(/flavor-sliders/g)||[]).length,1);
    const labelY = html => Number(html.match(/<text class="flavor-axis-text"[^>]*y="([^"]+)"[^>]*>Holzig<\/text>/)?.[1]);
    // Only the detail preview tightens axis labels; the full tasting radar is unchanged.
    assert.ok(labelY(preview) > labelY(flavorChart(profile)));
    assert.ok(labelY(preview) < 64, 'the compact top label is close to the radar ring');
});
