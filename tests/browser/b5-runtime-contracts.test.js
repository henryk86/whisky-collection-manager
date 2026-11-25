/**
 * Observable counterparts to the historical source-text assertions.
 * These tests load the application's real styles in Chromium and measure the
 * rendered DOM, not CSS spelling or JavaScript implementation tokens.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {session, seed} from './support.js';
import {renderWarehouseRoomWall}
  from '../../public/js/views/warehouse-room-wall.js';
import {createTastingsView} from '../../public/js/views/tastings.js';
import {importChoice} from '../../public/js/features/import/choice-template.js';
import {roomTransferMarkup}
  from '../../public/js/views/warehouse-room-transfer.js';

/**
 * Updates the DOM elements managed by fixture.
 *
 * @param {*} page Page or view being rendered or selected.
 * @param {*} html HTML markup to render or inspect.
 * @param {string=} width Width in pixels.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function fixture(page, html, width = '850px') {
  await page.evaluate(({html, width}) => {
    document.querySelector('#b5-contract-fixture')?.remove();
    const root = document.createElement('section');
    root.id = 'b5-contract-fixture';
    root.style.cssText =
      `box-sizing:border-box;width:${width};max-width:100%;margin:20px auto;`;
    root.innerHTML = html;
    document.body.append(root);
  }, {html, width});
  return page.locator('#b5-contract-fixture');
}

/**
 * Derives the simple warehouse result from the supplied values.
 * @return {!Array<*>} Resulting entries in their output order.
 */
function simpleWarehouse() {
  const room = {
    id: 'b5-room', name: 'Browser-Regale', width: 5, height: 4, furniture: [
      {
        id: 'b5-cabinet',
        name: 'Schrank',
        type: 'schrank',
        x: .2,
        y: .2,
        width: 1.2,
        depth: .5,
        elevation: 0,
        itemHeight: 1.7,
        shelves: [
          {id: 'b5-top', name: 'Fach oben', capacity: 2, heightCm: 80},
          {id: 'b5-bottom', name: 'Fach unten', capacity: 3, heightCm: 90}],
      },
      {
        id: 'b5-unavailable',
        name: 'Nicht belegbar',
        type: 'regal',
        x: 2,
        y: .2,
        width: 1,
        depth: .5,
        elevation: 0,
        itemHeight: 1.4,
        shelves: [{id: 'b5-zero', name: 'Nicht belegbares Fach', capacity: 0}],
      },
    ],
  };
  const warehouse = {
    rooms: [room],
    bottles: [{id: 'b5-bottle', name: 'Testflasche', number: '000123'}],
    assignments: {'b5-bottle': 'b5-bottom'},
  };
  return {room, warehouse};
}

/**
 * Derives the tasting form result from the supplied values.
 * @return {string} Resulting text.
 */
function tastingForm() {
  let html = '';
  const state = {
    page: 'tasting', selected: 'b5-bottling', tastingId: 'new',
    collection: {
      bottlings: [{id: 'b5-bottling', name: 'Example Whisky', tastings: []}],
      distilleries: [],
    },
  };
  createTastingsView({
    state,
    /**
     * Updates the shell state for its caller.
     *
     * @param {*} markup HTML markup for the selected content.
     */
    shell: markup => {
      html =
        markup;
    },
    /**
     * Updates the navigate state for its caller.
     */
    navigate() {},
    /**
     * Performs the refresh lifecycle action.
     */
    refresh() {},
  }).editor();
  return html;
}

test(
  'browser B-5: physical shelf wall uses real heights, horizontal scrolling \
and a visible edit action',
  async () => {
    await session(async ({page, open}) => {
      await open();
      const {room, warehouse} = simpleWarehouse();
      await fixture(
        page,
        renderWarehouseRoomWall(room, warehouse, ['b5-bottle'])
      );
      const actual = await page.locator('#b5-contract-fixture')
        .evaluate(root => {
          /**
           * Locates the DOM elements used by find.
           *
           * @param {function(...*): *} selector Selector input for this
           * operation.
           * @return {*} Matching DOM element, if present.
           */
          const find = selector => root.querySelector(selector);
          const wall = find('.warehouse-wall-scroll');
          const cabinet = find('[data-furniture-id="b5-cabinet"]');
          const edit = cabinet.querySelector('.warehouse-wall-furniture-edit');
          const title = cabinet.querySelector('.warehouse-wall-bay-title');
          const zero = find('[data-shelf-id="b5-zero"]');
          const selected = find('.warehouse-wall-bottle.is-selected');
          const shelf = find('[data-shelf-id="b5-bottom"]');
          const frame = cabinet.getBoundingClientRect(), button =
            edit.getBoundingClientRect();
          return {
            overflowX: getComputedStyle(wall).overflowX,
            overflowY: getComputedStyle(wall).overflowY,
            fullHeight: getComputedStyle(wall).maxHeight,
            editVisible: button.width > 0 && button.height > 0,
            editInside: button.left >= frame.left && button.right <=
              frame.right + 1 && button.top >= frame.top,
            labelRoom: parseFloat(getComputedStyle(title).paddingRight) || 0,
            zeroCursor: getComputedStyle(zero).cursor,
            zeroAction: zero.getAttribute('data-act'),
            selectedVisible: !!selected && selected.getBoundingClientRect()
              .width > 0,
            selectedOverflow: selected ? getComputedStyle(selected).overflow :
              'missing',
            shelfHeight: shelf.getBoundingClientRect().height,
            frameHeight: frame.height,
          };
        });
      assert.equal(actual.overflowX, 'auto');
      assert.equal(actual.overflowY, 'hidden');
      assert.equal(actual.fullHeight, 'none');
      assert.ok(
        actual.editVisible && actual.editInside,
        'editing remains inside the cabinet header'
      );
      assert.ok(
        actual.selectedVisible,
        'the selected physical bottle remains visible'
      );
      assert.equal(actual.zeroCursor, 'default');
      assert.notEqual(
        actual.zeroAction,
        'warehouse-shelf-view',
        'zero-capacity shelf cannot open a location chooser'
      );
      assert.ok(
        actual.shelfHeight > 50 && actual.frameHeight > actual.shelfHeight,
        'compartments have physical, finite heights'
      );
    });
  }
);

test(
  'browser B-5: eight shallow bays remain inside the cabinet rather than \
stretching it',
  async () => {
    await session(async ({page, open}) => {
      await open();
      const room = {
        id: 'shallow', name: 'Shallow', furniture: [{
          id: 'many', name: 'Regal', type: 'regal', x: 0, y: 0,
          width: .7, depth: .5, itemHeight: .8, elevation: 0,
          shelves: Array.from(
            {length: 8},
            (_, i) => ({
              id: `s${i}`, name: `Fach ${i}`, heightCm: 10,
              capacity: 3,
            })
          ),
        }],
      };
      const html = renderWarehouseRoomWall(
        room,
        {rooms: [room], bottles: [], assignments: {}}
      );
      await fixture(page, html);
      const measured = await page.locator('#b5-contract-fixture')
        .evaluate(root => {
          const frame = root.querySelector('[data-furniture-id="many"]');
          const bays = [...frame.querySelectorAll('.warehouse-wall-bay')];
          return {
            height: frame.getBoundingClientRect().height,
            contentHeight: frame.querySelector('.warehouse-wall-furniture-body')
              .getBoundingClientRect().height,
            bays: bays.map(node => node.getBoundingClientRect().height),
            overflow: frame.scrollHeight - frame.clientHeight,
          };
        });
      assert.equal(measured.bays.length, 8);
      assert.ok(
        measured.height >= 175 && measured.height <= 195,
        `80cm cabinet: ${JSON.stringify(measured)}`
      );
      assert.ok(
        measured.bays.every(height => height >= 17 && height <= 28),
        `10cm compartments: ${JSON.stringify(measured)}`
      );
      assert.ok(Math.abs(measured.contentHeight - measured.height) <= 2);
      assert.ok(
        measured.overflow <= 2,
        'no phantom shelf stretches the furniture'
      );
    });
  }
);

test(
  'browser B-5: tasting metadata stays three columns on desktop and stacks \
on a phone',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await fixture(page, tastingForm(), '100%');
      const desktop = await page.locator('#b5-contract-fixture')
        .evaluate(root => {
          const panel = root.querySelector('.tasting-edit-meta-panel');
          const date = panel.querySelector('[data-tasting-date]')
            .getBoundingClientRect();
          const title = panel.querySelector('[data-tasting-title]')
            .getBoundingClientRect();
          const actions = panel.querySelector('.tasting-editor-actions')
            .getBoundingClientRect();
          const notes = root.querySelector('.tasting-notes');
          const textarea = notes.querySelector('textarea');
          return {
            date: {x: date.x, y: date.y},
            title: {x: title.x, y: title.y},
            actions: {x: actions.x, y: actions.y},
            notesAlignment: getComputedStyle(notes).alignItems,
            resize: getComputedStyle(textarea).resize,
          };
        });
      assert.ok(
        desktop.date.x < desktop.title.x && desktop.title.x < desktop.actions.x,
        `desktop date/title/actions are side-by-side: ${JSON.stringify(desktop
        )}`
      );
      assert.equal(desktop.notesAlignment, 'start');
      assert.equal(desktop.resize, 'vertical');
      await page.setViewportSize({width: 390, height: 844});
      const mobile = await page.locator('#b5-contract-fixture')
        .evaluate(root => {
          const p = root.querySelector('.tasting-edit-meta-panel');
          return {
            grid: getComputedStyle(p).gridTemplateColumns,
            width: p.getBoundingClientRect().width,
            date: p.querySelector('[data-tasting-date]')
              .getBoundingClientRect().y,
            title: p.querySelector('[data-tasting-title]')
              .getBoundingClientRect().y,
            actions: p.querySelector('.tasting-editor-actions')
              .getBoundingClientRect().y,
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
      assert.ok(mobile.date < mobile.title && mobile.title < mobile.actions,
        `mobile controls stack in reading order: ${JSON.stringify(mobile)}`);
      assert.ok(
        mobile.overflow <= 2,
        `no horizontal overflow: ${JSON.stringify(mobile)}`
      );
    });
  }
);

test(
  'browser B-5: import option checkboxes are usable, responsive and follow \
theme changes',
  async () => {
    await session(async ({page, open}) => {
      await open();
      const markup = '<div class="import-choice-list" role="group">' +
        importChoice({
          field: 'name', label: 'Name', value: 'Neu',
          checked: true,
        }) +
        importChoice({
          field: 'abv', label: 'Alkohol', value: '46%',
          checked: false,
        }) + '</div>';
      await fixture(page, markup);
      const selected = page.locator(
        '#b5-contract-fixture .import-choice input[type="checkbox"]').first();
      const desktop = await page.locator('#b5-contract-fixture')
        .evaluate(root => {
          const list = root.querySelector('.import-choice-list');
          const checkbox = root.querySelector('input');
          const box = checkbox.getBoundingClientRect();
          return {
            columns: getComputedStyle(list).gridTemplateColumns
              .split(' ').length,
            width: box.width,
            height: box.height,
            minHeight: getComputedStyle(checkbox).minHeight,
            padding: getComputedStyle(checkbox).padding,
          };
        });
      assert.equal(desktop.columns, 2);
      assert.ok(desktop.width >= 16 && desktop.width <= 22 &&
        desktop.height >= 16 && desktop.height <= 22);
      assert.equal(await selected.isChecked(), true);
      await selected.uncheck();
      assert.equal(
        await selected.isChecked(),
        false,
        'selection is a live form control, not static markup'
      );
      await page.setViewportSize({width: 390, height: 844});
      const cols = await page.locator(
        '#b5-contract-fixture .import-choice-list')
        .evaluate(node => getComputedStyle(node).gridTemplateColumns
          .split(' ').length);
      assert.equal(cols, 1, 'choices remain readable on mobile');
      await page.evaluate(() => document.documentElement
        .setAttribute('data-theme', 'dark'));
      await selected.check();
      const dark = await selected.evaluate(node => {
        const label = node.closest('.import-choice');
        return {
          background: getComputedStyle(label).backgroundColor,
          contrast: getComputedStyle(label).color,
        };
      });
      assert.notEqual(
        dark.background,
        'rgba(0, 0, 0, 0)',
        'the selected choice is visibly highlighted'
      );
    });
  }
);

test(
  'browser B-5: room-transfer hidden tab remains hidden by rendered styles',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await fixture(page, roomTransferMarkup([], null));
      const hidden = page.locator(
        '#b5-contract-fixture #warehouse-transfer-panel-export');
      assert.equal(await hidden.isVisible(), false);
      assert.equal(
        await page.locator(
          '#b5-contract-fixture #warehouse-transfer-panel-import').isVisible(),
        true
      );
      assert.equal(
        await page.locator(
          '#b5-contract-fixture #warehouse-transfer-tab-export').isDisabled(),
        true
      );
    });
  }
);

test(
  'browser B-5: entrypoint buttons open dialogs and iOS icon resolves as a \
real image',
  async () => {
    await session(async ({page, open, base}) => {
      await seed(base, '003765');
      await open();
      const apple = await page.locator('link[rel="apple-touch-icon"]')
        .getAttribute('href');
      assert.ok(apple?.includes('/apple-touch-icon.png'));
      const icon = await fetch(new URL(apple, base));
      assert.equal(icon.status, 200);
      assert.match(icon.headers.get('content-type') || '', /image\/png/);
      await page.locator('header [data-act="new"]').click();
      await page.locator('#new-bottle-choice-form').waitFor();
      await page.locator('#modal-root [data-act="new-bottling-direct"]')
        .click();
      await page.locator('#bottling-form').waitFor();
    });
  }
);

test(
  'browser B-5: empty bottle images use a fitted SVG placeholder in both \
themes',
  async () => {
    await session(async ({page, open, base}) => {
      await seed(base, '009532');
      await open();
      const card = page.locator('.card-img:has(img.image-placeholder)').first();
      await card.waitFor();
      const placeholder = card.locator('img.image-placeholder');
      const resource = await fetch(new URL(await placeholder.getAttribute(
        'src'), base));
      assert.equal(resource.status, 200);
      assert.match(
        resource.headers.get('content-type') || '',
        /image\/svg\+xml/
      );
      const visual = await placeholder.evaluate(img => {
        const parent = img.parentElement.getBoundingClientRect(), box =
          img.getBoundingClientRect();
        return {
          src: img.currentSrc || img.src,
          naturalWidth: img.naturalWidth,
          width: box.width,
          height: box.height,
          containerWidth: parent.width,
          containerHeight: parent.height,
          inside: box.top >= parent.top - 2 && box.bottom <= parent.bottom + 2,
        };
      });
      assert.ok(
        visual.naturalWidth > 0,
        'placeholder image must actually render'
      );
      assert.ok(visual.inside && visual.width < visual.containerWidth * .7,
        `placeholder stays inside the card: ${JSON.stringify(visual)}`);
      const themeBefore = await placeholder.evaluate(img => ({
        mix: getComputedStyle(img).mixBlendMode,
        opacity: getComputedStyle(img).opacity,
      }));
      await page.evaluate(() => document.documentElement.dataset.theme =
        'dark');
      const themeAfter = await placeholder.evaluate(img => ({
        mix: getComputedStyle(img).mixBlendMode,
        opacity: getComputedStyle(img).opacity,
      }));
      assert.equal(themeAfter.mix, 'normal');
      assert.ok(
        Number(themeAfter.opacity) >= .85,
        'dark theme keeps the silhouette visible'
      );
      assert.ok(
        themeBefore.opacity,
        'light theme also has a defined, rendered image'
      );
    });
  }
);

test(
  'browser B-5: header branding is a loaded SVG and the installed app icon \
is reachable',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      const logo = page.locator('.site-header img[src*="logo.svg"]').first();
      await logo.waitFor();
      const props = await logo.evaluate(img => ({
        naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
        visible: img.getBoundingClientRect().width > 0,
      }));
      assert.ok(
        props.visible && props.naturalWidth > 0 && props.naturalHeight > 0,
        'real SVG branding is loaded in the header'
      );
      const appleHref = await page.locator('link[rel="apple-touch-icon"]')
        .getAttribute('href');
      const response = await fetch(new URL(appleHref, base));
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /image\/png/);
      const png = Buffer.from(await response.arrayBuffer());
      assert.equal(png.readUInt32BE(16), 180);
      assert.equal(png.readUInt32BE(20), 180);
    });
  }
);
