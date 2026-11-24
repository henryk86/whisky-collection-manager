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
 * @return {string} Resulting text.
 */
function detailHtml(tastings = []) {
  let html = '';
  const oldDocument = globalThis.document;
  globalThis.document = {
    /**
     * Derives the query selector all result from the supplied values.
     * @return {!Array<*>} Resulting entries in their output order.
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
         * Derives the bottles result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        bottles: () => [],
        /**
         * Derives the cover photo result from the supplied values.
         * @return {string} Resulting text.
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
       * Updates the shell state for its caller.
       *
       * @param {*} content Content to render, store or examine.
       */
      shell: content => {html = content;},
      /**
       * Updates the navigate state for its caller.
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
    const section = html.match(/<section[^>]*class="section tasting-summary is-empty"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section);
    assert.match(section, /data-act="tastings-new"[^>]*><svg class="new-icon"/);
    assert.doesNotMatch(section, /class="panel tasting-summary-card"/);
    assert.match(
      section,
      /class="hint tasting-summary-empty">Noch keine Verkostung<\/p>/
    );
    assert.match(
      section,
      /class="btn" data-act="tastings-open"[\s\S]*?data-act="tastings-new"/
    );
    assert.equal((section.match(/data-act="tastings-new"/g) || []).length, 1);
    assert.match(html, /data-act="add-bottle"><svg class="new-icon"/);
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
    const row = html.match(/<div class="tasting-summary-score">[\s\S]*?<div class="tasting-summary-rating">[^<]*<\/div>/)?.[0];
    assert.ok(row);
    assert.equal(
      (row.match(/class="glencairn-symbol glencairn-rating-symbol"/g) ||
        []).length,
      5
    );
    assert.match(row, /tasting-summary-glasses[\s\S]*?85 \/ 100/);
    assert.match(html, /data-act="tastings-open" data-tasting-id="note-1"/);
  }
);

test(
  'multiple tastings still open the exact latest record from the preview button',
  () => {
    const html = detailHtml([
      {id: 'earlier', tastedOn: '2026-11-10', rating: 70},
      {id: 'newer', tastedOn: '2026-11-22', rating: 80},
    ]);
    const section = html.split('<section data-region="detail-tastings"')[1]
      .split('</section>')[0];
    assert.match(
      section,
      /<button type="button" class="btn" data-act="tastings-open" data-tasting-id="newer">Verkostung anzeigen<\/button>/
    );
    assert.match(section, /22\.11\.2026 · 2 Verkostungsnotizen/);
    assert.doesNotMatch(section, /Alle Verkostungsnotizen/);
  }
);

test(
  'when a bottling has no notes, the overview action does not use an invalid tasting ID',
  () => {
    const html = detailHtml();
    assert.match(html, /data-act="tastings-open"(?=\s|>)/);
    assert.doesNotMatch(html, /data-act="tastings-open"[^>]*data-tasting-id=/);
    assert.match(html, /class="section tasting-summary is-empty"/);
    assert.match(
      html,
      /<p class="hint tasting-summary-empty">Noch keine Verkostung<\/p>/
    );
    assert.match(
      html,
      /<button type="button" class="btn" data-act="tastings-open">Alle Verkostungsnotizen<\/button>/
    );
    assert.doesNotMatch(
      html,
      /class="panel tasting-summary-card"|class="tasting-summary-rating"/
    );
    assert.equal((html.match(/data-act="tastings-open"/g) || []).length, 1);
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
       * Derives the shell result from the supplied values.
       *
       * @param {*} content Content to render, store or examine.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: content => html =
        content,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).home();
    assert.match(
      html,
      /<section class="analytics-panel tasting-home-recent">\s*<div class="tasting-panel-heading ds-section-header"><h3>Einträge<\/h3>\s*<button[^>]*data-act="tastings-start-choice"[^>]*><svg class="new-icon"/
    );
    assert.doesNotMatch(html, /class="tasting-add-action"/);
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
       * Derives the cover photo result from the supplied values.
       * @return {string} Resulting text.
       */
      coverPhoto: () => '/photos/cover.png',
    };
    createTastingsView({
      state,
      selectors,
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} content Content to render, store or examine.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: content => html = content,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).list();
    const info = html.match(/<div class="tasting-bottling-summary tasting-bottling-photo-layout">[\s\S]*?<\/section>/)?.[0];
    assert.ok(info);
    assert.ok(info.indexOf('class="tasting-bottling-photo"') <
      info.indexOf('class="tasting-bottling-copy"'));
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
       * Derives the shell result from the supplied values.
       *
       * @param {*} content Content to render, store or examine.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: content => html =
        content,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).editor();
    const start = html.indexOf('class="tasting-record-fields analytics-panel tasting-readonly-meta-panel"');
    const end = html.indexOf('class="tasting-top-row"', start);
    assert.ok(start > -1 && end > start);
    const recordPanel = html.slice(start, end);
    assert.match(recordPanel, /data-act="tasting-edit-start"/);
    assert.match(recordPanel, /class="actions tasting-readonly-meta-actions"/);
    assert.doesNotMatch(
      html,
      /<div class="section-head"><h3>Eindrücke<\/h3>\s*<div class="actions">/
    );
    assert.equal(
      (html.match(/data-act="tasting-edit-start"/g) || []).length,
      1
    );
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
        tastingNotes: {nose: 'Rauch & Vanille', palate: '<Frucht>', finish: '   '},
      },
    ]);
    const summary = html.split('<section data-region="detail-tastings"')[1]
      .split('</section>')[0];
    assert.match(summary, /class="tasting-summary-content"/);
    assert.doesNotMatch(
      summary,
      /tasting-summary-color|tasting-readonly-color|glencairn-liquid/
    );
    assert.match(summary, /class="tasting-summary-radar"/);
    assert.match(summary, /class="flavor-editor is-preview"/);
    assert.equal((summary.match(/class="flavor-axis-text"/g) || []).length, 10);
    assert.doesNotMatch(summary, /flavor-sliders|data-flavor-range/);
    assert.match(
      summary,
      /class="tasting-summary-note"[\s\S]*class="tasting-summary-field-label">Nase<\/span>[\s\S]*class="tasting-summary-note-value">Rauch &amp; Vanille/
    );
    assert.match(
      summary,
      /class="tasting-summary-field-label">Geschmack<\/span>[\s\S]*class="tasting-summary-note-value">&lt;Frucht&gt;/
    );
    assert.doesNotMatch(summary, /Old note|>Abgang<\/span>/);
    assert.match(summary, /data-act="tastings-open"/);
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
    const section = html.split('<section data-region="detail-tastings"')[1]
      .split('</section>')[0];
    const summary = section.indexOf('class="tasting-summary-main"');
    const heading = section.indexOf('class="muted tasting-summary-lead"');
    const score = section.indexOf('class="tasting-summary-score"');
    const date = section.indexOf('class="muted tasting-summary-meta"');
    const radar = section.indexOf('class="tasting-summary-radar"');
    const notes = section.indexOf('class="tasting-summary-notes"');
    const button = section.indexOf('class="actions tasting-summary-actions"');
    assert.ok(
      summary >= 0 && summary < heading && heading < score && score < date,
      'left summary keeps the original heading, rating, date hierarchy'
    );
    const mainEnd = section.indexOf('class="tasting-summary-radar"');
    assert.ok(date < button && button < mainEnd && mainEnd < notes,
      'the tasting button follows the date inside the left summary, before radar and optional notes');
    assert.match(
      section,
      /class="muted tasting-summary-meta"[^>]*>[^<]*<\/span>\s*<div class="actions tasting-summary-actions">/
    );
    assert.match(
      section,
      /<button type="button" class="btn" data-act="tastings-open" data-tasting-id="compact">Verkostung anzeigen<\/button>/
    );
    assert.match(
      section,
      /class="tasting-summary-field-label">Nase<\/span><div class="tasting-summary-note-value">Vanille und Frucht<\/div>/
    );
    assert.doesNotMatch(
      section,
      /tasting-summary-color|tasting-readonly-color|>Farbe<|>Geschmacksprofil<|>Geschmacksnoten</
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
    const section = html.split('<section data-region="detail-tastings"')[1]
      .split('</section>')[0];
    assert.match(
      section,
      /class="tasting-summary-radar"[\s\S]*?class="tasting-summary-notes is-empty" aria-hidden="true"><\/div>/
    );
    assert.doesNotMatch(
      section,
      /class="tasting-summary-note"|class="tasting-summary-field-label"/
    );
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
    const summary = none.split('<section data-region="detail-tastings"')[1]
      .split('</section>')[0];
    assert.doesNotMatch(
      summary,
      /tasting-summary-color|tasting-summary-radar|class="tasting-summary-note"/
    );
    assert.match(
      summary,
      /class="tasting-summary-notes is-empty" aria-hidden="true"><\/div>/
    );
    assert.match(summary, /60 \/ 100/);
    const withColor = detailHtml([{
      id: 'color', tastedOn: '2026-11-16', whiskyColor: 'custom:#be602f',
      flavorProfile: null, tastingNotes: {nose: '', palate: '', finish: ''},
    }]);
    const colorSummary =
      withColor.split('<section data-region="detail-tastings"')[1]
        .split('</section>')[0];
    assert.doesNotMatch(
      colorSummary,
      /tasting-summary-color|tasting-summary-radar|class="tasting-summary-note"|tasting-readonly-color/
    );
    assert.match(
      colorSummary,
      /class="tasting-summary-notes is-empty" aria-hidden="true"><\/div>/
    );
    assert.match(colorSummary, /Nicht bewertet/);
  }
);
