import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {startTestServer, requestJson} from '../helpers/server.js';
// Some managed environments block all top-level browser URLs. The explicit DOM
// mode renders real modules/CSS via intercepted requests; History is stubbed
// there.
// Normal local/CI runs use real navigation. Neither mode tests optical
// recognition.
export const domOnly = process.env.WHISKY_BROWSER_DOM_ONLY === 'true';
let browser;
let failedSessionCapture = 0;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    headless: true,
    args: process.env.CI || domOnly ? ['--no-sandbox'] : [],
  });
  fs.mkdirSync('test-artifacts', {
    recursive: true,
  });
});
after(async () => {
  await browser?.close();
});
/**
 * Controls app for support.
 *
 * @param {*} page Page used by this operation.
 * @param {*} base Base used by this operation.
 * @param {!Object=} options Optional configuration for the operation.
 */
async function openApp(page, base, options = {}) {
  // Locale overrides apply to real Chromium navigation as well as the DOM-only
  // harness.
  if (domOnly || options.localeOverrides) await page.route(
    `${base}/**`,
    async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      // The photo cutout tests register a synthetic ONNX runtime before open().
      // In DOM-only mode this catch-all route is installed later, so it must
      // defer to that earlier, more specific route rather than shadow it.
      if (domOnly && pathname ===
        '/ai/vendor/ort.wasm.min.mjs') return route.fallback();
      if (options.localeOverrides &&
        Object.hasOwn(options.localeOverrides, pathname)) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          headers: {'Access-Control-Allow-Origin': '*'},
          body: JSON.stringify(options.localeOverrides[pathname]),
        });
      }
      const response = await fetch(request.url(), {
        method: request.method(),
        headers: {
          ...(request.postData() ?
            {
              'Content-Type': request.headers()['content-type'] ||
                'application/json',
            } : {}),
          ...(request.headers()['x-wcm-state-delta'] === '1' ?
            {'X-WCM-State-Delta': '1'} : {}),
          ...(request.headers()['if-none-match'] ?
            {'If-None-Match': request.headers()['if-none-match']} : {}),
        },
        body: request.postData() || undefined,
      });
      await route.fulfill({
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'ETag, X-WCM-Store-ETag',
          ...(response.headers.get('etag') ? {
            'ETag': response.headers
              .get('etag'),
          } : {}),
          ...(response.headers.get('x-wcm-store-etag') ?
            {
              'X-WCM-Store-ETag': response.headers
                .get('x-wcm-store-etag'),
            } : {}),
        },
        body: Buffer.from(await response.arrayBuffer()),
      });
    }
  );
  if (!domOnly) {
    await page.goto(`${base}/${options.query || ''}`);
    // The entry module performs async locale loading and an async API refresh.
    // A completed navigation alone does not guarantee the app has rendered.
    await page.locator('.site-header').waitFor({state: 'visible'});
    return;
  }
  await page.goto(`about:blank${options.query || ''}`);
  await page.evaluate(() => {
    window.__historyCalls = [];
    for (const method of ['pushState', 'replaceState']) {
      history[method] = (...args) => window.__historyCalls.push({
        method, url: args[2],
      });
    }
  });
  const html = await (await fetch(base)).text();
  await page.setContent(html.replace('<head>', `<head><base href="${base}/">`));
  // In DOM-only mode the ES modules and initial API refresh are asynchronous.
  // Wait for the actual application, not just for setContent() to finish.
  await page.locator('.site-header').waitFor({state: 'visible'});
}

/**
 * Creates an isolated browser session for a functional scenario.
 *
 * @param {Function} callback Callback invoked by this operation.
 * @param {*=} activeBrowser Active browser used by this operation.
 */
export async function session(callback, activeBrowser = browser) {
  const server = await startTestServer();
  const context = await activeBrowser.newContext({
    viewport: {
      width: 1366, height: 900,
    },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await callback({
      ...server, page,
      /**
       * Performs the open lifecycle action.
       *
       * @param {*} options Options controlling the operation.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      open: options => openApp(page, server.base, options),
    });
    assert.deepEqual(errors, [], 'Unexpected browser errors');
  }
  catch (error) {
    // Screenshot is diagnostic only; never replace the original assertion.
    // Generated exclusively from synthetic per-test fixtures, not user data.
    const filename = `test-artifacts/browser-failure-${process
      .pid}-${++failedSessionCapture}.png`;
    try {
      await page.screenshot({
        path: filename, fullPage: true, animations:
          'disabled',
      });
    }
    catch { /* A crashed or closed page must not conceal the original error. */}
    throw error;
  }
  finally {
    await context.close();
    await server.stop();
  }
}

/**
 * Controls settings from menu for support.
 *
 * @param {*} page Page used by this operation.
 */
export async function openSettingsFromMenu(page) {
  await page.locator('header [data-act="toggle-menu"]').click();
  await page.locator('#site-drawer [data-act="goto-settings-menu"]').click();
  await page.getByRole('heading', {name: 'Einstellungen & Datensicherung'})
    .waitFor();
}
// Settings now have four mutually exclusive panels. Tests must explicitly open
// the required panel instead of interacting with controls hidden in another
// one.
// Use the same desktop navigation/mobile selector as a real user.

/**
 * Controls settings section for support.
 *
 * @param {*} page Page used by this operation.
 * @param {string} id Identifier used to select the relevant record.
 */
export async function openSettingsSection(page, id) {
  const desktop = page.locator(
    `.settings-page .section-nav-desktop [data-settings-section="${id}"]`);
  if (await desktop.isVisible()) await desktop.click();
  else await page.locator('.settings-page [data-section-switch="settings"]')
    .selectOption(id);
  await page.locator(`[data-settings-panel="${id}"]`)
    .waitFor({state: 'visible'});
}

/**
 * Initializes a test collection and its warehouse fixtures.
 *
 * @param {*} base Base used by this operation.
 * @param {string=} number Number used by this operation.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
export async function seed(base, number = '000123') {
  const result = await requestJson(base, '/api/bottlings', 'POST', {
    name: 'Browser Test Blend',
    whiskyType: 'blended_malt',
    abv: 46,
    volumeMl: 700,
    firstBottle: {
      inventoryNumber: number, status: 'closed',
    },
  });
  assert.equal(result.status, 201);
  return result.data;
}

/**
 * Installs a deterministic barcode decoder for browser tests.
 *
 * @param {*} page Page used by this operation.
 */
export async function mockDecoder(page) {
  await page.evaluate(() => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true, value: true,
    });
    if (!navigator.mediaDevices?.getUserMedia) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true, value: {
          /**
           * Retrieves user media from the available state.
           */
          getUserMedia() {
          },
        },
      });
    }
    window.Html5QrcodeSupportedFormats = {
      QR_CODE: 0, CODE_128: 1,
    };
    window.__stopped = 0;
    window.Html5Qrcode = class {
      /**
       * Performs the start lifecycle action.
       *
       * @param {*} camera Value used by this operation.
       * @param {*} options Options controlling the operation.
       * @param {*} decoded Value used by this operation.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      async start(camera, options, decoded) {
        window.__decoded = decoded;
      }

      /**
       * Performs the stop lifecycle action.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      async stop() {
        window.__stopped++;
      }

      /**
       * Updates the clear state for its caller.
       */
      clear() {
      }
    };
  });
}

export {chromium};
