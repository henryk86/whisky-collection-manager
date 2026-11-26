import {composeMarkup} from './render-plan.js';
import {t} from '../i18n/index.js';
import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/flavor-profile.html');


/**
 * Resolves the localized label for a flavour-profile axis.
 *
 * @param {string} axis Flavor-axis identifier used to resolve the localized title.
 * @return {*} Localized title for the requested flavor axis.
 */
export const flavorAxisTitle = axis => t(`flavor.axis.${axis}`);
const radius = 118, cx = 230, cy = 195;
const step = 2 * Math.PI / FLAVOR_AXES.length;
/**
 * Calculates the radar-axis angle in radians, starting at the top of the chart.
 *
 * @param {*} index Zero-based index of the selected entry.
 * @return {number} Axis angle in radians relative to the positive x-axis.
 */
const angleAt = index => -Math.PI / 2 + index * step;

/**
 * Converts an axis index and score into Cartesian radar-chart coordinates.
 *
 * @param {*} index Zero-based index of the selected entry.
 * @param {*} value Value to process.
 * @return {!Array<number>} Resulting entries in their output order.
 */
const point = (index, value) => {
  const angle = angleAt(index);
  return [cx + Math.cos(angle) * (value / 10) * radius, cy + Math.sin(angle) * (value / 10) * radius];
};

/**
 * Calculates present from the inputs.
 *
 * @param {*} value Value to process.
 * @return {boolean} True for an integer flavor score from zero to ten.
 */
const scorePresent = value => Number.isInteger(value) && value >= 0 && value <= 10;

/**
 * Reads the flavor-axis scores from the editor, preserving unset axes as null.
 *
 * @param {*} section Flavor editor section containing one score control per axis.
 * @return {!Object} Array of values selected for the caller.
 */
const scoresFromEditor = section => Object.fromEntries(FLAVOR_AXES.map(axis => {
  const input = section.querySelector(`[name="flavor-${axis}"]`);
  return [axis, input.dataset?.flavorUnset ? null : Number(input.value)];
}));

/**
 * Calculates radar-chart polygon points from flavour scores.
 *
 * @param {?Record<string, number|null>} values Recorded scores by flavor axis; null denotes an unrecorded profile.
 * @return {string} SVG polygon point list containing only assessed axes.
 */
export function flavorPolygon(values) {
  // Omit unassessed points from older tastings instead of silently plotting
  // them at zero.
  return FLAVOR_AXES.flatMap((axis, index) => scorePresent(values?.[axis]) ? [point(index, values[axis]).map(n => n.toFixed(2)).join(',')] : [])
    .join(' ');
}

/**
 * Prepares taste radar and its labels, or the unrecorded-profile hint.
 *
 * @param {?Record<string, number|null>} values Recorded scores by flavor axis; null denotes an unrecorded profile.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {!import('./render-plan.js').RenderPlan} Taste radar and its labels, or the unrecorded-profile hint.
 */
export function flavorChart(values, {editable = false, colorSection = null,
  compact = false} = {}) {
  if (!values && !editable) return renderTemplate('hint', {notRecorded: t('flavor.notRecorded'), });
  const scores = values || Object.fromEntries(FLAVOR_AXES.map(axis => [axis, 0]));
  return renderTemplate('flavorEditor', {
    editable: editable ? ' is-editable' : '',
    colorSection: colorSection ? ' has-color' : '',
    compact: compact ? ' is-preview' : '',
    dataFlavorEditorAttributes: editable ? {"data-flavor-editor": "", "data-flavor-set": values ? '1' : ''} : {},
    colorControl: colorSection || '',
    chartLabel: t('flavor.chartLabel'),
    content: composeMarkup([2, 4, 6, 8, 10].map(score =>
      renderTemplate('flavorGrid', {gridPoints: FLAVOR_AXES.map((_, i) => point(i, score).join(',')).join(' '), }))),
    axisLines: composeMarkup(FLAVOR_AXES.map((axis, i) => {
      const [x, y] = point(i, 10);
      return renderTemplate('flavorGrid2', {
        cx: cx,
        cy: cy,
        x: x,
        y: y,
      });
    })),
    flavorPolygon: flavorPolygon(scores),
    flavorHitTarget: editable ?
      renderTemplate('flavorHitTarget', {
        cx: cx,
        cy: cy,
        radius: radius,
      }) : '',
    scoreMarkers: composeMarkup(FLAVOR_AXES.map((axis, i) => {
      const score = scores[axis]; const [x, y] = point(i, scorePresent(score) ? score : 0);
      return renderTemplate('flavorPoint', {
        i: i,
        x: x,
        y: y,
        editable: editable ? 6 : 4,
        visibilityAttributes: scorePresent(score) ? {} : {"visibility": "hidden"},
      });
    })),
    axisLabels: composeMarkup(FLAVOR_AXES.map((axis, i) => {
      const [x, y] = point(i, compact ? 11.2 : 13.5); const side = Math.cos(angleAt(i)); const anchor = side > .3 ? 'start' : side < -.3 ? 'end' : 'middle';
      return renderTemplate('flavorAxisText', {
        x: x,
        y: y,
        anchor: anchor,
        flavorAxisTitle: flavorAxisTitle(axis),
      });
    })),
    sliderPanel: compact ? '' :
      renderTemplate('flavorSliders', {
        axisSliders: composeMarkup(FLAVOR_AXES.map((axis,
          i) => {
          const score = scores[axis]; const missing = !scorePresent(score); return renderTemplate('flavorScale', {
            flavorAxisTitle: flavorAxisTitle(axis),
            input: editable ?
              renderTemplate('flavorChartInput', {
                missing: missing ? 0 : score,
                axis: axis,
                i: i,
                dataFlavorUnsetAttributes: missing ? {"data-flavor-unset": "1"} : {},
                flavorAxisTitle: flavorAxisTitle(axis),
                flavorValue: i,
                displayScore: missing ? '–' : score,
              }) : renderTemplate('strong', {missing: missing ? '–' : `${score} / 10`, }),
          });
        })),
      }),
  });
}

/**
 * Parses flavor profile for flavor profile.
 *
 * @param {*} form Form containing the optional flavor editor and its current set/unset state.
 * @return {?Object} Profile keyed by flavor axis, or null when no flavor profile has been set.
 */
export function readFlavorProfile(form) {
  const section = form?.querySelector('[data-flavor-editor]');
  if (!section || !section.dataset.flavorSet) return null;
  return scoresFromEditor(section);
}

/**
 * Handles a flavor slider change and synchronizes the profile visualization.
 *
 * @param {{target: EventTarget|null}} event Native or synthetic event identifying the changed flavor slider.
 * @return {boolean} True if the event belongs to a mounted flavor editor.
 */
export function handleFlavorRange(event) {
  const range = /** @type {HTMLElement} */ (/** @type {Element} */ (event.target).closest?.('[data-flavor-range]'));
  if (!range) return false;
  const container = /** @type {HTMLElement} */ (range.closest('[data-flavor-editor]'));
  if (!container) return false;
  if (range.dataset) delete range.dataset.flavorUnset;
  container.dataset.flavorSet = '1';
  const values = scoresFromEditor(container);
  container.querySelector('[data-flavor-polygon]').setAttribute('points', flavorPolygon(values));
  FLAVOR_AXES.forEach((axis, i) => {
    const present = scorePresent(values[axis]);
    const [x, y] = point(i, present ? values[axis] : 0);
    const marker = container.querySelector(`[data-flavor-point="${i}"]`);
    marker?.setAttribute('cx', String(x)); marker?.setAttribute('cy', String(y));
    marker?.setAttribute('visibility', present ? 'visible' : 'hidden');
    const out = container.querySelector(`[data-flavor-value="${i}"]`);
    if (out) out.textContent = present ? String(values[axis]) : '–';
  });
  return true;
}

/**
 * Accessible native sliders are the input controls. SVG rays are optional
 * touch targets.
 *
 * @param {!PointerEvent} event Event that triggered the handler.
 * @return {boolean} True if the pointer event updated a flavor axis.
 */
export function setFlavorFromPointer(event) {
  const hit = /** @type {SVGElement} */ (/** @type {Element} */ (event.target).closest?.('[data-flavor-hit]'));
  if (!hit) return false;
  const svg = hit.ownerSVGElement;
  const pointInSvg = svg.createSVGPoint(); pointInSvg.x = event.clientX; pointInSvg.y = event.clientY;
  const matrix = svg.getScreenCTM(); if (!matrix) return false;
  const pos = pointInSvg.matrixTransform(matrix.inverse());
  const rawAngle = Math.atan2(pos.y - cy, pos.x - cx);
  const index = ((Math.round((rawAngle + Math.PI / 2) / step) % FLAVOR_AXES.length) + FLAVOR_AXES.length) % FLAVOR_AXES.length;
  const angle = angleAt(index);
  const projected = (pos.x - cx) * Math.cos(angle) + (pos.y - cy) * Math.sin(angle);
  const slider = /** @type {HTMLInputElement} */ (hit.closest('[data-flavor-editor]').querySelector(`[data-flavor-range="${index}"]`));
  slider.value = String(Math.max(0, Math.min(10, Math.round(projected / radius * 10))));
  handleFlavorRange({target: slider}); return true;
}

/**
 * Keep the SVG, native sliders and accessibility labels in sync after
 * undo/redo.
 *
 * @param {*} container Flavor editor container whose inputs, score labels and chart are updated.
 * @param {?Record<string, number|null>} values Recorded scores by flavor axis; null denotes an unrecorded profile.
 */
export function displayFlavorProfile(container, values) {
  if (!container) return;
  const scores = values || Object.fromEntries(FLAVOR_AXES.map(axis => [axis, 0]));
  const sliders = FLAVOR_AXES.map((axis, i) => container.querySelector(`[data-flavor-range="${i}"]`));
  sliders.forEach((slider, i) => {
    if (!slider) return;
    const score = scores[FLAVOR_AXES[i]];
    slider.value = String(scorePresent(score) ? score : 0);
    if (slider.dataset) {
      if (scorePresent(score)) delete slider.dataset.flavorUnset;
      else slider.dataset.flavorUnset = '1';
    }
  });
  // Update the drawing without marking unassessed axes as explicitly zero.
  // handleFlavorRange clears only the slider it receives, so update via a
  // previously recorded axis.
  const recordedIndex = scores && FLAVOR_AXES.findIndex(axis => scorePresent(scores[axis]));
  const recorded = sliders[recordedIndex < 0 ? 0 : recordedIndex];
  if (recorded) handleFlavorRange({target: recorded});
  const editor = container.matches?.('[data-flavor-editor]') ? container : container.querySelector('[data-flavor-editor]');
  if (editor) editor.dataset.flavorSet = values ? '1' : '';
}
