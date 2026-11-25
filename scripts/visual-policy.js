/**
 * @fileoverview Blocking layout checks and opt-in pixel verification rules.
 * Pixel changes are diagnostic until screenshots have been reapproved using
 * the exact Chromium build used by the CI runner.
 */

/**
 * Resolves the requested visual comparison policy.
 * @param {!Array<string>} args Command-line arguments.
 * @param {!Object<string, string|undefined>} env Environment variables.
 * @return {'diagnostic'|'strict'} Effective pixel policy.
 */
export function pixelMode(args = [], env = {}) {
  const requested = args.includes('--strict-pixels') ? 'strict' : (env.WCM_VISUAL_PIXEL_MODE || 'diagnostic');
  if (!['diagnostic', 'strict'].includes(requested)) {
    throw new Error(`Invalid pixel mode "${requested}"; use diagnostic or strict.`);
  }
  return requested;
}

/**
 * Checks that a strict pixel comparison has an identical browser renderer.
 *
 * @param {string} browser Version reported by the running browser.
 * @param {string} baselineBrowser Version recorded with the approved
 * snapshots.
 * @param {'diagnostic'|'strict'} mode Effective pixel policy.
 * @return {string|null} Non-blocking version warning in diagnostic mode.
 */
export function browserWarning(browser, baselineBrowser, mode) {
  if (browser && baselineBrowser && browser === baselineBrowser) return null;
  const message =
    `Visual baseline browser mismatch: reference=${baselineBrowser || 'unknown'}, ` +
    `runner=${browser || 'unknown'}. Browser/font rasterization may change screenshots. ` +
    'Use the pinned CI Chromium and approve new baselines manually before enabling strict pixels.';
  if (mode === 'strict') throw new Error(`${message} Strict pixel verification was not started.`);
  return message;
}

/**
 * Compares the recorded rectangles and detects horizontal overflow.
 *
 * @param {?Object<string, *>} before Approved reference geometry.
 * @param {?Object<string, *>} after Current browser geometry.
 * @return {!Array<string>} Blocking geometry failures.
 */
export function compareGeometry(before, after) {
  if (!before || !after) return ['missing geometry'];
  const mismatches = [];
  if (!Number.isFinite(after.overflow) || after.overflow > 1) {
    mismatches.push(`horizontal overflow ${after.overflow}px`);
  }
  for (const key of ['main', 'header', 'heading', 'panel', 'grid', 'field',
    'dialog', 'footer']) {
    const a = before[key];
    const b = after[key];
    if (Boolean(a) !== Boolean(b)) {
      mismatches.push(`${key} presence changed`);
    } else if (a && (!Array.isArray(b) || a.some((value, i) => Math.abs(value - b[i]) > 2))) {
      mismatches.push(`${key} moved/resized: ${a} -> ${b}`);
    }
  }
  return mismatches;
}

/**
 * Separates blocking geometry defects from diagnostic image differences. In
 * strict mode, even one pixel past the per-pixel colour delta is blocking;
 * there is deliberately no global screenshot-area tolerance.
 *
 * @param {*} capture Capture metrics.
 * @return {{geometryErrors: !Array<string>, pixelChanged: boolean,
 *     blocking: boolean, status: string}} Capture assessment.
 */
export function assessCapture(capture) {
  const geometryErrors = compareGeometry(capture.before, capture.after);
  const [beforeWidth, beforeHeight, currentWidth, currentHeight] = capture.dimensions;
  if (beforeWidth !== currentWidth || beforeHeight !== currentHeight) {
    geometryErrors.push(`screenshot dimensions changed: ${capture.dimensions.join(' -> ')}`);
  }
  const pixelChanged = capture.changed > 0;
  const blocking = geometryErrors.length > 0 || (capture.mode === 'strict' && pixelChanged);
  return {
    geometryErrors,
    pixelChanged,
    blocking,
    status: blocking ? 'failed' : pixelChanged ? 'diagnostic' : 'passed',
  };
}
