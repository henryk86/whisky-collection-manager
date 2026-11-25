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
 * @return {string} Resulting text.
 */
function headerFor(page) {
  const root = {innerHTML: ''};
  createShell({
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
  return root.innerHTML.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
}

test(
  'the global app header is identical on every main and tasting page',
  () => {
    const reference = headerFor('home');
    assert.ok(reference);
    assert.match(reference, /data-act="scan"/);
    assert.match(reference, /data-act="new"/);
    assert.match(reference, /data-act="toggle-theme"/);
    assert.match(reference, /data-act="toggle-menu"/);
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
      assert.equal(headerFor(page), reference, `global header differs for ${page}`);
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
    state,
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
  }).home();
  assert.match(html, /class="analytics-page tasting-home-page"/);
  assert.match(html, /<header class="section-head ds-page-header analytics-page-heading">/);
  assert.match(html, /class="page-heading-copy"/);
  assert.match(html, /class="eyebrow dark">JOURNAL/);
  assert.match(html, /class="heading-period" aria-hidden="true">\.<\/span>/);
  assert.match(html, /class="intro">/);
  assert.doesNotMatch(html, /data-act="tastings-header-new"/);
  assert.match(html, /<h2>Verkostungsnotizen<span class="heading-period" aria-hidden="true">/);
  assert.match(html, /<h3>Einträge<\/h3>/);
  assert.doesNotMatch(html, /<h3>Alle Verkostungsnotizen<\/h3>/);
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
      state,
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
    });
    view.list();
    assert.match(html, /Whisky with details/);
    assert.match(html, /Alter: 12 Jahre/);
    assert.match(html, /Fasstyp: Sherry Butt/);
    assert.match(html, /Alkoholgehalt: 48,5 % Vol\./);
    assert.match(
      html,
      new RegExp(
        'data-act="tastings-back-detail"[^>]*><svg ' + 'class="ui-symbol"[^>]*aria-hidden="true"[^' +
        '>]*>[^<]*<path d="m12 19-7-7 7-7M5 12h14"' +
        '\\/><\\/svg>'
      )
    );
    state.page = 'tasting'; state.tastingId = 'note-1';
    view.editor();
    for (const label of ['Alter: 12 Jahre', 'Fasstyp: Sherry Butt',
      'Alkoholgehalt: 48,5 % Vol.'])
      assert.ok(html.includes(label), `missing ${label} on tasting editor`);
    assert.match(
      html,
      new RegExp(
        'data-act="tastings-back-list"[^>]*><svg cl' + 'ass="ui-symbol"[^>]*aria-hidden="true"[^>]' +
        '*>[^<]*<path d="m12 19-7-7 7-7M5 12h14"\\/' +
        '><\\/svg>'
      )
    );
    delete bottling.ageYears; delete bottling.caskType; delete bottling.abv;
    view.list();
    assert.doesNotMatch(html, /Alter:|Fasstyp:|Alkoholgehalt:/);
    state.page = 'tasting';
    view.editor();
    assert.doesNotMatch(html, /Alter:|Fasstyp:|Alkoholgehalt:/);
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
      state,
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
    });
    view.list();
    let header = html.match(
      new RegExp('<header class="section-head ds-page-header' + ' analytics-page-heading">[\\s\\S]*?<\\/hea' + 'der>'))?.[0];
    assert.ok(header);
    assert.match(header, /Verkostungsübersicht/);
    assert.doesNotMatch(header, /Named bottling|tasting-title-icon|glencairn-symbol/);
    assert.ok(html.indexOf('Named bottling') > html.indexOf('class="analytics-panel tasting-bottling-info"'));
    assert.ok(html.indexOf('class="analytics-panel tasting-bottling-info"') <
      html.indexOf('class="analytics-panel tasting-list-section"'));
    state.page = 'tasting'; state.tastingId = 'note-1';
    view.editor();
    header = html.match(
      new RegExp('<header class="section-head ds-page-header' + ' analytics-page-heading">[\\s\\S]*?<\\/hea' + 'der>'))?.[0];
    assert.match(header, /<h2>Verkostung<span/);
    assert.doesNotMatch(header, /Named bottling|Bourbon Barrel/);
    const subject = html.indexOf('class="analytics-panel tasting-bottling-info"');
    assert.ok(subject > html.indexOf('</header>'));
    assert.ok(subject < html.indexOf('<h3>Eindrücke</h3>'));
    assert.ok(subject < html.indexOf('class="tasting-record-fields analytics-panel'));
    assert.match(
      html,
      new RegExp(
        'data-act="tastings-back-list"[^>]*><svg cl' + 'ass="ui-symbol"[^>]*aria-hidden="true"[^>]' +
        '*>[^<]*<path d="m12 19-7-7 7-7M5 12h14"\\/' +
        '><\\/svg>'
      )
    );
    state.tastingId = 'new';
    view.editor();
    assert.match(
      html,
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
      state,
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
    }).editor();
    const header = html.match(
      new RegExp('<header class="section-head ds-page-header' + ' analytics-page-heading">[\\s\\S]*?<\\/hea' + 'der>'))?.[0];
    assert.match(header, /Verkostung erfassen/);
    assert.doesNotMatch(header, /Name der Abfüllung|tasting-title-icon/);
    assert.ok(html.indexOf('class="analytics-panel tasting-bottling-info"') <
      html.indexOf('class="section-head ds-section-header tasting-editor-section-head"><h3>Eindrücke</h3>'));
    assert.match(
      html,
      new RegExp('class="analytics-panel tasting-bottling-in' + 'fo"[\\s\\S]*?data-external-field="name"')
    );
    assert.doesNotMatch(html, /<h3>Abfüllungsangaben<\/h3>/);
    assert.doesNotMatch(html, /data-act="tasting-external-edit"/);
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
      state,
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} s Source value to transform.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: s => html = s,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.list();
    assert.match(
      html,
      new RegExp(
        '<div class="analytics-page tasting-child-p' + 'age">\\s*<nav class="page-back-nav ds-back' +
        '-nav ds-back-nav--inline"[^>]*>\\s*<button' +
        '[^>]*data-act="tastings-back-detail"'
      )
    );
    assert.ok(html.indexOf('<nav class="page-back-nav ds-back-nav ds-back-nav--inline"') <
      html.indexOf('<header class="section-head ds-page-header analytics-page-heading"')
    );
    assert.ok(html.indexOf('<header class="section-head ds-page-header analytics-page-heading"') <
      html.indexOf('<section class="analytics-panel tasting-bottling-info">')
    );
    assert.doesNotMatch(html, /<h3>Abfüllungsangaben<\/h3>/);
    state.page = 'tasting'; state.tastingId = 'taste';
    view.editor();
    assert.match(
      html,
      new RegExp(
        '<div class="analytics-page tasting-child-p' + 'age">\\s*<nav class="page-back-nav ds-back' +
        '-nav ds-back-nav--inline"[^>]*>\\s*<button' +
        '[^>]*data-act="tastings-back-list"'
      )
    );
    assert.ok(html.indexOf('<nav class="page-back-nav ds-back-nav ds-back-nav--inline"') <
      html.indexOf('<header class="section-head ds-page-header analytics-page-heading"')
    );
    assert.ok(html.indexOf('<header class="section-head ds-page-header analytics-page-heading"') <
      html.indexOf('<section class="section tasting-editor-content'));
    state.page = 'external-tasting'; state.selected = 'new';
    view.editor();
    assert.match(
      html,
      new RegExp(
        '<div class="analytics-page tasting-child-p' + 'age">\\s*<nav class="page-back-nav ds-back' +
        '-nav ds-back-nav--inline"[^>]*>\\s*<button' +
        '[^>]*data-act="tastings-back-home"'
      )
    );
    assert.ok(html.indexOf('<nav class="page-back-nav ds-back-nav ds-back-nav--inline"') <
      html.indexOf('<header class="section-head ds-page-header analytics-page-heading"')
    );
    assert.ok(html.indexOf('<header class="section-head ds-page-header analytics-page-heading"') <
      html.indexOf('data-external-field="name"'));
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
      state,
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} s Source value to transform.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: s => html = s,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.home();
    assert.match(html, /class="warehouse-bottle-list tasting-entry-list"/);
    assert.match(html, /class="warehouse-bottle-row tasting-entry-row tasting-home-row"/);
    assert.match(html, /data-act="tastings-home-open"/);
    assert.match(
      html,
      new RegExp('<button type="button" class="tasting-entry' + '-open" data-act="tastings-home-open"')
    );
    assert.doesNotMatch(html, /data-act="tastings-home-open"[^>]*>[^<]*Öffnen<\/button>/);
    assert.match(html, /class="tasting-entry-chevron" aria-hidden="true"/);
    state.page = 'tastings'; view.list();
    assert.match(html, /class="warehouse-bottle-row tasting-entry-row tasting-list-row"/);
    assert.match(html, /data-act="tastings-open"/);
    assert.match(
      html,
      new RegExp('<button type="button" class="tasting-entry' + '-open" data-act="tastings-open"')
    );
    assert.match(
      html,
      new RegExp(
        'class="tasting-entry-actions"><button type' + '="button" class="btn small danger" data-ac' + 't="tasting-delete"'
      )
    );
    assert.match(html, /data-act="tasting-delete"/);
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
      state,
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} s Source value to transform.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: s => html = s,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.editor();
    const summary = html.match(new RegExp('<section class="analytics-panel tasting-bo' + 'ttling-info">[\\s\\S]*?<\\/section>'))?.[0];
    assert.ok(summary);
    assert.match(summary, /<div class="tasting-bottling-summary" data-external-read>/);
    assert.match(summary, /data-act="tasting-external-edit"[^>]*><svg class="action-icon"/);
    assert.match(summary, /Distillery/);
    assert.match(summary, /Alter: 12 Jahre/);
    assert.match(summary, /43,6 % Vol/);
    assert.match(summary, /<div data-external-edit hidden>/);
    assert.match(summary, /data-act="tasting-external-save"/);
    assert.match(summary, /data-act="tasting-external-cancel"/);
    assert.doesNotMatch(summary, /<h3>Abfüllungsangaben<\/h3>/);
    state.selected = 'new'; view.editor();
    assert.match(html, /<div data-external-edit >/);
    assert.doesNotMatch(html, /data-external-read/);
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
      state,
      /**
       * Updates the shell state for its caller.
       */
      shell() {},
      /**
       * Updates the navigate state for its caller.
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
        return inputs[selector.match(/data-external-field="([^"]+)"/)?.[1]] || null;
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
      assert.equal(read.hidden, true);
      assert.equal(form.hidden, false);
      assert.equal(name.focused, true);
      name.value = 'Uncommitted'; distillery.value = 'Other'; age.value = '9';
      view.cancelExternalEdit();
      assert.equal(read.hidden, false);
      assert.equal(form.hidden, true);
      assert.equal(name.value, 'Old whisky');
      assert.equal(distillery.value, 'Original');
      assert.equal(age.value, '8');
      assert.equal(saved.tastingNotes.nose, 'vanilla');
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
      state,
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
      /**
       * Renders modal in the current view.
       *
       * @param {*} _title Value used by this operation.
       * @param {*} content Content to render, store or examine.
       */
      showModal(_title, content) {dialog = content;},
      /**
       * Performs the close modal lifecycle action.
       */
      closeModal() {},
    });
    view.editor();
    assert.match(html, /data-act="tasting-external-assign"/);
    view.showAssignDialog();
    assert.match(dialog, /data-tasting-assign-target/);
    assert.match(dialog, /data-act="tasting-external-assign-confirm"/);
    assert.ok(dialog.indexOf('Owned first') < dialog.indexOf('Owned second'));
    state.selected = 'new'; view.editor();
    assert.doesNotMatch(html, /data-act="tasting-external-assign"/);
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
      state,
      selectors: createSelectors(state),
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} markup HTML markup for the selected content.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: markup => html = markup,
      /**
       * Updates the navigate state for its caller.
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
      const header = html.match(
        new RegExp('<header class="section-head ds-page-header' + ' analytics-page-heading">[\\s\\S]*?<\\/hea' + 'der>'))?.[0];
      assert.doesNotMatch(header, /<img |Photo dram/);
      const info = html.match(new RegExp('<section class="analytics-panel tasting-bo' + 'ttling-info">[\\s\\S]*?<\\/section>'))?.[0];
      assert.ok(info);
      assert.match(info, /class="tasting-bottling-summary tasting-bottling-photo-layout"/);
      assert.match(info, /class="tasting-bottling-photo"/);
      assert.match(info, /src="\/photos\/cutout.png"/);
      assert.match(info, /alt="[^"]*Photo dram/);
      assert.doesNotMatch(info, /photos\/original.jpg/);
    }
    bottling.bottles[0].photos = [];
    view.list();
    assert.doesNotMatch(html, /class="tasting-bottling-photo"/, 'no placeholder when no photo exists');
    state.page = 'external-tasting'; state.selected = 'new';
    view.editor();
    assert.doesNotMatch(html, /class="tasting-bottling-photo"/, 'external tasting has no collection photo');
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
      state,
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} markup HTML markup for the selected content.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: markup => html = markup,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.editor();
    assert.match(html, /data-tasting-readonly="true"/);
    assert.match(
      html,
      new RegExp('<span class="tasting-readonly-label">Titel' + '<\\/span><strong>Evening tasting<\\/strong' + '>')
    );
    assert.doesNotMatch(html, /Titel \(optional\)/);
    assert.match(html, /data-act="tasting-edit-start"[^>]*><svg class="action-icon"/);
    assert.match(html, /class="tasting-notes tasting-readonly-notes"/);
    assert.match(html, /Sherry &amp; vanilla/);
    assert.match(html, /87\.5 \/ 100/);
    assert.match(html, /class="tasting-readonly-glasses"/);
    assert.match(html, /class="tasting-readonly-color"/);
    assert.doesNotMatch(
      html,
      new RegExp('data-tasting-note=|data-tasting-score|data' + '-flavor-range|data-act="tasting-delete"')
    );
    assert.match(html, /data-act="tasting-open-bottling"[^>]*>Zu den Abf/);
    assert.doesNotMatch(html, /<h3>Abf/);
    view.startEditing();
    assert.doesNotMatch(html, /data-tasting-readonly="true"/);
    assert.doesNotMatch(html, /class="tasting-notes tasting-readonly-notes"/);
    assert.match(html, /Titel \(optional\)/);
    assert.match(html, /data-tasting-note="nose"/);
    assert.match(html, /data-act="tasting-edit-done"/);
    assert.match(html, /data-tasting-score/);
    assert.match(html, /data-act="tasting-delete"/);
    state.tastingId = 'new';
    view.editor();
    assert.match(html, /data-act="tasting-create"/);
    assert.match(html, /data-tasting-note="nose"/);
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
      state,
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} markup HTML markup for the selected content.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: markup => html = markup,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    });
    view.editor();
    assert.match(html, /data-tasting-readonly="true"/);
    assert.match(html, /data-act="tasting-external-edit"/);
    assert.match(html, /data-act="tasting-edit-start"/);
    assert.doesNotMatch(html, /data-act="tasting-open-bottling"/);
    assert.doesNotMatch(html, /data-tasting-score/);
    view.startEditing();
    assert.match(html, /data-tasting-score/);
    assert.match(html, /data-act="tasting-edit-done"/);
    state.selected = 'new'; view.editor();
    assert.match(html, /data-tasting-score/);
    assert.doesNotMatch(html, /data-tasting-readonly="true"/);
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
         * Derives the query selector all result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        querySelectorAll: () => [],
      };
      createDetailView({
        state: {collection, selected: 'b1'}, selectors: {
          /**
           * Derives the bottles result from the supplied values.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          bottles: () => [],
          /**
           * Derives the cover photo result from the supplied values.
           * @return {*} Result computed from the supplied inputs.
           */
          coverPhoto: () => null,
          /**
           * Derives the distillery names result from the supplied values.
           * @return {string} Resulting text.
           */
          distilleryNames: () => '',
        },
        /**
         * Derives the shell result from the supplied values.
         *
         * @param {*} s Source value to transform.
         * @return {*} Result computed from the supplied inputs.
         */
        shell: s => detailHtml = s,
        /**
         * Updates the navigate state for its caller.
         */
        navigate() {},
        /**
         * Updates the action state for its caller.
         */
        action() {},
      })();
    } finally {
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
    }
    let tastingHtml = '';
    createTastingsView({
      state: {page: 'tastings', selected: 'b1', collection},
      /**
       * Derives the shell result from the supplied values.
       *
       * @param {*} s Source value to transform.
       * @return {*} Result computed from the supplied inputs.
       */
      shell: s => tastingHtml = s,
      /**
       * Updates the navigate state for its caller.
       */
      navigate() {},
      /**
       * Performs the refresh lifecycle action.
       */
      refresh() {},
    }).list();
    const detailButton =
      detailHtml.match(
        new RegExp(
          '<nav class="page-back-nav ds-back-nav ds-b' + 'ack-nav--inline"[^>]*>\\s*<button[^>]*clas' +
          's="inline-link page-back ds-back-button ds' +
          '-back-button--inline"[^>]*>[\\s\\S]*?<\\/b' +
          'utton><\\/nav>'
        ))?.[0];
    const tastingButton =
      tastingHtml.match(
        new RegExp(
          '<nav class="page-back-nav ds-back-nav ds-b' + 'ack-nav--inline"[^>]*>\\s*<button[^>]*clas' +
          's="inline-link page-back ds-back-button ds' +
          '-back-button--inline"[^>]*>[\\s\\S]*?<\\/b' +
          'utton><\\/nav>'
        ))?.[0];
    assert.ok(detailButton);
    assert.ok(tastingButton);
    assert.equal(detailButton.match(/<path d="([^"]+)"/)[1], tastingButton.match(/<path d="([^"]+)"/)[1]);
    assert.match(detailButton, /data-region="detail-back"/);
    assert.match(tastingButton, /data-act="tastings-back-detail"/);
    assert.equal((detailHtml.match(/class="page-back-nav ds-back-nav ds-back-nav--inline"/g) || []).length, 1);
    assert.equal((tastingHtml.match(/class="page-back-nav ds-back-nav ds-back-nav--inline"/g) || []).length, 1);
    assert.equal(
      backNavigation('back', 'Zur Sammlung').includes('class="page-back-nav ds-back-nav ds-back-nav--inline"'),
      true
    );
    for (const label of ['Zur Sammlung', '← Zur Sammlung',
      '⟵ Back to collection']) {
      const nav = backNavigation('back', label);
      assert.equal((nav.match(/class="ui-symbol"/g) || []).length, 1, 'exactly one SVG arrow');
      assert.doesNotMatch(nav, /<span>\s*(?:←|⟵)/u, 'translated arrow never appears beside SVG icon');
    }
  }
);
