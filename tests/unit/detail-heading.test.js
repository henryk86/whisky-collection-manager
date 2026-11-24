import test from 'node:test';
import assert from 'node:assert/strict';
import {createDetailView} from '../../public/js/views/detail.js';

function renderDetail(distilleryIds, bottler) {
  const originalDocument = globalThis.document;
  globalThis.document = {querySelectorAll: () => []};
  try {
    let html = '';
    const bottling = {
      id: 'b1', name: 'Laphroaig WILLEM 14-year-old',
      distilleryIds, completionStatus: 'incomplete',
      whiskyType: 'single_malt', bottler,
    };
    const detail = createDetailView({
      state: {selected: 'b1', collection: {bottlings: [bottling]}},
      selectors: {
        bottles: () => [],
        coverPhoto: () => '',
        distilleryNames: () => 'Laphroaig',
      },
      shell: output => {html = output;},
      navigate: () => {throw new Error('Unexpected navigation');},
      action: async handler => handler(),
    });
    detail();
    return html;
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

test(
  'detail headline uses the overview card kicker for distillery, and a muted separate status',
  () => {
    const html = renderDetail(['distillery-laphroaig']);
    assert.match(html, /<span class="card-kicker">Laphroaig<\/span>/);
    assert.match(
      html,
      /<span class="detail-heading-separator" aria-hidden="true">·<\/span><span class="muted">Unvollständig<\/span>/
    );
  }
);

test(
  'bottling title is unchanged by shared decorative page heading punctuation',
  () => {
    const html = renderDetail(['distillery-laphroaig']);
    assert.match(html, /<h2>Laphroaig WILLEM 14-year-old<\/h2>/);
    assert.doesNotMatch(
      html,
      /<h2>Laphroaig WILLEM 14-year-old<span class="heading-period"/
    );
  }
);

test(
  'detail headline without distillery shows status only, no separator',
  () => {
    const html = renderDetail([]);
    assert.match(
      html,
      /<div class="detail-heading-meta"><span class="muted">Unvollständig<\/span><\/div>/
    );
    assert.doesNotMatch(html, /detail-heading-separator/);
  }
);

test('detail heading uses the bottler when no distillery is supplied', () => {
  const html = renderDetail([], 'Signatory Vintage');
  assert.match(html, /<span class="card-kicker">Signatory Vintage<\/span>/);
  assert.match(
    html,
    /<span class="detail-heading-separator" aria-hidden="true">·<\/span>/
  );
  assert.match(html, /<span class="muted">Unvollständig<\/span>/);
  assert.match(html, /data-ds-detail-field="fact"><span>Abfüller<\/span>/);
});

test(
  'detail offers a right-aligned map link with location icon for one or several assigned distilleries, but not for an unassigned bottling',
  () => {
    const single = renderDetail(['distillery-laphroaig']);
    assert.match(
      single,
      /class="actions ds-header-actions detail-head-actions"/
    );
    assert.match(
      single,
      /data-act="bottling-map"[^>]*><svg class="action-icon"[\s\S]*?<span>Auf Landkarte anzeigen<\/span><\/button>/
    );
    assert.match(
      single,
      /<header class="section-head ds-page-header detail-page-head">/
    );
    const multiple = renderDetail(['distillery-laphroaig', 'distillery-ardbeg']);
    assert.match(
      multiple,
      /data-act="bottling-map"[^>]*><svg class="action-icon"[\s\S]*?<span>Standorte auf Landkarte<\/span><\/button>/
    );
    assert.doesNotMatch(renderDetail([]), /data-act="bottling-map"/);
  }
);
