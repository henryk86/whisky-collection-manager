/**
 * Deterministic Chromium/CDP image and geometry regression for the design
 * system.
 * Zero runtime dependencies beyond the Chromium already installed by CI.
 * --update is an EXPLICIT, local, reviewed baseline operation. Never runs on
 * CI.
 * This is a separate visual layer; functional Playwright tests remain
 * tests/browser/.
 */
import {spawn} from 'node:child_process';
import {appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {startTestServer, requestJson} from '../tests/helpers/server.js';
import {comparePNG} from './visual-png.js';
import {assessCapture, browserWarning, pixelMode} from './visual-policy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES = path.join(ROOT, 'tests/visual/baselines');
const ARTIFACTS = path.join(ROOT, 'test-artifacts/designsystem-visual');
const update = process.argv.includes('--update');
const capture = process.argv.includes('--capture');
const CAPTURES = path.join(ARTIFACTS, 'captures');
if (capture && update) throw new Error('Capture cannot update baselines.');
const pixels = pixelMode(process.argv.slice(2), process.env);
if (update && process.env
  .CI) throw new Error('CI must never update visual baselines. Review them locally.');
if ((update || capture) && pixels === 'strict') {
  throw new Error('Capture/update cannot use strict verification.');
}
const widths = [390, 768, 1024, 1440];
const themes = ['light', 'dark'];
const date = '2026-11-20';
const snapshotClock = '2026-11-23T12:00:00.000Z';
// No global screenshot-area tolerance: even a small icon change must be
// visible in the report. Strict pixel mode requires an identical browser.
const COLOR_DELTA = 36;
const scenarios = [
  ['collection-empty', '/', '.empty-state'],
  ['bottling-partial', null, '.bottle-entry-facts'],
  ['bottling-full', null, '.tasting-summary-notes'],
  ['tasting-readonly', null, '.tasting-readonly-notes'],
  ['analytics', '/?view=analysis', '.analytics-page'],
  ['settings', '/?view=settings', '.settings-page'],
  ['settings-en', '/?view=settings&lang=en', '.settings-page'],
  ['help', '/?view=help', '.help-page'],
  ['help-en', '/?view=help&lang=en', '.help-page'],
  ['warehouse', '/?view=warehouse', '.warehouse-page'],
  ['tasting-list', '/?view=tastings', '.tasting-home-page'],
  ['modal-new', '/', '#modal-root .dialog'],
  ['modal-flight', '/?view=tastings', '#modal-root .flight-plan-form'],
  ['modal-flight-expanded', '/?view=tastings',
    '#modal-root .flight-plan-form'],
  ['modal-flight-help', '/?view=tastings', '#modal-root .flight-plan-help'],
  ['modal-edit', null, '#bottling-form'],
  ['modal-confirm', null, '#modal-root .ds-modal-footer'],
  ['bottling-long', null, '.bottle-entry-facts'],
];

let browser, socket, server, browserVersion;
let seq = 0;
const pending = new Map();
const problems = [];
const warnings = [];
const results = [];
const interactionChecks = [];
/**
 * Serializes command data to JSON.
 *
 * @param {*} method Value used by this operation.
 * @param {!Object=} params Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
function command(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {pending.delete(id); reject(new Error(`${method} timed out`));},
      25000
    );
    pending.set(
      id,
      {
        /**
         * Updates the resolve state for its caller.
         *
         * @param {*} v Value to evaluate.
         */
        resolve: v => {clearTimeout(timer); resolve(v);},
        /**
         * Updates the reject state for its caller.
         *
         * @param {*} e Value used by this operation.
         */
        reject: e => {clearTimeout(timer); reject(e);},
      }
    );
    socket.send(JSON.stringify({id, method, params}));
  });
}

/**
 * Validates the evaluate state and rejects invalid inputs.
 *
 * @param {*} expression Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function evaluate(expression) {
  const out = await command(
    'Runtime.evaluate',
    {expression, awaitPromise: true, returnByValue: true}
  );
  if (out.exceptionDetails) throw new Error(`Browser evaluation failed: ${out.exceptionDetails.text}`);
  return out.result?.value;
}

/**
 * Validates the until state and rejects invalid inputs.
 *
 * @param {*} expression Value used by this operation.
 * @param {*} label Label shown to the user.
 * @param {number=} tries Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function until(expression, label, tries = 80) {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await pause(100);
  }
  throw new Error(`Page did not render: ${label}`);
}

/**
 * Requests intercept data from the configured remote endpoint.
 *
 * @param {!Object} options Options controlling the operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function intercept({requestId, request}) {
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        'Content-Type': request.headers['Content-Type'] ||
          'application/json',
      },
      body: request.method === 'GET' || request.method === 'HEAD' ?
        undefined : request.postData,
    });
    const contents = Buffer.from(await response.arrayBuffer());
    const headers = [
      {
        name: 'Content-Type',
        value: response.headers.get('content-type') || 'text/plain',
      },
      {name: 'Access-Control-Allow-Origin', value: '*'},
      {name: 'Access-Control-Expose-Headers', value: 'ETag, X-WCM-Store-ETag'},
      ...(response.headers.get('etag') ?
        [{name: 'ETag', value: response.headers.get('etag')}] : []),
    ];
    await command(
      'Fetch.fulfillRequest',
      {
        requestId,
        responseCode: response.status,
        responseHeaders: headers,
        body: contents.toString('base64'),
      }
    );
  } catch (error) {
    console.error('CDP intercepted request:', error.message);
    await command('Fetch.failRequest', {requestId, errorReason: 'Failed'})
      .catch(() => {});
  }
}

/**
 * Validates the absolute chromium state and rejects invalid inputs.
 * @return {*} Result computed from the supplied inputs.
 */
function absoluteChromium() {
  const value = process.env.WCM_VISUAL_BROWSER_PATH || process.env
    .PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/chromium';
  if (!existsSync(value)) throw new Error(`Chromium executable not found: ${value}. CI must install Playwright Chromium first.`);
  return value;
}
const scratch = mkdtempSync(path.join(tmpdir(), 'wcm-visual-'));
/**
 * Parses boot data from JSON input.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function boot() {
  server = await startTestServer();
  browser = spawn(absoluteChromium(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--disable-extensions',
    '--disable-background-networking',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    `--user-data-dir=${scratch}`,
    '--remote-debugging-port=0',
    'about:blank',
  ], {stdio: ['ignore', 'ignore', 'pipe']});
  let port;
  for (let i = 0; i < 100; i++) {
    const file = path.join(scratch, 'DevToolsActivePort');
    if (existsSync(file)) {
      port = Number(readFileSync(file, 'utf8')
        .split('\n')[0]); break;
    }
    if (browser.exitCode !=
      null) throw new Error(`Chromium exited unexpectedly: ${browser.exitCode}`);
    await pause(100);
  }
  if (!port) throw new Error('Chromium did not expose its debugging port');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = pages.find(p => p.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen =
      resolve; socket.onerror = reject;
  });
  socket.onmessage = event => {
    const item = JSON.parse(event.data);
    if (item.method === 'Fetch.requestPaused') {
      intercept(item.params)
        .catch(console.error); return;
    }
    if (item.id && pending.has(item.id)) {
      const waiter = pending.get(item.id); pending.delete(item.id);
      item.error ? waiter.reject(new Error(item.error.message)) :
        waiter.resolve(item.result);
    }
  };
  browserVersion = (await command('Browser.getVersion')).product;
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Emulation.setTimezoneOverride', {timezoneId: 'Europe/Berlin'});
  await command('Emulation.setLocaleOverride', {locale: 'de-DE'});
  await command('Fetch.enable', {patterns: [{urlPattern: `${server.base}/*`}]});
}

/**
 * Renders the designsystem visual state.
 *
 * @param {*} route Route used by this operation.
 * @param {Function} selector Selector used by this operation.
 * @param {Function} action Mutation or UI action callback.
 * @param {*} scenarioName Scenario name used by this operation.
 */
async function render(route, selector, action, scenarioName) {
  // The project DOM-only browser harness uses the same intercepted HTTP assets.
  // This allows capture when top-level localhost navigation is blocked.
  await command(
    'Page.navigate',
    {url: `about:blank${route === '/' ? '' : route.slice(1)}`}
  );
  await evaluate('history.pushState = () => undefined; history.replaceState = () => undefined');
  // Freeze only browser time before the application's entry module executes.
  // API data remains isolated/deterministic and unchanged.
  await evaluate(`(()=>{const NativeDate=Date;const fixed=${JSON.stringify(snapshotClock)};
    globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}
    static now(){return NativeDate.parse(fixed);}};})()`);
  const html = await (await fetch(server.base)).text();
  const frame = (await command('Page.getFrameTree')).frameTree.frame.id;
  await command(
    'Page.setDocumentContent',
    {
      frameId: frame,
      html: html.replace('<head>', `<head><base href="${server.base}/">`),
    }
  );
  await until(`document.querySelector('.site-header')`, 'site-header');
  if (action) {
    await until(
      `document.querySelector(${JSON.stringify(action[0])})`,
      action[0]
    );
    await evaluate(`document.querySelector(${JSON.stringify(action[0])}).click()`);
    if (action[1]) {
      if (scenarioName === 'modal-flight-help') {
        await evaluate(`(()=>{const form=document.querySelector('.flight-plan-form'); form.dataset.qaIdentity='original-dom'; form.querySelector('[data-flight-name]').value='Preserved flight';form.querySelector('[data-flight-notes]').value='Unsaved notes';})()`);
      }
      await until(
        `document.querySelector(${JSON.stringify(action[1])})`,
        action[1]
      );
      await evaluate(`document.querySelector(${JSON.stringify(action[1])}).click()`);
    }
  }
  await until(`document.querySelector(${JSON.stringify(selector)})`, selector);
  await evaluate(`(async()=>{
    const style = document.createElement('style');
    style.textContent = ':root{--sans:Arial,sans-serif} *,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
    document.head.append(style);
    if(document.fonts?.ready) await document.fonts.ready;
  })()`);
}

/**
 * Opens every cask refinement using the actual planner controls.
 * @return {!Promise<void>} Completion of the expanded fixture setup.
 */
async function expandFlightPlanner() {
  await evaluate(`(()=>{
    const form = document.querySelector('.flight-plan-form');
    const select = (selector, value) => {
      const field = form.querySelector(selector);
      field.value = value;
      field.dispatchEvent(new Event('change', {bubbles:true}));
    };
    form.querySelector('.flight-plan-advanced > summary').click();
    select('[data-flight-plan-style]', 'discover');
    select('[data-flight-plan-cask-mode]', 'specific');
    select('[data-flight-plan-age-mode]', 'range');
    for (const input of form.querySelectorAll('[name^="flight-cask-group-"]')) {
      if (!input.checked) input.click();
    }
    for (const detail of form.querySelectorAll(
      '[data-flight-plan-cask-subtype-wrap]')) {
      if (!detail.open) detail.querySelector('summary').click();
      const first = detail.querySelector('input[type="checkbox"]');
      if (first && !first.checked) first.click();
    }
    const strict = form.querySelector('[name="flight-plan-strict"]');
    if (!strict.checked) strict.click();
    strict.focus({preventScroll:true});
    document.querySelector('#modal-root .dialog').scrollTop = 0;
  })()`);
  const expanded = await evaluate(`(()=>{
    const form = document.querySelector('.flight-plan-form');
    const groups = [...form.querySelectorAll('[name^="flight-cask-group-"]')];
    const details = [...form.querySelectorAll(
      '[data-flight-plan-cask-subtype-wrap]')];
    return groups.length > 0 && groups.every(el => el.checked) &&
      details.length > 0 && details.every(el => el.open && !el.hidden &&
        el.getBoundingClientRect().height > 0) &&
      ['.flight-plan-advanced', '[data-flight-plan-cask-group-wrap]',
        '[data-flight-plan-age-range-wrap]', '[data-flight-plan-strict-wrap]',
        '[data-flight-plan-unfamiliar-wrap]'].every(selector =>
        form.querySelector(selector).getBoundingClientRect().height > 0);
  })()`);
  if (!expanded) throw new Error('Expanded flight fixture is incomplete');
}

/**
 * Enlarges only the expanded scenario to include the entire scrollable modal.
 * @param {number} width Viewport width in CSS pixels.
 * @return {!Promise<number>} Actual capture viewport height.
 */
async function fitFlightPlanner(width) {
  const required = await evaluate(`(()=>{
    const dialog = document.querySelector('#modal-root .dialog');
    return Math.ceil((dialog.scrollHeight + 12) / 0.94) + 32;
  })()`);
  const height = Math.max(1100, required);
  await command('Emulation.setDeviceMetricsOverride',
    {width, height, deviceScaleFactor: 1, mobile: false});
  const complete = await evaluate(`(()=>{
    const dialog = document.querySelector('#modal-root .dialog');
    dialog.scrollTop = 0;
    const rect = dialog.getBoundingClientRect();
    return dialog.scrollHeight <= dialog.clientHeight + 1 &&
      dialog.scrollWidth <= dialog.clientWidth + 1 &&
      rect.top >= 0 && rect.bottom <= innerHeight;
  })()`);
  if (!complete) {
    throw new Error('Expanded flight modal is clipped or overflows');
  }
  return height;
}

/**
 * Locates the DOM elements used by geometry expression.
 * @return {string} Resulting text.
 */
function geometryExpression() {
  return `JSON.stringify((()=>{
    const rect = el => {
      if (!el) return null;
      const r=el.getBoundingClientRect();
      return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100);
    };
    return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
      main:rect(document.querySelector('main')),
      header:rect(document.querySelector('.site-header')),
      heading:rect(document.querySelector('.ds-page-header')),
      panel:rect(document.querySelector('.panel')),
      grid:rect(document.querySelector('[data-ds-detail-grid]')),
      field:rect(document.querySelector('[data-ds-detail-field]')),
      dialog:rect(document.querySelector('#modal-root .dialog')),
      footer:rect(document.querySelector('#modal-root .ds-modal-footer')),
      scrollbar:innerWidth-document.documentElement.clientWidth
    };
  })())`;
}

/**
 * Coordinates asynchronous work for key.
 *
 * @param {*} key Key used to select or group values.
 * @param {*} code Code used to identify a specific outcome.
 * @param {*} windowsVirtualKeyCode Windows virtual key code input for this
 * operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function key(key, code, windowsVirtualKeyCode) {
  for (const type of ['keyDown', 'keyUp']) await command(
    'Input.dispatchKeyEvent',
    {type, key, code, windowsVirtualKeyCode}
  );
}

/**
 * Validates modal interactions for designsystem visual.
 *
 * @param {string} name Name of the item.
 */
async function checkModalInteractions(name) {
  if (!name.startsWith('modal-')) return;
  const focus = await evaluate(`Boolean(document.activeElement?.closest?.('#modal-root .dialog'))`);
  if (!focus) throw new Error(`${name}: initial focus escaped the modal`);
  await evaluate(`document.querySelector('#modal-root .ds-modal-close').focus({preventScroll:true})`);
  await key('Tab', 'Tab', 9);
  if (!await evaluate(`Boolean(document.activeElement?.closest?.('#modal-root .dialog'))`))
    throw new Error(`${name}: Tab escaped modal focus trap`);
  await key('Escape', 'Escape', 27);
  if (name === 'modal-flight-help') {
    await until(
      `document.querySelector('#modal-root [data-flight-name]')`,
      'restored parent flight'
    );
    const original = await evaluate(`(()=>{const f=document.querySelector('#modal-root .flight-plan-form');return f?.dataset.qaIdentity==='original-dom' && f.querySelector('[data-flight-name]').value==='Preserved flight' && f.querySelector('[data-flight-notes]').value==='Unsaved notes';})()`);
    if (!original) throw new Error('Nested help modal lost the original parent DOM or unsaved field values');
    interactionChecks.push('Flight help: same form DOM and unsaved values restored after Escape');
    await key('Escape', 'Escape', 27);
  }
  if (await evaluate(`Boolean(document.querySelector('#modal-root .dialog'))`)) throw new Error(`${name}: Escape did not close modal`);
  if (await evaluate(`Boolean(document.querySelector('main')?.inert)`)) throw new Error(`${name}: background remained inert after Escape`);
  interactionChecks.push(`${name}: initial focus, Tab trap, Escape and background restoration`);
  if (name === 'modal-new') {
    const before = await evaluate(`(()=>{document.querySelector('main').style.minHeight='1900px';scrollTo({top:520,behavior:'instant'});const r=document.querySelector('main').getBoundingClientRect();return {scroll:scrollY,left:r.left,width:r.width};})()`);
    if (before.scroll < 400) throw new Error('Could not establish nonzero background scroll');
    for (let cycle = 0; cycle < 3; cycle++) {
      await evaluate(`(()=>{const el=document.querySelector('header [data-act="new"]');el.focus({preventScroll:true});el.click()})()`);
      await until(
        `document.querySelector('#modal-root .dialog')`,
        'reopened modal'
      );
      const during = await evaluate(`(()=>{const r=document.querySelector('main').getBoundingClientRect();return {left:r.left,width:r.width};})()`);
      if (Math.abs(during.left - before.left) > 1 || Math.abs(during.width -
        before.width) > 1) throw new Error('Modal scrollbar produced a horizontal layout jump');
      await key('Escape', 'Escape', 27);
      const after = await evaluate(`({scroll:scrollY,focus:document.activeElement.matches('header [data-act="new"]')})`);
      if (Math.abs(after.scroll - before.scroll) > 1 ||
        !after.focus) throw new Error(`Modal cycle ${cycle} lost scroll or focus`);
    }
    interactionChecks.push('New modal: 3 reopen/close cycles at nonzero background scroll, no geometry jump');
  }
}

/**
 * Validates the seed fixtures state and rejects invalid inputs.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function seedFixtures() {
  const partial = await requestJson(server.base, '/api/bottlings', 'POST', {
    name: 'Designsystem Partially Filled',
    firstBottle: {inventoryNumber: '001230', status: 'closed'},
  });
  const full = await requestJson(server.base, '/api/bottlings', 'POST', {
    name: 'Designsystem Test Bottle',
    whiskyType: 'single_malt',
    abv: 46,
    volumeMl: 700,
    description: 'Ein Beschreibungstext mit mehreren Zeilen.\nDie zweite Zeile.',
    firstBottle: {
      inventoryNumber: '001234',
      status: 'closed',
      purchaseDate: '2026-11-01',
      purchasePrice: 49.9,
      merchant: 'Test Store',
      comment: 'Diese Flasche ist nur eine Testreferenz.',
    },
  });
  if (partial.status !== 201 || full.status !==
    201) throw new Error('Unable to seed visual test data');
  const fullId = full.data.bottling.id;
  const tasting = await requestJson(
    server.base,
    `/api/bottlings/${fullId}/tastings`,
    'POST',
    {
      tastedOn: date, rating: 85, whiskyColor: 'amber',
      tastingNotes: {
        nose: 'Reife Früchte',
        palate: 'Vanille und Eiche',
        finish: 'Lang und angenehm',
      },
      ratingComment: 'Rund und harmonisch',
    }
  );
  if (tasting.status !== 201) throw new Error('Unable to seed tasting');
  const long = await requestJson(server.base, '/api/bottlings', 'POST', {
    name: 'A very long single malt whisky title with numerous words, exceptional descriptors and a deliberately overflowing-looking name to test responsive line breaks in every interface language',
    description: 'An extended description that must not produce horizontal overflow. '.repeat(12),
    firstBottle: {inventoryNumber: '001235', status: 'closed'},
  });
  if (long.status !== 201) throw new Error('Unable to seed long-title fixture');
  return {
    partialId: partial.data.bottling.id,
    fullId,
    tastingId: tasting.data.id,
    longId: long.data.bottling.id,
  };
}

try {
  mkdirSync(ARTIFACTS, {recursive: true});
  if (update) mkdirSync(BASELINES, {recursive: true});
  await boot();
  if (capture) {
    rmSync(CAPTURES, {recursive: true, force: true});
    mkdirSync(CAPTURES, {recursive: true});
  }
  if (!update && !capture) {
    const manifestPath = path.join(BASELINES, 'manifest.json');
    if (!existsSync(manifestPath)) throw new Error('Approved visual manifest is missing. Baselines must be reviewed locally.');
    const baselineBrowser = JSON.parse(readFileSync(manifestPath, 'utf8'))
      .browser;
    const warning = browserWarning(browserVersion, baselineBrowser, pixels);
    if (warning) {
      warnings.push(warning);
      console.warn(`VISUAL NOTICE: ${warning}`);
    }
  }
  if (update) {
    writeFileSync(path.join(BASELINES, 'manifest.json'), JSON.stringify({
      description: 'Explicitly approved design-system baseline. Do not rewrite in CI.',
      source: 'corrected Phase-5 UI baseline', browser: browserVersion,
      snapshotClock, timezone: 'Europe/Berlin', locale: 'de-DE',
      dimensions: {widths, height: 1100, scale: 1}, themes,
      scenarios: scenarios.map(([id]) => id),
      note: 'Arial/sans-serif fallback, animation/transition and caret suppression only during capture',
    }, null, 2) + '\n');
  }
  let fixture;
  for (const [name, defaultRoute, selector] of scenarios) {
    // Capture the genuinely empty collection before inserting deterministic
    // bottles.
    if (name === 'bottling-partial') fixture = await seedFixtures();
    const routes = fixture ? {
      'bottling-partial': `/?bottling=${fixture.partialId}`,
      'bottling-full': `/?bottling=${fixture.fullId}`,
      'tasting-readonly': `/?bottling=${fixture.fullId}&tasting=${fixture.tastingId}`,
      'modal-edit': `/?bottling=${fixture.fullId}`,
      'modal-confirm': `/?bottling=${fixture.fullId}`,
      'bottling-long': `/?bottling=${fixture.longId}`,
    } : {};
    const route = routes[name] || defaultRoute;
    const action = name === 'modal-new' ? ['header [data-act="new"]']
      : name === 'modal-edit' ? ['[data-act="edit-bottling"]']
        : name === 'modal-confirm' ? ['[data-act="delete-bottling"]']
          : ['modal-flight', 'modal-flight-expanded'].includes(name) ?
            ['.tasting-flight-home [data-act="flight-plan-new"]']
            : name === 'modal-flight-help' ? [
              '.tasting-flight-home [data-act="flight-plan-new"]',
              '#modal-root [data-act="flight-plan-help"]',
            ]
              : null;
    try {
      await render(route, selector, action, name);
      if (name === 'modal-flight-expanded') await expandFlightPlanner();
    }
    catch (error) {problems.push(`${name}: ${error.message}`); console.error('FAIL', name, error.message); continue;}
    for (const width of widths) {
      await command(
        'Emulation.setDeviceMetricsOverride',
        {width, height: 1100, deviceScaleFactor: 1, mobile: false}
      );
      for (const theme of themes) {
        const id = `${name}__${width}__${theme}`;
        try {
          await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.documentElement.style.colorScheme=${JSON.stringify(theme)}`);
          // Force a layout flush before the screenshot; avoid arbitrary
          // sleep-based waits.
          await evaluate('document.body.getBoundingClientRect().width; document.fonts?.ready');
          let captureHeight = 1100;
          if (name === 'modal-flight-expanded') {
            captureHeight = await fitFlightPlanner(width);
          }
          const currentGeometry =
            JSON.parse(await evaluate(geometryExpression()));
          if (name === 'modal-flight-expanded') {
            currentGeometry.captureHeight = captureHeight;
          }
          const image = Buffer.from(
            (await command(
              'Page.captureScreenshot',
              {format: 'png', captureBeyondViewport: false}
            )).data,
            'base64'
          );
          const reference = path.join(BASELINES, `${id}.png`);
          const referenceGeometry = path.join(BASELINES, `${id}.json`);
          if (capture) {
            writeFileSync(path.join(CAPTURES, `${id}.png`), image);
            writeFileSync(path.join(CAPTURES, `${id}.json`),
              JSON.stringify(currentGeometry) + '\n');
            if (!Number.isFinite(currentGeometry.overflow) ||
              currentGeometry.overflow > 1) {
              problems.push(`${id}: horizontal overflow`);
            }
            results.push({id, status: 'captured'});
          } else if (update) {
            writeFileSync(reference, image);
            writeFileSync(
              referenceGeometry,
              JSON.stringify(currentGeometry, null, 2) + '\n'
            );
            results.push({id, percent: 0, status: 'baseline-created'});
          } else {
            const actualDir = path.join(ARTIFACTS, 'actual');
            if (!existsSync(reference) || !existsSync(referenceGeometry)) {
              problems.push(`${id}: approved snapshot missing, run --update locally and review`);
              mkdirSync(actualDir, {recursive: true}); writeFileSync(path.join(actualDir, `${id}.png`), image);
              continue;
            }
            const initial = JSON.parse(readFileSync(referenceGeometry, 'utf8'));
            const diff = comparePNG(readFileSync(reference), image);
            const assessment = assessCapture({
              before: initial, after: currentGeometry, changed: diff.changed,
              dimensions: diff.dimensions, mode: pixels,
            });
            if (assessment.blocking) {
              const cause = assessment.geometryErrors.length ?
                assessment.geometryErrors.join('; ') :
                `strict pixel difference: ${diff.percent}%`;
              problems.push(`${id}: ${cause}`);
            }
            // Pixel differences are reported, never silently accepted as visual
            // approval. Diagnostics must not mask a real geometry failure.
            const saveDiff = assessment.blocking || assessment.pixelChanged;
            if (saveDiff) {
              mkdirSync(actualDir, {recursive: true});
              mkdirSync(path.join(ARTIFACTS, 'diff'), {recursive: true});
              writeFileSync(path.join(actualDir, `${id}.png`), image);
              writeFileSync(
                path.join(ARTIFACTS, 'diff', `${id}.png`),
                diff.diff
              );
            }
            results.push({
              id, changedPixels: diff.changed, percent: diff.percent,
              dimensions: diff.dimensions,
              geometryErrors: assessment.geometryErrors,
              pixelChanged: assessment.pixelChanged, diffSaved: saveDiff,
              status: assessment.status,
            });
          }
        } catch (error) {
          problems.push(`${id}: ${error.message}`); console.error('FAIL', id, error.stack);
        }
      }
    }
    if (name === 'modal-flight-expanded') {
      await command('Emulation.setDeviceMetricsOverride',
        {
          width: widths.at(-1), height: 1100, deviceScaleFactor: 1,
          mobile: false,
        });
    }
    try {await checkModalInteractions(name);} catch (error) {problems.push(`${name} interaction: ${error.message}`); console.error('FAIL', name, error.message);}
    console.log(`${name}: ${results.filter(r => r.id
      .startsWith(`${name}__`) && r.status !== 'failed')
      .length} geometry checks passed`);
  }
} catch (error) {
  problems.push(`fatal: ${error.stack || error.message}`);
} finally {
  socket?.close(); browser?.kill(); await server?.stop();
  await pause(100);
  rmSync(scratch, {recursive: true, force: true});
  writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify({
    mode: capture ? 'capture' : update ?
      'explicit-baseline-update' : 'geometry-gate',
    pixelMode: capture ? 'not-compared' : pixels,
    browser: browserVersion,
    baselineBrowser: capture ? null :
      existsSync(path.join(BASELINES, 'manifest.json')) ?
        JSON.parse(readFileSync(path.join(BASELINES, 'manifest.json'),
          'utf8')).browser : 'unknown',
    snapshotClock,
    timezone: 'Europe/Berlin',
    locale: 'de-DE',
    viewportWidths: widths,
    themes,
    interactionChecks,
    total: results.length,
    passed: results.filter(r => r.status !== 'failed').length,
    pixelDifferences: results.filter(r => r.pixelChanged).length,
    diffArtifacts: results.filter(r => r.diffSaved).length,
    failed: problems.length,
    problems,
    warnings,
    results,
  }, null, 2) + '\n');
}
if (process.env.GITHUB_STEP_SUMMARY && !capture) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Design-system visual checks\n\n` +
    `- Blocking layout/interaction issues: **${problems.length}**\n` +
    `- Captures: **${results.length}**; pixel differences (diagnostic unless strict): **${results.filter(r => r.pixelChanged).length}**\n` +
    `- Browser: ${browserVersion ||
    'unavailable'}; approved references: ${existsSync(path.join(BASELINES, 'manifest.json')) ? JSON.parse(readFileSync(path.join(BASELINES, 'manifest.json'), 'utf8')).browser : 'missing'}\n` +
    `- Reference images were not modified. See the uploaded visual artifacts for actual images, diffs and report.\n\n`);
}
if (capture) {
  console.log(`Designsystem visual: ${results.length} fresh captures, ` +
    `${problems.length} blocking issues; no local baseline comparison. ` +
    'Report: test-artifacts/designsystem-visual/report.json');
} else {
  console.log(`Designsystem visual: ${results.length} captures, ` +
    `${problems.length} blocking issues, ` +
    `${results.filter(r => r.pixelChanged)
      .length} pixel differences (${pixels} mode), ` +
    `${results.filter(r => r.diffSaved)
      .length} diagnostic diffs saved. ` +
    'Report: test-artifacts/designsystem-visual/report.json');
}
if (problems.length) {for (const problem of problems) console.error(`FAIL ${problem}`); process.exitCode = 1;}
