import {domElements, domText, domMatches, domIndex, domScope, assertDom, assertDomOrder} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTastingsView} from '../../public/js/views/tastings.js';
import {createDetailView} from '../../public/js/views/detail.js';

const example = {
  id: 'bottling-1',
  name: 'Example dram',
  bottles: [],
  distillery: 'Sample Distillery',
  tastings: [],
};

/**
 * Derives the detail html result from the supplied values.
 *
 * @param {!Array<*>=} tastings Value used by this operation.
 * @return {import('../../public/js/ui/render-plan.js').RenderContent} Captured tasting detail plan used to inspect the layout.
 */
function detailHtml(tastings = []) {
  let html = '';
  const oldDocument = globalThis.document;
  globalThis.document = {
    /**
     * Simulates an element query with no matches.
     * @return {Array<never>} Empty match list; the simulated root has no matching elements.
     */
    querySelectorAll: () => [],
  };
  try {
    const state = {
      page: 'detail',
      selected: example.id,
      collection: {bottlings: [{...example, tastings}], distilleries: []},
    };
    createDetailView({
      state,
      selectors: {
        /**
         * Provides an empty physical-bottle list.
         * @return {Array<never>} No physical bottles for the requested bottling.
         */
        bottles: () => [],
        /**
         * Simulates a bottling without a cover photo.
         * @return {string} Empty path to exercise the no-photo state.
         */
        coverPhoto: () =>
          '',
        /**
         * Derives the distillery names result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        distilleryNames: () => [],
      },
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
       */
      shell: content => {html = content;},
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Derives the action result from the supplied values.
       *
       * @param {*} fn Function called during this operation.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      action: async fn => fn(),
    })();
  } finally {globalThis.document = oldDocument;}
  return html;
}

test(
  'detail-page empty tastings use a subdued heading hint and two buttons without a panel',
  async () => {
    const html = detailHtml();
    const section = domScope(html, 'section.section.tasting-summary.is-empty');
    assert.ok(section);
    await assertDom(section, "[data-act=\"tastings-new\"] > svg.new-icon");
    assert.equal((await domElements(section, '[class="panel tasting-summary-card"]')).length, 0);
    await assertDom(section, "[class=\"hint tasting-summary-empty\"]", {"text": new RegExp("^Noch keine Verkostung$")});
    await assertDom(section, "button[data-act=\"tastings-open\"]");
    assert.equal((await domElements(section, '[data-act="tastings-new"]')).length, 1);
    await assertDom(html, "[data-act=\"add-bottle\"] > svg.new-icon");
  }
);

test(
  'detail-page latest tasting uses five fillable glencairns before its numeric score',
  async () => {
    const latest = {
      id: 'note-1',
      tastedOn: '2026-11-15',
      createdAt: '2026-11-15T20:00:00Z',
      rating: 85,
    };
    const html = detailHtml([latest]);
    const row = domScope(html, '.tasting-summary-score');
    assert.ok(row);
    assert.equal((await domElements(row, '[class="glencairn-symbol glencairn-rating-symbol"]')).length, 5);
    await assertDom(row, ".tasting-summary-glasses", {parentText: /85 \/ 100/});
    assert.ok((await domElements(html, '[data-act="tastings-open"][data-tasting-id="note-1"]')).length > 0);
  }
);

test(
  'multiple tastings still open the exact latest record from the preview button',
  async () => {
    const html = detailHtml([
      {id: 'earlier', tastedOn: '2026-11-10', rating: 70},
      {id: 'newer', tastedOn: '2026-11-22', rating: 80},
    ]);
    const section = domScope(html, 'section[data-region=\"detail-tastings\"]');
    assert.ok((await domElements(section, '[data-act="tastings-open"][data-tasting-id="newer"]')).length > 0);
    assert.match(await domText(section), /22\.11\.2026 · 2 Verkostungsnotizen/);
    assert.doesNotMatch(await domText(section), /Alle Verkostungsnotizen/);
  }
);

test(
  'when a bottling has no notes, the overview action does not use an invalid tasting ID',
  async () => {
    const html = detailHtml();
    await assertDom(html, "[data-act=\"tastings-open\"]");
    await assertDom(html, "[data-act=\"tastings-open\"][data-tasting-id]", {}, true);
    assert.ok((await domElements(html, '[class="section tasting-summary is-empty"]')).length > 0);
    await assertDom(html, "p[class=\"hint tasting-summary-empty\"]", {"text": new RegExp("^Noch keine Verkostung$")});
    await assertDom(html, "button[data-act=\"tastings-open\"]", {text: /^Alle Verkostungsnotizen/});
    await assertDom(html, ".panel.tasting-summary-card, .tasting-summary-rating", {}, true);
    assert.equal((await domElements(html, '[data-act="tastings-open"]')).length, 1);
  }
);

test(
  'the tasting home create action is inside the entries panel heading',
  async () => {
    let html = '';
    const state = {
      page: 'tastings-home',
      collection: {bottlings: [], externalTastings: []},
    };
    createTastingsView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: content => html = content,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).home();
    await assertDom(html, "section.analytics-panel.tasting-home-recent > .tasting-panel-heading.ds-section-header:has(> h3) > button[data-act=\"tastings-start-choice\"] > svg.new-icon");
    assert.equal((await domElements(html, '[class="tasting-add-action"]')).length, 0);
  }
);

test(
  'tasting subject photo precedes details inside the information panel',
  async () => {
    let html = '';
    const b = {
      ...example,
      tastings: [{
        id: 't1',
        tastedOn: '2026-11-15',
        rating: 80,
        tastingNotes: {nose: '', palate: '', finish: ''},
      }],
    };
    const state = {
      page: 'tastings',
      selected: b.id,
      collection: {bottlings: [b], distilleries: [], externalTastings: []},
    };
    const selectors = {
      /**
       * Supplies a fixed cover-photo path for the image rendering assertion.
       * @return {string} Fixture photo path '/photos/cover.png'.
       */
      coverPhoto: () => '/photos/cover.png',
    };
    createTastingsView({
      state,
      selectors,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: content => html = content,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).list();
    const info = domScope(html, '.tasting-bottling-summary.tasting-bottling-photo-layout');
    assert.ok(info);
    assert.ok(await domIndex(info, '.tasting-bottling-photo') < await domIndex(info, '.tasting-bottling-copy'));
  }
);

test(
  'saved tasting edit control sits inside the record data panel rather than the section heading',
  async () => {
    let html = '';
    const note = {
      id: 'note-1',
      tastedOn: '2026-11-15',
      title: 'Evening',
      rating: 80,
      tastingNotes: {nose: '', palate: '', finish: ''},
    };
    const b = {...example, tastings: [note]};
    const state = {
      page: 'tasting',
      selected: b.id,
      tastingId: note.id,
      collection: {bottlings: [b], distilleries: [], externalTastings: []},
    };
    createTastingsView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: content => html = content,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).editor();
    const recordPanel = domScope(html, '.tasting-record-fields.analytics-panel.tasting-readonly-meta-panel');
    await assertDomOrder(html, '.tasting-readonly-meta-panel', '.tasting-top-row');
    assert.ok((await domElements(recordPanel, '[data-act="tasting-edit-start"]')).length > 0);
    assert.ok((await domElements(recordPanel, '[class="actions tasting-readonly-meta-actions"]')).length > 0);
    await assertDom(html, ".section-head:has(> h3) > .actions", {}, true);
    assert.equal((await domElements(html, '[data-act="tasting-edit-start"]')).length, 1);
  }
);

test(
  'latest tasting card reuses the radar and previews notes as other detail facts, but hides colour',
  async () => {
    const flavorProfile = {
      woody: 4,
      smoky: 8,
      cereal: 1,
      peaty: 7,
      fruity: 6,
      floral: 2,
      medicinal: 1,
      winey: 4,
      feinty: 0,
      sulphury: 0,
    };
    const html = detailHtml([
      {
        id: 'previous',
        tastedOn: '2026-11-14',
        createdAt: '2026-11-14T08:00:00Z',
        whiskyColor: 'gold',
        flavorProfile: null,
        tastingNotes: {nose: 'Old note', palate: '', finish: ''},
      },
      {
        id: 'recent',
        tastedOn: '2026-11-15',
        createdAt: '2026-11-15T08:00:00Z',
        rating: 80,
        whiskyColor: 'amber',
        flavorProfile,
        tastingNotes: {
          nose: 'Rauch & Vanille', palate: '<Frucht>',
          finish: '   ',
        },
      },
    ]);
    const summary = domScope(html, 'section[data-region=\"detail-tastings\"]');
    assert.ok((await domElements(summary, '[class="tasting-summary-content"]')).length > 0);
    assert.equal((await domMatches(summary, ".tasting-readonly-color, .glencairn-liquid")) || (await domMatches(summary, ".tasting-summary-color")), false);
    assert.ok((await domElements(summary, '[class="tasting-summary-radar"]')).length > 0);
    assert.ok((await domElements(summary, '[class="flavor-editor is-preview"]')).length > 0);
    assert.equal((await domElements(summary, '[class="flavor-axis-text"]')).length, 10);
    assert.equal((await domMatches(summary, ".flavor-sliders, [data-flavor-range]")), false);
    await assertDom(summary, ".tasting-summary-note .tasting-summary-field-label:has(+ .tasting-summary-note-value)", {text: "Nase", nextText: /Rauch & Vanille/});
    await assertDom(summary, ".tasting-summary-field-label:has(+ .tasting-summary-note-value)", {text: "Geschmack", nextText: /<Frucht>/});
    assert.equal((/Old note/.test(await domText(summary)) || await domMatches(summary, "span", {text: "Abgang"})), false);
    assert.ok((await domElements(summary, '[data-act="tastings-open"]')).length > 0);
  }
);

test(
  'compact preview shares panel edges and uses normal buttons and detail-field notes',
  async () => {
    const html = detailHtml([{
      id: 'compact',
      tastedOn: '2026-11-16',
      rating: 80,
      whiskyColor: 'honey',
      flavorProfile: {woody: 5},
      tastingNotes: {nose: 'Vanille und Frucht', palate: '', finish: ''},
    }]);
    const section = domScope(html, 'section[data-region=\"detail-tastings\"]');
    const summary = await domIndex(section, '.tasting-summary-main');
    const heading = await domIndex(section, '.muted.tasting-summary-lead');
    const score = await domIndex(section, '.tasting-summary-score');
    const date = await domIndex(section, '.muted.tasting-summary-meta');
    const radar = await domIndex(section, '.tasting-summary-radar');
    const notes = await domIndex(section, '.tasting-summary-notes');
    const button = await domIndex(section, '.actions.tasting-summary-actions');
    assert.ok(
      summary >= 0 && summary < heading && heading < score && score < date,
      'left summary keeps the original heading, rating, date hierarchy'
    );
    const mainEnd = await domIndex(section, '.tasting-summary-radar');
    assert.ok(date < button && button < mainEnd && mainEnd < notes,
      'the tasting button follows the date inside the left summary, before radar and optional notes');
    await assertDom(section, ".muted.tasting-summary-meta + div.actions.tasting-summary-actions");
    assert.ok((await domElements(section, '[data-act="tastings-open"][data-tasting-id="compact"]')).length > 0);
    await assertDom(section, ".tasting-summary-field-label:has(+ .tasting-summary-note-value)", {text: "Nase", nextText: "Vanille und Frucht"});
    assert.equal((await domMatches(section, ".tasting-readonly-color")) || (await domMatches(section, "*", {"text": new RegExp("^Farbe$")})) || (await domMatches(section, "*", {"text": new RegExp("^Geschmacksprofil$")})) || (await domMatches(section, "*", {"text": new RegExp("^Geschmacksnoten$")})) || (await domMatches(section, ".tasting-summary-color")), false);
  }
);

test(
  'desktop reserves the right notes column without displaying absent notes',
  async () => {
    const flavorProfile = {
      woody: 4,
      smoky: 8,
      cereal: 1,
      peaty: 7,
      fruity: 6,
      floral: 2,
      medicinal: 1,
      winey: 4,
      feinty: 0,
      sulphury: 0,
    };
    const html = detailHtml([{
      id: 'without-notes', tastedOn: '2026-11-15', rating: 80,
      flavorProfile, tastingNotes: {nose: ' ', palate: '', finish: ''},
    }]);
    const section = domScope(html, 'section[data-region=\"detail-tastings\"]');
    await assertDomOrder(section, ".tasting-summary-radar", '.tasting-summary-notes.is-empty[aria-hidden="true"]');
    assert.equal((await domMatches(section, "[class=\"tasting-summary-note\"], [class=\"tasting-summary-field-label\"]")), false);
  }
);

test(
  'latest tasting only shows recorded preview content, not empty note labels',
  async () => {
    const none = detailHtml([{
      id: 'empty',
      tastedOn: '2026-11-15',
      rating: 60,
      whiskyColor: null,
      flavorProfile: null,
      tastingNotes: {nose: ' ', palate: '', finish: ''},
    }]);
    const summary = domScope(none, 'section[data-region=\"detail-tastings\"]');
    assert.equal((await domMatches(summary, ".tasting-summary-radar, [class=\"tasting-summary-note\"]")) || (await domMatches(summary, ".tasting-summary-color")), false);
    await assertDom(summary, "[class=\"tasting-summary-notes is-empty\"][aria-hidden=\"true\"]", {"text": new RegExp("^$")});
    assert.match(await domText(summary), /60 \/ 100/);
    const withColor = detailHtml([{
      id: 'color', tastedOn: '2026-11-16', whiskyColor: 'custom:#be602f',
      flavorProfile: null, tastingNotes: {nose: '', palate: '', finish: ''},
    }]);
    const colorSummary = domScope(withColor, 'section[data-region=\"detail-tastings\"]');
    assert.equal((await domMatches(colorSummary, ".tasting-summary-radar, [class=\"tasting-summary-note\"], .tasting-readonly-color")) || (await domMatches(colorSummary, ".tasting-summary-color")), false);
    await assertDom(colorSummary, "[class=\"tasting-summary-notes is-empty\"][aria-hidden=\"true\"]", {"text": new RegExp("^$")});
    assert.match(await domText(colorSummary), /Nicht bewertet/);
  }
);
