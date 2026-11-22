import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionWorkspace } from '../../public/js/ui/section-navigation.js';
import { helpView } from '../../public/js/views/help.js';
import { createAnalyticsView } from '../../public/js/views/analytics.js';

test('common section sidebar has a straight gold active marker, no rounded pill, and a mobile selector', () => {
    const config = {sections:[{id:'intro',label:'Einführung'},{id:'other',label:'Weiter'}],
        activeId:'other',action:'help-tab',itemAttribute:'data-help-topic',
        label:'Hilfethemen',switchKind:'help'};
    const markup = sectionWorkspace(config, '<article>Testinhalt</article>');
    assert.match(markup, /data-help-topic="other" aria-current="page"/);
    assert.doesNotMatch(markup, /data-help-topic="intro" aria-current/);
    assert.match(markup, /data-section-switch="help"/);
    assert.match(markup, /<option value="other" selected>/);
    assert.match(markup, /<article>Testinhalt<\/article>/);

});

test('shared section navigation escapes all external values', () => {
    const html = sectionWorkspace({sections:[{id:'<id>',label:'<script>'}], activeId:'<id>',
        action:'<act>',itemAttribute:'data-section',label:'<nav>',switchKind:'analytics'}, 'CONTENT');
    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /<id>/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /CONTENT/);
});

test('analysis and help render the same workspace and preserve their own content', () => {
    const state = {collection:{schemaVersion:6,distilleries:[],bottlings:[]},
        analyticsFilters:{},analyticsPeriod:'month',selected:'overview'};
    let analysis = '';
    createAnalyticsView({state,shell:html => {analysis=html;}})();
    const help = helpView();
    for (const html of [analysis,help]) {
        assert.match(html, /class="section-workspace"/);
        assert.match(html, /class="section-nav-desktop"/);
        assert.match(html, /class="section-nav-mobile"/);
    }
    assert.match(analysis, /Das Wichtigste auf einen Blick\./);
    assert.match(help, /class="help-steps"/);
    assert.match(analysis, /data-section-switch="analytics"/);
    assert.match(help, /data-section-switch="help"/);
    assert.match(help, /data\/warehouse\.json/);
});
