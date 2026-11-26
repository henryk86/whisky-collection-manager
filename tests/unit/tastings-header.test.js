import {renderedText, captureContent, captureAppend, domElements} from '../helpers/rendering.js';
import {backNavigation} from '../../public/js/ui/headers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createShell} from '../../public/js/ui/shell.js';
import {createTastingsView} from '../../public/js/views/tastings.js';
import {createDetailView} from '../../public/js/views/detail.js';
import {createSelectors} from '../../public/js/domain/selectors.js';

/**
 * Derives the header for result from the supplied values.
 *
 * @param {*} page Page or view being rendered or selected.
 * @return {string|undefined} Serialized site header for the requested tasting page, if found.
 */
function headerFor(page) {
  const root = {innerHTML: ''};
  createShell({
    mountContent: captureContent,
    root,
    state: {page, version: '0.27.1', modal: null},
    /**
     * Updates theme in the current state.
     */
    applyTheme() {},
    /**
     * Renders modal in the current view.
     */
    renderModal() {},
  })('');
  return renderedText(root.innerHTML).match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
}

test(
  'the global app header is identical on every main and tasting page',
  () => {
    const reference = headerFor('home');
    assert.ok(reference);
    assert.ok(domElements(reference, '[data-act="scan"]').length > 0);
    assert.ok(domElements(reference, '[data-act="new"]').length > 0);
    assert.ok(domElements(reference, '[data-act="toggle-theme"]').length > 0);
    assert.ok(domElements(reference, '[data-act="toggle-menu"]').length > 0);
    for (const page of [
      'detail',
      'analytics',
      'settings',
      'tastings-home',
      'tastings',
      'tasting',
      'external-tasting',
      'tasting-flight',
    ]) {
      assert.equal(renderedText(headerFor(page)), renderedText(reference), `global header differs for ${page}`);
    }
  }
);

test('tasting landing page uses the shared analytics page heading only', () => {
  let html = '';
  const state = {
    page: 'tastings-home', collection: {
      bottlings: [],
      externalTastings: [],
    },
  };
  createTastingsView({
    mountContent: captureContent, mountAppend: captureAppend,
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
  assert.ok(domElements(html, '[class="analytics-page tasting-home-page"]').length > 0);
  assert.ok(domElements(html, 'header[class="section-head ds-page-header analytics-page-heading"]').length > 0);
  assert.ok(domElements(html, '[class="page-heading-copy"]').length > 0);
  assert.match(renderedText(html), /class="eyebrow dark">JOURNAL/);
  assert.match(renderedText(html), /class="heading-period" aria-hidden="true">\.<\/span>/);
  assert.ok(domElements(html, '[class="intro"]').length > 0);
  assert.equal(domElements(html, '[data-act="tastings-header-new"]').length, 0);
  assert.match(renderedText(html), /<h2>Verkostungsnotizen<span class="heading-period" aria-hidden="true">/);
  assert.match(renderedText(html), /<h3>Einträge<\/h3>/);
  assert.doesNotMatch(renderedText(html), /<h3>Alle Verkostungsnotizen<\/h3>/);
});


test(
  'tasting list and editor show age, cask type and ABV only when stored on an owned bottling',
  () => {
    const bottling = {
      id: 'owned-1',
      name: 'Whisky with details',
      ageYears: 12,
      caskType: 'Sherry Butt',
      abv: 48.5,
      distillery: 'Test distillery',
      tastings: [{
        id: 'note-1',
        tastedOn: '2026-11-15',
        title: '',
        rating: 87,
        flavorProfile: null,
        tastingNotes: {nose: '', palate: '', finish: ''},
        whiskyColor: null,
        createdAt: '2026-11-15T10:00:00.000Z',
      }],
    };
    const state = {
      page: 'tastings',
      selected: 'owned-1',
      collection: {
        bottlings: [bottling], distilleries: [], externalTastings: [],
      },
    };
    let html = '';
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
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
    });
    view.list();
    assert.match(renderedText(html), /Whisky with details/);
    assert.match(renderedText(html), /Alter: 12 Jahre/);
    assert.match(renderedText(html), /Fasstyp: Sherry Butt/);
    assert.match(renderedText(html), /Alkoholgehalt: 48,5 % Vol\./);
    assert.equal(domElements(html, '[data-act="tastings-back-detail"] > svg.ui-symbol[aria-hidden="true"] > path[d="m12 19-7-7 7-7M5 12h14"]').length, 1);
    state.page = 'tasting'; state.tastingId = 'note-1';
    view.editor();
    for (const label of ['Alter: 12 Jahre', 'Fasstyp: Sherry Butt',
      'Alkoholgehalt: 48,5 % Vol.'])
      assert.ok(renderedText(html).includes(renderedText(label)), `missing ${label} on tasting editor`);
    assert.equal(domElements(html, '[data-act="tastings-back-list"] > svg.ui-symbol[aria-hidden="true"] > path[d="m12 19-7-7 7-7M5 12h14"]').length, 1);
    delete bottling.ageYears; delete bottling.caskType; delete bottling.abv;
    view.list();
    assert.doesNotMatch(renderedText(html), /Alter:|Fasstyp:|Alkoholgehalt:/);
    state.page = 'tasting';
    view.editor();
    assert.doesNotMatch(renderedText(html), /Alter:|Fasstyp:|Alkoholgehalt:/);
  }
);

test(
  'tasting page headers describe the page; bottling details are in the first information panel',
  () => {
    const bottling = {
      id: 'owned-1',
      name: 'Named bottling',
      ageYears: 14,
      caskType: 'Bourbon Barrel',
      abv: 46,
      distillery: 'Example distillery',
      tastings: [{
        id: 'note-1',
        tastedOn: '2026-11-15',
        title: '',
        rating: 85,
        flavorProfile: null,
        tastingNotes: {nose: '', palate: '', finish: ''},
        whiskyColor: null,
      }],
    };
    const state = {
      page: 'tastings',
      selected: 'owned-1',
      collection: {
        bottlings: [bottling], distilleries: [], externalTastings: [],
      },
    };
    let html = '';
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
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
    });
    view.list();
    let header = renderedText(html).match(
      new RegExp('<header class="section-head ds-page-header' + ' analytics-page-heading">[\\s\\S]*?<\\/hea' + 'der>'))?.[0];
    assert.ok(header);
    assert.match(renderedText(header), /Verkostungsübersicht/);
    assert.doesNotMatch(renderedText(header), /Named bottling|tasting-title-icon|glencairn-symbol/);
    assert.ok(renderedText(html).indexOf('Named bottling') > renderedText(html).indexOf('class="analytics-panel tasting-bottling-info"'));
    assert.ok(renderedText(html).indexOf('class="analytics-panel tasting-bottling-info"') <
      renderedText(html).indexOf('class="analytics-panel tasting-list-section"'));
    state.page = 'tasting'; state.tastingId = 'note-1';
    view.editor();
    header = renderedText(html).match(
      new RegExp('<header class="section-head ds-page-header' + ' analytics-page-heading">[\\s\\S]*?<\\/hea' + 'der>'))?.[0];
    assert.match(renderedText(header), /<h2>Verkostung<span/);
    assert.doesNotMatch(renderedText(header), /Named bottling|Bourbon Barrel/);
    const subject = renderedText(html).indexOf('class="analytics-panel tasting-bottling-info"');
    assert.ok(subject > renderedText(html).indexOf('</header>'));
    assert.ok(subject < renderedText(html).indexOf('<h3>Eindrücke</h3>'));
    assert.ok(subject < renderedText(html).indexOf('class="tasting-record-fields analytics-panel'));
    assert.equal(domElements(html, '[data-act="tastings-back-list"] > svg.ui-symbol[aria-hidden="true"] > path[d="m12 19-7-7 7-7M5 12h14"]').length, 1);
    state.tastingId = 'new';
    view.editor();
    assert.match(
      renderedText(html),
      new RegExp(
        '<h2>Verkostung erfassen<span class="headin' + 'g-period" aria-hidden="true">\\.<\\/span><' + '\\/h2>'
      )
    );
  }
);

test(
  'external tasting stores editable bottling information as the first panel, not in the page heading',
  () => {
    let html = '';
    const state = {
      page: 'external-tasting',
      selected: 'new',
      collection: {bottlings: [], distilleries: [], externalTastings: []},
    };
    createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
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
    const header = renderedText(html).match(
      new RegExp('<header class="section-head ds-page-header' + ' analytics-page-heading">[\\s\\S]*?<\\/hea' + 'der>'))?.[0];
    assert.match(renderedText(header), /Verkostung erfassen/);
    assert.doesNotMatch(renderedText(header), /Name der Abfüllung|tasting-title-icon/);
    assert.ok(renderedText(html).indexOf('class="analytics-panel tasting-bottling-info"') <
      renderedText(html).indexOf('class="section-head ds-section-header tasting-editor-section-head"><h3>Eindrücke</h3>'));
    assert.match(
      renderedText(html),
      new RegExp('class="analytics-panel tasting-bottling-in' + 'fo"[\\s\\S]*?data-external-field="name"')
    );
    assert.doesNotMatch(renderedText(html), /<h3>Abfüllungsangaben<\/h3>/);
    assert.equal(domElements(html, '[data-act="tasting-external-edit"]').length, 0);
  }
);


test(
  'return navigation is above the entire page heading on every tasting subpage',
  () => {
    const bottling = {
      id: 'mine',
      name: 'A bottling',
      tastings: [{
        id: 'taste',
        tastedOn: '2026-11-14',
        rating: 80,
        tastingNotes: {nose: '', palate: '', finish: ''},
      }],
    };
    const state = {
      page: 'tastings',
      selected: 'mine',
      collection: {bottlings: [bottling], externalTastings: []},
    };
    let html = '';
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} s Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: s => html = s,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.list();
    assert.match(
      renderedText(html),
      new RegExp(
        '<div class="analytics-page tasting-child-p' + 'age">\\s*<nav class="page-back-nav ds-back' +
        '-nav ds-back-nav--inline"[^>]*>\\s*<button' +
        '[^>]*data-act="tastings-back-detail"'
      )
    );
    assert.ok(renderedText(html).indexOf('<nav class="page-back-nav ds-back-nav ds-back-nav--inline"') <
      renderedText(html).indexOf('<header class="section-head ds-page-header analytics-page-heading"')
    );
    assert.ok(renderedText(html).indexOf('<header class="section-head ds-page-header analytics-page-heading"') <
      renderedText(html).indexOf('<section class="analytics-panel tasting-bottling-info">')
    );
    assert.doesNotMatch(renderedText(html), /<h3>Abfüllungsangaben<\/h3>/);
    state.page = 'tasting'; state.tastingId = 'taste';
    view.editor();
    assert.match(
      renderedText(html),
      new RegExp(
        '<div class="analytics-page tasting-child-p' + 'age">\\s*<nav class="page-back-nav ds-back' +
        '-nav ds-back-nav--inline"[^>]*>\\s*<button' +
        '[^>]*data-act="tastings-back-list"'
      )
    );
    assert.ok(renderedText(html).indexOf('<nav class="page-back-nav ds-back-nav ds-back-nav--inline"') <
      renderedText(html).indexOf('<header class="section-head ds-page-header analytics-page-heading"')
    );
    assert.ok(renderedText(html).indexOf('<header class="section-head ds-page-header analytics-page-heading"') <
      renderedText(html).indexOf('<section class="section tasting-editor-content'));
    state.page = 'external-tasting'; state.selected = 'new';
    view.editor();
    assert.match(
      renderedText(html),
      new RegExp(
        '<div class="analytics-page tasting-child-p' + 'age">\\s*<nav class="page-back-nav ds-back' +
        '-nav ds-back-nav--inline"[^>]*>\\s*<button' +
        '[^>]*data-act="tastings-back-home"'
      )
    );
    assert.ok(renderedText(html).indexOf('<nav class="page-back-nav ds-back-nav ds-back-nav--inline"') <
      renderedText(html).indexOf('<header class="section-head ds-page-header analytics-page-heading"')
    );
    assert.ok(renderedText(html).indexOf('<header class="section-head ds-page-header analytics-page-heading"') <
      renderedText(html).indexOf('data-external-field="name"'));
  }
);

test(
  'tasting lists reuse Lager -> Flasche finden framed rows, not card grids',
  () => {
    const bottling = {
      id: 'mine',
      name: 'An old whisky',
      tastings: [{
        id: 't',
        tastedOn: '2026-11-10',
        title: '',
        rating: 85,
        tastingNotes: {nose: '', palate: '', finish: ''},
      }],
    };
    const state = {
      page: 'tastings-home',
      selected: 'mine',
      collection: {bottlings: [bottling], externalTastings: []},
    };
    let html = '';
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} s Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: s => html = s,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.home();
    assert.ok(domElements(html, '[class="warehouse-bottle-list tasting-entry-list"]').length > 0);
    assert.ok(domElements(html, '[class="warehouse-bottle-row tasting-entry-row tasting-home-row"]').length > 0);
    assert.ok(domElements(html, '[data-act="tastings-home-open"]').length > 0);
    assert.match(
      renderedText(html),
      new RegExp('<button type="button" class="tasting-entry' + '-open" data-act="tastings-home-open"')
    );
    assert.doesNotMatch(renderedText(html), /data-act="tastings-home-open"[^>]*>[^<]*Öffnen<\/button>/);
    assert.ok(domElements(html, '[class="tasting-entry-chevron"][aria-hidden="true"]').length > 0);
    state.page = 'tastings'; view.list();
    assert.ok(domElements(html, '[class="warehouse-bottle-row tasting-entry-row tasting-list-row"]').length > 0);
    assert.ok(domElements(html, '[data-act="tastings-open"]').length > 0);
    assert.match(
      renderedText(html),
      new RegExp('<button type="button" class="tasting-entry' + '-open" data-act="tastings-open"')
    );
    assert.match(
      renderedText(html),
      new RegExp(
        'class="tasting-entry-actions"><button type' + '="button" class="btn small danger" data-ac' + 't="tasting-delete"'
      )
    );
    assert.ok(domElements(html, '[data-act="tasting-delete"]').length > 0);
  }
);

test(
  'saved external whisky is shown read-only with the shared pencil edit icon; draft is a form',
  () => {
    const external = {
      id: 'ex-1',
      bottling: {
        name: 'Guest dram',
        distillery: 'Distillery',
        bottler: 'Independent',
        ageYears: 12,
        abv: 43.6,
        releaseYear: 2017,
      },
      tastedOn: '2026-11-14',
      rating: 86,
      tastingNotes: {nose: '', palate: '', finish: ''},
    };
    const state = {
      page: 'external-tasting',
      selected: 'ex-1',
      collection: {bottlings: [], externalTastings: [external]},
    };
    let html = '';
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} s Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: s => html = s,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.editor();
    const summary = renderedText(html).match(new RegExp('<section class="analytics-panel tasting-bo' + 'ttling-info">[\\s\\S]*?<\\/section>'))?.[0];
    assert.ok(summary);
    assert.ok(domElements(summary, 'div[class="tasting-bottling-summary"][data-external-read]').length > 0);
    assert.match(renderedText(summary), /data-act="tasting-external-edit"[^>]*><svg class="action-icon"/);
    assert.match(renderedText(summary), /Distillery/);
    assert.match(renderedText(summary), /Alter: 12 Jahre/);
    assert.match(renderedText(summary), /43,6 % Vol/);
    assert.ok(domElements(summary, 'div[data-external-edit][hidden]').length > 0);
    assert.ok(domElements(summary, '[data-act="tasting-external-save"]').length > 0);
    assert.ok(domElements(summary, '[data-act="tasting-external-cancel"]').length > 0);
    assert.doesNotMatch(renderedText(summary), /<h3>Abfüllungsangaben<\/h3>/);
    state.selected = 'new'; view.editor();
    assert.ok(domElements(html, 'div[data-external-edit]').length > 0);
    assert.equal(domElements(html, '[data-external-read]').length, 0);
  }
);

test(
  'editing external facts is explicit; cancelling restores saved facts without touching tasting notes',
  () => {
    const saved = {
      id: 'external-1',
      bottling: {name: 'Old whisky', distillery: 'Original', ageYears: 8},
      tastedOn: '2026-11-01',
      rating: 77,
      tastingNotes: {nose: 'vanilla', palate: '', finish: ''},
    };
    const state = {
      page: 'external-tasting',
      selected: 'external-1',
      collection: {bottlings: [], externalTastings: [saved]},
    };
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      /**
       * Discards page content in this scenario; no real DOM is mounted.
       */
      shell() {},
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.editor();
    const read = {hidden: false}, name =
    {
      value: 'Old whisky',
      /**
       * Updates the focus state for its caller.
       */
      focus() {this.focused = true;},
    }, distillery = {value: 'Original'}, age = {value: '8'};
    const form = {
      hidden: true,
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector(selector) {
        return selector === '[data-external-field="name"]' ? name : null;
      },
    };
    const inputs = {name, distillery, ageYears: age};
    const panel = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector(selector) {
        if (selector === '[data-external-read]') return read;
        if (selector === '[data-external-edit]') return form;
        return inputs[renderedText(selector).match(/data-external-field="([^"]+)"/)?.[1]] || null;
      },
    };
    const original = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Structured result assembled from the input data.
       */
      querySelector(selector) {
        return selector === '[data-flavor-detail]' ? {
          /**
           * Derives the query selector result from the supplied values.
           *
           * @param {*} sel Value used by this operation.
           * @return {!Object} Result computed from the supplied inputs.
           */
          querySelector(sel) {
            return sel === '.tasting-bottling-info' ? panel : null;
          },
        } : null;
      },
    };
    try {
      view.startExternalEdit();
      assert.equal(renderedText(read.hidden), true);
      assert.equal(renderedText(form.hidden), false);
      assert.equal(renderedText(name.focused), true);
      name.value = 'Uncommitted'; distillery.value = 'Other'; age.value = '9';
      view.cancelExternalEdit();
      assert.equal(renderedText(read.hidden), false);
      assert.equal(renderedText(form.hidden), true);
      assert.equal(renderedText(name.value), 'Old whisky');
      assert.equal(renderedText(distillery.value), 'Original');
      assert.equal(renderedText(age.value), '8');
      assert.equal(renderedText(saved.tastingNotes.nose), 'vanilla');
    } finally {globalThis.document = original;}
  }
);

test(
  'saved external tasting offers an assignment action and a collection-bottling selection modal',
  () => {
    let html = '', dialog = '';
    const external = {
      id: 'external-note',
      bottling: {name: 'Sample without bottle'},
      tastedOn: '2026-11-14',
      rating: 86,
      tastingNotes: {nose: '', palate: '', finish: ''},
    };
    const state = {
      page: 'external-tasting', selected: 'external-note', collection: {
        bottlings: [
          {id: 'owned-2', name: 'Owned second', tastings: []},
          {id: 'owned-1', name: 'Owned first', tastings: []},
        ], externalTastings: [external],
      },
    };
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
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
      /**
       * Captures the dialog body without mounting the modal overlay.
       *
       * @param {string} _title Dialog title ignored by this fixture.
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Dialog content captured for assertions.
       */
      showModal(_title, content) {dialog = content;},
      /**
       * Performs the close modal lifecycle action.
       */
      closeModal() {},
    });
    view.editor();
    assert.ok(domElements(html, '[data-act="tasting-external-assign"]').length > 0);
    view.showAssignDialog();
    assert.ok(domElements(dialog, '[data-tasting-assign-target]').length > 0);
    assert.ok(domElements(dialog, '[data-act="tasting-external-assign-confirm"]').length > 0);
    assert.ok(renderedText(dialog).indexOf('Owned first') < renderedText(dialog).indexOf('Owned second'));
    state.selected = 'new'; view.editor();
    assert.equal(domElements(html, '[data-act="tasting-external-assign"]').length, 0);
  }
);


test(
  'owned tasting information shows the same bottling cover photo as the bottling detail page without changing the page header',
  () => {
    const bottling = {
      id: 'owned-photo', name: 'Photo dram', bottles: [{
        id: 'physical', photos: [
          {
            path: 'photos/original.jpg',
            cutout: {selected: true, path: 'photos/cutout.png'},
          }],
      }], tastings: [
        {
          id: 'taste',
          tastedOn: '2026-11-15',
          rating: 81,
          tastingNotes: {nose: '', palate: '', finish: ''},
        },
      ],
    };
    const state = {
      page: 'tastings',
      selected: 'owned-photo',
      collection: {
        bottlings: [bottling], distilleries: [], externalTastings: [],
      },
    };
    let html = '';
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      selectors: createSelectors(state),
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: markup => html = markup,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    for (const page of ['tastings', 'tasting']) {
      state.page = page;
      state.tastingId = 'taste';
      if (page === 'tastings') view.list(); else view.editor();
      const header = renderedText(html).match(
        new RegExp('<header class="section-head ds-page-header' + ' analytics-page-heading">[\\s\\S]*?<\\/hea' + 'der>'))?.[0];
      assert.doesNotMatch(renderedText(header), /<img |Photo dram/);
      const info = renderedText(html).match(new RegExp('<section class="analytics-panel tasting-bo' + 'ttling-info">[\\s\\S]*?<\\/section>'))?.[0];
      assert.ok(info);
      assert.ok(domElements(info, '[class="tasting-bottling-summary tasting-bottling-photo-layout"]').length > 0);
      assert.ok(domElements(info, '[class="tasting-bottling-photo"]').length > 0);
      assert.match(renderedText(info), /src="\/photos\/cutout.png"/);
      assert.match(renderedText(info), /alt="[^"]*Photo dram/);
      assert.doesNotMatch(renderedText(info), /photos\/original.jpg/);
    }
    bottling.bottles[0].photos = [];
    view.list();
    assert.equal(domElements(html, '[class="tasting-bottling-photo"]').length, 0, 'no placeholder when no photo exists');
    state.page = 'external-tasting'; state.selected = 'new';
    view.editor();
    assert.equal(domElements(html, '[class="tasting-bottling-photo"]').length, 0, 'external tasting has no collection photo');
  }
);


test(
  'saved tasting opens as a static view; editing requires pencil, new tasting is editable immediately',
  () => {
    const tasting = {
      id: 'saved-note',
      tastedOn: '2026-11-15',
      title: 'Evening tasting',
      rating: 87.5,
      whiskyColor: 'amber',
      flavorProfile: {
        woody: 2,
        cereal: 3,
        peaty: 4,
        fruity: 5,
        floral: 6,
        winey: 7,
        feinty: 8,
        sulphury: 9,
      },
      tastingNotes: {
        nose: 'Sherry & vanilla', palate: 'Citrus',
        finish: 'Long finish',
      },
    };
    const b = {id: 'b1', name: 'Bottling & friends', tastings: [tasting]};
    let html = '';
    const state = {
      page: 'tasting',
      selected: 'b1',
      tastingId: 'saved-note',
      collection: {bottlings: [b], externalTastings: []},
    };
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: markup => html = markup,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.editor();
    assert.ok(domElements(html, '[data-tasting-readonly="true"]').length > 0);
    assert.match(
      renderedText(html),
      new RegExp('<span class="tasting-readonly-label">Titel' + '<\\/span><strong>Evening tasting<\\/strong' + '>')
    );
    assert.doesNotMatch(renderedText(html), /Titel \(optional\)/);
    assert.match(renderedText(html), /data-act="tasting-edit-start"[^>]*><svg class="action-icon"/);
    assert.ok(domElements(html, '[class="tasting-notes tasting-readonly-notes"]').length > 0);
    assert.match(renderedText(html), /Sherry &amp; vanilla/);
    assert.match(renderedText(html), /87\.5 \/ 100/);
    assert.ok(domElements(html, '[class="tasting-readonly-glasses"]').length > 0);
    assert.ok(domElements(html, '[class="tasting-readonly-color"]').length > 0);
    assert.doesNotMatch(
      renderedText(html),
      new RegExp('data-tasting-note=|data-tasting-score|data' + '-flavor-range|data-act="tasting-delete"')
    );
    assert.match(renderedText(html), /data-act="tasting-open-bottling"[^>]*>Zu den Abf/);
    assert.doesNotMatch(renderedText(html), /<h3>Abf/);
    view.startEditing();
    assert.equal(domElements(html, '[data-tasting-readonly="true"]').length, 0);
    assert.equal(domElements(html, '[class="tasting-notes tasting-readonly-notes"]').length, 0);
    assert.match(renderedText(html), /Titel \(optional\)/);
    assert.ok(domElements(html, '[data-tasting-note="nose"]').length > 0);
    assert.ok(domElements(html, '[data-act="tasting-edit-done"]').length > 0);
    assert.ok(domElements(html, '[data-tasting-score]').length > 0);
    assert.ok(domElements(html, '[data-act="tasting-delete"]').length > 0);
    state.tastingId = 'new';
    view.editor();
    assert.ok(domElements(html, '[data-act="tasting-create"]').length > 0);
    assert.ok(domElements(html, '[data-tasting-note="nose"]').length > 0);
  }
);

test(
  'saved external tasting also begins in read-only notes mode while external facts have a separate edit control',
  () => {
    const external = {
      id: 'x1',
      bottling: {name: 'External dram', distillery: 'Orkney'},
      tastedOn: '2026-11-15',
      rating: 90,
      tastingNotes: {nose: 'Peat', palate: 'Smoke', finish: 'Sweet'},
    };
    let html = '';
    const state = {
      page: 'external-tasting',
      selected: 'x1',
      collection: {bottlings: [], externalTastings: [external]},
    };
    const view = createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} markup Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: markup => html = markup,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.editor();
    assert.ok(domElements(html, '[data-tasting-readonly="true"]').length > 0);
    assert.ok(domElements(html, '[data-act="tasting-external-edit"]').length > 0);
    assert.ok(domElements(html, '[data-act="tasting-edit-start"]').length > 0);
    assert.equal(domElements(html, '[data-act="tasting-open-bottling"]').length, 0);
    assert.equal(domElements(html, '[data-tasting-score]').length, 0);
    view.startEditing();
    assert.ok(domElements(html, '[data-tasting-score]').length > 0);
    assert.ok(domElements(html, '[data-act="tasting-edit-done"]').length > 0);
    state.selected = 'new'; view.editor();
    assert.ok(domElements(html, '[data-tasting-score]').length > 0);
    assert.equal(domElements(html, '[data-tasting-readonly="true"]').length, 0);
  }
);

test(
  'bottling details and tasting pages render identical back-button structure and arrow',
  () => {
    const bottling = {
      id: 'b1',
      name: 'Navigation test',
      distilleryIds: [],
      bottles: [],
      tastings: [],
    };
    const collection = {
      schemaVersion: 6,
      bottlings: [bottling],
      distilleries: [],
      externalTastings: [],
    };
    const originalDocument = globalThis.document;
    let detailHtml = '';
    try {
      globalThis.document = {
        /**
         * Simulates an element query with no matches.
         * @return {Array<never>} Empty match list; the simulated root has no matching elements.
         */
        querySelectorAll: () => [],
      };
      createDetailView({
        state: {collection, selected: 'b1'}, selectors: {
          /**
           * Provides an empty physical-bottle list.
           * @return {Array<never>} No physical bottles for the requested bottling.
           */
          bottles: () => [],
          /**
           * Simulates a missing cover photo.
           * @return {null} No photo path.
           */
          coverPhoto: () => null,
          /**
           * Omits distillery labels for this test.
           * @return {string} Empty label; no distillery name is supplied by this fixture.
           */
          distilleryNames: () => '',
        },
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} s Page content passed by the view.
         * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
         */
        shell: s => detailHtml = s,
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate() {},
        /**
         * Suppresses action execution in this rendering-only scenario.
         */
        action() {},
      })();
    } finally {
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    }
    let tastingHtml = '';
    createTastingsView({
      mountContent: captureContent, mountAppend: captureAppend,
      state: {page: 'tastings', selected: 'b1', collection},
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} s Page content passed by the view.
       * @return {import('../../public/js/ui/render-plan.js').RenderContent} The captured page content.
       */
      shell: s => tastingHtml = s,
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).list();
    const navigation = 'nav.page-back-nav.ds-back-nav.ds-back-nav--inline';
    const button = `${navigation} > button.inline-link.page-back.ds-back-button.ds-back-button--inline`;
    assert.equal(domElements(detailHtml, `${button} > svg > path`)[0].attributes.d, domElements(tastingHtml, `${button} > svg > path`)[0].attributes.d);
    assert.equal(domElements(detailHtml, `${button}[data-region="detail-back"]`).length, 1);
    assert.equal(domElements(tastingHtml, `${button}[data-act="tastings-back-detail"]`).length, 1);
    assert.equal(domElements(detailHtml, '[class="page-back-nav ds-back-nav ds-back-nav--inline"]').length, 1);
    assert.equal(domElements(tastingHtml, '[class="page-back-nav ds-back-nav ds-back-nav--inline"]').length, 1);
    assert.equal(
      renderedText(backNavigation('back', 'Zur Sammlung')).includes('class="page-back-nav ds-back-nav ds-back-nav--inline"'),
      true
    );
    for (const label of ['Zur Sammlung', '← Zur Sammlung',
      '⟵ Back to collection']) {
      const nav = backNavigation('back', label);
      assert.equal(domElements(nav, '[class="ui-symbol"]').length, 1, 'exactly one SVG arrow');
      assert.doesNotMatch(renderedText(nav), /<span>\s*(?:←|⟵)/u, 'translated arrow never appears beside SVG icon');
    }
  }
);
