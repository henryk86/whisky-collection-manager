import {
  CASK_GROUPS, CASK_DIMENSIONS, CASK_PHASES,
} from '../domain/flight-casks.js';
import {checkboxInput} from './fields.js';
import {actionButton} from './buttons.js';
import {chevronDownIcon} from './action-icons.js';
import {escapeHtml} from './dom.js';

/**
 * Returns the form field name for a cask category.
 * @param {string} group Category identifier.
 * @return {string} Stable form field name.
 */
const groupField = group => `flight-cask-group-${group}`;

/**
 * Returns a unique field name for a category-scoped feature.
 * @param {string} group Category identifier.
 * @param {string} dimension Feature dimension.
 * @param {string} value Feature identifier.
 * @return {string} Stable form field name.
 */
const featureField = (group, dimension, value) =>
  `flight-cask-feature-${group}-${dimension}-${value}`;

/**
 * Renders optional category-scoped criteria using shared form fields.
 * All groups and dimensions come from the same domain vocabulary.
 * @param {function(string): string} t Translation lookup.
 * @return {string} Planner controls with initially hidden refinements.
 */
export function flightCaskOptionsHtml(t) {
  const prefix = 'flightPlan.caskAge.';
  /**
   * Looks up the translated label for a cask category.
   * @param {string} group Category identifier.
   * @return {string} Display label.
   */
  const groupLabel = group => t(`${prefix}group.${group}`);
  const groups = CASK_GROUPS.map(group => checkboxInput(groupLabel(group),
    groupField(group))).join('');
  const details = CASK_GROUPS.filter(group =>
    Object.keys(CASK_DIMENSIONS[group]).length).map(group => {
      const dimensions = Object.entries(CASK_DIMENSIONS[group]).map(
        ([dimension, values]) => {
          const title = escapeHtml(t(`${prefix}dimension.${dimension}`));
          const fields = values.map(value => checkboxInput(
            t(`${prefix}subtype.${value}`),
            featureField(group, dimension, value)
          )).join('');
          return `<div class="flight-plan-cask-dimension" role="group"
          aria-label="${title}"><span>${title}</span>
          <div class="flight-plan-cask-choices">${fields}</div></div>`;
        }).join('');
      const title = escapeHtml(groupLabel(group));
      const all = escapeHtml(t(`${prefix}allTypes`));
      return `<details class="flight-plan-cask-refinement"
      data-flight-plan-cask-subtype-wrap="${group}" hidden>
      <summary><span>${title}</span>
        <span class="flight-plan-cask-count" data-flight-plan-cask-count
          >${all}</span>${chevronDownIcon('flight-plan-cask-chevron')}
      </summary><div class="flight-plan-cask-dimensions">${dimensions}</div>
    </details>`;
    }).join('');
  const label = escapeHtml(t(`${prefix}caskGroup`));
  const hint = escapeHtml(t(`${prefix}groupHint`));
  const phaseLabel = escapeHtml(t(`${prefix}phase`));
  const phases = CASK_PHASES.map(phase => {
    const text = escapeHtml(t(`${prefix}phase.${phase}`));
    return `<option value="${phase}">${text}</option>`;
  }).join('');
  const reset = actionButton({
    label: t(`${prefix}reset`),
    action: 'flight-plan-cask-reset', size: 'small', variant: 'text',
  });
  return `<div class="flight-plan-cask-filter"
    data-flight-plan-cask-group-wrap hidden>
    <div class="form-field full" role="group" aria-label="${label}"
      aria-describedby="flight-plan-cask-hint">
      <div class="flight-plan-cask-heading"><span>${label}</span>${reset}</div>
      <span class="ds-field-description" id="flight-plan-cask-hint"
        >${hint}</span>
      <div class="flight-plan-cask-choices">${groups}</div>
    </div>
    <div class="flight-plan-cask-details" data-flight-plan-cask-details hidden>
      <span class="flight-plan-cask-caption">${escapeHtml(t(
    `${prefix}refine`))}</span>${details}
    </div>
    <div class="flight-plan-options flight-plan-advanced-grid">
      <label>${phaseLabel}
        <select data-flight-plan-cask-phase>${phases}</select>
      </label>
    </div>
    <div class="flight-plan-cask-selection" aria-live="polite">
      <span class="flight-plan-cask-caption">${escapeHtml(t(
      `${prefix}selection`))}</span>
      <span data-flight-plan-cask-selection>${escapeHtml(t(
        `${prefix}allGroups`))}</span>
    </div>
  </div>`;
}

/**
 * Reads selected groups and only the refinements of those selected groups.
 * An empty selection is unrestricted; deselected groups have no effect.
 * @param {?Element} root Planner dialog root, if mounted.
 * @return {!Object} Category-scoped feature selections.
 */
export function readFlightCaskFilters(root) {
  const filters = {};
  for (const group of CASK_GROUPS) {
    if (!root?.querySelector(`[name="${groupField(group)}"]`)?.checked)
      continue;
    const dimensions = {};
    for (const [dimension, values] of Object.entries(CASK_DIMENSIONS[group])) {
      const selected = values.filter(value => {
        const name = featureField(group, dimension, value);
        return root.querySelector(`[name="${name}"]`)?.checked;
      });
      if (selected.length) dimensions[dimension] = selected;
    }
    filters[group] = dimensions;
  }
  return filters;
}

/**
 * Shows refinements only for selected categories in specific-cask mode.
 * @param {?Element} root Planner dialog root, if mounted.
 * @param {boolean} specific Whether specific-cask mode is active.
 * @param {function(string, Object=): string} t Translation lookup.
 */
export function syncFlightCaskOptions(root, specific, t) {
  const wrapper = root?.querySelector('[data-flight-plan-cask-group-wrap]');
  if (wrapper) wrapper.hidden = !specific;
  const selected = readFlightCaskFilters(root);
  const details = root?.querySelectorAll(
    '[data-flight-plan-cask-subtype-wrap]');
  let hasDetails = false;
  for (const detail of details || []) {
    const group = detail.dataset.flightPlanCaskSubtypeWrap;
    const visible = specific && Object.hasOwn(selected, group);
    if (visible && detail.hidden) detail.open = true;
    detail.hidden = !visible;
    hasDetails ||= visible;
    const count = Object.values(selected[group] || {}).flat().length;
    const counter = detail.querySelector?.('[data-flight-plan-cask-count]');
    if (counter) counter.textContent = count ?
      t('flightPlan.caskAge.selectedCount', {count}) :
      t('flightPlan.caskAge.allTypes');
  }
  const detailGroup = root?.querySelector('[data-flight-plan-cask-details]');
  if (detailGroup) detailGroup.hidden = !hasDetails;
  const summary = root?.querySelector('[data-flight-plan-cask-selection]');
  if (summary) {
    const labels = Object.entries(selected).map(([group, dimensions]) => {
      const label = t(`flightPlan.caskAge.group.${group}`);
      const values = Object.values(dimensions).flat().map(value =>
        t(`flightPlan.caskAge.subtype.${value}`));
      return values.length ? `${label} (${values.join(', ')})` : label;
    });
    summary.textContent = labels.join(' · ') ||
      t('flightPlan.caskAge.allGroups');
  }
}

/**
 * Clears every cask preference, including hidden refinements and phase.
 * @param {?Element} root Planner dialog root, if mounted.
 */
export function resetFlightCaskOptions(root) {
  for (const input of root?.querySelectorAll('[name^="flight-cask-"]') || []) {
    input.checked = false;
  }
  const phase = root?.querySelector('[data-flight-plan-cask-phase]');
  if (phase) phase.value = 'any';
}
