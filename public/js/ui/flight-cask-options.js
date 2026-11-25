import {composeMarkup} from './render-plan.js';
import {
  CASK_GROUPS, CASK_DIMENSIONS, CASK_PHASES,
} from '../domain/flight-casks.js';
import {checkboxInput} from './fields.js';
import {actionButton} from './buttons.js';
import {chevronDownIcon} from './action-icons.js';
import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/flight-cask-options.html', import.meta.url));


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
  const groups = composeMarkup(CASK_GROUPS.map(group => checkboxInput(
    groupLabel(group),
    groupField(group)
  )));
  const details = composeMarkup(CASK_GROUPS.filter(group =>
    Object.keys(CASK_DIMENSIONS[group]).length).map(group => {
      const dimensions =
        composeMarkup(Object.entries(CASK_DIMENSIONS[group]).map(
          ([dimension, values]) => {
            const title = escapeHtml(t(`${prefix}dimension.${dimension}`));
            const fields = composeMarkup(values.map(value => checkboxInput(
              t(`${prefix}subtype.${value}`),
              featureField(group, dimension, value)
            )));
            return renderTemplate('flightPlanCaskDimension', {
              title: title,
              title2: title,
              fields: fields,
            });
          }));
      const title = escapeHtml(groupLabel(group));
      const all = escapeHtml(t(`${prefix}allTypes`));
      return renderTemplate('flightPlanCaskRefinement', {
        group: group,
        title: title,
        all: all,
        chevronDownIcon: chevronDownIcon('flight-plan-cask-chevron'),
        dimensions: dimensions,
      });
    }));
  const label = escapeHtml(t(`${prefix}caskGroup`));
  const hint = escapeHtml(t(`${prefix}groupHint`));
  const phaseLabel = escapeHtml(t(`${prefix}phase`));
  const phases = composeMarkup(CASK_PHASES.map(phase => {
    const text = escapeHtml(t(`${prefix}phase.${phase}`));
    return renderTemplate('phasesOption', {
      phase: phase,
      text: text,
    });
  }));
  const reset = actionButton({
    label: t(`${prefix}reset`),
    action: 'flight-plan-cask-reset', size: 'small', variant: 'text',
  });
  return renderTemplate('flightPlanCaskFilter', {
    label: label,
    label2: label,
    reset: reset,
    hint: hint,
    groups: groups,
    t: t(
      `${prefix}refine`),
    details: details,
    phaseLabel: phaseLabel,
    phases: phases,
    t2: t(
      `${prefix}selection`),
    t3: t(
      `${prefix}allGroups`),
  });
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
