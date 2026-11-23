import { pageHeader, sectionHeader, headingTitle, headerActions, backNavigation, helpIconButton } from '../../public/js/ui/headers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import de from '../../public/locales/de.json' with {type:'json'};
import en from '../../public/locales/en.json' with {type:'json'};

test('page header escapes text, retains one semantic title and trusted action slots', () => {
    const html=pageHeader({title:'A < B',eyebrow:'The "reserve"',intro:'<script>x</script>',className:'settings-heading',actions:'<button data-act="goto-home">Back</button>'});
    assert.match(html,/<header class="section-head ds-page-header settings-heading">/);
    assert.match(html,/<h2>A &lt; B<span class="heading-period" aria-hidden="true">\.<\/span><\/h2>/);
    assert.match(html,/The &quot;reserve&quot;/);
    assert.ok(!html.includes('<script>'));
    assert.match(html,/<button data-act="goto-home">Back<\/button>/);
    assert.equal((html.match(/<h2\b/g) || []).length,1);
});

test('section heading keeps actions separate and help inside the heading without injecting inline style', () => {
    const help=helpIconButton({label:'Show help',action:'flight-plan-help'});
    const html=sectionHeader({title:'Planning',layout:'tasting-panel-heading',titleClass:'flight-plan-heading-title',trailingAction:help,actions:'<button disabled>Next</button>'});
    assert.match(html,/<h3 class="flight-plan-heading-title ds-heading-with-action">Planning/);
    assert.equal((html.match(/class="ds-help-icon-button flight-plan-help-button"/g) || []).length,1);
    assert.match(html,/<div class="actions ds-header-actions"><button disabled>Next<\/button><\/div>/);
    assert.ok(!html.includes('style='));
    assert.match(headingTitle({title:'<&',level:2,className:'analytics-section-title'}),/<h2 class="analytics-section-title">&lt;&amp;<\/h2>/);
    assert.throws(()=>headingTitle({title:'wrong',level:1}),/Heading level/);
    assert.throws(()=>sectionHeader({title:'wrong',layout:'not-supported'}),/Invalid section header/);
});

test('header actions do not take over behavior and can be disabled without altering data-act', () => {
    const html=headerActions('<button data-act="edit-bottling" disabled>Bearbeiten</button>',{className:'detail-head-actions'});
    assert.match(html,/class="actions ds-header-actions detail-head-actions"/);
    assert.match(html,/data-act="edit-bottling" disabled/);
});

test('back navigation owns exactly one SVG arrow and has accessible action semantics', () => {
    for (const [language,catalog] of [['de',de],['en',en]]) {
        const text=catalog['common.navigation.backToCollection'];
        assert.doesNotMatch(text,/^[←⟵⬅]/u,`${language}: translation contains no icon`);
        const page=backNavigation('goto-home',text,'','page-action');
        assert.equal((page.match(/<svg\b/g) || []).length,1);
        assert.match(page,/data-act="goto-home"/);
        assert.match(page,/ds-back-nav--page-action/);
        assert.ok(page.includes(`<span>${text}</span>`));
        const inline=backNavigation('back',` ←  ← ${text}`,'detail-back');
        assert.equal((inline.match(/<svg\b/g) || []).length,1);
        assert.ok(!inline.includes('←'),`${language}: no repeated arrow glyph`);
        assert.match(inline,/data-region="detail-back"/);
    }
    assert.throws(()=>backNavigation('back','Back','','invalid'),/Invalid back-navigation/);
    assert.match(backNavigation('x','<img onerror=alert(1)>'),/&lt;img/);
});

test('help icon receives a readable name, a single SVG, and an explicit disabled state', () => {
    const html=helpIconButton({label:'Why "this"?',disabled:true});
    assert.match(html,/aria-label="Why &quot;this&quot;\?"/);
    assert.match(html,/disabled>/);
    assert.equal((html.match(/<svg\b/g)||[]).length,1);
});
