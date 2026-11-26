import {renderedText, domElements} from '../helpers/rendering.js';
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
  () => {
    const html = detailHtml();
    const section = renderedText(html).match(new RegExp('<section[^>]*class="section tasting-summar' + 'y is-empty"[\\s\\S]*?<\\/section>'))?.[0];
    assert.ok(section);
    assert.match(renderedText(section), /data-act="tastings-new"[^>]*><svg class="new-icon"/);
    assert.equal(domElements(section, '[class="panel tasting-summary-card"]').length, 0);
    assert.match(renderedText(section), /class="hint tasting-summary-empty">Noch keine Verkostung<\/p>/);
    assert.match(renderedText(section), /<button[^>]*data-act="tastings-open"[\s\S]*?tastings-new"/);
    assert.equal(domElements(section, '[data-act="tastings-new"]').length, 1);
    assert.match(renderedText(html), /data-act="add-bottle"><svg class="new-icon"/);
  }
);

test(
  'detail-page latest tasting uses five fillable glencairns before its numeric score',
  () => {
    const latest = {
      id: 'note-1',
      tastedOn: '2026-11-15',
      createdAt: '2026-11-15T20:00:00Z',
      rating: 85,
    };
    const html = detailHtml([latest]);
    const row = renderedText(html).match(
      new RegExp(
        '<div class="tasting-summary-score">[\\s\\S' + ']*?<div class="tasting-summary-rating">[^<' + ']*<\\/div>'
      ))?.[0];
    assert.ok(row);
    assert.equal(domElements(row, '[class="glencairn-symbol glencairn-rating-symbol"]').length, 5);
    assert.match(renderedText(row), /tasting-summary-glasses[\s\S]*?85 \/ 100/);
    assert.ok(domElements(html, '[data-act="tastings-open"][data-tasting-id="note-1"]').length > 0);
  }
);

test(
  'multiple tastings still open the exact latest record from the preview button',
  () => {
    const html = detailHtml([
      {id: 'earlier', tastedOn: '2026-11-10', rating: 70},
      {id: 'newer', tastedOn: '2026-11-22', rating: 80},
    ]);
    const section = renderedText(html).split('<section data-region="detail-tastings"')[1].split('</section>')[0];
    assert.ok(domElements(section, '[data-act="tastings-open"][data-tasting-id="newer"]').length > 0);
    assert.match(renderedText(section), /22\.11\.2026 · 2 Verkostungsnotizen/);
    assert.doesNotMatch(renderedText(section), /Alle Verkostungsnotizen/);
  }
);

test(
  'when a bottling has no notes, the overview action does not use an invalid tasting ID',
  () => {
    const html = detailHtml();
    assert.match(renderedText(html), /data-act="tastings-open"(?=\s|>)/);
    assert.doesNotMatch(renderedText(html), /data-act="tastings-open"[^>]*data-tasting-id=/);
    assert.ok(domElements(html, '[class="section tasting-summary is-empty"]').length > 0);
    assert.match(renderedText(html), /<p class="hint tasting-summary-empty">Noch keine Verkostung<\/p>/);
    assert.match(renderedText(html), /<button[^>]*data-act="tastings-open"[^>]*>Alle Verkostungsnotizen/);
    assert.doesNotMatch(renderedText(html), /class="panel tasting-summary-card"|class="tasting-summary-rating"/);
    assert.equal(domElements(html, '[data-act="tastings-open"]').length, 1);
  }
);

test(
  'the tasting home create action is inside the entries panel heading',
  () => {
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
    assert.match(
      renderedText(html),
      new RegExp(
        '<section class="analytics-panel tasting-ho' + 'me-recent">\\s*<div class="tasting-panel-h' +
        'eading ds-section-header"><h3>Einträge<\\/' +
        'h3>\\s*<button[^>]*data-act="tastings-star' +
        't-choice"[^>]*><svg class="new-icon"'
      )
    );
    assert.equal(domElements(html, '[class="tasting-add-action"]').length, 0);
  }
);

test(
  'tasting subject photo precedes details inside the information panel',
  () => {
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
    const info = renderedText(html).match(
      new RegExp(
        '<div class="tasting-bottling-summary tasti' + 'ng-bottling-photo-layout">[\\s\\S]*?<\\/se' + 'ction>'
      ))?.[0];
    assert.ok(info);
    assert.ok(renderedText(info).indexOf('class="tasting-bottling-photo"') < renderedText(info).indexOf('class="tasting-bottling-copy"'));
  }
);

test(
  'saved tasting edit control sits inside the record data panel rather than the section heading',
  () => {
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
    const start = renderedText(html).indexOf('class="tasting-record-fields analytics-panel tasting-readonly-meta-panel"');
    const end = renderedText(html).indexOf('class="tasting-top-row"', start);
    assert.ok(start > -1 && end > start);
    const recordPanel = renderedText(html).slice(start, end);
    assert.ok(domElements(recordPanel, '[data-act="tasting-edit-start"]').length > 0);
    assert.ok(domElements(recordPanel, '[class="actions tasting-readonly-meta-actions"]').length > 0);
    assert.doesNotMatch(renderedText(html), /<div class="section-head"><h3>Eindrücke<\/h3>\s*<div class="actions">/);
    assert.equal(domElements(html, '[data-act="tasting-edit-start"]').length, 1);
  }
);

test(
  'latest tasting card reuses the radar and previews notes as other detail facts, but hides colour',
  () => {
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
    const summary = renderedText(html).split('<section data-region="detail-tastings"')[1].split('</section>')[0];
    assert.ok(domElements(summary, '[class="tasting-summary-content"]').length > 0);
    assert.doesNotMatch(renderedText(summary), /tasting-summary-color|tasting-readonly-color|glencairn-liquid/);
    assert.ok(domElements(summary, '[class="tasting-summary-radar"]').length > 0);
    assert.ok(domElements(summary, '[class="flavor-editor is-preview"]').length > 0);
    assert.equal(domElements(summary, '[class="flavor-axis-text"]').length, 10);
    assert.doesNotMatch(renderedText(summary), /flavor-sliders|data-flavor-range/);
    assert.match(
      renderedText(summary),
      new RegExp(
        'class="tasting-summary-note"[\\s\\S]*class' + '="tasting-summary-field-label">Nase<\\/spa' +
        'n>[\\s\\S]*class="tasting-summary-note-val' +
        'ue">Rauch &amp; Vanille'
      )
    );
    assert.match(
      renderedText(summary),
      new RegExp(
        'class="tasting-summary-field-label">Geschm' + 'ack<\\/span>[\\s\\S]*class="tasting-summar' +
        'y-note-value">&lt;Frucht&gt;'
      )
    );
    assert.doesNotMatch(renderedText(summary), /Old note|>Abgang<\/span>/);
    assert.ok(domElements(summary, '[data-act="tastings-open"]').length > 0);
  }
);

test(
  'compact preview shares panel edges and uses normal buttons and detail-field notes',
  () => {
    const html = detailHtml([{
      id: 'compact',
      tastedOn: '2026-11-16',
      rating: 80,
      whiskyColor: 'honey',
      flavorProfile: {woody: 5},
      tastingNotes: {nose: 'Vanille und Frucht', palate: '', finish: ''},
    }]);
    const section = renderedText(html).split('<section data-region="detail-tastings"')[1].split('</section>')[0];
    const summary = renderedText(section).indexOf('class="tasting-summary-main"');
    const heading = renderedText(section).indexOf('class="muted tasting-summary-lead"');
    const score = renderedText(section).indexOf('class="tasting-summary-score"');
    const date = renderedText(section).indexOf('class="muted tasting-summary-meta"');
    const radar = renderedText(section).indexOf('class="tasting-summary-radar"');
    const notes = renderedText(section).indexOf('class="tasting-summary-notes"');
    const button = renderedText(section).indexOf('class="actions tasting-summary-actions"');
    assert.ok(
      summary >= 0 && summary < heading && heading < score && score < date,
      'left summary keeps the original heading, rating, date hierarchy'
    );
    const mainEnd = renderedText(section).indexOf('class="tasting-summary-radar"');
    assert.ok(date < button && button < mainEnd && mainEnd < notes,
      'the tasting button follows the date inside the left summary, before radar and optional notes');
    assert.match(
      renderedText(section),
      new RegExp(
        'class="muted tasting-summary-meta"[^>]*>[^' + '<]*<\\/span>\\s*<div class="actions tastin' + 'g-summary-actions">'
      )
    );
    assert.ok(domElements(section, '[data-act="tastings-open"][data-tasting-id="compact"]').length > 0);
    assert.match(
      renderedText(section),
      new RegExp(
        'class="tasting-summary-field-label">Nase<' + '\\/span><div class="tasting-summary-note-v' +
        'alue">Vanille und Frucht<\\/div>'
      )
    );
    assert.doesNotMatch(
      renderedText(section),
      new RegExp('tasting-summary-color|tasting-readonly-col' + 'or|>Farbe<|>Geschmacksprofil<|>Geschmacksn' + 'oten<')
    );
  }
);

test(
  'desktop reserves the right notes column without displaying absent notes',
  () => {
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
    const section = renderedText(html).split('<section data-region="detail-tastings"')[1].split('</section>')[0];
    assert.match(
      renderedText(section),
      new RegExp(
        'class="tasting-summary-radar"[\\s\\S]*?cla' + 'ss="tasting-summary-notes is-empty" aria-h' +
        'idden="true"><\\/div>'
      )
    );
    assert.doesNotMatch(renderedText(section), /class="tasting-summary-note"|class="tasting-summary-field-label"/);
  }
);

test(
  'latest tasting only shows recorded preview content, not empty note labels',
  () => {
    const none = detailHtml([{
      id: 'empty',
      tastedOn: '2026-11-15',
      rating: 60,
      whiskyColor: null,
      flavorProfile: null,
      tastingNotes: {nose: ' ', palate: '', finish: ''},
    }]);
    const summary = renderedText(none).split('<section data-region="detail-tastings"')[1].split('</section>')[0];
    assert.doesNotMatch(renderedText(summary), /tasting-summary-color|tasting-summary-radar|class="tasting-summary-note"/);
    assert.match(renderedText(summary), /class="tasting-summary-notes is-empty" aria-hidden="true"><\/div>/);
    assert.match(renderedText(summary), /60 \/ 100/);
    const withColor = detailHtml([{
      id: 'color', tastedOn: '2026-11-16', whiskyColor: 'custom:#be602f',
      flavorProfile: null, tastingNotes: {nose: '', palate: '', finish: ''},
    }]);
    const colorSummary = renderedText(withColor).split('<section data-region="detail-tastings"')[1].split('</section>')[0];
    assert.doesNotMatch(
      renderedText(colorSummary),
      new RegExp(
        'tasting-summary-color|tasting-summary-rada' + 'r|class="tasting-summary-note"|tasting-rea' + 'donly-color'
      )
    );
    assert.match(renderedText(colorSummary), /class="tasting-summary-notes is-empty" aria-hidden="true"><\/div>/);
    assert.match(renderedText(colorSummary), /Nicht bewertet/);
  }
);
