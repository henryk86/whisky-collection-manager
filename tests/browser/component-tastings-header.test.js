import {domElements, domText, domMatches, domIndex, domTextIndex, domEqual, domScope, assertDom} from './component-dom.js';
import {captureContent, captureAppend} from '../helpers/capture-rendering.js';
import {backNavigation} from '../../public/js/ui/headers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createShell} from '../../public/js/ui/shell.js';
import {createTastingsView} from '../../public/js/views/tastings.js';
import {createDetailView} from '../../public/js/views/detail.js';
import {createSelectors} from '../../public/js/domain/selectors.js';

/**
 * Selects the site header from the shell rendered for the requested page.
 *
 * @param {*} page Page or view being rendered or selected.
 * @return {!Object} Native fixture scope for the site header.
 */
function headerFor(page) {
  const root = {renderedContent: ''};
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
  return domScope(root.renderedContent, 'header.site-header');
}

test(
  'the global app header is identical on every main and tasting page',
  async () => {
    const reference = headerFor('home');
    assert.ok(reference);
    assert.ok((await domElements(reference, '[data-act="scan"]')).length > 0);
    assert.ok((await domElements(reference, '[data-act="new"]')).length > 0);
    assert.ok((await domElements(reference, '[data-act="toggle-theme"]')).length > 0);
    assert.ok((await domElements(reference, '[data-act="toggle-menu"]')).length > 0);
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
      assert.ok(await domEqual(headerFor(page), reference), `global header differs for ${page}`);
    }
  }
);

test('tasting landing page uses the shared analytics page heading only', async () => {
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
  assert.ok((await domElements(html, '[class="analytics-page tasting-home-page"]')).length > 0);
  assert.ok((await domElements(html, 'header[class="section-head ds-page-header analytics-page-heading"]')).length > 0);
  assert.ok((await domElements(html, '[class="page-heading-copy"]')).length > 0);
  await assertDom(html, "[class=\"eyebrow dark\"]", {"text": new RegExp("JOURNAL")});
  await assertDom(html, "[class=\"heading-period\"][aria-hidden=\"true\"]", {"text": new RegExp("^\\.$")});
  assert.ok((await domElements(html, '[class="intro"]')).length > 0);
  assert.equal((await domElements(html, '[data-act="tastings-header-new"]')).length, 0);
  await assertDom(html, "h2:has(> span.heading-period[aria-hidden=\"true\"])", {directText: "Verkostungsnotizen"});
  await assertDom(html, "h3", {"text": new RegExp("^Einträge$")});
  await assertDom(html, "h3", {"text": new RegExp("^Alle Verkostungsnotizen$")}, true);
});

test(
  'tasting list and editor show age, cask type and ABV only when stored on an owned bottling',
  async () => {
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
    assert.match(await domText(html), /Whisky with details/);
    assert.match(await domText(html), /Alter: 12 Jahre/);
    assert.match(await domText(html), /Fasstyp: Sherry Butt/);
    assert.match(await domText(html), /Alkoholgehalt: 48,5 % Vol\./);
    assert.equal((await domElements(html, '[data-act="tastings-back-detail"] > svg.ui-symbol[aria-hidden="true"] > path[d="m12 19-7-7 7-7M5 12h14"]')).length, 1);
    state.page = 'tasting'; state.tastingId = 'note-1';
    view.editor();
    for (const label of ['Alter: 12 Jahre', 'Fasstyp: Sherry Butt',
      'Alkoholgehalt: 48,5 % Vol.'])
      assert.ok((await domText(html)).includes(label), `missing ${label} on tasting editor`);
    assert.equal((await domElements(html, '[data-act="tastings-back-list"] > svg.ui-symbol[aria-hidden="true"] > path[d="m12 19-7-7 7-7M5 12h14"]')).length, 1);
    delete bottling.ageYears; delete bottling.caskType; delete bottling.abv;
    view.list();
    assert.equal((new RegExp("Alter:|Fasstyp:|Alkoholgehalt:").test(await domText(html))), false);
    state.page = 'tasting';
    view.editor();
    assert.equal((new RegExp("Alter:|Fasstyp:|Alkoholgehalt:").test(await domText(html))), false);
  }
);

test(
  'tasting page headers describe the page; bottling details are in the first information panel',
  async () => {
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
    let header = domScope(html, 'header.section-head.ds-page-header.analytics-page-heading');
    assert.ok(header);
    assert.match(await domText(header), /Verkostungsübersicht/);
    assert.equal((await domMatches(header, ".glencairn-symbol")) || (await domMatches(header, ".tasting-title-icon") || new RegExp("Named bottling").test(await domText(header))), false);
    assert.match(await domText(domScope(html, '.tasting-bottling-info')), /Named bottling/);
    assert.ok(await domIndex(html, '.analytics-panel.tasting-bottling-info') <
      await domIndex(html, '.analytics-panel.tasting-list-section'));
    state.page = 'tasting'; state.tastingId = 'note-1';
    view.editor();
    header = domScope(html, 'header.section-head.ds-page-header.analytics-page-heading');
    await assertDom(header, "h2:has(> span.heading-period[aria-hidden=\"true\"])", {directText: "Verkostung"});
    assert.equal((new RegExp("Named bottling|Bourbon Barrel").test(await domText(header))), false);
    const subject = await domIndex(html, '.analytics-panel.tasting-bottling-info');
    assert.ok(subject > await domIndex(html, 'header.analytics-page-heading'));
    assert.ok(subject < await domIndex(html, 'h3', {text: 'Eindrücke'}));
    assert.ok(subject < await domIndex(html, '.tasting-record-fields.analytics-panel'));
    assert.equal((await domElements(html, '[data-act="tastings-back-list"] > svg.ui-symbol[aria-hidden="true"] > path[d="m12 19-7-7 7-7M5 12h14"]')).length, 1);
    state.tastingId = 'new';
    view.editor();
    await assertDom(html, "h2:has(> span.heading-period[aria-hidden=\"true\"])", {directText: "Verkostung erfassen"});
  }
);

test(
  'external tasting stores editable bottling information as the first panel, not in the page heading',
  async () => {
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
    const header = domScope(html, 'header.section-head.ds-page-header.analytics-page-heading');
    assert.match(await domText(header), /Verkostung erfassen/);
    assert.equal((await domMatches(header, ".tasting-title-icon") || new RegExp("Name der Abf\u00fcllung").test(await domText(header))), false);
    assert.ok(await domIndex(html, '.analytics-panel.tasting-bottling-info') <
      await domIndex(html, '.tasting-editor-section-head > h3', {text: 'Eindrücke'}));
    await assertDom(html, ".analytics-panel.tasting-bottling-info [data-external-field=\"name\"]");
    await assertDom(html, "h3", {"text": new RegExp("^Abfüllungsangaben$")}, true);
    assert.equal((await domElements(html, '[data-act="tasting-external-edit"]')).length, 0);
  }
);

test(
  'return navigation is above the entire page heading on every tasting subpage',
  async () => {
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
    await assertDom(html, ".analytics-page.tasting-child-page > nav.page-back-nav.ds-back-nav.ds-back-nav--inline > button[data-act=\"tastings-back-detail\"]");
    assert.ok(await domIndex(html, '.page-back-nav.ds-back-nav.ds-back-nav--inline') <
      await domIndex(html, '.section-head.ds-page-header.analytics-page-heading')
    );
    assert.ok(await domIndex(html, '.section-head.ds-page-header.analytics-page-heading') <
      await domIndex(html, '.analytics-panel.tasting-bottling-info')
    );
    await assertDom(html, "h3", {"text": new RegExp("^Abfüllungsangaben$")}, true);
    state.page = 'tasting'; state.tastingId = 'taste';
    view.editor();
    await assertDom(html, ".analytics-page.tasting-child-page > nav.page-back-nav.ds-back-nav.ds-back-nav--inline > button[data-act=\"tastings-back-list\"]");
    assert.ok(await domIndex(html, '.page-back-nav.ds-back-nav.ds-back-nav--inline') <
      await domIndex(html, '.section-head.ds-page-header.analytics-page-heading')
    );
    assert.ok(await domIndex(html, '.section-head.ds-page-header.analytics-page-heading') <
      await domIndex(html, '.section.tasting-editor-content'));
    state.page = 'external-tasting'; state.selected = 'new';
    view.editor();
    await assertDom(html, ".analytics-page.tasting-child-page > nav.page-back-nav.ds-back-nav.ds-back-nav--inline > button[data-act=\"tastings-back-home\"]");
    assert.ok(await domIndex(html, '.page-back-nav.ds-back-nav.ds-back-nav--inline') <
      await domIndex(html, '.section-head.ds-page-header.analytics-page-heading')
    );
    assert.ok(await domIndex(html, '.section-head.ds-page-header.analytics-page-heading') <
      await domIndex(html, '[data-external-field="name"]'));
  }
);

test(
  'tasting lists reuse Lager -> Flasche finden framed rows, not card grids',
  async () => {
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
    assert.ok((await domElements(html, '[class="warehouse-bottle-list tasting-entry-list"]')).length > 0);
    assert.ok((await domElements(html, '[class="warehouse-bottle-row tasting-entry-row tasting-home-row"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="tastings-home-open"]')).length > 0);
    await assertDom(html, "button[type=\"button\"][class=\"tasting-entry-open\"][data-act=\"tastings-home-open\"]");
    await assertDom(html, "[data-act=\"tastings-home-open\"]", {text: /Öffnen$/}, true);
    assert.ok((await domElements(html, '[class="tasting-entry-chevron"][aria-hidden="true"]')).length > 0);
    state.page = 'tastings'; view.list();
    assert.ok((await domElements(html, '[class="warehouse-bottle-row tasting-entry-row tasting-list-row"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="tastings-open"]')).length > 0);
    await assertDom(html, "button[type=\"button\"][class=\"tasting-entry-open\"][data-act=\"tastings-open\"]");
    await assertDom(html, ".tasting-entry-actions > button.btn.small.danger[data-act=\"tasting-delete\"]");
    assert.ok((await domElements(html, '[data-act="tasting-delete"]')).length > 0);
  }
);

test(
  'saved external whisky is shown read-only with the shared pencil edit icon; draft is a form',
  async () => {
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
    const summary = domScope(html, 'section.analytics-panel.tasting-bottling-info');
    assert.ok(summary);
    assert.ok((await domElements(summary, 'div[class="tasting-bottling-summary"][data-external-read]')).length > 0);
    await assertDom(summary, "[data-act=\"tasting-external-edit\"] > svg.action-icon");
    assert.match(await domText(summary), /Distillery/);
    assert.match(await domText(summary), /Alter: 12 Jahre/);
    assert.match(await domText(summary), /43,6 % Vol/);
    assert.ok((await domElements(summary, 'div[data-external-edit][hidden]')).length > 0);
    assert.ok((await domElements(summary, '[data-act="tasting-external-save"]')).length > 0);
    assert.ok((await domElements(summary, '[data-act="tasting-external-cancel"]')).length > 0);
    await assertDom(summary, "h3", {"text": new RegExp("^Abfüllungsangaben$")}, true);
    state.selected = 'new'; view.editor();
    assert.ok((await domElements(html, 'div[data-external-edit]')).length > 0);
    assert.equal((await domElements(html, '[data-external-read]')).length, 0);
  }
);

test(
  'saved external tasting offers an assignment action and a collection-bottling selection modal',
  async () => {
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
    assert.ok((await domElements(html, '[data-act="tasting-external-assign"]')).length > 0);
    view.showAssignDialog();
    assert.ok((await domElements(dialog, '[data-tasting-assign-target]')).length > 0);
    assert.ok((await domElements(dialog, '[data-act="tasting-external-assign-confirm"]')).length > 0);
    assert.ok(await domTextIndex(dialog, 'Owned first') < await domTextIndex(dialog, 'Owned second'));
    state.selected = 'new'; view.editor();
    assert.equal((await domElements(html, '[data-act="tasting-external-assign"]')).length, 0);
  }
);

test(
  'owned tasting information shows the same bottling cover photo as the bottling detail page without changing the page header',
  async () => {
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
      const header = domScope(html, 'header.section-head.ds-page-header.analytics-page-heading');
      assert.equal((await domMatches(header, "img") || /Photo dram/.test(await domText(header))), false);
      const info = domScope(html, 'section.analytics-panel.tasting-bottling-info');
      assert.ok(info);
      assert.ok((await domElements(info, '[class="tasting-bottling-summary tasting-bottling-photo-layout"]')).length > 0);
      assert.ok((await domElements(info, '[class="tasting-bottling-photo"]')).length > 0);
      await assertDom(info, "img[src=\"/photos/cutout.png\"]");
      await assertDom(info, "img", {alt: /Photo dram/});
      await assertDom(info, "[src*=\"photos/original.jpg\"]", {}, true);
    }
    bottling.bottles[0].photos = [];
    view.list();
    assert.equal((await domElements(html, '[class="tasting-bottling-photo"]')).length, 0, 'no placeholder when no photo exists');
    state.page = 'external-tasting'; state.selected = 'new';
    view.editor();
    assert.equal((await domElements(html, '[class="tasting-bottling-photo"]')).length, 0, 'external tasting has no collection photo');
  }
);

test(
  'saved tasting opens as a static view; editing requires pencil, new tasting is editable immediately',
  async () => {
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
    assert.ok((await domElements(html, '[data-tasting-readonly="true"]')).length > 0);
    await assertDom(html, "span.tasting-readonly-label:has(+ strong)", {text: "Titel", nextText: "Evening tasting"});
    assert.doesNotMatch(await domText(html), /Titel \(optional\)/);
    await assertDom(html, "[data-act=\"tasting-edit-start\"] > svg.action-icon");
    assert.ok((await domElements(html, '[class="tasting-notes tasting-readonly-notes"]')).length > 0);
    assert.match(await domText(html), new RegExp("Sherry & vanilla"));
    assert.match(await domText(html), /87\.5 \/ 100/);
    assert.ok((await domElements(html, '[class="tasting-readonly-glasses"]')).length > 0);
    assert.ok((await domElements(html, '[class="tasting-readonly-color"]')).length > 0);
    await assertDom(html, "[data-tasting-note], [data-tasting-score], [data-flavor-range], [data-act=\"tasting-delete\"]", {}, true);
    await assertDom(html, "[data-act=\"tasting-open-bottling\"]", {"text": new RegExp("^Zu den Abf")});
    await assertDom(html, "h3", {"text": new RegExp("^Abf")}, true);
    view.startEditing();
    assert.equal((await domElements(html, '[data-tasting-readonly="true"]')).length, 0);
    assert.equal((await domElements(html, '[class="tasting-notes tasting-readonly-notes"]')).length, 0);
    assert.match(await domText(html), /Titel \(optional\)/);
    assert.ok((await domElements(html, '[data-tasting-note="nose"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="tasting-edit-done"]')).length > 0);
    assert.ok((await domElements(html, '[data-tasting-score]')).length > 0);
    assert.ok((await domElements(html, '[data-act="tasting-delete"]')).length > 0);
    state.tastingId = 'new';
    view.editor();
    assert.ok((await domElements(html, '[data-act="tasting-create"]')).length > 0);
    assert.ok((await domElements(html, '[data-tasting-note="nose"]')).length > 0);
  }
);

test(
  'saved external tasting also begins in read-only notes mode while external facts have a separate edit control',
  async () => {
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
    assert.ok((await domElements(html, '[data-tasting-readonly="true"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="tasting-external-edit"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="tasting-edit-start"]')).length > 0);
    assert.equal((await domElements(html, '[data-act="tasting-open-bottling"]')).length, 0);
    assert.equal((await domElements(html, '[data-tasting-score]')).length, 0);
    view.startEditing();
    assert.ok((await domElements(html, '[data-tasting-score]')).length > 0);
    assert.ok((await domElements(html, '[data-act="tasting-edit-done"]')).length > 0);
    state.selected = 'new'; view.editor();
    assert.ok((await domElements(html, '[data-tasting-score]')).length > 0);
    assert.equal((await domElements(html, '[data-tasting-readonly="true"]')).length, 0);
  }
);

test(
  'bottling details and tasting pages render identical back-button structure and arrow',
  async () => {
    const bottling = {
      id: 'b1',
      name: 'Navigation test',
      distilleryIds: [],
      bottles: [],
      tastings: [],
    };
    const collection = {
      schemaVersion: 10,
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
    assert.equal((await domElements(detailHtml, `${button} > svg > path`))[0].attributes.d, (await domElements(tastingHtml, `${button} > svg > path`))[0].attributes.d);
    assert.equal((await domElements(detailHtml, `${button}[data-region="detail-back"]`)).length, 1);
    assert.equal((await domElements(tastingHtml, `${button}[data-act="tastings-back-detail"]`)).length, 1);
    assert.equal((await domElements(detailHtml, '[class="page-back-nav ds-back-nav ds-back-nav--inline"]')).length, 1);
    assert.equal((await domElements(tastingHtml, '[class="page-back-nav ds-back-nav ds-back-nav--inline"]')).length, 1);
    assert.equal(
      await domMatches(backNavigation('back', 'Zur Sammlung'), '.page-back-nav.ds-back-nav.ds-back-nav--inline'),
      true
    );
    for (const label of ['Zur Sammlung', '← Zur Sammlung',
      '⟵ Back to collection']) {
      const nav = backNavigation('back', label);
      assert.equal((await domElements(nav, '[class="ui-symbol"]')).length, 1, 'exactly one SVG arrow');
      await assertDom(nav, "span", {"text": new RegExp("^\\s*(?:←|⟵)", "u")}, true, 'translated arrow never appears beside SVG icon');
    }
  }
);
