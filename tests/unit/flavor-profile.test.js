import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBottling} from '../../server/domain/normalization.js';
import {FLAVOR_AXES, normalizeFlavorProfile} from '../../public/js/domain/flavor-profile.js';
import {flavorChart, flavorPolygon} from '../../public/js/ui/flavor-profile.js';
import german from '../../public/locales/de.json' with {type:'json'};
import english from '../../public/locales/en.json' with {type:'json'};

const profile = Object.fromEntries(FLAVOR_AXES.map((key,i) => [key,i]));
test('bottling flavor profile persists all eight language-independent values, without affecting physical bottle properties', () => {
    const value = normalizeBottling({name:'Sample',distilleryIds:[],flavorProfile:profile});
    assert.deepEqual(value.flavorProfile,profile);
    assert.deepEqual(normalizeBottling({name:'Updated'},value).flavorProfile,profile);
    assert.equal(normalizeBottling({name:'Updated',flavorProfile:null},value).flavorProfile,null);
    assert.equal(value.bottles,undefined);
});
test('flavor values must be complete integer scales 0 through 10; malformed objects cannot enter collection', () => {
    for (const invalid of [{woody:5},{...profile,woody:11},{...profile,peaty:-1},{...profile,fruity:'3'},{...profile,winey:2.5},{...profile,unexpected:3},[]]) {
        assert.throws(() => normalizeFlavorProfile(invalid));
        assert.throws(() => normalizeBottling({name:'Sample',flavorProfile:invalid}));
    }
    assert.deepEqual(normalizeFlavorProfile(Object.fromEntries(FLAVOR_AXES.map(key=>[key,10]))),Object.fromEntries(FLAVOR_AXES.map(key=>[key,10])));
});
test('flavor chart has eight axes and sliders and does not misrepresent missing profile as zero', () => {
    const editor=flavorChart(profile,{editable:true});
    assert.equal((editor.match(/data-flavor-range=/g)||[]).length,8);
    assert.equal((editor.match(/data-flavor-point=/g)||[]).length,8);
    assert.match(editor,/data-flavor-set="1"/);
    assert.match(flavorChart(null,{editable:true}),/data-flavor-set=""/);
    assert.equal((flavorPolygon(profile).match(/ /g)||[]).length,7);
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
test('optional color column is emitted before the radar chart without altering the eight axes', () => {
    const html=flavorChart(profile,{editable:true,colorSection:'<div class="tasting-color-column" data-test="palette"></div>'});
    assert.match(html,/class="flavor-editor is-editable has-color"/);
    assert.ok(html.indexOf('data-test="palette"')<html.indexOf('<svg class="flavor-chart"'));
    assert.ok(html.indexOf('<svg class="flavor-chart"')<html.indexOf('<div class="flavor-sliders"'));
    assert.equal((html.match(/data-flavor-range=/g)||[]).length,8);
});
