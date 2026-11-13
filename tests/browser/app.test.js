import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { startTestServer, requestJson } from '../helpers/server.js';
// Some managed environments block all top-level browser URLs. The explicit DOM
// mode renders real modules/CSS via intercepted requests; History is stubbed there.
// Normal local/CI runs use real navigation. Neither mode tests optical recognition.
const domOnly = process.env.WHISKY_BROWSER_DOM_ONLY === 'true';
let browser;
before(async () => {
    browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
        headless: true,
        args: process.env.CI || domOnly ? ['--no-sandbox'] : [],
    });
    fs.mkdirSync('test-artifacts', {
        recursive: true
    });
});
after(async () => {
    await browser?.close();
});
async function openApp(page, base, options = {}) {
    // Locale overrides apply to real Chromium navigation as well as the DOM-only harness.
    if (domOnly || options.localeOverrides) await page.route(`${base}/**`, async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (options.localeOverrides && Object.hasOwn(options.localeOverrides, pathname)) {
            return route.fulfill({status:200, contentType:'application/json',
                headers:{'Access-Control-Allow-Origin':'*'},
                body:JSON.stringify(options.localeOverrides[pathname])});
        }
        const response = await fetch(request.url(), {
            method: request.method(),
            headers: request.postData() ? {
                'Content-Type': 'application/json'
            } : {},
            body: request.postData() || undefined,
        });
        await route.fulfill({
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('content-type') || 'text/plain', 'Access-Control-Allow-Origin': '*'
            },
            body: Buffer.from(await response.arrayBuffer()),
        });
    });
    if (!domOnly) {
        await page.goto(`${base}/${options.query || ''}`);
        // The entry module performs async locale loading and an async API refresh.
        // A completed navigation alone does not guarantee the app has rendered.
        await page.locator('.site-header').waitFor({ state: 'visible' });
        return;
    }
    await page.goto(`about:blank${options.query || ''}`);
    await page.evaluate(() => {
        window.__historyCalls = [];
        for (const method of ['pushState', 'replaceState']) {
            history[method] = (...args) => window.__historyCalls.push({
                method, url: args[2]
            });
        }
    });
    const html = await (await fetch(base)).text();
    await page.setContent(html.replace('<head>', `<head><base href="${base}/">`));
    // In DOM-only mode the ES modules and initial API refresh are asynchronous.
    // Wait for the actual application, not just for setContent() to finish.
    await page.locator('.site-header').waitFor({ state: 'visible' });
}
async function session(callback, activeBrowser = browser) {
    const server = await startTestServer();
    const context = await activeBrowser.newContext({
        viewport: {
            width: 1366, height: 900
        }
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await callback({
            ...server, page, open: options => openApp(page, server.base, options)
        });
        assert.deepEqual(errors, [], 'Unexpected browser errors');
    }
    finally {
        await context.close();
        await server.stop();
    }
}
async function openSettingsFromMenu(page) {
    await page.locator('header [data-act="toggle-menu"]').click();
    await page.locator('#site-drawer [data-act="goto-settings-menu"]').click();
    await page.getByRole('heading', { name: 'Einstellungen & Datensicherung' }).waitFor();
}
async function seed(base, number = '000123') {
    const result = await requestJson(base, '/api/bottlings', 'POST', {
        name: 'Browser Test Blend', whiskyType: 'blended_malt', abv: 46, volumeMl: 700,
        firstBottle: {
            inventoryNumber: number, status: 'closed'
        },
    });
    assert.equal(result.status, 201);
    return result.data;
}
async function mockDecoder(page) {
    await page.evaluate(() => {
        Object.defineProperty(window, 'isSecureContext', {
            configurable: true, value: true
        });
        if (!navigator.mediaDevices?.getUserMedia) {
            Object.defineProperty(navigator, 'mediaDevices', {
                configurable: true, value: {
                    getUserMedia() {
                    }
                }
            });
        }
        window.Html5QrcodeSupportedFormats = {
            QR_CODE: 0, CODE_128: 1
        };
        window.__stopped = 0;
        window.Html5Qrcode = class {
            async start(camera, options, decoded) {
                window.__decoded = decoded;
            }
            async stop() {
                window.__stopped++;
            }
            clear() {
            }
        };
    });
}
test('browser: bottling editor shows external import preview only after incoming data', async () => {
    await session(async ({ page, open }) => {
        await open();
        await page.locator('[data-act="new"]').first().click();
        await page.locator('#bottling-form').waitFor();
        assert.equal(await page.locator('#bottling-form #wb-panel').count(), 0);
        assert.equal(await page.locator('#bottling-form [data-act="wb-search"]').count(), 0);
        assert.equal(await page.locator('#bottling-form a[href*="whiskybase.com"]').count(), 0);
        await page.locator('#bottling-form [data-act="close-modal"]').click();
        await page.evaluate(() => {
            const payload = {
                version: 2, source: 'external',
                fields: {
                    whiskybaseId: '765432', name: 'Private import example',
                    whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/765432/example',
                },
            };
            location.hash = '#wcm-import=' + encodeURIComponent(JSON.stringify(payload));
        });
        await page.locator('#wb-panel .wb-preview').waitFor();
        assert.equal(await page.locator('#bottling-form #wb-panel').count(), 1);
        assert.equal(await page.locator('#wb-panel [data-act="wb-apply"]').count(), 1);
        assert.equal(await page.locator('#wb-panel input[data-wb-field="name"]').count(), 1);
    });
});

test('browser: Whiskybase import assigns four comma-separated distilleries to one bottling', async () => {
    await session(async ({ page, open, base }) => {
        await open();
        const originalCollection = (await requestJson(base, '/api/collection')).data;
        const expectedNames = ['Caol Ila', 'Bowmore', 'Ardbeg', 'Port Ellen'];
        const expectedIds = expectedNames.map(name => originalCollection.distilleries.find(item => item.name === name)?.id);
        assert.ok(expectedIds.every(Boolean), 'all four distilleries are in the catalog');
        await page.evaluate(() => {
            const payload = {
                version: 2, source: 'external', distilleryName: 'Caol Ila, Bowmore, Ardbeg, Port Ellen',
                fields: {
                    whiskybaseId: '987654', name: 'Four-Distillery Blended Malt', whiskyType: 'blended_malt',
                    whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/987654/test',
                },
            };
            location.hash = '#wcm-import=' + encodeURIComponent(JSON.stringify(payload));
        });
        await page.locator('#wb-panel input[name="wb-distillery"]').first().waitFor();
        const importOptions = page.locator('#wb-panel input[name="wb-distillery"]');
        assert.equal(await importOptions.count(), 4);
        assert.deepEqual(await importOptions.evaluateAll(inputs => inputs.map(input => input.value)), expectedIds);
        assert.equal(await page.locator('#wb-panel input[name="wb-distillery"]:checked').count(), 4);
        assert.equal(await page.locator('#wb-panel input[name="wb-distillery"]:disabled').count(), 0);
        await page.locator('#wb-panel [data-act="wb-apply"]').click();
        const selectedIds = await page.locator('#bottling-form input[name="distilleryIds"]:checked')
            .evaluateAll(inputs => inputs.map(input => input.value));
        assert.deepEqual(new Set(selectedIds), new Set(expectedIds));
        await page.locator('#bottling-form button[type="submit"]').click();
        await page.locator('.section-head h2').filter({ hasText: 'Four-Distillery Blended Malt' }).waitFor();
        const saved = (await requestJson(base, '/api/collection')).data.bottlings
            .find(item => item.name === 'Four-Distillery Blended Malt');
        assert.ok(saved);
        assert.deepEqual(new Set(saved.distilleryIds), new Set(expectedIds));
    });
});

test('browser: create a bottling, read-only bottle context, edit and photo upload', async () => {
    await session(async ({ page, open, base }) => {
        await open();
        await page.locator('[data-act="new"]').first().click();
        await page.locator('[name="name"]').fill('UI Lifecycle');
        await page.locator('[name="firstInventoryNumber"]').fill('000321');
        await page.locator('#bottling-form button[type="submit"]').click();
        await page.waitForSelector('[data-act="edit-bottling"]');
        assert.equal(await page.locator('.section-head h2').innerText(), 'UI Lifecycle');
        await page.locator('[data-act="edit-bottle"]').click();
        assert.equal(await page.locator('.bottling-context-name').innerText(), 'UI Lifecycle');
        assert.equal(await page.locator('.bottling-context input, .bottling-context select').count(), 0);
        assert.equal(await page.locator('[name="inventoryNumber"]').count(), 1);
        await page.locator('[name="comment"]').fill('Edited from the browser');
        await page.locator('[name="photos"]').setInputFiles({
            name: 'test.png', mimeType: 'image/png',
            buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=', 'base64'),
        });
        await page.locator('#bottle-form button[type="submit"]').click();
        await page.waitForSelector('.photo-tile');
        // Photo previews must remain in this browser tab; the lightbox also
        // supports Escape, the large cover image and backdrop dismissal.
        await page.locator('.photo-tile [data-act="open-photo"]').click();
        await page.waitForSelector('.photo-lightbox-image');
        const viewerStyle = () => page.locator('.photo-lightbox-stage').evaluate(el => getComputedStyle(el).backgroundColor);
        const viewerBefore = await viewerStyle();
        await page.evaluate(() => {
            document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        });
        assert.notEqual(await viewerStyle(), viewerBefore, 'Photo viewer background must match the light/dark theme');
        assert.equal(await page.context().pages().length, 1, 'no extra browser tab');
        await page.keyboard.press('Escape');
        await page.waitForSelector('.photo-lightbox-image', { state: 'detached' });
        await page.locator('.hero-photo-open').click();
        await page.waitForSelector('.photo-lightbox-image');
        await page.locator('.overlay').click({ position: { x: 3, y: 3 } });
        await page.waitForSelector('.photo-lightbox-image', { state: 'detached' });
        const saved = await requestJson(base, '/api/collection');
        assert.equal(saved.data.bottlings[0].bottles[0].comment, 'Edited from the browser');
        assert.equal(saved.data.bottlings[0].bottles[0].photos.length, 1);
        assert.equal(saved.data.bottles, undefined);
    });
});
test('browser: Chrome pointer dragging reorders bottle photos without opening the viewer', async () => {
    await session(async ({ page, open, base }) => {
        const { bottling, bottle } = await seed(base, '000325');
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
        const photos = [];
        for (let i = 0; i < 3; i++) {
            const saved = await requestJson(base, `/api/bottles/${bottle.id}/photos`, 'POST', { image: png });
            assert.equal(saved.status, 201);
            photos.push(saved.data.id);
        }
        await open({ query: `?bottling=${bottling.id}` });
        const gallery = page.locator(`[data-photo-list="${bottle.id}"]`);
        await gallery.locator('[data-photo-tile]').first().waitFor();
        const order = () => gallery.locator('[data-photo-tile]')
            .evaluateAll(tiles => tiles.map(tile => tile.dataset.photoId));
        const drag = async (source, target) => {
            const start = await source.boundingBox();
            const end = await target.boundingBox();
            assert.ok(start && end);
            await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
            await page.mouse.down();
            await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
            await page.mouse.up();
        };
        // Dragging the handle must use the position under the pointer at release.
        await drag(gallery.locator('[data-photo-tile]').first().locator('[data-photo-drag]'),
            gallery.locator('[data-photo-tile]').last());
        await page.waitForFunction(expected => {
            const tiles = document.querySelectorAll('[data-photo-list] [data-photo-tile]');
            return JSON.stringify([...tiles].map(t => t.dataset.photoId)) === JSON.stringify(expected);
        }, [photos[1], photos[2], photos[0]]);
        assert.deepEqual(await order(), [photos[1], photos[2], photos[0]]);

        // Chrome starts native image dragging by default. Pointer-based thumbnail
        // dragging must save the order without opening the photo lightbox.
        await drag(gallery.locator('[data-photo-tile]').last().locator('.photo-open'),
            gallery.locator('[data-photo-tile]').first());
        await page.waitForFunction(expected => {
            const tiles = document.querySelectorAll('[data-photo-list] [data-photo-tile]');
            return JSON.stringify([...tiles].map(t => t.dataset.photoId)) === JSON.stringify(expected);
        }, [photos[0], photos[1], photos[2]]);
        assert.equal(await page.locator('.photo-lightbox-image').count(), 0);
        assert.deepEqual((await requestJson(base, '/api/collection')).data.bottlings[0].bottles[0]
            .photos.map(p => p.id), [photos[0], photos[1], photos[2]]);

        // Cancel a drag outside the gallery: no stale target should be saved.
        await drag(gallery.locator('[data-photo-tile]').first().locator('[data-photo-drag]'),
            page.locator('.section-head h2').first());
        assert.deepEqual(await order(), [photos[0], photos[1], photos[2]]);

        // A plain photo click still opens the lightbox after the drag.
        await gallery.locator('.photo-open').first().click();
        await page.locator('.photo-lightbox-image').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('.photo-lightbox-image').waitFor({ state: 'detached' });
    });
});

test('browser: new bottle can reuse an existing bottling or create a new one', async () => {
    await session(async ({ page, open, base }) => {
        const existing = await seed(base, '009100');
        await page.setViewportSize({ width: 390, height: 844 });
        await open();
        await page.locator('header [data-act="new"]').click();
        await page.waitForSelector('#new-bottle-choice-form');
        assert.equal(await page.evaluate(() => document.body.scrollWidth <= document.body.getBoundingClientRect().width + 1), true, 'mobile picker must not overflow');
        // Search does not silently create a second bottling or preselect a result.
        await page.locator('#bottling-choice-search').fill('nicht vorhanden');
        assert.equal(await page.locator('#bottling-choice-select option').count(), 1);
        await page.locator('#bottling-choice-search').fill('Browser Test');
        assert.equal(await page.locator('#bottling-choice-select option').count(), 2);
        assert.equal(await page.locator('#bottling-choice-select').inputValue(), '');
        await page.locator('#bottling-choice-select').selectOption(existing.bottling.id);
        await page.locator('#new-bottle-choice-form button[type="submit"]').click();
        await page.waitForSelector('#bottle-form[data-from-overview="1"]');
        assert.equal(await page.locator('.bottling-context-name').innerText(), 'Browser Test Blend');
        assert.equal(await page.locator('#bottle-form [name="name"]').count(), 0);
        await page.locator('#bottle-form [name="inventoryNumber"]').fill('009101');
        await page.locator('#bottle-form [name="status"]').selectOption('open');
        await page.locator('#bottle-form button[type="submit"]').click();
        await page.waitForSelector('.bottle-entry.scanned-bottle');
        const saved = (await requestJson(base, '/api/collection')).data;
        assert.equal(saved.bottlings.length, 1, 'same parent, no duplicate bottling');
        assert.equal(saved.bottlings[0].bottles.length, 2);
        assert.equal(saved.bottlings[0].bottles.find(bottle => bottle.inventoryNumber === '009101').status, 'open');
        await page.locator('header [data-act="new"]').click();
        await page.waitForSelector('#new-bottle-choice-form');
        await page.locator('[data-act="new-bottling-direct"]').click();
        await page.locator('#bottling-form [name="name"]').fill('Neues unabhängiges Produkt');
        await page.locator('#bottling-form [name="firstInventoryNumber"]').fill('009102');
        await page.locator('#bottling-form button[type="submit"]').click();
        await page.waitForSelector('.section-head h2');
        const next = (await requestJson(base, '/api/collection')).data;
        assert.equal(next.bottlings.length, 2, 'explicitly requested a new bottling');
        assert.ok(next.bottlings.some(bottling => bottling.name === 'Neues unabhängiges Produkt'));
    });
});

test('browser: a decoded inventory number opens details at the top, without edit mode', async () => {
    await session(async ({ page, base, open }) => {
        const data = await seed(base);
        let target;
        for (let index = 0; index < 8; index++) {
            const result = await requestJson(base, '/api/bottles', 'POST', {
                bottlingId: data.bottling.id, inventoryNumber: `TEST-${index}`
            });
            target = result.data;
        }
        await open();
        await mockDecoder(page);
        await page.locator('[data-act="scan"]').first().click();
        await page.waitForFunction(() => !!window.__decoded);
        await page.evaluate(number => window.__decoded(number), target.inventoryNumber);
        await page.waitForSelector(`#bottle-${target.id}.scanned-bottle`);
        assert.equal(await page.locator('.overlay').count(), 0);
        await page.waitForFunction(() => window.scrollY < 5);
        assert.ok(await page.evaluate(() => window.__stopped >= 1));
        assert.equal(await page.locator('.section-head h2').innerText(), 'Browser Test Blend');
    });
});
test('browser: scanning into an edit form retains the bottle ID and unsaved comment', async () => {
    await session(async ({ page, base, open }) => {
        const data = await seed(base);
        await open();
        await page.locator('.whisky-card').click();
        await page.locator('[data-act="edit-bottle"]').click();
        await page.locator('[name="comment"]').fill('Do not lose this text');
        await mockDecoder(page);
        await page.locator('[data-act="scan-into-bottle"]').click();
        await page.waitForFunction(() => !!window.__decoded);
        await page.evaluate(() => window.__decoded('008888'));
        await page.waitForSelector('#bottle-form');
        assert.equal(await page.locator('[name="inventoryNumber"]').inputValue(), '008888');
        assert.equal(await page.locator('[name="comment"]').inputValue(), 'Do not lose this text');
        assert.equal(await page.locator('#bottle-form').getAttribute('data-id'), data.bottle.id);
        await page.locator('#bottle-form button[type="submit"]').click();
        await page.waitForSelector('.overlay', {
            state: 'detached'
        });
        const saved = await requestJson(base, '/api/collection');
        assert.equal(saved.data.bottlings[0].bottles.length, 1);
        assert.equal(saved.data.bottlings[0].bottles[0].id, data.bottle.id);
        assert.equal(saved.data.bottlings[0].bottles[0].inventoryNumber, '008888');
    });
});
test('browser: the mobile header stays in one row at responsive widths', async () => {
    await session(async ({ page, open }) => {
        await open();
        await page.waitForSelector('.site-header .top-actions');
        for (const width of [320, 360, 390, 450, 600, 740, 900, 960]) {
            await page.setViewportSize({ width, height: 844 });
            const layout = await page.evaluate(() => {
                const brand = document.querySelector('.site-header .brand').getBoundingClientRect();
                const actions = document.querySelector('.site-header .top-actions').getBoundingClientRect();
                const header = document.querySelector('.site-header').getBoundingClientRect();
                const buttons = [...document.querySelectorAll('.site-header .top-actions > button')];
                return {
                    brandRight: brand.right, actionsLeft: actions.left,
                    brandCenter: brand.top + brand.height / 2,
                    actionsCenter: actions.top + actions.height / 2,
                    headerHeight: header.height,
                    buttons: buttons.map(button => ({
                        visible: getComputedStyle(button).display !== 'none',
                        top: button.getBoundingClientRect().top,
                        height: button.getBoundingClientRect().height,
                    })),
                    overflow: document.body.scrollWidth > document.body.getBoundingClientRect().width + 1,
                };
            });
            assert.equal(layout.buttons.length, 4, `All four header actions retained at ${width}px`);
            assert.ok(layout.buttons.every(button => button.visible && button.height >= 40), `Buttons are usable at ${width}px`);
            assert.ok(layout.brandRight + 2 <= layout.actionsLeft, `No brand/button overlap at ${width}px`);
            assert.ok(Math.abs(layout.brandCenter - layout.actionsCenter) < 3, `Brand and actions in same row at ${width}px`);
            assert.ok(layout.buttons.every(button => Math.abs(button.top - layout.buttons[0].top) < 1), `All actions in same row at ${width}px`);
            assert.ok(layout.headerHeight <= (width <= 380 ? 66 : width <= 740 ? 74 : 82), `Compact mobile header at ${width}px`);
            assert.equal(layout.overflow, false, `No horizontal overflow at ${width}px`);
        }
        assert.equal(await page.locator('header [data-act="scan"]').getAttribute('aria-label'), 'Inventar scannen');
        assert.equal(await page.locator('header [data-act="new"]').getAttribute('aria-label'), 'Neue Flasche');
        assert.equal(await page.locator('header [data-act="settings"]').count(), 0);
        assert.equal(await page.locator('header [data-act="scan"] .scan-icon').isVisible(), true);
        assert.equal(await page.locator('header [data-act="new"] .new-icon').isVisible(), true);
        assert.equal(await page.locator('header [data-act="new"]').evaluate(el => el.firstElementChild.tagName), 'svg');
    });
});
test('browser: persistent scrollbar track keeps centered content stationary', async t => {
    // Playwright's default --hide-scrollbars makes a centering regression
    // undetectable. Run this case with visible classic scrollbars instead.
    const scrollbarBrowser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
        headless: true,
        ignoreDefaultArgs: ['--hide-scrollbars'],
        args: process.env.CI || domOnly ? ['--no-sandbox'] : [],
    });
    try {
        await session(async ({ page, open }) => {
            await open();
            await page.setViewportSize({ width: 1366, height: 900 });
            await page.evaluate(() => {
                document.querySelector('#app').style.display = 'none';
                document.body.style.minHeight = '0';
                const probe = document.createElement('div');
                probe.id = 'scrollbar-layout-probe';
                probe.style.cssText = 'width:600px;max-width:100%;margin:0 auto;height:1px';
                document.body.appendChild(probe);
            });
            const measure = () => page.evaluate(() => ({
                overflowY: getComputedStyle(document.documentElement).overflowY,
                clientWidth: document.body.getBoundingClientRect().width,
                left: document.querySelector('#scrollbar-layout-probe').getBoundingClientRect().left,
                scrollHeight: document.documentElement.scrollHeight,
                viewportHeight: window.innerHeight,
            }));
            const shortPage = await measure();
            assert.equal(shortPage.overflowY, 'scroll');
            assert.ok(shortPage.scrollHeight <= shortPage.viewportHeight);
            await page.evaluate(() => {
                const filler = document.createElement('div');
                filler.id = 'scrollbar-layout-filler';
                filler.style.height = '3000px';
                document.body.appendChild(filler);
            });
            const longPage = await measure();
            assert.ok(longPage.scrollHeight > longPage.viewportHeight);
            // Prove the browser has a physical scrollbar before claiming a pass.
            await page.evaluate(() => { document.documentElement.style.overflowY = 'auto'; });
            const autoLong = await measure();
            await page.evaluate(() => document.querySelector('#scrollbar-layout-filler').remove());
            const autoShort = await measure();
            if (autoLong.clientWidth === autoShort.clientWidth) {
                t.skip('Browser uses overlay/hidden scrollbars; no measurable scrollbar width');
                return;
            }
            assert.ok(autoLong.clientWidth < autoShort.clientWidth, 'Classic scrollbar reduces usable width');
            assert.notEqual(autoLong.left, autoShort.left, 'Without reserved scrollbar track centered content must shift');
            await page.evaluate(() => { document.documentElement.style.overflowY = ''; });
            assert.equal((await measure()).left, shortPage.left);
            assert.equal(shortPage.clientWidth, longPage.clientWidth, 'Permanent scrollbar track holds layout width');
            assert.equal(shortPage.left, longPage.left, 'Permanent scrollbar track prevents centering shift');
        }, scrollbarBrowser);
    } finally {
        await scrollbarBrowser.close();
    }
});
test('browser: mobile and desktop share theme SVGs and keep clear logo spacing', async () => {
    await session(async ({ page, open }) => {
        await open();
        const themeButton = page.locator('header [data-act="toggle-theme"]');
        const measure = async () => page.evaluate(() => {
            const logo = document.querySelector('.brand-emblem').getBoundingClientRect();
            const text = document.querySelector('.brand-copy').getBoundingClientRect();
            const brand = document.querySelector('.brand').getBoundingClientRect();
            const actions = document.querySelector('.top-actions').getBoundingClientRect();
            const icon = document.querySelector('header [data-act="toggle-theme"] svg');
            return {
                gap: text.left - logo.right,
                brandRight: brand.right,
                actionsLeft: actions.left,
                overflow: document.body.scrollWidth > document.body.getBoundingClientRect().width + 1,
                iconSize: icon.getBoundingClientRect().width,
            };
        });
        const initialTheme = await page.locator('html').getAttribute('data-theme');
        const firstSvg = await themeButton.locator('svg').evaluate(svg => svg.outerHTML);
        await themeButton.click();
        const secondSvg = await themeButton.locator('svg').evaluate(svg => svg.outerHTML);
        assert.notEqual(secondSvg, firstSvg, 'Sun and moon must have distinct shapes');
        await themeButton.click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), initialTheme);
        for (const width of [1366, 960, 740, 450, 390, 360, 320]) {
            await page.setViewportSize({ width, height: 844 });
            const layout = await measure();
            assert.ok(layout.gap >= (width <= 380 ? 7 : width <= 450 ? 9 : 8), `Logo-to-wordmark spacing at ${width}px: ${layout.gap}px`);
            assert.ok(layout.brandRight + 1 <= layout.actionsLeft, `No overlap at ${width}px`);
            assert.equal(layout.overflow, false, `No horizontal overflow at ${width}px`);
            assert.equal(layout.iconSize, 19, `Identical icon size at ${width}px`);
            assert.equal(await themeButton.locator('svg').evaluate(svg => svg.outerHTML), firstSvg, `First theme icon is identical at ${width}px`);
            await themeButton.click();
            assert.equal(await themeButton.locator('svg').evaluate(svg => svg.outerHTML), secondSvg, `Opposite theme icon is identical at ${width}px`);
            await themeButton.click();
        }
    });
});
test('browser: header actions match hero; settings live only in the rightmost menu', async () => {
    await session(async ({ page, open }) => {
        await open();
        await page.waitForSelector('.hero-actions');
        for (const [action, label] of [['new', 'Neue Flasche'], ['scan', 'Inventar scannen']]) {
            const headerButton = page.locator(`header [data-act="${action}"]`);
            const heroButton = page.locator(`.hero-actions [data-act="${action}"]`);
            assert.equal(await headerButton.locator('span').innerText(), label);
            assert.equal(await heroButton.locator('span').innerText(), label);
            assert.equal(await headerButton.getAttribute('aria-label'), label);
            assert.equal(await heroButton.getAttribute('aria-label'), label);
            assert.equal(await headerButton.locator('svg').evaluate(svg => svg.outerHTML), await heroButton.locator('svg').evaluate(svg => svg.outerHTML));
        }
        assert.equal(await page.locator('header [data-act="settings"]').count(), 0);
        const buttons = await page.locator('.top-actions > button').evaluateAll(items => items.map(item => item.dataset.act));
        assert.deepEqual(buttons, ['toggle-theme', 'scan', 'new', 'toggle-menu']);
        await page.locator('#menu-button').click();
        const settings = page.locator('#site-drawer [data-act="goto-settings-menu"]');
        assert.equal(await settings.isVisible(), true);
        assert.equal(await settings.locator('svg > path').count(), 1, 'settings menu uses shared gear outline');
        assert.equal(await settings.locator('svg > circle').count(), 1, 'settings gear retains center circle');
        await settings.click();
        await page.getByRole('heading', { name: 'Einstellungen & Datensicherung' }).waitFor();
        assert.equal(await page.locator('.settings-heading .eyebrow.dark').innerText(), 'DEINE SAMMLUNG VERWALTEN');
        assert.equal(await page.locator('.settings-heading .heading-period').innerText(), '.');
        assert.equal(await page.locator('.settings-heading [data-act="goto-home"]').count(), 1);
        await page.setViewportSize({ width: 390, height: 844 });
        const settingsOverflow = await page.evaluate(() => document.body.scrollWidth - document.body.getBoundingClientRect().width);
        assert.ok(settingsOverflow <= 1, `Settings header must not overflow on mobile (${settingsOverflow}px)`);
        assert.equal(await page.locator('#menu-button').isVisible(), true);
        await page.locator('#menu-button').click();
        assert.equal(await page.locator('#site-drawer [data-act="goto-settings-menu"]').isVisible(), true);
    });
});
test('browser: both themes and a narrow mobile layout render without page overflow', async () => {
    await session(async ({ page, open }) => {
        await open();
        await page.waitForSelector('.collection-hero');
        await page.screenshot({
            path: 'test-artifacts/desktop-light.png'
        });
        const beforeTheme = await page.locator('html').getAttribute('data-theme');
        await page.locator('[data-act="toggle-theme"]').click();
        assert.notEqual(await page.locator('html').getAttribute('data-theme'), beforeTheme);
        await page.screenshot({
            path: 'test-artifacts/desktop-dark.png'
        });
        const sampleHeroBackground = () => page.locator('.hero-overlay').evaluate(el => getComputedStyle(el).backgroundImage);
        const heroBefore = await sampleHeroBackground();
        assert.match(heroBefore, /rgba\(7, 20, 33, 0\.84\)/, 'Hero overlay must stay dark');
        await page.locator('[data-act="toggle-theme"]').click();
        assert.equal(await sampleHeroBackground(), heroBefore, 'Hero overlay must stay dark when the theme changes');
        await page.setViewportSize({
            width: 390, height: 844
        });
        assert.equal(await page.locator('header [data-act="settings"]').count(), 0, 'settings are menu-only');
        assert.equal(await page.locator('#menu-button').isVisible(), true);
        const mobileTheme = page.locator('[data-act="toggle-theme"]');
        assert.equal(await mobileTheme.isVisible(), true, 'The mobile theme toggle must be visible');
        const mobileThemeBefore = await page.locator('html').getAttribute('data-theme');
        await mobileTheme.click();
        assert.notEqual(await page.locator('html').getAttribute('data-theme'), mobileThemeBefore);
        const heroGap = await page.evaluate(() => {
            const buttons = document.querySelector('.hero-actions').getBoundingClientRect();
            const footnote = document.querySelector('.hero-footnote').getBoundingClientRect();
            return footnote.top - buttons.bottom;
        });
        assert.ok(heroGap >= 18, `The EST label must be separated from buttons (gap: ${heroGap}px)`);
        await page.screenshot({
            path: 'test-artifacts/mobile-dark.png'
        });
        assert.ok(await page.evaluate(() => document.body.scrollWidth <= document.body.getBoundingClientRect().width + 1));
    });
});
test('browser: cards have equal heights per current grid row, but different rows can differ', async () => {
    await session(async ({ page, base, open }) => {
        const names = [
            'A ' + 'Besonders langer Whiskyname mit mehreren Worten und vielen Angaben '.repeat(3).trim(),
            'B Kurz', 'C Kurz', 'D Kurz', 'E Kurz', 'F Kurz', 'G Kurz', 'H Kurz',
        ];
        for (let index = 0; index < names.length; index++) {
            const result = await requestJson(base, '/api/bottlings', 'POST', {
                name: names[index], ageYears: 12,
                firstBottle: { inventoryNumber: `GRID-${index}`, status: 'closed' },
            });
            assert.equal(result.status, 201);
        }
        await open();
        await page.waitForFunction(() => document.querySelectorAll('.whisky-card').length === 8);
        // The same eight DOM cards must reflow into 4/3/2/1 columns without changing the page size.
        for (const [width, expectedColumns] of [[1366, 4], [900, 3], [740, 2], [390, 2], [320, 1]]) {
            await page.setViewportSize({ width, height: 900 });
            const layout = await page.evaluate(() => {
                const grid = document.querySelector('.grid');
                const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
                const rows = [];
                for (const card of grid.querySelectorAll('.whisky-card')) {
                    const rect = card.getBoundingClientRect();
                    let row = rows.find(r => Math.abs(r.top - rect.top) < 1);
                    if (!row) { row = { top: rect.top, heights: [], cards: [] }; rows.push(row); }
                    row.heights.push(rect.height);
                    row.cards.push(card.querySelector('h3').textContent);
                }
                const first = grid.querySelector('.whisky-card');
                const title = first.querySelector('h3').getBoundingClientRect();
                const facts = first.querySelector('.card-facts').getBoundingClientRect();
                return { columns, rows, gap: facts.top - title.bottom };
            });
            assert.equal(layout.columns, expectedColumns, `Grid columns at ${width}px`);
            assert.equal(layout.rows.flatMap(row => row.cards).length, 8);
            for (const row of layout.rows) {
                assert.ok(Math.max(...row.heights) - Math.min(...row.heights) < 1,
                    `${width}px: cards in the same grid row must have equal heights: ${row.heights}`);
            }
            assert.ok(layout.rows[0].heights[0] > layout.rows[1].heights[0] + 10,
                `${width}px: the first (long-title) row must not force its height onto later rows`);
            assert.ok(layout.gap >= 0 && layout.gap < 10,
                `${width}px: title and facts should stay close (${layout.gap}px)`);
        }
    });
});

test('browser: founding year and bottler fallback work in home, table and detail after reload', async () => {
    await session(async ({ page, open, base }) => {
        const created = await requestJson(base, '/api/bottlings', 'POST', {
            name: 'Independent bottling', bottler: 'Signatory Vintage', distilleryIds: [],
            firstBottle: { inventoryNumber: '009998', status: 'open' }
        });
        assert.equal(created.status, 201);
        await open();
        await page.locator('.whisky-card').waitFor();
        assert.match(await page.locator('.whisky-card .card-kicker').textContent(), /Signatory Vintage/);
        const stats = await page.locator('.stats').textContent();
        assert.match(stats, /Geöffnet/);
        assert.match(stats, /Geschlossen/);
        assert.ok(stats.indexOf('Geschlossen') < stats.indexOf('Geöffnet'), 'Geschlossen must come first');
        assert.doesNotMatch(stats, /Unvollständig/);
        const footerGap = await page.evaluate(() => {
            const pager = document.querySelector('.collection-pagination').getBoundingClientRect();
            const footer = document.querySelector('.site-footer').getBoundingClientRect();
            return footer.top - pager.bottom;
        });
        assert.ok(footerGap <= 55, `Footer must follow pagination without excessive whitespace (${footerGap}px)`);
        await page.locator('[data-act="toggle-view"]').click();
        assert.match(await page.locator('tbody tr').innerText(), /Signatory Vintage/);
        await page.locator('tbody tr').click();
        await page.locator('.detail-heading-meta').waitFor();
        assert.match(await page.locator('.detail-heading-meta').textContent(), /Signatory Vintage/);
        await page.locator('button[data-act="back"]').first().click();
        await openSettingsFromMenu(page);
        await page.locator('#established-year').fill('1992');
        await page.locator('#collection-settings-form button[type="submit"]').click();
        await page.getByText('Gründungsjahr gespeichert', { exact: true }).waitFor();
        assert.equal(await page.locator('#established-year').inputValue(), '1992');
        await page.locator('button[data-act="goto-home"]').first().click();
        await page.locator('.hero-footnote').waitFor();
        assert.match(await page.locator('.hero-footnote').innerText(), /COLLECTION · EST\. 1992/);
        if (!domOnly) {
            await page.reload();
            await page.locator('.hero-footnote').waitFor();
            assert.match(await page.locator('.hero-footnote').innerText(), /COLLECTION · EST\. 1992/);
        }
    });
});

test('browser: real back/forward navigation and direct reload', {
    skip: domOnly ? 'Managed environment: only DOM mode available; history controller is unit-tested separately' : false
}, async () => {
    await session(async ({ page, base, open }) => {
        const data = await seed(base);
        await open();
        await page.locator('.whisky-card').click();
        await page.waitForURL(`**/?bottling=${data.bottling.id}`);
        await openSettingsFromMenu(page);
        await page.waitForURL('**/?view=settings');
        await page.goBack();
        await page.waitForSelector('[data-act="edit-bottling"]');
        await page.goForward();
        await page.waitForURL('**/?view=settings');
        await page.getByRole('heading', { name: 'Einstellungen & Datensicherung' }).waitFor();
        // The legacy JSON import is intentionally hidden in a closed <details>.
        // Verify that it can be opened instead of waiting for a hidden input.
        await page.locator('details:has(#import-file) > summary').click();
        await page.locator('#import-file').waitFor({ state: 'visible' });
        await page.goto(`${base}/?bottling=${data.bottling.id}`);
        await page.reload();
        await page.waitForSelector('[data-act="edit-bottling"]');
        assert.equal(await page.locator('.section-head h2').innerText(), 'Browser Test Blend');
    });
});

test('browser: overview and detail mark individual samples, not the bottling itself', async () => {
    await session(async ({ page, open, base }) => {
        const created = await seed(base);
        const sample = await requestJson(base, '/api/bottles', 'POST', {
            bottlingId: created.bottling.id, inventoryNumber: '000124', volumeType: 'sample', volumeMl: 30
        });
        assert.equal(sample.status, 201);
        await open();
        await page.waitForSelector('.whisky-card .badge.sample');
        const badges = page.locator('.whisky-card .card-body > .badges');
        assert.match(await badges.innerText(), /1 Standardflasche/);
        assert.match(await badges.innerText(), /1 Sample/);
        assert.doesNotMatch(await badges.innerText(), /2 Flaschen/);
        await page.locator('[data-act="toggle-view"]').click();
        const tableCounts = page.locator('tbody .inventory-badges');
        assert.match(await tableCounts.innerText(), /1 Standardflasche/);
        assert.match(await tableCounts.innerText(), /1 Sample/);
        assert.doesNotMatch(await tableCounts.innerText(), /2 Flaschen/);
        await page.locator('tbody tr').first().click();
        await page.waitForSelector(`#bottle-${sample.data.id} .badge.sample`);
        assert.equal(await page.locator(`#bottle-${created.bottle.id} .badge.sample`).count(), 0);
        assert.match(await page.locator(`#bottle-${sample.data.id}`).innerText(), /30 ml/);
        // The sample badge must not touch the status badge or show a border.
        for (const theme of ['light', 'dark']) {
            const metrics = await page.evaluate(({ id, theme }) => {
                document.documentElement.dataset.theme = theme;
                const info = document.getElementById(`bottle-${id}`);
                const status = info.querySelector('.info > strong > .badge.closed');
                const sample = info.querySelector('.info > strong > .badge.sample');
                const statusRect = status.getBoundingClientRect();
                const sampleRect = sample.getBoundingClientRect();
                return {
                    gap: sampleRect.left - statusRect.right,
                    borderWidth: getComputedStyle(sample).borderTopWidth,
                };
            }, { id: sample.data.id, theme });
            assert.ok(metrics.gap >= 10, `${theme}: gap must be at least 10px, got ${metrics.gap}px`);
            assert.equal(metrics.borderWidth, '0px', `${theme}: sample badge must have no border`);
        }
        await page.locator(`#bottle-${sample.data.id} [data-act="edit-bottle"]`).click();
        assert.equal(await page.locator('#bottle-form [name="volumeType"]').inputValue(), 'sample');
        assert.equal(await page.locator('#bottle-form [name="volumeMl"]').inputValue(), '30');
    });
});

test('browser: upload and remove invoice for one physical bottle', async () => {
    await session(async ({ page, base, open }) => {
        const data = await seed(base, '000931');
        await open();
        await page.locator('.whisky-card').click();
        const files = page.locator(`#bottle-${data.bottle.id} input[data-bottle-files]`);
        await files.setInputFiles({
            name: 'Rechnung.pdf', mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4\n%%EOF\n')
        });
        await page.waitForSelector(`#bottle-${data.bottle.id} .document-list a`);
        assert.equal(await page.locator('.document-list a').innerText(), 'Rechnung.pdf');
        const saved = (await requestJson(base, '/api/collection')).data;
        assert.equal(saved.bottlings[0].bottles[0].files.length, 1);
        const link = page.locator('.document-list a');
        assert.match(await link.getAttribute('href'), new RegExp(`/api/bottles/${data.bottle.id}/files/`));
        await page.locator(`#bottle-${data.bottle.id} [data-act="delete-file"]`).click();
        await page.locator('.overlay [data-act="confirm-action"]').click();
        await page.waitForSelector('.document-list', { state: 'detached' });
        const after = (await requestJson(base, '/api/collection')).data;
        assert.deepEqual(after.bottlings[0].bottles[0].files, []);
    });
});

test('browser: six bottlings still use four columns on desktop', async () => {
    await session(async ({ page, base, open }) => {
        const collection = (await requestJson(base, '/api/collection')).data;
        collection.bottlings = Array.from({ length: 6 }, (_, index) => ({
            id: `six-${index + 1}`,
            name: `Six Malt ${index + 1}`,
            distilleryIds: [], bottles: [],
            createdAt: '2026-11-06T08:00:00.000Z',
        }));
        assert.equal((await requestJson(base, '/api/import/json', 'POST', collection)).status, 200);
        await open();
        assert.equal(await page.locator('.whisky-card').count(), 6);
        assert.equal(await page.locator('.grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
        assert.equal(await page.locator('#pagination-size').inputValue(), '24');
    });
});

test('browser: selected entries per page survive F5 in both collection modes', async () => {
    if (domOnly) return; // Actual F5 requires navigation, not the DOM-only test harness.
    await session(async ({ page, base, open }) => {
        const source = await requestJson(base, '/api/collection');
        const collection = source.data;
        collection.bottlings = Array.from({ length: 75 }, (_, index) => ({
            id: `persist-${index + 1}`,
            name: `Malt ${index + 1}`,
            distilleryIds: [], bottles: [{
                id: `bottle-persist-${index + 1}`,
                inventoryNumber: String(index + 1), status: 'closed',
            }],
            createdAt: '2026-11-06T08:00:00.000Z',
        }));
        assert.equal((await requestJson(base, '/api/import/json', 'POST', collection)).status, 200);
        await open();
        await page.locator('#pagination-size').selectOption('48');
        assert.equal(await page.locator('.whisky-card').count(), 48);
        assert.equal(await page.evaluate(() => localStorage.getItem('whisky-page-size')), '48');
        await page.reload();
        await page.locator('#pagination-size').waitFor();
        assert.equal(await page.locator('#pagination-size').inputValue(), '48');
        assert.equal(await page.locator('.whisky-card').count(), 48);
        await page.locator('[data-collection-mode="bottles"]').click();
        assert.equal(await page.locator('#pagination-size').inputValue(), '48');
        await page.reload();
        await page.locator('#pagination-size').waitFor();
        assert.equal(await page.locator('#pagination-size').inputValue(), '48');
        await page.locator('#pagination-size').selectOption('12');
        await page.reload();
        await page.locator('#pagination-size').waitFor();
        assert.equal(await page.locator('#pagination-size').inputValue(), '12');
        assert.equal(await page.locator('.whisky-card').count(), 12);
    });
});

test('browser: 450 bottlings keep a fixed page size with only divisor-friendly grid widths', async () => {
    await session(async ({ page, base, open }) => {
        const source = await requestJson(base, '/api/collection');
        const collection = source.data;
        collection.bottlings = Array.from({ length: 450 }, (_, index) => ({
            id: `bulk-${String(index + 1).padStart(4, '0')}`,
            name: `Malt ${String(index + 1).padStart(4, '0')}`,
            distilleryIds: [],
            bottles: [],
            createdAt: '2026-11-06T08:00:00.000Z',
        }));
        const result = await requestJson(base, '/api/import/json', 'POST', collection);
        assert.equal(result.status, 200);
        await open();
        await page.waitForSelector('.collection-pagination');
        await page.waitForFunction(() => document.querySelectorAll('.whisky-card').length === 24);
        assert.equal(await page.locator('.grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
        assert.equal(await page.locator('.whisky-card').count(), 24);
        assert.match(await page.locator('.pagination-topline').innerText(), /Seite 1 von 19/);
        assert.equal(await page.locator('#pagination-size').inputValue(), '24');

        // 24 remains 24 even when the grid changes 2 -> 3 -> 4 columns.
        for (const [width, columns] of [[390, 2], [820, 3], [1366, 4], [1660, 4], [360, 1]]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(await page.locator('.grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), columns);
            assert.equal(await page.locator('.whisky-card').count(), 24);
        }

        // The numbered last page and the "Letzte Seite" button both target page 19.
        // Select the numbered button by its unique accessible name.
        await page.locator('.pagination-pages [aria-label="Seite 19"]').click();
        assert.equal(await page.locator('.whisky-card').count(), 18);
        assert.equal(await page.locator('.grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1);
        assert.match(await page.locator('.pagination-topline').innerText(), /433–450 von 450/);
        if (domOnly) {
            assert.ok(await page.evaluate(() => window.__historyCalls.some(call => call.url === '/?page=19')));
        } else {
            await page.waitForURL('**/?page=19');
        }
        await page.setViewportSize({ width: 1660, height: 900 });
        assert.equal(await page.locator('.grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
        await page.locator('#search').fill('Malt 044');
        // Search leaves 10 results, not necessarily a complete row; no six-column squeeze.
        assert.equal(await page.locator('.whisky-card').count(), 10);
        assert.equal(await page.locator('.grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
        await page.locator('#search').fill('Malt 0450');
        assert.equal(await page.locator('.whisky-card').count(), 1);
        assert.match(await page.locator('.whisky-card').innerText(), /Malt 0450/);
        assert.equal(await page.locator('.pagination-summary').innerText(), '1–1 von 1 Abfüllungen');
        await page.locator('#search').fill('');
        await page.locator('[data-act="toggle-view"]').click();
        assert.equal(await page.locator('tbody tr').count(), 24, 'table respects the same fixed 24 entries');
        await page.locator('[data-act="toggle-view"]').click();
        assert.equal(await page.locator('#pagination-size').inputValue(), '24');
        await page.locator('#pagination-size').selectOption('48');
        assert.equal(await page.locator('.whisky-card').count(), 48);
        await page.locator('#pagination-size').selectOption('12');
        assert.equal(await page.locator('.whisky-card').count(), 12);
        await page.locator('#pagination-size').selectOption('24');
        await page.locator('.pagination-pages [aria-label="Seite 19"]').click();
        assert.match(await page.locator('.pagination-topline').innerText(), /433–450 von 450/);
        assert.equal(await page.locator('.whisky-card').count(), 18);
    });
});

test('browser: distillery management stays compact and uses app dialogs for create and rename', async () => {
    await session(async ({ page, base, open }) => {
        await open();
        await openSettingsFromMenu(page);
        await page.waitForSelector('.distillery-list');
        const metrics = await page.locator('.distillery-list').evaluate(el => ({
            height: el.getBoundingClientRect().height,
            maxHeight: parseFloat(getComputedStyle(el).maxHeight),
            scrolling: getComputedStyle(el).overflowY,
        }));
        assert.ok(metrics.height <= metrics.maxHeight + 1, 'list must not grow taller than its cap');
        assert.equal(metrics.scrolling, 'auto');
        await page.locator('#distillery-search').fill('Ardbeg');
        assert.equal(await page.locator('.distillery-row:visible').count(), 1);
        assert.match(await page.locator('#distillery-count').innerText(), /1 von/);
        await page.locator('.distillery-row:visible [data-act="rename-distillery"]').click();
        assert.equal(await page.locator('#distillery-name').inputValue(), 'Ardbeg');
        const labelGaps = await page.locator('#distillery-form').evaluate(form => {
            const nameBottom = form.querySelector('#distillery-name').getBoundingClientRect().bottom;
            const statusLabel = form.querySelector('#distillery-status').closest('label');
            const statusBottom = form.querySelector('#distillery-status').getBoundingClientRect().bottom;
            const coordinatesLabel = form.querySelector('#distillery-latitude').closest('label');
            return [statusLabel.getBoundingClientRect().top - nameBottom,
                coordinatesLabel.getBoundingClientRect().top - statusBottom];
        });
        assert.ok(labelGaps.every(gap => gap >= 12), `distillery labels need vertical separation: ${labelGaps}`);
        await page.locator('#distillery-name').fill('Ardbeg Test Edition');
        await page.locator('#distillery-form button[type="submit"]').click();
        await page.waitForSelector('.overlay', { state: 'detached' });
        await page.locator('#distillery-search').fill('Ardbeg Test Edition');
        assert.equal(await page.locator('.distillery-row:visible').count(), 1);
        const renamed = (await requestJson(base, '/api/collection')).data.distilleries;
        assert.ok(renamed.some(d => d.name === 'Ardbeg Test Edition'));
        await page.locator('[data-act="add-distillery"]').first().click();
        await page.locator('#distillery-name').fill('Sample New Distillery');
        await page.locator('#distillery-form button[type="submit"]').click();
        await page.waitForSelector('.overlay', { state: 'detached' });
        assert.ok((await requestJson(base, '/api/collection')).data.distilleries.some(d => d.name === 'Sample New Distillery'));
    });
});

test('browser: adding a distillery within a bottling form restores unsaved fields and selected files', async () => {
    await session(async ({ page, open }) => {
        await open();
        await page.locator('[data-act="new"]').first().click();
        await page.locator('#bottling-form [name="name"]').fill('My unfinished bottling');
        await page.locator('#bottling-form [name="brand"]').fill('My unfinished brand');
        await page.locator('#bottling-form [name="firstPhotos"]').setInputFiles({
            name: 'snapshot.png', mimeType: 'image/png',
            buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=', 'base64'),
        });
        await page.locator('#bottling-form [data-act="add-distillery"]').click();
        await page.waitForSelector('#distillery-form');
        assert.equal(await page.locator('#bottling-form').count(), 0, 'parent form must be temporarily suspended');
        await page.locator('#distillery-name').fill('New Distillery in Draft');
        await page.locator('#distillery-form button[type="submit"]').click();
        await page.waitForSelector('#bottling-form');
        assert.equal(await page.locator('#bottling-form [name="name"]').inputValue(), 'My unfinished bottling');
        assert.equal(await page.locator('#bottling-form [name="brand"]').inputValue(), 'My unfinished brand');
        assert.equal(await page.locator('#bottling-form [name="firstPhotos"]').evaluate(el => el.files[0]?.name), 'snapshot.png');
        const selection = page.locator('#bottling-form .distillery-option').filter({ hasText: 'New Distillery in Draft' });
        assert.equal(await selection.locator('input:checked').count(), 1);
    });
});

test('browser: existing overview photos keep a visible gap above the divider', async () => {
    await session(async ({ page, open, base }) => {
        const { bottle } = await seed(base, '000912');
        await requestJson(base, `/api/bottles/${bottle.id}/photos`, 'POST', {
            image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=',
        });
        await open();
        for (const width of [1366, 390, 350]) {
            await page.setViewportSize({ width, height: 850 });
            const spacing = await page.locator('.card-img img:not(.image-placeholder)').evaluate(el => {
                const image = getComputedStyle(el);
                const card = el.closest('.card-img');
                const rule = getComputedStyle(card, '::after');
                return { padding: parseFloat(image.paddingBottom), ruleBottom: parseFloat(rule.bottom) };
            });
            // The line is 13px from the card bottom; the image padding must be
            // greater than that to avoid any visible pixels touching the line.
            assert.ok(spacing.padding - spacing.ruleBottom >= 8, `${width}px: photo needs >8px gap above rule`);
        }
    });
});

test('browser: switch between bottlings and physical bottles, filter, navigate and restore the mode', async () => {
    await session(async ({ page, base, open }) => {
        const created = await seed(base, '000701');
        const added = await requestJson(base, '/api/bottles', 'POST', {
            bottlingId: created.bottling.id, inventoryNumber: '000702',
            volumeType: 'sample', volumeMl: 50, status: 'open',
        });
        assert.equal(added.status, 201);
        const photo = await requestJson(base, `/api/bottles/${created.bottle.id}/photos`, 'POST', {
            image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=',
        });
        assert.equal(photo.status, 201);
        await open();
        assert.equal(await page.locator('.whisky-card').count(), 1);
        const head = page.locator('.collection-heading');
        assert.equal(await head.locator('.collection-mode-toggle').count(), 1);
        assert.equal(await page.locator('.collection-mode-toggle').count(), 1);
        for (const width of [320, 390, 740, 900, 1366]) {
            await page.setViewportSize({ width, height: 850 });
            const layout = await head.locator('.collection-mode-toggle').evaluate((el) => {
                const rect = el.getBoundingClientRect();
                const stats = document.querySelector('.stats').getBoundingClientRect();
                return { left: rect.left, right: rect.right, bottom: rect.bottom, statsTop: stats.top };
            });
            assert.ok(layout.left >= 0 && layout.right <= width + 1, `${width}px: toggle must fit the viewport`);
            assert.ok(layout.bottom <= layout.statsTop, `${width}px: toggle must stay above statistics`);
        }
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.locator('[data-collection-mode="bottles"]').click();
        assert.equal(await page.locator('.whisky-card').count(), 2);
        const firstSrc = await page.locator(`.whisky-card[data-bottle-id="${created.bottle.id}"] .card-img img`).getAttribute('src');
        const secondSrc = await page.locator(`.whisky-card[data-bottle-id="${added.data.id}"] .card-img img`).getAttribute('src');
        assert.ok(firstSrc && !firstSrc.includes('photo-placeholder'), 'The first bottle has its own photo');
        assert.equal(secondSrc, firstSrc, 'A bottle without its own photo uses the bottling cover');
        assert.equal(await page.locator('[data-collection-mode="bottles"]').getAttribute('aria-pressed'), 'true');
        assert.match(await page.locator('.grid').innerText(), /000701/);
        assert.match(await page.locator('.grid').innerText(), /000702/);
        if (!domOnly) {
            assert.equal(new URL(page.url()).searchParams.get('mode'), 'bottles');
            await page.goBack();
            assert.equal(await page.locator('.whisky-card').count(), 1);
            await page.goForward();
            assert.equal(await page.locator('.whisky-card').count(), 2);
            await page.reload();
            assert.equal(await page.locator('.whisky-card').count(), 2);
        }
        await page.locator('#filter-status').selectOption('open');
        assert.equal(await page.locator('.whisky-card').count(), 1);
        assert.match(await page.locator('.whisky-card').innerText(), /000702/);
        await page.locator('#filter-status').selectOption('all');
        await page.locator('#search').fill('000701');
        assert.equal(await page.locator('.whisky-card').count(), 1);
        assert.match(await page.locator('.whisky-card').innerText(), /000701/);
        await page.locator('#search').fill('');
        await page.locator('[data-act="toggle-view"]').click();
        assert.equal(await page.locator('tbody tr[data-bottle-id]').count(), 2);
        assert.match(await page.locator('thead').innerText(), /Flasche/i);
        await page.locator('[data-act="toggle-view"]').click();
        await page.locator(`.whisky-card[data-bottle-id="${added.data.id}"]`).click();
        await page.waitForSelector(`#bottle-${added.data.id}.scanned-bottle`);
        await page.locator('[data-act="back"]').first().click();
        assert.equal(await page.locator('.whisky-card').count(), 2);
        assert.equal(await page.locator('[data-collection-mode="bottles"]').getAttribute('aria-pressed'), 'true');
        await page.locator('[data-collection-mode="bottlings"]').click();
        assert.equal(await page.locator('.whisky-card').count(), 1);
    });
});

test('browser: overview quick filters list only used distilleries and combine standard bottles and samples', async () => {
    await session(async ({ page, base, open }) => {
        const catalog = (await requestJson(base, '/api/collection')).data.distilleries;
        const first = catalog.find(item => item.name === 'Kilchoman');
        const second = catalog.find(item => item.name === 'Aberfeldy');
        assert.ok(first && second);
        for (const [name, id, number] of [
            ['Quickfilter Kilchoman', first.id, '086001'],
            ['Quickfilter Aberfeldy', second.id, '086002'],
        ]) {
            const created = await requestJson(base, '/api/bottlings', 'POST', {
                name, distilleryIds: [id], firstBottle: { inventoryNumber: number, status: 'closed' },
            });
            assert.equal(created.status, 201);
            if (id === first.id) {
                const added = await requestJson(base, '/api/bottles', 'POST', {
                    bottlingId: created.data.bottling.id, inventoryNumber: '086003',
                    volumeType: 'sample', status: 'open',
                });
                assert.equal(added.status, 201);
            }
        }
        await open();
        assert.deepEqual(await page.locator('#filter-distillery option').allTextContents(),
            ['Alle Destillerien', 'Aberfeldy', 'Kilchoman']);
        await page.locator('#filter-distillery').selectOption(first.id);
        await page.locator('#filter-volume-type').selectOption('sample');
        assert.equal(await page.locator('.whisky-card').count(), 1);
        assert.match(await page.locator('.whisky-card').innerText(), /Quickfilter Kilchoman/);
        await page.locator('#filter-status').selectOption('closed');
        assert.equal(await page.locator('.whisky-card').count(), 0,
            'the closed standard bottle must not qualify as a closed sample');
        await page.locator('#filter-status').selectOption('open');
        assert.equal(await page.locator('.whisky-card').count(), 1);
        await page.locator('[data-collection-mode="bottles"]').click();
        assert.equal(await page.locator('#filter-distillery').inputValue(), first.id);
        assert.equal(await page.locator('#filter-volume-type').inputValue(), 'sample');
        assert.equal(await page.locator('.whisky-card').count(), 1);
        assert.match(await page.locator('.whisky-card').innerText(), /086003/);
        await page.locator('#filter-volume-type').selectOption('standard');
        assert.equal(await page.locator('.whisky-card').count(), 0);
        await page.locator('#filter-status').selectOption('all');
        assert.equal(await page.locator('.whisky-card').count(), 1);
        assert.match(await page.locator('.whisky-card').innerText(), /086001/);
        await page.locator('[data-act="toggle-view"]').click();
        assert.equal(await page.locator('tbody tr').count(), 1);
        await page.locator('#filter-distillery').selectOption(second.id);
        assert.match(await page.locator('tbody').innerText(), /086002/);
        for (const width of [320, 390, 1366]) {
            await page.setViewportSize({ width, height: 850 });
            const overflow = await page.evaluate(() => document.body.scrollWidth - document.body.getBoundingClientRect().width);
            assert.ok(overflow <= 1, `${width}px: overview quick filters must not overflow`);
            const layout = await page.locator('.toolbar').evaluate(toolbar => {
                const controls = [...toolbar.children];
                return controls.map(element => ({
                    tag: element.tagName, top: element.getBoundingClientRect().top,
                    height: element.getBoundingClientRect().height,
                }));
            });
            assert.deepEqual(layout.map(item => item.tag),
                ['INPUT', 'SELECT', 'SELECT', 'SELECT', 'SELECT', 'SELECT', 'BUTTON']);
            assert.ok(layout.every(item => Math.abs(item.height - 44) <= 1),
                `${width}px: all controls including view switch must be 44px high`);
            if (width === 1366) {
                assert.ok(layout.every(item => Math.abs(item.top - layout[0].top) <= 1),
                    'desktop: all five selectors, search and view switch must share the first toolbar row');
            }
        }
    });
});



test('browser: horizontal overflow check detects an 8px overflow with a reserved scrollbar track', async () => {
    await session(async ({ page, open }) => {
        await open();
        await page.setViewportSize({ width: 320, height: 900 });
        const measurement = await page.evaluate(() => {
            // The browser may report the full viewport through clientWidth even
            // though the real body layout ends at the scrollbar track.
            const body = document.body;
            const usableWidth = body.getBoundingClientRect().width;
            const normalOverflow = body.scrollWidth - usableWidth;
            const probe = document.createElement('div');
            // Use an in-flow box: absolute positioning can make scrollWidth
            // measurements differ between the root and body scroll containers.
            probe.style.cssText = `display:block;width:${usableWidth + 8}px;height:1px;pointer-events:none`;
            body.append(probe);
            const withOverflow = body.scrollWidth - body.getBoundingClientRect().width;
            const visualExcess = probe.getBoundingClientRect().right - body.getBoundingClientRect().right;
            probe.remove();
            return { usableWidth, normalOverflow, withOverflow, visualExcess };
        });
        assert.ok(measurement.usableWidth > 0 && measurement.usableWidth <= 320);
        assert.ok(measurement.normalOverflow <= 1, `Baseline layout overflow: ${JSON.stringify(measurement)}`);
        assert.ok(measurement.visualExcess >= 7,
            `Probe must extend 8px beyond the usable body layout: ${JSON.stringify(measurement)}`);
        assert.ok(measurement.withOverflow >= 7,
            `8px overflow must be detected with a reserved scrollbar track: ${JSON.stringify(measurement)}`);
    });
});

test('browser: map and collection use the same full-width content frame, right drawer and unified return button', async () => {
    await session(async ({ page, open }) => {
        await open();
        await page.locator('.collection-hero').waitFor({ state: 'visible' });
        for (const width of [320, 390, 740, 1024, 1366, 1660]) {
            await page.setViewportSize({ width, height: 900 });
            const homeFrame = await page.evaluate(() => {
                const main = document.querySelector('main').getBoundingClientRect();
                const hero = document.querySelector('.collection-hero').getBoundingClientRect();
                return { left: main.left, right: main.right, width: main.width,
                    viewportContentWidth: document.body.getBoundingClientRect().width,
                    contentLeft: hero.left, contentRight: hero.right,
                    overflow: document.body.scrollWidth - document.body.getBoundingClientRect().width };
            });
            // The root's clientWidth can still include the reserved scrollbar track
            // while the body's layout box excludes it. Measure that actual
            // layout box: it is what main { width: 100% } fills.
            assert.ok(Math.abs(homeFrame.width - Math.min(homeFrame.viewportContentWidth, 1350)) <= 1,
                `${width}px: collection main should fill usable width ${homeFrame.viewportContentWidth}, got ${homeFrame.width}`);
            assert.ok(homeFrame.viewportContentWidth <= width && homeFrame.viewportContentWidth > 0,
                `${width}px: browser content viewport should fit within the window`);
            assert.ok(homeFrame.overflow <= 1, `${width}px: collection must not overflow`);

            await page.locator('#menu-button').click();
            const drawer = await page.locator('#site-drawer').evaluate(el => {
                const rect = el.getBoundingClientRect();
                const backdrop = document.querySelector('.site-drawer-backdrop').getBoundingClientRect();
                return { left: rect.left, right: rect.right, width: rect.width,
                    backdropRight: backdrop.right, layoutRight: document.body.getBoundingClientRect().right };
            });
            // A fixed element can end at the gutter boundary, not innerWidth.
            // It must align with its backdrop and remain at the usable right edge.
            assert.ok(Math.abs(drawer.right - drawer.backdropRight) <= 1,
                `${width}px: menu drawer must align with fixed backdrop right edge: ${JSON.stringify(drawer)}`);
            assert.ok(drawer.right >= drawer.layoutRight - 1 && drawer.right <= width + 1,
                `${width}px: menu drawer must stay on the right, including the scrollbar gutter: ${JSON.stringify(drawer)}`);
            assert.ok(drawer.left >= -1, `${width}px: drawer must remain inside viewport`);
            assert.equal(await page.locator('#menu-button').getAttribute('aria-expanded'), 'true');
            await page.locator('#site-drawer [data-act="goto-map"]').click();
            await page.locator('.map-layout').waitFor({ state: 'visible' });
            assert.equal(await page.locator('#site-drawer').isVisible(), false);

            const mapFrame = await page.evaluate(() => {
                const main = document.querySelector('main').getBoundingClientRect();
                const layout = document.querySelector('.map-layout').getBoundingClientRect();
                const map = document.querySelector('.map-stage').getBoundingClientRect();
                const sidebar = document.querySelector('.map-sidebar').getBoundingClientRect();
                const actualGridColumns = getComputedStyle(document.querySelector('.map-layout')).gridTemplateColumns.split(' ').length;
                return { left: main.left, right: main.right, width: main.width,
                    contentLeft: layout.left, contentRight: layout.right,
                    mapRight: map.right, sidebarLeft: sidebar.left, sidebarRight: sidebar.right,
                    mapTop: map.top, sidebarTop: sidebar.top, actualGridColumns,
                    overflow: document.body.scrollWidth - document.body.getBoundingClientRect().width };
            });
            for (const field of ['left', 'right', 'width']) {
                assert.ok(Math.abs(mapFrame[field] - homeFrame[field]) <= 1,
                    `${width}px: map and collection ${field} differ: ${mapFrame[field]} vs ${homeFrame[field]}`);
            }
            assert.ok(Math.abs(mapFrame.contentLeft - homeFrame.contentLeft) <= 1,
                `${width}px: map content must align with collection content left edge`);
            assert.ok(Math.abs(mapFrame.contentRight - homeFrame.contentRight) <= 1,
                `${width}px: map content must align with collection content right edge`);
            if (width > 950) {
                assert.equal(mapFrame.actualGridColumns, 2, `${width}px: preserve two-column map layout`);
                assert.ok(mapFrame.mapRight + 5 < mapFrame.sidebarLeft, `${width}px: separate map and sidebar`);
                assert.ok(Math.abs(mapFrame.mapTop - mapFrame.sidebarTop) <= 1,
                    `${width}px: the map and info panel remain side by side`);
                assert.ok(Math.abs(mapFrame.sidebarRight - mapFrame.contentRight) <= 1);
            } else {
                assert.equal(mapFrame.actualGridColumns, 1, `${width}px: stack the layout on smaller displays`);
            }
            assert.ok(mapFrame.overflow <= 1, `${width}px: map must not overflow`);
            const mapBack = page.locator('main .section-head > .btn');
            assert.equal(await mapBack.innerText(), '← Zur Sammlung');
            assert.equal(await mapBack.getAttribute('data-act'), 'goto-home');
            await mapBack.click();
            await page.locator('.collection-hero').waitFor({ state: 'visible' });
        }
        await page.locator('#menu-button').click();
        await page.locator('#site-drawer [data-act="goto-settings-menu"]').click();
        await page.getByRole('heading', { name: 'Einstellungen & Datensicherung' }).waitFor();
        const settingsBack = page.locator('main .section-head > .btn');
        assert.equal(await settingsBack.innerText(), '← Zur Sammlung');
        assert.equal(await settingsBack.getAttribute('data-act'), 'goto-home');
        await settingsBack.click();
        await page.locator('.collection-hero').waitFor({ state: 'visible' });
    });
});

test('browser: map can toggle every catalogued distillery and show pagoda markers for empty sites', async () => {
    await session(async ({ page, open, base }) => {
        const catalog = (await requestJson(base, '/api/collection')).data.distilleries;
        const kilchoman = catalog.find(site => site.name === 'Kilchoman');
        const aberfeldy = catalog.find(site => site.name === 'Aberfeldy');
        assert.ok(kilchoman && aberfeldy);
        const added = await requestJson(base, '/api/bottlings', 'POST', {
            name: 'Only Kilchoman', distilleryIds: [kilchoman.id],
            firstBottle: { inventoryNumber: '088601', status: 'closed' },
        });
        assert.equal(added.status, 201);
        await open();
        await page.locator('[data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        const toggle = page.getByRole('switch', { name: 'Alle Destillerien anzeigen' });
        assert.equal(await toggle.isChecked(), false);
        assert.equal(await page.locator('#map-site-select option').count(), 1);
        assert.equal(await page.locator('.map-marker-pagoda').count(), 0);
        assert.equal(await page.locator('.map-marker').count(), 1);
        assert.equal(await page.locator('.map-zoom-level').innerText(), 'Zoom 11');

        await toggle.check();
        assert.equal(await page.locator('#map-site-select option').count(), catalog.length);
        assert.equal(await page.locator('.map-marker-pagoda .map-pagoda-icon').count() > 0, true);
        assert.equal(await page.locator('.map-legend .map-pagoda-icon').count(), 2, 'active and closed distilleries have distinct legend icons');
        assert.ok(await page.locator('.map-marker-cluster').count() > 0, 'all-sites overview must cluster nearby distilleries');
        assert.ok((await page.locator('.map-legend').innerText()).includes('Gruppiert'));
        assert.match(await page.locator('.map-legend-empty').innerText(), /^Ohne Flaschen\s+Aktiv\s+Geschlossen$/);
        const clusterLegend = page.locator('.map-legend .map-cluster-legend-icon.map-cluster-visual');
        assert.equal(await clusterLegend.count(), 1, 'legend must reuse the actual cluster appearance');
        assert.equal(await clusterLegend.innerText(), '6', 'legend example shows a group, not a single distillery');
        assert.equal(await page.locator('.map-markers .map-marker-cluster.map-cluster-visual').count() > 0, true);
        assert.equal(await clusterLegend.evaluate(el => getComputedStyle(el).backgroundColor),
            await page.locator('.map-markers .map-marker-cluster.map-cluster-visual:not(.selected)').first()
                .evaluate(el => getComputedStyle(el).backgroundColor),
            'cluster and legend icon use the same cluster background');
        const legendSections = await page.locator('.map-legend-section').evaluateAll(nodes => nodes.map(node => node.classList[1]));
        assert.deepEqual(legendSections, ['map-legend-status', 'map-legend-empty', 'map-legend-stock', 'map-legend-clusters'],
            'both status sections are adjacent, followed by the size scale and groups');
        assert.equal(await page.locator('.map-legend .map-legend-status-icon').count(), 2,
            'stocked active and closed sites have distinct legend symbols');
        assert.equal(await page.locator('.map-legend .map-legend-status-icon.map-marker-closed').count(), 1,
            'closed stocked marker uses the dashed closed marker class');
        const stockLegend = page.locator('.map-legend .map-legend-stock-icon');
        assert.equal(await stockLegend.count(), 3, 'only the three stock size samples 1, 10, 100 are shown');
        const sampleSizes = await stockLegend.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().width)));
        assert.deepEqual(sampleSizes, [21, 27, 37], 'legend samples use compact proportional diameters');
        assert.equal(Math.round((await clusterLegend.boundingBox()).width), 27,
            'group sample should remain compact while live groups keep their map sizes');
        assert.deepEqual(await stockLegend.allInnerTexts(), ['1', '10', '100'],
            'bottle counts are displayed inside their markers, as on the map');
        // At the worldwide overview zoom, even the sole stocked distillery can
        // be inside a cluster with unstocked sites. Do not require a separate
        // stocked marker until we explicitly focus that distillery below.
        for (const theme of ['light', 'dark']) {
            await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
            const legendStyle = await clusterLegend.evaluate(el => ({
                background: getComputedStyle(el).backgroundColor,
                border: getComputedStyle(el).borderTopColor,
                color: getComputedStyle(el).color,
            }));
            const markerStyle = await page.locator('.map-markers .map-marker-cluster:not(.selected)').first().evaluate(el => ({
                background: getComputedStyle(el).backgroundColor,
                border: getComputedStyle(el).borderTopColor,
                color: getComputedStyle(el).color,
            }));
            assert.deepEqual(legendStyle, markerStyle, `cluster icon must match the map marker in ${theme} mode`);
            const clusterGeometry = await clusterLegend.evaluate(el => ({
                radius: getComputedStyle(el).borderRadius,
                shape: getComputedStyle(el).clipPath,
            }));
            const liveClusterGeometry = await page.locator('.map-markers .map-marker-cluster:not(.selected)').first().evaluate(el => ({
                radius: getComputedStyle(el).borderRadius,
                shape: getComputedStyle(el).clipPath,
            }));
            assert.deepEqual(clusterGeometry, { radius: '50%', shape: 'none' }, 'cluster sample must be round');
            assert.deepEqual(clusterGeometry, liveClusterGeometry, `round cluster appearance matches in ${theme} mode`);
            const statusStyles = await page.locator('.map-legend-status-icon').evaluateAll(nodes => nodes.map(el => ({
                background: getComputedStyle(el).backgroundColor,
                border: getComputedStyle(el).borderTopColor,
                borderStyle: getComputedStyle(el).borderTopStyle,
            })));
            const liveStock = await page.evaluate(() => {
                // The only stocked map marker may be selected, so compare against
                // an unselected live-style reference rather than selection gold.
                const marker = document.createElement('span');
                marker.className = 'map-marker map-stock-visual';
                document.body.append(marker);
                const style = getComputedStyle(marker);
                const result = { background: style.backgroundColor, border: style.borderTopColor, borderStyle: style.borderTopStyle };
                marker.remove();
                return result;
            });
            assert.deepEqual(statusStyles[0], liveStock, `active stocked legend uses live marker style in ${theme} mode`);
            assert.equal(statusStyles[1].borderStyle, 'dashed', `closed stocked legend shows dashed outline in ${theme} mode`);
            assert.notEqual(statusStyles[0].background, statusStyles[1].background,
                `closed and active stocked markers are distinguishable in ${theme} mode`);
            for (const legendIcon of await page.locator('.map-legend .map-legend-marker, .map-legend .map-pagoda-icon').all()) {
                const decoration = await legendIcon.evaluate(el => ({
                    boxShadow: getComputedStyle(el).boxShadow,
                    filter: getComputedStyle(el).filter,
                    textShadow: getComputedStyle(el).textShadow,
                }));
                assert.deepEqual(decoration, { boxShadow: 'none', filter: 'none', textShadow: 'none' },
                    `legend example has no glow or shadow in ${theme} mode`);
            }
        }
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
        assert.ok(await page.locator('#map-site-select option').count() === catalog.length, 'all sites stay individually selectable');
        const allZoom = Number((await page.locator('.map-zoom-level').innerText()).replace('Zoom ', ''));
        assert.ok(allZoom < 11, 'showing all distilleries must fit a wider geographic area');
        await page.locator('#map-site-select').selectOption(aberfeldy.id);
        const emptyMarker = page.locator('.map-marker-pagoda[aria-label^="Aberfeldy:"]');
        await emptyMarker.waitFor({ state: 'visible' });
        assert.match(await page.locator('.map-site-heading').innerText(), /0 Abfüllungen · 0 Flaschen/);
        assert.equal(await page.locator('.map-empty-site').isVisible(), true);
        assert.equal(await page.locator('#map-bottling-search').count(), 0);
        await emptyMarker.click();
        assert.equal(await page.locator('#map-site-select').inputValue(), aberfeldy.id);

        // A focused stocked distillery must be shown as an individual marker,
        // even if it was previously aggregated in a worldwide overview.
        await page.locator('#map-site-select').selectOption(kilchoman.id);
        const stockedMarker = page.locator('.map-markers .map-marker.map-stock-visual[aria-label^="Kilchoman:"]');
        await stockedMarker.waitFor({ state: 'visible' });
        assert.match(await stockedMarker.getAttribute('aria-label'), /1 Flaschen/);

        await page.setViewportSize({ width: 390, height: 820 });
        assert.equal(await page.getByRole('switch', { name: 'Alle Destillerien anzeigen' }).isVisible(), true);
        const overflow = await page.evaluate(() => document.body.scrollWidth - document.body.getBoundingClientRect().width);
        assert.ok(overflow <= 1, `mobile map layer causes overflow: ${overflow}px`);

        await page.getByRole('switch', { name: 'Alle Destillerien anzeigen' }).uncheck();
        assert.equal(await page.locator('#map-site-select option').count(), 1);
        assert.equal(await page.locator('.map-marker-pagoda').count(), 0);
        assert.equal(await page.locator('.map-marker[aria-label^="Kilchoman:"]').count(), 1);
        assert.equal(await page.locator('.map-zoom-level').innerText(), 'Zoom 11');
    });
});

test('browser: zoom-dependent clusters expand on click while keeping the underlying distillery records', async () => {
    await session(async ({ page, open, base }) => {
        const list = (await requestJson(base, '/api/collection')).data.distilleries;
        const ardbeg = list.find(site => site.name === 'Ardbeg');
        const lagavulin = list.find(site => site.name === 'Lagavulin');
        assert.ok(ardbeg && lagavulin);
        for (const [site, inventory] of [[ardbeg, '088711'], [lagavulin, '088712']]) {
            const added = await requestJson(base, '/api/bottlings', 'POST', {
                name: `Cluster ${site.name}`, distilleryIds: [site.id],
                firstBottle: { inventoryNumber: inventory, status: 'closed' },
            });
            assert.equal(added.status, 201);
            if (site.id === ardbeg.id) {
                for (const inventoryNumber of ['088713', '088714']) {
                    const extra = await requestJson(base, '/api/bottles', 'POST', {
                        bottlingId: added.data.bottling.id, inventoryNumber, status: 'closed',
                    });
                    assert.equal(extra.status, 201);
                }
            }
        }
        await open();
        await page.locator('[data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        assert.equal(await page.locator('#map-site-select option').count(), 2);
        const zoomOut = page.getByRole('button', { name: 'Karte verkleinern' });
        for (let i = 0; i < 12 && await page.locator('.map-marker-cluster').count() === 0; i++) await zoomOut.click();
        const cluster = page.locator('.map-marker-cluster');
        await cluster.waitFor({ state: 'visible' });
        assert.equal(await cluster.innerText(), '4', 'cluster marker sums three Ardbeg and one Lagavulin bottles');
        assert.match(await cluster.getAttribute('aria-label'), /4 Flaschen · 2 Destillerien/);
        const initialZoom = Number((await page.locator('.map-zoom-level').innerText()).replace('Zoom ', ''));
        await cluster.click();
        const nextZoom = Number((await page.locator('.map-zoom-level').innerText()).replace('Zoom ', ''));
        assert.equal(nextZoom, Math.min(initialZoom + 2, 16), 'clicking a group zooms towards it');
        const zoomIn = page.getByRole('button', { name: 'Karte vergrößern' });
        for (let i = nextZoom; i < 16; i++) await zoomIn.click();
        assert.equal(await page.locator('.map-marker-cluster').count(), 0, 'no clusters may remain at maximum zoom');
        assert.equal(await page.locator('#map-site-select option').count(), 2);
        await page.locator('#map-site-select').selectOption(lagavulin.id);
        assert.match(await page.locator('.map-site-heading').innerText(), /Lagavulin/);
        assert.equal(await page.locator('.map-marker[aria-label^="Lagavulin:"]').count(), 1,
            'selecting a distillery must still expose its individual marker');
    });
});

test('browser: map menu, location-based aggregation, responsive fit and detail link', async () => {
    await session(async ({ page, open, base }) => {
        const list = (await requestJson(base, '/api/collection')).data.distilleries;
        const kilchoman = list.find(d => d.name === 'Kilchoman');
        const ardbeg = list.find(d => d.name === 'Ardbeg');
        assert.ok(kilchoman && ardbeg);
        for (const [name, id, count] of [['Map Kilchoman A', kilchoman.id, 3], ['Map Kilchoman B', kilchoman.id, 1], ['Map Ardbeg', ardbeg.id, 1]]) {
            const response = await requestJson(base, '/api/bottlings', 'POST', {
                name, distilleryIds: [id],
                ...(name === 'Map Kilchoman A' ? { ageYears: 8, abv: 46.2, distillationYear: 2012, bottlingYear: 2020 } : {}),
                firstBottle: { inventoryNumber: String(800 + count + name.length), status: 'closed' },
            });
            assert.equal(response.status, 201);
            for (let i = 1; i < count; i++) {
                const extra = await requestJson(base, '/api/bottles', 'POST', { bottlingId: response.data.bottling.id, inventoryNumber: `${name.length}${i}99`, status: 'closed' });
                assert.equal(extra.status, 201);
            }
        }
        await page.setViewportSize({ width: 390, height: 820 });
        await open();
        await page.locator('[data-act="toggle-menu"]').click();
        assert.equal(await page.locator('#site-drawer').isVisible(), true);
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        await page.locator('.map-marker').first().waitFor({ state: 'visible' });
        assert.equal(await page.locator('#site-drawer').isVisible(), false);
        assert.equal(await page.locator('.map-marker').count(), 2);
        const marker = page.locator('.map-marker[aria-label^="Kilchoman:"]');
        assert.match(await marker.getAttribute('aria-label'), /2 Abfüllungen, 4 Flaschen/);
        assert.match(await page.locator('.map-zoom-level').innerText(), /Zoom (?:8|9|10|11|12)/);
        assert.equal(await page.locator('.map-attribution').isVisible(), true);
        await page.locator('#map-site-select').selectOption(kilchoman.id);
        assert.equal(await page.locator('.map-position-edit .action-icon').count(), 1);
        const editRect = await page.locator('.map-site-title').evaluate(el => {
            const name = el.querySelector('strong').getBoundingClientRect();
            const button = el.querySelector('button').getBoundingClientRect();
            return { nameRight: name.right, buttonLeft: button.left, nameTop: name.top, buttonTop: button.top, buttonWidth: button.width };
        });
        assert.ok(editRect.buttonLeft > editRect.nameRight - 1 && editRect.buttonWidth <= 36);
        assert.ok(Math.abs(editRect.buttonTop - editRect.nameTop) < 15);
        assert.equal(await page.locator('.map-missing').count(), 0, 'hide missing section when all map sites are located');
        assert.doesNotMatch(await page.locator('.map-summary').innerText(), /ohne Standort/);
        assert.doesNotMatch(await page.locator('.map-legend').innerText(), /62 px/);
        await page.locator('.map-position-edit').click();
        assert.equal(await page.locator('#distillery-latitude').inputValue(), '55.7869', 'catalog location must prefill edit dialog');
        await page.locator('[data-act="close-modal"]').last().click();
        assert.equal(await page.locator('.map-bottling-link').count(), 2);
        const annotated = page.locator('.map-bottling-link').filter({ hasText: 'Map Kilchoman A' });
        assert.equal(await annotated.locator('.map-bottling-facts').innerText(), '8 Jahre · 46,2 % Vol. · Dest. 2012 · Abgef. 2020');
        assert.match(await annotated.innerText(), /3 Flaschen/);
        assert.equal(await page.locator('.map-bottling-facts').count(), 1, 'missing metadata does not render empty placeholder');
        await page.locator('#map-bottling-search').fill('Kilchoman B');
        assert.equal(await page.locator('.map-bottling-link').count(), 1);
        await page.locator('.map-bottling-link').first().click();
        await page.locator('[data-act="edit-bottling"]').waitFor({ state: 'visible' });
        assert.match(await page.locator('.section-head h2').first().innerText(), /Map Kilchoman B/);
        await page.locator('[data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        await page.locator('[data-map-control="fit"]').click();
        assert.equal(await page.locator('.map-marker').count(), 2);
        const overflow = await page.evaluate(() => document.body.scrollWidth - document.body.getBoundingClientRect().width);
        assert.ok(overflow <= 1, `mobile horizontal overflow: ${overflow}px`);
    });
});

test('browser: unknown distillery can be positioned in app and large per-site list is paginated', async () => {
    await session(async ({ page, open, base }) => {
        const added = await requestJson(base, '/api/distilleries', 'POST', { name: 'Private Test Destillery' });
        assert.equal(added.status, 201);
        for (let i = 0; i < 15; i++) {
            const response = await requestJson(base, '/api/bottlings', 'POST', {
                name: `Unlocated Whisky ${String(i).padStart(2, '0')}`,
                distilleryIds: [added.data.id],
                firstBottle: { inventoryNumber: String(90500 + i), status: 'closed' },
            });
            assert.equal(response.status, 201);
        }
        await open();
        await page.locator('[data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        if (!(await page.locator('.map-missing').evaluate(details => details.open))) await page.locator('.map-missing summary').click();
        const edit = page.locator(`[data-map-edit="${added.data.id}"]`).first();
        await edit.click();
        await page.locator('#distillery-latitude').fill('55.7869');
        await page.locator('#distillery-longitude').fill('-6.4308');
        await page.locator('#distillery-form button[type="submit"]').click();
        await page.locator('.overlay').waitFor({ state: 'detached' });
        assert.equal((await requestJson(base, '/api/collection')).data.distilleries.find(d => d.id === added.data.id).latitude, 55.7869);
        const marker = page.locator('.map-marker[aria-label^="Private Test Destillery:"]');
        await marker.waitFor({ state: 'visible' });
        await page.locator('#map-site-select').selectOption(added.data.id);
        assert.equal(await page.locator('.map-bottling-link').count(), 12);
        await page.locator('[data-map-page="next"]').click();
        assert.equal(await page.locator('.map-bottling-link').count(), 3);
        assert.match(await page.locator('.map-list-pager').innerText(), /Seite 2 von 2/);
    });
});


test('browser: editing map coordinates keeps zoom and recenters only after a position change', async () => {
    await session(async ({ page, open, base }) => {
        const distilleries = (await requestJson(base, '/api/collection')).data.distilleries;
        const ardbeg = distilleries.find(site => site.name === 'Ardbeg');
        const kilchoman = distilleries.find(site => site.name === 'Kilchoman');
        assert.ok(ardbeg && kilchoman);
        for (const [distillery, number] of [[ardbeg, '071411'], [kilchoman, '071412']]) {
            const created = await requestJson(base, '/api/bottlings', 'POST', {
                name: `Map position edit ${distillery.name}`,
                distilleryIds: [distillery.id],
                firstBottle: { inventoryNumber: number, status: 'closed' },
            });
            assert.equal(created.status, 201);
        }
        await open();
        await page.locator('[data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        await page.locator('#map-site-select').selectOption(ardbeg.id);
        await page.locator('[data-map-control="in"]').click();
        await page.locator('[data-map-control="in"]').click();
        const zoomBefore = await page.locator('.map-zoom-level').innerText();
        assert.ok(Number(zoomBefore.replace('Zoom ', '')) >= 12);

        await page.locator('.map-position-edit').click();
        await page.locator('#distillery-latitude').fill('55.7101');
        await page.locator('#distillery-longitude').fill('-6.2202');
        await page.locator('#distillery-form button[type="submit"]').click();
        await page.locator('.overlay').waitFor({ state: 'detached' });
        assert.equal(await page.locator('.map-zoom-level').innerText(), zoomBefore,
            'saving an edited location must never refit all map points');
        assert.equal(await page.locator('#map-site-select').inputValue(), ardbeg.id);
        const marker = page.locator('.map-marker[aria-label^="Ardbeg:"]');
        const position = await marker.evaluate(element => {
            const marker = element.getBoundingClientRect();
            const view = document.querySelector('.map-viewport').getBoundingClientRect();
            return { x: marker.left + marker.width / 2 - view.left - view.width / 2,
                y: marker.top + marker.height / 2 - view.top - view.height / 2 };
        });
        assert.ok(Math.abs(position.x) < 3 && Math.abs(position.y) < 3,
            `corrected location should be centered at the original zoom: ${JSON.stringify(position)}`);
        assert.equal((await requestJson(base, '/api/collection')).data.distilleries
            .find(site => site.id === ardbeg.id).latitude, 55.7101);

        // A metadata-only edit must not shift the map, and must preserve zoom.
        // Retain the same DOM node; rebuilding the viewer can lose the exact camera.
        await page.locator('#distillery-map').evaluate(element => { element.dataset.cameraIdentity = 'keep'; });
        await page.locator('[data-map-control="out"]').click();
        const zoomAfterOut = await page.locator('.map-zoom-level').innerText();
        const viewport = await page.locator('.map-viewport').boundingBox();
        await page.mouse.move(viewport.x + viewport.width / 2 + 110, viewport.y + viewport.height / 2 + 65);
        await page.mouse.down();
        await page.mouse.move(viewport.x + viewport.width / 2 + 165, viewport.y + viewport.height / 2 + 90, { steps: 5 });
        await page.mouse.up();
        const displaced = await page.locator('.map-marker[aria-label^="Ardbeg:"]').evaluate(element => {
            const marker = element.getBoundingClientRect();
            const view = document.querySelector('.map-viewport').getBoundingClientRect();
            return { x: marker.left + marker.width / 2 - view.left - view.width / 2,
                y: marker.top + marker.height / 2 - view.top - view.height / 2 };
        });
        assert.ok(Math.abs(displaced.x) > 25, 'dragging should move the marker away from center');
        await page.locator('.map-position-edit').click();
        await page.locator('#distillery-status').selectOption('closed');
        await page.locator('#distillery-form button[type="submit"]').click();
        await page.locator('.overlay').waitFor({ state: 'detached' });
        assert.equal(await page.locator('.map-zoom-level').innerText(), zoomAfterOut);
        assert.equal(await page.locator('#distillery-map').getAttribute('data-camera-identity'), 'keep',
            'a metadata edit should update map markers without remounting the map viewer');
        assert.equal(await page.locator('#map-site-select').inputValue(), ardbeg.id);
        const samePosition = await page.locator('.map-marker[aria-label^="Ardbeg:"]').evaluate(element => {
            const marker = element.getBoundingClientRect();
            const view = document.querySelector('.map-viewport').getBoundingClientRect();
            return { x: marker.left + marker.width / 2 - view.left - view.width / 2,
                y: marker.top + marker.height / 2 - view.top - view.height / 2 };
        });
        assert.ok(Math.abs(samePosition.x - displaced.x) < 3 && Math.abs(samePosition.y - displaced.y) < 3,
            'a status-only edit must preserve the panned map center');
    });
});

test('browser: OSM tiles switch theme and wheel zoom holds cursor geography', async () => {
    await session(async ({ page, base, open }) => {
        const catalog = (await requestJson(base, '/api/collection')).data.distilleries;
        for (const [name, number] of [['Kilchoman', '071301'], ['Ardbeg', '071302']]) {
            const distillery = catalog.find(site => site.name === name);
            assert.ok(distillery, `${name} should be in the catalog`);
            const added = await requestJson(base, '/api/bottlings', 'POST', {
                name: `Wheel test ${name}`,
                distilleryIds: [distillery.id],
                firstBottle: { inventoryNumber: number, status: 'closed' },
            });
            assert.equal(added.status, 201);
        }
        await open();
        await page.locator('[data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        const marker = page.locator('.map-marker[aria-label^="Kilchoman:"]');
        await marker.waitFor({ state: 'visible' });
        const themeStyle = () => page.evaluate(() => ({
            theme: document.documentElement.dataset.theme,
            filter: getComputedStyle(document.querySelector('.map-tiles')).filter,
            mapBackground: getComputedStyle(document.querySelector('.map-canvas')).backgroundColor,
            markerFilter: getComputedStyle(document.querySelector('.map-marker')).filter,
            controlsBg: getComputedStyle(document.querySelector('.map-controls button')).backgroundColor,
        }));
        const initial = await themeStyle();
        await page.locator('[data-act="toggle-theme"]').click();
        const toggled = await themeStyle();
        assert.notEqual(toggled.theme, initial.theme, 'theme switch must work without leaving the map');
        assert.notEqual(toggled.filter, initial.filter, 'OSM tiles must change appearance');
        const darker = initial.theme === 'dark' ? initial : toggled;
        const lighter = initial.theme === 'light' ? initial : toggled;
        assert.match(darker.filter, /invert\(0\.91\).*brightness\(1\.02\).*contrast\(0\.96\)/,
            'dark OSM palette must remain readable and brighter than the old map style');
        assert.equal(lighter.filter, 'none', 'light OSM tiles must be unfiltered');
        assert.notEqual(toggled.mapBackground, initial.mapBackground, 'map loading background must follow theme');
        assert.notEqual(toggled.controlsBg, initial.controlsBg, 'map controls must follow theme');
        assert.equal(toggled.markerFilter, 'none', 'markers must not be colour-inverted');
        await page.locator('[data-act="toggle-theme"]').click();
        assert.deepEqual(await themeStyle(), initial, 'switching back restores the original map style');

        const rectCenter = async () => marker.evaluate(element => {
            const r = element.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        const initialMarker = await rectCenter();
        const initialZoom = Number((await page.locator('.map-zoom-level').innerText()).replace('Zoom ', ''));
        await page.mouse.move(initialMarker.x, initialMarker.y);
        await page.mouse.wheel(0, -160);
        await page.waitForFunction(before => document.querySelector('.map-zoom-level')?.textContent === `Zoom ${before + 1}`, initialZoom);
        const afterIn = await rectCenter();
        assert.ok(Math.abs(afterIn.x - initialMarker.x) < 2 && Math.abs(afterIn.y - initialMarker.y) < 2,
            `wheel under marker moved anchored location: ${JSON.stringify({ initialMarker, afterIn })}`);

        // Zooming out around a point next to the marker must scale the marker's
        // distance to the pointer by 1/2, not use the map's screen centre.
        const viewport = await page.locator('.map-viewport').boundingBox();
        const pointer = {
            x: Math.min(viewport.x + viewport.width - 12, afterIn.x + 45),
            y: Math.min(viewport.y + viewport.height - 12, afterIn.y + 35),
        };
        await page.mouse.move(pointer.x, pointer.y);
        await page.mouse.wheel(0, 160);
        await page.waitForFunction(before => document.querySelector('.map-zoom-level')?.textContent === `Zoom ${before}`, initialZoom);
        const afterOut = await rectCenter();
        const expected = { x: (afterIn.x + pointer.x) / 2, y: (afterIn.y + pointer.y) / 2 };
        assert.ok(Math.abs(afterOut.x - expected.x) < 2 && Math.abs(afterOut.y - expected.y) < 2,
            `wheel off marker must preserve cursor position: ${JSON.stringify({ expected, afterOut })}`);
    });
});

test('browser: analytics dashboard, six pages, filters, deep links and drill-down', async () => {
    await session(async ({ page, open, base }) => {
        const catalog = (await requestJson(base, '/api/collection')).data.distilleries;
        const site = catalog.find(d => d.name === 'Kilchoman');
        assert.ok(site);
        const created = await requestJson(base, '/api/bottlings', 'POST', {
            name: 'Analysis Test Whisky', distilleryIds: [site.id], country: 'Scotland',
            ageYears: 8, abv: 46, firstBottle: { inventoryNumber: '987421', status: 'closed',
                volumeType: 'standard', volumeMl: 700, purchasePrice: 50, currency: 'EUR', purchaseDate: '2026-07-11' },
        });
        assert.equal(created.status, 201);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-analysis"]').click();
        await page.locator('.analytics-metric').first().waitFor();
        assert.equal(await page.locator('.analytics-section-card').count(), 6);
        // Hovering any part of the final Top-Destillerien row must underline its link.
        const lastTopRow = page.locator('.analytics-panel').filter({ has: page.locator('h3', { hasText: 'Top-Destillerien' }) })
            .locator('.analytics-bar-row').last();
        const lastTopLink = lastTopRow.locator('button.analytics-bar-label.analytics-link');
        assert.equal(await lastTopLink.count(), 1);
        // The full-row click target overlays the track; move the mouse to its position directly.
        const barBox = await lastTopRow.locator('.analytics-bar-track').boundingBox();
        assert.ok(barBox);
        await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2);
        assert.equal(await lastTopLink.evaluate(el => getComputedStyle(el).textDecorationLine), 'underline');
        await page.locator('[data-analytics-filter="distillery"]').selectOption(site.id);
        assert.equal(await page.locator('[data-analytics-filter="distillery"]').inputValue(), site.id);
        for (const section of ['inventory', 'origins', 'profile', 'finance', 'timeline', 'quality']) {
            await page.locator(`.analytics-tab[data-section="${section}"]`).click();
            assert.equal(await page.locator('.analytics-section-title').count(), 1);
            assert.equal(await page.locator('[data-analytics-filter="distillery"]').inputValue(), site.id);
        }
        await page.locator('.analytics-tab[data-section="origins"]').click();
        await page.locator('.analytics-bar-label[data-act="analytics-distillery"]').first().click();
        await page.locator('.collection-heading').waitFor();
        assert.equal(await page.locator('#filter-distillery').inputValue(), site.id);
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-analysis"]').click();
        await page.locator('.analytics-tab[data-section="finance"]').click();
        assert.match(await page.locator('.analytics-page').innerText(), /Dokumentierte Ausgaben/);
        await page.locator('[data-act="analytics-reset"]').click();
        assert.equal(await page.locator('[data-analytics-filter="distillery"]').inputValue(), 'all');
        if (!domOnly) {
            await page.locator('[data-analytics-filter="country"]').selectOption('Schottland');
            await page.reload();
            assert.equal(await page.locator('[data-analytics-filter="country"]').inputValue(), 'Schottland');
        }
        // A content-rich analytics page must not leave excessive whitespace before the footer.
        // Use a short viewport so the sticky footer cannot mask excessive content padding.
        await page.setViewportSize({ width: 1366, height: 500 });
        await page.locator('.analytics-tab[data-section="profile"]').click();
        const footerGap = await page.evaluate(() => {
            const note = document.querySelector('.analytics-footnote').getBoundingClientRect();
            const footer = document.querySelector('.site-footer').getBoundingClientRect();
            return footer.top - note.bottom;
        });
        assert.ok(footerGap >= 0 && footerGap <= 55,
            `analytics footer must follow the final note with compact spacing (${footerGap}px)`);
        const overflow = await page.evaluate(() => document.body.scrollWidth - document.body.getBoundingClientRect().width);
        assert.ok(overflow <= 1, `analytics desktop horizontal overflow: ${overflow}px`);
    });
});

test('browser: detail map link opens all locations of a multi-distillery bottling and remains reloadable', async () => {
    await session(async ({ page, open, base }) => {
        const catalog = (await requestJson(base, '/api/collection')).data.distilleries;
        const ardbeg = catalog.find(site => site.name === 'Ardbeg');
        const kilchoman = catalog.find(site => site.name === 'Kilchoman');
        assert.ok(ardbeg && kilchoman);
        const result = await requestJson(base, '/api/bottlings', 'POST', {
            name: 'Map Focus Blend', whiskyType: 'blended_malt', distilleryIds: [ardbeg.id, kilchoman.id],
            firstBottle: { inventoryNumber: '098401', status: 'closed' },
        });
        assert.equal(result.status, 201);
        await open();
        await page.locator(`[data-act="open"][data-id="${result.data.bottling.id}"]`).first().click();
        await page.locator('[data-act="bottling-map"]').click();
        assert.equal(await page.locator('.map-related-site').count(), 2);
        assert.match(await page.locator('.map-related-bottling').innerText(), /Map Focus Blend/);
        assert.equal(await page.locator('.map-related-site').first().getAttribute('data-map-focus') != null, true);
        // In DOM-only mode History is intentionally stubbed and location stays
        // about:blank; assert the recorded navigation target instead.
        const routeUrl = domOnly
            ? await page.evaluate(() => window.__historyCalls.at(-1)?.url || '')
            : page.url();
        assert.match(routeUrl, /view=map&focusBottling=/);
        const zoom = await page.locator('.map-zoom-level').innerText();
        assert.match(zoom, /^Zoom (?:\d+)$/);
        await page.locator(`[data-map-focus="${kilchoman.id}"]`).click();
        assert.equal(await page.locator('#map-site-select').inputValue(), kilchoman.id);
        if (!domOnly) {
            await page.reload();
            assert.equal(await page.locator('.map-related-site').count(), 2);
        }
    });
});

test('browser: phone detail title, analytics tabs and period controls, and overview view switch fit their layout', async () => {
    await session(async ({ page, open, base }) => {
        const catalog = (await requestJson(base, '/api/collection')).data.distilleries;
        const site = catalog.find(d => d.name === 'Kilchoman') || catalog[0];
        assert.ok(site);
        const created = await requestJson(base, '/api/bottlings', 'POST', {
            name: 'Very long Waterford Ballykilcavan: Edition 1.1 release',
            distilleryIds: [site.id],
            firstBottle: { inventoryNumber: '987427', status: 'closed' },
        });
        assert.equal(created.status, 201);
        await page.setViewportSize({ width: 390, height: 844 });
        await open();
        await page.locator(`.whisky-card[data-id="${created.data.bottling.id}"]`).click();
        const detail = await page.evaluate(() => {
            const heading = document.querySelector('.detail-page-head');
            const title = heading.querySelector('h2').getBoundingClientRect();
            const actions = heading.querySelector('.detail-head-actions').getBoundingClientRect();
            const map = heading.querySelector('[data-act="bottling-map"]').getBoundingClientRect();
            const edit = heading.querySelector('[data-act="edit-bottling"]').getBoundingClientRect();
            const remove = heading.querySelector('[data-act="delete-bottling"]').getBoundingClientRect();
            const parent = heading.getBoundingClientRect();
            return { title, actions, map, edit, remove, parent };
        });
        assert.ok(detail.title.right <= detail.parent.right + 2, 'title must fit inside the detail header');
        assert.ok(detail.actions.top >= detail.title.bottom, 'all action buttons belong below the title');
        assert.ok(detail.map.bottom <= detail.edit.top, 'map button is its own first row');
        assert.ok(Math.abs(detail.edit.top - detail.remove.top) <= 1, 'edit and delete share the same row');
        assert.ok(detail.actions.right <= detail.parent.right + 2, 'action buttons must not overflow');

        await page.locator('[data-act="back"]').first().click();
        const toolbarHeights = await page.evaluate(() => [
            '#search', '#filter-status', '#filter-completion', '#filter-sort',
            '#filter-distillery', '#filter-volume-type', '[data-act="toggle-view"]',
        ].map(selector => Math.round(document.querySelector(`.toolbar ${selector}`).getBoundingClientRect().height)));
        assert.equal(new Set(toolbarHeights).size, 1, `all toolbar elements should match: ${toolbarHeights}`);
        // Phone and narrow Android layouts must not force native selects/inputs
        // beyond their flex row; the view switch keeps its own usable width.
        for (const width of [320, 360, 390, 412, 600]) {
            await page.setViewportSize({ width, height: 844 });
            const tooWide = await page.evaluate(() => [...document.querySelectorAll('.toolbar input, .toolbar select')]
                .filter(el => {
                    const r = el.getBoundingClientRect();
                    const parent = el.parentElement.getBoundingClientRect();
                    return r.right > parent.right + 1 || r.left < parent.left - 1;
                }).map(el => el.id || el.outerHTML.slice(0, 50)));
            assert.deepEqual(tooWide, [], `overview fields should not overflow at ${width}px`);
        }
        await page.setViewportSize({ width: 390, height: 844 });

        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-analysis"]').click();
        await page.locator('.analytics-tab[data-section="quality"]').click();
        const visibleTab = await page.evaluate(() => {
            const strip = document.querySelector('.analytics-tabs').getBoundingClientRect();
            const active = document.querySelector('.analytics-tab.active').getBoundingClientRect();
            return active.left >= strip.left - 2 && active.right <= strip.right + 2;
        });
        assert.equal(visibleTab, true, 'active analysis tab remains visible on mobile after selection');
        await page.locator('.analytics-tab[data-section="timeline"]').click();
        // The date input is inset inside the 44px bordered control. Compare the
        // visible controls, not the inner input (which is 42px by design).
        const periodGeometry = await page.evaluate(() => [
            document.querySelector('#analytics-period'),
            ...document.querySelectorAll('.analytics-date-control'),
        ].map(el => {
            const { width, height } = el.getBoundingClientRect();
            return [Math.round(width), Math.round(height)];
        }));
        assert.equal(new Set(periodGeometry.map(([, height]) => height)).size, 1,
            `period controls should have equal heights: ${JSON.stringify(periodGeometry)}`);
        assert.equal(new Set(periodGeometry.map(([width]) => width)).size, 1,
            `period controls should have equal widths on phones: ${JSON.stringify(periodGeometry)}`);
        await page.locator('#analytics-start-date').fill('2026-01-15');
        assert.equal(await page.locator('#analytics-start-date').inputValue(), '2026-01-15');
        await page.locator('#analytics-end-date').fill('2026-12-31');
        assert.equal(await page.locator('#analytics-end-date').inputValue(), '2026-12-31');
        await page.locator('#analytics-start-date').fill('');
        assert.equal(await page.locator('#analytics-start-date').inputValue(), '');
        for (const width of [320, 360, 390, 412, 600]) {
            await page.setViewportSize({ width, height: 844 });
            const tooWide = await page.evaluate(() => [...document.querySelectorAll('.analytics-period input, .analytics-period select, .analytics-filters select')]
                .filter(el => {
                    const r = el.getBoundingClientRect();
                    const parent = el.parentElement.getBoundingClientRect();
                    return r.right > parent.right + 1 || r.left < parent.left - 1;
                }).map(el => el.id || el.outerHTML.slice(0, 50)));
            assert.deepEqual(tooWide, [], `analysis fields should not overflow at ${width}px`);
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await openSettingsFromMenu(page);
        await page.locator('#distillery-search').fill('Ardbeg');
        await page.locator('.distillery-row:visible [data-act="rename-distillery"]').first().click();
        await page.locator('#distillery-form').waitFor();
        for (const width of [320, 360, 390, 412]) {
            await page.setViewportSize({ width, height: 844 });
            const tooWide = await page.evaluate(() => [...document.querySelectorAll('#distillery-form input, #distillery-form select')]
                .filter(el => {
                    const r = el.getBoundingClientRect();
                    const parent = el.parentElement.getBoundingClientRect();
                    return r.right > parent.right + 1 || r.left < parent.left - 1;
                }).map(el => el.id));
            assert.deepEqual(tooWide, [], `distillery dialog fields should not overflow at ${width}px`);
        }
    });
});

test('browser: warehouse room plan mounts local Three.js and keeps the 2D plan available', async () => {
    await session(async ({base,page,open})=>{
        const room=await requestJson(base,'/api/warehouse/rooms','POST',{name:'3D-Raum',width:5,height:4});
        assert.equal(room.status,201);
        const rack=await requestJson(base,`/api/warehouse/rooms/${room.data.id}/furniture`,'POST',
            {name:'Offenes Regal',type:'regal',x:0.3,y:0.2,width:1.7,depth:0.6,rotation:0,elevation:0,itemHeight:1.8});
        assert.equal(rack.status,201);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        assert.equal(await page.locator('[data-act="warehouse-plan-mode"][data-mode="3d"]').getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('.warehouse-three-viewport').count(),1);
        for(const corner of ['nw','ne','se','sw']){
            await page.locator(`[data-act="warehouse-camera"][data-corner="${corner}"]`).click();
            assert.equal(await page.locator(`[data-act="warehouse-camera"][data-corner="${corner}"]`).getAttribute('aria-pressed'),'true');
        }
        const eye=page.locator('.warehouse-bulk-visibility').first();
        assert.equal(await eye.locator('svg.warehouse-eye-icon').count(),1);
        assert.equal(await eye.getAttribute('aria-label'),'Offenes Regal ausblenden');
        const tile=page.locator('.warehouse-bulk-item').first();
        await tile.hover();
        if (await page.locator('.warehouse-three-canvas').count()) {
            await page.waitForFunction(() => document.querySelector('.warehouse-three-canvas')?.dataset.highlightedFurniture !== '');
            assert.equal(await page.locator('.warehouse-three-canvas').getAttribute('data-highlighted-furniture'),rack.data.id);
            await page.locator('.warehouse-bulk-head').hover();
            assert.equal(await page.locator('.warehouse-three-canvas').getAttribute('data-highlighted-furniture'),'');
        }
        await eye.click();
        assert.equal(await page.locator('.warehouse-bulk-visibility').first().getAttribute('aria-pressed'),'false');
        assert.equal(await page.locator('.warehouse-bulk-visibility').first().getAttribute('aria-label'),'Offenes Regal einblenden');
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),1);
        assert.equal(await page.locator('.warehouse-camera-toolbar [data-act="warehouse-iso-clear"]').count(),0);
        await page.locator('.warehouse-bulk-visibility').first().click();
        assert.equal(await page.locator('.warehouse-bulk-visibility').first().getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),0);
        await page.locator('#warehouse-plan-zoom').selectOption('150');
        assert.equal(await page.locator('#warehouse-plan-zoom').inputValue(),'150');
        await page.locator('.warehouse-bulk-open').first().click();
        assert.equal(await page.locator('.warehouse-furniture-panel').count(),1);
        assert.equal(await page.locator('.warehouse-shelf').count(),0);
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        assert.equal(await page.locator('.warehouse-floor').count(),1);
        assert.equal(await page.locator('.warehouse-three-viewport').count(),0);
    });
});

test('browser: room and compact furniture strip stay together; show all restores hidden items', async () => {
    await session(async ({base,page,open}) => {
        const roomResult=await requestJson(base,'/api/warehouse/rooms','POST',{name:'Kompakter Raum',width:10,height:6});
        const room=roomResult.data;
        for (let i=0;i<13;i++) {
            const result=await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',{
                name:`Testregal ${i+1}`,type:'regal',x:(i%5)*1.7+0.1,y:Math.floor(i/5)*1.1+0.1,
                width:1.2,depth:.5,rotation:0,elevation:0,itemHeight:1.6,
            });
            assert.equal(result.status,201,`furniture ${i+1} should be created`);
        }
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        assert.equal(await page.locator('.warehouse-plan-workspace').count(),1);
        assert.equal(await page.locator('.warehouse-bulk-item').count(),13);
        assert.equal(await page.locator('[data-act="warehouse-show-all"]').isDisabled(),true);
        const desktop=await page.evaluate(()=>{
            const stage=document.querySelector('.warehouse-plan-stage').getBoundingClientRect();
            const aside=document.querySelector('.warehouse-bulk-panel--sidebar').getBoundingClientRect();
            const list=document.querySelector('.warehouse-bulk-panel--sidebar .warehouse-bulk-list');
            return {stage:{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom},aside:{left:aside.left,top:aside.top,bottom:aside.bottom},scrollHeight:list.scrollHeight,clientHeight:list.clientHeight};
        });
        assert.ok(desktop.stage.right<=desktop.aside.left,`sidebar must be beside 3D scene: ${JSON.stringify(desktop)}`);
        assert.ok(Math.abs(desktop.stage.top-desktop.aside.top)<2,`scene and controls must start at same height: ${JSON.stringify(desktop)}`);
        assert.ok(desktop.scrollHeight>desktop.clientHeight,`long furniture list must scroll inside sidebar: ${JSON.stringify(desktop)}`);
        const eyes=page.locator('.warehouse-bulk-visibility');
        await eyes.nth(0).click();
        await eyes.nth(1).click();
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),2);
        assert.equal(await page.locator('[data-act="warehouse-show-all"]').isEnabled(),true);
        await page.locator('[data-act="warehouse-show-all"]').click();
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),0);
        assert.equal(await page.locator('[data-act="warehouse-show-all"]').isDisabled(),true);
        assert.equal(await page.locator('.warehouse-bulk-visibility[aria-pressed="true"]').count(),13);
        assert.equal(await page.locator('.warehouse-bulk-check:checked').count(),0,'show all must not modify bulk selection');
        await page.setViewportSize({width:390,height:844});
        const mobile=await page.evaluate(()=>{
            const stage=document.querySelector('.warehouse-plan-stage').getBoundingClientRect();
            const aside=document.querySelector('.warehouse-bulk-panel--sidebar').getBoundingClientRect();
            const list=document.querySelector('.warehouse-bulk-panel--sidebar .warehouse-bulk-list');
            return {stageBottom:stage.bottom,asideTop:aside.top,stripWidth:list.clientWidth,scrollWidth:list.scrollWidth,pageWidth:document.body.scrollWidth,viewportWidth:document.body.getBoundingClientRect().width};
        });
        assert.ok(mobile.asideTop>=mobile.stageBottom-2,`compact horizontal list must be immediately below the 3D scene: ${JSON.stringify(mobile)}`);
        assert.ok(mobile.scrollWidth>mobile.stripWidth,`many furniture cards must scroll horizontally: ${JSON.stringify(mobile)}`);
        assert.ok(mobile.pageWidth<=mobile.viewportWidth+2,`no horizontal page overflow: ${JSON.stringify(mobile)}`);
    });
});

test('browser: shelf bottle opens details modal, can relocate and links to its highlighted bottle', async () => {
    await session(async ({base,page,open}) => {
        const created = await seed(base, '098765');
        const room = (await requestJson(base,'/api/warehouse/rooms','POST',{name:'Flaschenraum',width:4,height:4})).data;
        const furniture = (await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Testregal',type:'regal',x:.3,y:.3,width:1,depth:.5,rotation:0,elevation:0,itemHeight:1.8})).data;
        const shelf = (await requestJson(base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:'Flaschenfach',capacity:6})).data;
        const allocation = await requestJson(base,`/api/warehouse/bottles/${created.bottle.id}`,'PUT',{shelfId:shelf.id});
        assert.equal(allocation.status,200);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="shelves"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        await page.locator('.warehouse-bulk-open').click();
        const symbol = page.locator(`.warehouse-bottle-symbol[data-id="${created.bottle.id}"]`);
        await symbol.click();
        const dialog = page.locator('#modal-root [role="dialog"]');
        await dialog.waitFor();
        assert.equal((await dialog.locator('h2').textContent()).trim(),'Flaschendetails');
        assert.match(await dialog.textContent(),/Browser Test Blend/);
        assert.match(await dialog.textContent(),/098765/);
        assert.match(await dialog.textContent(),/Flaschenraum \/ Testregal \/ Flaschenfach/);
        assert.equal(await dialog.locator('#warehouse-form').count(),0,'click must not open relocation form immediately');
        const link = dialog.getByRole('link',{name:'Zur Detailseite'});
        assert.equal(await link.getAttribute('href'),`/?bottling=${created.bottling.id}`);
        await dialog.locator('[data-act="warehouse-assign"]').click();
        assert.equal(await page.locator('#warehouse-form').count(),1,'relocation remains available in modal');
        const assign = page.locator('#warehouse-form');
        assert.equal(await assign.locator('[data-assignment-room]').inputValue(),room.id);
        assert.equal(await assign.locator('[data-assignment-furniture]').inputValue(),furniture.id);
        assert.equal(await assign.locator('[data-assignment-shelf]').inputValue(),shelf.id);
        assert.match(await assign.locator('.warehouse-assignment-current').innerText(),/Flaschenraum \/ Testregal \/ Flaschenfach/);
        assert.match(await assign.locator('.warehouse-assignment-feedback').innerText(),/1 von 6/);
        // A tall real bottle photo used to inflate the CSS grid's intrinsic row
        // beyond the fixed preview frame, silently cropping the bottom in Chrome.
        await assign.evaluate(element => {
            const photo = element.querySelector('.warehouse-assignment-photo');
            const image = document.createElement('img');
            image.alt = '';
            image.src = 'data:image/svg+xml,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="2400">'
                + '<rect width="600" height="2400" fill="green"/>'
                + '<rect y="2300" width="600" height="100" fill="red"/>'
                + '</svg>');
            photo.replaceChildren(image);
        });
        await assign.locator('.warehouse-assignment-photo img').evaluate(image => image.decode());
        const checkPhotoSize = async () => {
            const bounds = await assign.evaluate(element => {
                const frame = element.querySelector('.warehouse-assignment-photo').getBoundingClientRect();
                const image = element.querySelector('.warehouse-assignment-photo img').getBoundingClientRect();
                return {frame:{x:frame.x,y:frame.y,w:frame.width,h:frame.height},
                    image:{x:image.x,y:image.y,w:image.width,h:image.height},
                    fit:getComputedStyle(element.querySelector('.warehouse-assignment-photo img')).objectFit};
            });
            assert.equal(bounds.fit,'contain');
            assert.ok(bounds.image.x >= bounds.frame.x - 1 && bounds.image.y >= bounds.frame.y - 1
                && bounds.image.x + bounds.image.w <= bounds.frame.x + bounds.frame.w + 1
                && bounds.image.y + bounds.image.h <= bounds.frame.y + bounds.frame.h + 1,
                `tall bottle photo must fit entirely in preview: ${JSON.stringify(bounds)}`);
        };
        await checkPhotoSize();
        await assign.locator('[name="warehouseAssignmentMode"][value="none"]').check();
        assert.equal(await assign.locator('[data-assignment-room]').isDisabled(),true);
        assert.equal(await assign.locator('[data-assignment-shelf]').isDisabled(),true);
        await assign.locator('[name="warehouseAssignmentMode"][value="shelf"]').check();
        assert.equal(await assign.locator('[data-assignment-shelf]').isEnabled(),true);
        await page.setViewportSize({width:390,height:844});
        const assignmentFrame = await assign.evaluate(element => ({
            width: element.closest('.dialog').getBoundingClientRect().width,
            viewport: document.documentElement.clientWidth,
            columns: getComputedStyle(element.querySelector('.warehouse-assignment-selectors')).gridTemplateColumns.split(' ').length,
        }));
        assert.ok(assignmentFrame.width <= assignmentFrame.viewport + 1, 'dialog must fit mobile width');
        assert.equal(assignmentFrame.columns,1,'mobile assignment selects should stack vertically');
        await checkPhotoSize();
        await page.locator('#modal-root [data-act="close-modal"]').first().click();
        await symbol.click();
        await page.locator('#modal-root [data-act="open"]').click();
        await page.locator(`#bottle-${created.bottle.id}.scanned-bottle`).waitFor();
        assert.equal(await page.locator('#modal-root [role="dialog"]').count(),0);
    });
});

test('browser: furniture has one list; click scrolls to shelves and double-click opens furniture editor', async () => {
    await session(async ({base,page,open}) => {
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Scrollraum',width:5,height:4})).data;
        const furniture=(await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Klickregal',type:'regal',x:0.5,y:0.5,width:1,depth:.5,rotation:0,elevation:0,itemHeight:1.5})).data;
        await requestJson(base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',{name:'Testfach',capacity:0});
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        assert.equal(await page.locator('.warehouse-bulk-item').count(),1);
        assert.equal(await page.locator('.warehouse-room-card').count(),0,'no redundant furniture cards');
        assert.equal(await page.locator('.warehouse-iso-number').count(),0);
        // Opening an item shows its shelves, but must not imply bulk-selection.
        await page.locator('.warehouse-bulk-open').click();
        const firstPosition=await page.evaluate(() => ({scroll:window.scrollY,top:document.querySelector('.warehouse-furniture-panel').getBoundingClientRect().top,pad:document.querySelector('.warehouse-page').style.paddingBottom,height:document.documentElement.scrollHeight,inner:window.innerHeight,body:document.body.scrollHeight}));
        assert.ok(firstPosition.scroll>0,`shelves panel must scroll into view: ${JSON.stringify(firstPosition)}`);
        assert.ok(firstPosition.top>=-1&&firstPosition.top<120,`shelves panel must be near viewport top after opening: ${JSON.stringify(firstPosition)}`);
        assert.equal(await page.locator('.warehouse-bulk-check').isChecked(),false);
        assert.equal((await page.locator('.warehouse-bulk-count').textContent()).trim(),'0 von 1 ausgewählt');
        assert.equal(await page.locator('.warehouse-bulk-delete-btn').isDisabled(),true);
        assert.equal(await page.locator('.warehouse-bulk-open').getAttribute('aria-current'),'true');
        const unselectedStyles=await page.locator('.warehouse-bulk-item').evaluate(el => ({
            shadow:getComputedStyle(el).boxShadow,
            background:getComputedStyle(el).backgroundColor,
            check:el.querySelector('input').checked,
        }));
        assert.equal(unselectedStyles.shadow,'none','opening shelves must not visually mark a bulk selection');
        assert.equal(unselectedStyles.check,false);
        await page.locator('.warehouse-bulk-check').check();
        assert.equal((await page.locator('.warehouse-bulk-count').textContent()).trim(),'1 von 1 ausgewählt');
        assert.equal(await page.locator('.warehouse-bulk-delete-btn').isEnabled(),true);
        await page.locator('.warehouse-bulk-open').click();
        assert.equal(await page.locator('.warehouse-bulk-check').isChecked(),true,'opening shelves must preserve explicit checkbox selection');
        await page.locator('.warehouse-bulk-check').uncheck();
        assert.equal(await page.locator('.warehouse-bulk-check').isChecked(),false);
        assert.equal(await page.locator('.warehouse-furniture-panel').count(),1);
        assert.equal(await page.locator('.warehouse-shelf').count(),1);
        assert.equal(await page.locator('.warehouse-tabs [data-section="rooms"]').getAttribute('aria-current'),'page');
        await page.locator('.warehouse-floor .warehouse-drag').dblclick();
        await page.locator('#warehouse-form [name="name"]').waitFor();
        assert.equal(await page.locator('#warehouse-form [name="name"]').inputValue(),'Klickregal');
        await page.locator('[data-act="close-modal"]').last().click();
        await page.locator('.warehouse-tabs [data-section="shelves"]').click();
        assert.equal(await page.locator('.warehouse-bulk-item').count(),1);
        assert.equal(await page.locator('.warehouse-room-card').count(),0,'shelves tab has only the shared furniture list');
        assert.equal(await page.locator('#warehouse-room-select').count(),1,'shelves can still switch rooms');
        for (const action of ['warehouse-room-new','warehouse-room-edit','warehouse-room-delete']) {
            assert.equal(await page.locator(`.warehouse-room-toolbar [data-act="${action}"]`).count(),0,`${action} hidden in shelves`);
        }
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        for (const action of ['warehouse-room-new','warehouse-room-edit','warehouse-room-delete']) {
            assert.equal(await page.locator(`.warehouse-room-toolbar [data-act="${action}"]`).count(),1,`${action} available in room plans`);
        }
    });
});

test('browser: 3D viewport either renders WebGL canvas or clearly reports unavailable WebGL', async()=>{
    await session(async({base,page,open})=>{
        const room=await requestJson(base,'/api/warehouse/rooms','POST',{name:'Tiefentest',width:4,height:4});
        const baseFurniture=await requestJson(base,`/api/warehouse/rooms/${room.data.id}/furniture`,'POST',
            {name:'Unterschrank',type:'schrank',x:0.5,y:0.5,width:2,depth:0.6,rotation:0,elevation:0,itemHeight:1.8});
        const upper=await requestJson(base,`/api/warehouse/rooms/${room.data.id}/furniture`,'POST',
            {name:'Hängeregal',type:'haengeregal',x:0.5,y:0.5,width:2,depth:0.6,rotation:0,elevation:1.9,itemHeight:0.4});
        assert.equal(baseFurniture.status,201);assert.equal(upper.status,201);
        await open();await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="3d"]').click();
        await page.waitForFunction(()=>!!document.querySelector('.warehouse-three-canvas')||
            /nicht verf.gbar/.test(document.querySelector('.warehouse-three-viewport')?.textContent||''));
        const viewport=page.locator('.warehouse-three-viewport');
        const canvas=viewport.locator('.warehouse-three-canvas');
        if(await canvas.count()){
            const size=await canvas.evaluate(el=>({width:el.width,height:el.height}));
            assert.ok(size.width>10&&size.height>10,'live WebGL canvas has real dimensions');
        }else{
            assert.match(await viewport.textContent(),/nicht verfügbar/);
        }
        const data=await requestJson(base,'/api/warehouse');
        assert.equal(data.data.rooms[0].furniture.length,2);
    });
});

test('browser: 2D furniture drag stops at a physical obstacle but permits non-overlapping heights', async () => {
    await session(async ({base,page,open})=>{
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Kollisionsraum',width:4,height:3})).data;
        const post=async (name,x,elevation=0)=>(await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name,type:'schrank',x,y:.2,width:.5,depth:.5,rotation:0,elevation,itemHeight:.6})).data;
        const moving=await post('Beweglich',.2);
        await post('Hindernis',1.2);
        const elevated=await post('Wandregal',1.2,.6);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        const plan=page.locator('.warehouse-floor');
        await plan.waitFor();
        assert.ok(await page.locator('.warehouse-grid-fine').count()>0);
        const planRect=await plan.boundingBox();
        const scale=planRect.width/4;
        const dragFurniture=async (id, deltaMetres) => {
            const el=page.locator(`.warehouse-drag[data-id="${id}"]`);
            const rect=await el.boundingBox();
            const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
            await page.mouse.move(x,y);
            await page.mouse.down();
            await page.mouse.move(x+deltaMetres*scale,y,{steps:1});
            await page.mouse.up();
            await page.waitForTimeout(120);
        };
        await dragFurniture(moving.id,2.4);
        const blocked=(await requestJson(base,'/api/warehouse')).data.rooms[0].furniture.find(f=>f.id===moving.id);
        assert.ok(blocked.x<=.71 && blocked.x>=.61,`collision stops drag near cabinet: ${blocked.x}`);
        await page.locator('#warehouse-plan-layer').selectOption('elevated');
        await dragFurniture(elevated.id,1.5);
        const updated=(await requestJson(base,'/api/warehouse')).data.rooms[0].furniture.find(f=>f.id===elevated.id);
        assert.ok(updated.x>2.5,`elevated shelf can move above floor cabinet: ${updated.x}`);
    });
});

test('browser: overview room cards show static 3D room previews and still open the room plan', async () => {
    await session(async ({base,page,open}) => {
        const room = (await requestJson(base, '/api/warehouse/rooms', 'POST',
            {name:'Raumvorschau', width:4, height:3})).data;
        const furniture = await requestJson(base, `/api/warehouse/rooms/${room.id}/furniture`, 'POST',
            {name:'Vorschau-Regal',type:'regal',x:0.3,y:0.6,width:1.2,depth:0.5,rotation:0,elevation:0,itemHeight:1.8});
        assert.equal(furniture.status, 201);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        const card = page.locator(`.warehouse-room-card[data-id="${room.id}"]`);
        await card.waitFor();
        const preview = card.locator('.warehouse-room-preview');
        await preview.waitFor();
        await page.waitForFunction(id => {
            const node = document.querySelector(`.warehouse-room-card[data-id="${id}"] .warehouse-room-preview`);
            return node?.dataset.previewState === 'ready' || node?.dataset.previewState === 'unavailable';
        }, room.id);
        if (await preview.locator('img').count()) {
            assert.equal(await preview.locator('img').evaluate(img => img.naturalWidth === 360 && img.naturalHeight === 210), true,
                'static image is rendered at thumbnail resolution');
            assert.ok((await preview.locator('img').getAttribute('src')).startsWith('data:image/png;base64,'));
        } else {
            assert.match(await preview.textContent(), /nicht verfügbar/, 'fallback if WebGL is blocked');
        }
        const positions = await card.evaluate(el => {
            const image = el.querySelector('.warehouse-room-preview').getBoundingClientRect();
            const details = el.querySelector('.warehouse-room-card-details').getBoundingClientRect();
            return { image: { x:image.x, width:image.width, height:image.height }, details:{ x:details.x } };
        });
        assert.ok(positions.image.width <= 114 && positions.image.height <= 72, 'thumbnail stays compact');
        assert.ok(positions.details.x > positions.image.x + positions.image.width, 'text sits beside the thumbnail');
        await card.click();
        await page.locator('.warehouse-three-viewport').waitFor();
    });
});


test('browser: eye icons independently hide and show furniture without selecting its checkbox', async () => {
    await session(async ({base,page,open}) => {
        const room=await requestJson(base,'/api/warehouse/rooms','POST',{name:'Sichtbarkeit',width:5,height:4});
        assert.equal(room.status,201);
        for(const [name,x] of [['Linkes Regal',0.4],['Rechtes Regal',2.5]]) {
            const result=await requestJson(base,`/api/warehouse/rooms/${room.data.id}/furniture`,'POST',
                {name,type:'regal',x,y:0.3,width:1,depth:0.5,rotation:0,elevation:0,itemHeight:1.8});
            assert.equal(result.status,201);
        }
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        const eyes=page.locator('.warehouse-bulk-visibility');
        assert.equal(await eyes.count(),2);
        assert.equal(await eyes.first().getAttribute('aria-pressed'),'true');
        assert.equal(await eyes.last().getAttribute('aria-pressed'),'true');
        const dims=await eyes.first().evaluate(el=>({button:el.getBoundingClientRect().width,icon:el.querySelector('svg').getBoundingClientRect().width}));
        assert.ok(dims.button>=44 && dims.icon>=27,JSON.stringify(dims));
        await eyes.first().click();
        await eyes.last().click();
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),2);
        assert.equal(await page.locator('.warehouse-bulk-check:checked').count(),0);
        await eyes.first().click();
        assert.equal(await eyes.first().getAttribute('aria-pressed'),'true');
        assert.equal(await eyes.last().getAttribute('aria-pressed'),'false');
        assert.equal(await page.locator('.warehouse-bulk-item.is-hidden').count(),1);
        if(await page.locator('.warehouse-three-canvas').count()) {
            const hidden=await page.locator('.warehouse-three-canvas').getAttribute('data-hidden-furniture');
            assert.equal(hidden,await eyes.last().getAttribute('data-id'));
        }
        // The visibility choice survives leaving and returning to the 3D plan.
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="2d"]').click();
        await page.locator('[data-act="warehouse-plan-mode"][data-mode="3d"]').click();
        assert.equal(await page.locator('.warehouse-bulk-visibility').last().getAttribute('aria-pressed'),'false');
    });
});

test('browser: compact room tools, uniform bulk buttons and furniture wall toggles', async () => {
    await session(async ({base,page,open}) => {
        const room=(await requestJson(base,'/api/warehouse/rooms','POST',{name:'Whiskyzimmer',width:3,height:4})).data;
        const created=await requestJson(base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',{
            name:'Wandregal',type:'regal',x:.2,y:.2,width:1,depth:.4,rotation:0,elevation:0,itemHeight:1.8,
            leftSidePanel:true,rightSidePanel:false,backPanel:true,
        });
        assert.equal(created.status,201);
        await open();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.locator('.warehouse-tabs [data-section="rooms"]').click();
        await page.locator('#warehouse-room-select').selectOption(room.id);
        const desktop=await page.evaluate(() => {
            const el = selector => document.querySelector(selector)?.getBoundingClientRect();
            const buttons=[...document.querySelectorAll('.warehouse-bulk-actions .btn')].map(node=>node.getBoundingClientRect().height);
            return { roomName:el('.warehouse-room-identity h3'),metrics:el('.warehouse-room-metrics'),
                modes:el('.warehouse-view-switch'), cameras:el('.warehouse-camera-toolbar'),
                zoom:el('.warehouse-plan-filter'),buttons };
        });
        assert.equal(desktop.buttons.length,4);
        assert.ok(desktop.buttons.every(h=>Math.abs(h-desktop.buttons[0])<1),`bulk buttons need equal heights ${JSON.stringify(desktop.buttons)}`);
        assert.ok(Math.abs(desktop.modes.top-desktop.cameras.top)<4,`camera and view switch share a row: ${JSON.stringify(desktop)}`);
        assert.ok(Math.abs(desktop.modes.top-desktop.zoom.top)<4,`zoom and view switch share a row: ${JSON.stringify(desktop)}`);
        assert.ok(Math.abs(desktop.roomName.top-desktop.metrics.top)<40,`room title and metrics share a header: ${JSON.stringify(desktop)}`);
        await page.locator('.warehouse-room-summary').screenshot({path:'test-artifacts/warehouse-room-header-0147.png'});
        await page.locator('.warehouse-bulk-open').click();
        await page.locator('[data-act="warehouse-furniture-edit"]').click();
        assert.equal(await page.locator('.warehouse-wall-toggle').count(),3);
        assert.equal(await page.locator('.warehouse-wall-toggle [name="leftSidePanel"]').isChecked(),true);
        assert.equal(await page.locator('.warehouse-wall-toggle [name="rightSidePanel"]').isChecked(),false);
        assert.equal(await page.locator('.warehouse-wall-toggle [name="backPanel"]').isChecked(),true);
        await page.locator('.warehouse-wall-toggle').nth(1).click();
        assert.equal(await page.locator('.warehouse-wall-toggle [name="rightSidePanel"]').isChecked(),true);
        await page.locator('.warehouse-wall-options').screenshot({path:'test-artifacts/warehouse-wall-desktop-0147.png'});
        await page.setViewportSize({width:390,height:844});
        const mobile=await page.evaluate(() => {
            const fieldset=document.querySelector('.warehouse-wall-options').getBoundingClientRect();
            const cards=[...document.querySelectorAll('.warehouse-wall-toggle')].map(el=>el.getBoundingClientRect());
            return {fieldset:{left:fieldset.left,right:fieldset.right},cards:cards.map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})),width:document.body.getBoundingClientRect().width};
        });
        assert.ok(mobile.cards.every(r=>r.right<=mobile.width+2),`wall options should fit mobile viewport: ${JSON.stringify(mobile)}`);
        assert.ok(mobile.cards[0].bottom<=mobile.cards[1].top,`mobile wall switches should stack: ${JSON.stringify(mobile)}`);
        await page.locator('.warehouse-wall-options').screenshot({path:'test-artifacts/warehouse-wall-mobile-0147.png'});
    });
});

test('browser: analysis and warehouse use the same page width as the shared main content', async () => {
    await session(async ({page, open}) => {
        await open();
        for (const width of [1600, 1024, 390]) {
            await page.setViewportSize({width, height:900});
            for (const [destination] of [['analysis'], ['warehouse']]) {
                await page.locator('header [data-act="toggle-menu"]').click();
                await page.locator(`#site-drawer [data-act="goto-${destination}"]`).click();
                const dimensions = await page.locator('.analytics-page').evaluate(element => {
                    const main = element.closest('main');
                    const mainStyle = getComputedStyle(main);
                    const bounds = main.getBoundingClientRect();
                    const contentLeft = bounds.left + parseFloat(mainStyle.paddingLeft);
                    const contentRight = bounds.right - parseFloat(mainStyle.paddingRight);
                    const page = element.getBoundingClientRect();
                    return {left:page.left, right:page.right, contentLeft, contentRight};
                });
                assert.ok(Math.abs(dimensions.left - dimensions.contentLeft) < 1,
                    `${destination} left edge aligns with shared main content at ${width}px`);
                assert.ok(Math.abs(dimensions.right - dimensions.contentRight) < 1,
                    `${destination} right edge aligns with shared main content at ${width}px`);
            }
        }
    });
});


test('browser: translating a dynamic warehouse view does not translate room names', async () => {
    await session(async ({page, base, open}) => {
        const created = await requestJson(base, '/api/warehouse/rooms', 'POST',
            {name:'Lagerverwaltung', width:4, height:3});
        assert.equal(created.status, 201);
        // Verify the shipped English catalog rather than a shortened test-only
        // dictionary; wait for async language initialization before asserting.
        await open({query:'?lang=en'});
        await page.locator('html[lang="en"]').waitFor();
        await page.locator('header [data-act="toggle-menu"]').click();
        assert.equal((await page.locator('#site-drawer [data-act="goto-analysis"]').innerText()).trim(), 'Analytics');
        await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
        await page.getByRole('heading', {name:'Storage management'}).waitFor();
        assert.match(await page.locator('.warehouse-heading p').innerText(), /every bottle has its own place/);
        assert.match(await page.locator('.warehouse-room-card-details').first().innerText(), /0 storage furniture items/);
        assert.equal((await page.locator('.warehouse-room-card-details strong').first().innerText()).trim(),
            'Lagerverwaltung', 'user-defined room names must remain unchanged');
    });
});

test('browser: complete English locale renders collection controls and analytics filters', async () => {
    await session(async ({page, open}) => {
        await open({query:'?lang=en'});
        await page.locator('html[lang="en"]').waitFor();
        const view = page.locator('[data-act="toggle-view"]');
        await view.waitFor();
        assert.match((await view.innerText()).trim(), /Table/);
        await view.click();
        assert.match((await view.innerText()).trim(), /Cards/);
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-analysis"]').click();
        await page.locator('.analytics-page').waitFor();
        const filters = await page.locator('.analytics-filters').innerText();
        for (const label of ['All distilleries','All countries','All bottle types','All statuses']) {
            assert.match(filters, new RegExp(label));
        }
        assert.doesNotMatch(filters, /Alle Destillerien|Alle Flaschentypen|Alle Status/);
    });
});


test('browser: English map legend translates active and closed for visible and empty distilleries', async () => {
    await session(async ({page, open}) => {
        await open({query:'?lang=en'});
        await page.locator('html[lang="en"]').waitFor();
        await page.locator('header [data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        const stocked = page.locator('.map-legend-status');
        await stocked.waitFor();
        assert.match(await stocked.innerText(), /With bottles\s+1\s*Active\s+1\s*Closed/);
        await page.locator('#map-all-distilleries').check();
        const empty = page.locator('.map-legend-empty');
        await empty.waitFor();
        assert.match(await empty.innerText(), /Without bottles\s+Active\s+Closed/);
        assert.doesNotMatch(await page.locator('.map-legend').innerText(), /Aktiv|Geschlossen/);
    });
});

test('browser: cutout dialog fully contains both images on desktop and mobile', async () => {
    await session(async ({base, page, open}) => {
        const created = await seed(base, 'CUT-FIT');
        const bottleId = created.bottle.id;
        const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
        const photo = (await requestJson(base, `/api/bottles/${bottleId}/photos`, 'POST', {image:tinyPng})).data;
        await requestJson(base, `/api/bottles/${bottleId}/photos/${photo.id}/cutout`, 'PUT', {image:tinyPng});
        await open();
        await page.locator(`.whisky-card[data-id="${created.bottling.id}"]`).first().click();
        await page.locator(`[data-act="cutout-open"][data-photo-id="${photo.id}"]`).click();
        await page.locator('.cutout-compare').waitFor();
        // Large portrait and landscape images expose intrinsic-size clipping that a 1px
        // API fixture cannot reproduce. The test only changes the preview DOM.
        await page.evaluate(async () => {
            const dimensions = [[800, 1200], [1200, 800]];
            const images = [...document.querySelectorAll('.cutout-image-frame img')];
            await Promise.all(images.map(async (img, i) => {
                const canvas = document.createElement('canvas');
                [canvas.width, canvas.height] = dimensions[i];
                const context = canvas.getContext('2d');
                context.fillStyle = '#ad7b35';
                context.fillRect(0, 0, canvas.width, canvas.height);
                img.src = canvas.toDataURL('image/png');
                await img.decode();
            }));
        });
        for (const viewport of [{width:1366,height:900}, {width:390,height:844}, {width:320,height:568}, {width:844,height:390}]) {
            await page.setViewportSize(viewport);
            const measurements = await page.evaluate(() => {
                const frames = [...document.querySelectorAll('.cutout-image-frame')];
                return frames.map(frame => {
                    const img = frame.querySelector('img');
                    const bounds = img.getBoundingClientRect();
                    const container = frame.getBoundingClientRect();
                    const style = getComputedStyle(frame);
                    const maxWidth = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
                    const maxHeight = frame.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
                    return {
                        naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
                        width: bounds.width, height: bounds.height,
                        maxWidth, maxHeight, left:bounds.left, right:bounds.right,
                        top:bounds.top, bottom:bounds.bottom,
                        frameLeft:container.left, frameRight:container.right,
                        frameTop:container.top, frameBottom:container.bottom,
                    };
                });
            });
            for (const image of measurements) {
                const description = `${viewport.width}x${viewport.height} ${JSON.stringify(image)}`;
                assert.ok(image.naturalWidth > 0 && image.naturalHeight > 0, description);
                assert.ok(image.width <= image.maxWidth + 1 && image.height <= image.maxHeight + 1, description);
                assert.ok(image.left >= image.frameLeft - 1 && image.right <= image.frameRight + 1, description);
                assert.ok(image.top >= image.frameTop - 1 && image.bottom <= image.frameBottom + 1, description);
                assert.ok(Math.abs(image.width / image.height - image.naturalWidth / image.naturalHeight) < 0.02, description);
            }
        }
    });
});

test('browser: a saved photo cutout can be previewed, toggled and deleted without losing the original', async () => {
    await session(async ({base, page, open}) => {
        const created = await seed(base, 'CUT-001');
        const bottleId = created.bottle.id;
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
        const photo = (await requestJson(base, `/api/bottles/${bottleId}/photos`, 'POST', {image:png})).data;
        const url = `/api/bottles/${bottleId}/photos/${photo.id}/cutout`;
        const cutout = (await requestJson(base, url, 'PUT', {image:png})).data;
        await open();
        await page.locator(`.whisky-card[data-id="${created.bottling.id}"]`).first().click();
        await page.locator(`[data-act="cutout-open"][data-photo-id="${photo.id}"]`).waitFor();
        assert.match(await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img`).getAttribute('src'), /cutout/);
        await page.locator(`[data-act="cutout-open"][data-photo-id="${photo.id}"]`).click();
        await page.locator('.cutout-workspace').waitFor();
        assert.equal(await page.locator('[data-cutout-preview]').getAttribute('src'), `/${cutout.cutout.path}`);
        assert.equal(await page.locator('[data-act="cutout-generate"]').count(), 0, 'a saved cutout has no redundant re-run button');
        await page.locator('[data-act="cutout-toggle"]').click();
        await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img[src="/${photo.path}"]`).waitFor();
        assert.equal(await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img`).getAttribute('src'), `/${photo.path}`);
        await page.locator(`[data-act="cutout-open"][data-photo-id="${photo.id}"]`).click();
        await page.locator('[data-act="cutout-remove"]').click();
        await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img`).waitFor();
        assert.equal((await requestJson(base, '/api/collection')).data.bottlings[0].bottles[0].photos[0].cutout, undefined);
        assert.equal(await page.locator(`[data-photo-tile][data-photo-id="${photo.id}"] img`).getAttribute('src'), `/${photo.path}`);
    });
});

test('browser: isolated slightly tilted bottle fills both vertical edges of transparent 2:3 cutout', async () => {
    await session(async ({page, open}) => {
        await open();
        const result = await page.evaluate(async () => {
            const {composeCutout} = await import(new URL('js/features/cutout/image.js', document.baseURI).href);
            const source = document.createElement('canvas');
            source.width = 720; source.height = 1080;
            const sc = source.getContext('2d');
            sc.fillStyle = '#bc7623'; sc.fillRect(0, 0, source.width, source.height);
            const img = new Image(); img.src = source.toDataURL('image/png'); await img.decode();
            const mask = new Uint8ClampedArray(320 * 320);
            for (let y = 28; y < 291; y++) {
                const mid = 160 + (y - 160) * Math.tan(6 * Math.PI / 180) * 1080 / 720;
                for (let x = Math.ceil(mid - 30); x <= mid + 30; x++) mask[y * 320 + x] = 255;
            }
            // High-confidence debris must be absent from the saved image, not just its crop.
            mask[0] = 255; mask[319] = 255;
            const cutout = new Image(); cutout.src = composeCutout(img, mask); await cutout.decode();
            const out = document.createElement('canvas');
            out.width = cutout.naturalWidth; out.height = cutout.naturalHeight;
            const ctx = out.getContext('2d', {willReadFrequently:true});
            ctx.drawImage(cutout, 0, 0);
            const rgba = ctx.getImageData(0, 0, out.width, out.height).data;
            const rowHasAlpha = y => {
                for (let x = 0; x < out.width; x++) {
                    if (rgba[(y * out.width + x) * 4 + 3] >= 8) return true;
                }
                return false;
            };
            return {width:out.width,height:out.height,top:rowHasAlpha(0),bottom:rowHasAlpha(out.height - 1),
                topLeft:rgba[3],topRight:rgba[(out.width - 1) * 4 + 3]};
        });
        assert.equal(result.width * 3, result.height * 2, 'the saved PNG must be exactly 2:3');
        assert.ok(result.top, 'the visible bottle reaches the first image row');
        assert.ok(result.bottom, 'the visible bottle reaches the final image row');
        assert.equal(result.topLeft, 0, 'no detached alpha at the outer top left');
        assert.equal(result.topRight, 0, 'no detached alpha at the outer top right');
    });
});

test('browser: cutout compositor sharpens the model feather into a narrow transparent bottle edge', async () => {
    await session(async ({page, open}) => {
        await open();
        const result = await page.evaluate(async () => {
            const {composeCutout} = await import(new URL('js/features/cutout/image.js', document.baseURI).href);
            const original = document.createElement('canvas');
            original.width = 640; original.height = 960;
            const sourceContext = original.getContext('2d');
            sourceContext.fillStyle = '#67829a';
            sourceContext.fillRect(0, 0, original.width, original.height);
            const photo = new Image();
            photo.src = original.toDataURL('image/png');
            await photo.decode();
            const mask = new Uint8ClampedArray(320 * 320);
            for (let y = 22; y < 298; y++) {
                for (let x = 108; x <= 212; x++) {
                    const distance = Math.min(x - 108, 212 - x);
                    mask[y * 320 + x] = Math.min(255, 25 * distance);
                }
            }
            const image = new Image();
            image.src = composeCutout(photo, mask);
            await image.decode();
            const output = document.createElement('canvas');
            output.width = image.naturalWidth; output.height = image.naturalHeight;
            const context = output.getContext('2d', {willReadFrequently:true});
            context.drawImage(image, 0, 0);
            const rgba = context.getImageData(0, Math.floor(output.height / 2), output.width, 1).data;
            const alphas = Array.from({length:output.width}, (_, x) => rgba[x * 4 + 3]);
            return {
                transition:alphas.filter(value => value > 0 && value < 255).length,
                opaque:alphas.filter(value => value === 255).length,
                transparent:alphas.filter(value => value === 0).length,
                ratio:output.width * 3 === output.height * 2,
            };
        });
        assert.equal(result.ratio, true, 'the PNG keeps the original 2:3 ratio');
        assert.ok(result.transition > 0 && result.transition <= 16,
            `the final edge needs narrow antialiasing, not a broad model feather: ${JSON.stringify(result)}`);
        assert.ok(result.opaque > 0 && result.transparent > 0,
            'the image has a fully opaque bottle and transparent background');
    });
});
