

import {composeMarkup} from '../ui/render-plan.js';
import {replaceContent} from '../ui/dom-renderer.js';
import {actionButton} from '../ui/buttons.js';

import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';
import {normalizeFlavorCriteria}
  from '../../../shared/collection-saved-views.js';
import {t} from '../i18n/index.js';
import {loadTemplates} from '../ui/templates.js';
import {closeIcon} from '../ui/action-icons.js';

const renderTemplate = await loadTemplates('collection/home.html');

/**
 * Owns the draft flavor filter and its dialog lifecycle.
 * @param {!Object} options Controller dependencies.
 * @return {!Object} Public controller actions and presentation.
 */
export function createCollectionFlavorController({state, showModal, closeModal, home}) {
  let flavorDraft = null;

  /**
   * Derives the profile-presence filter from the current collection filter flags.
   * @return {'without'|'with'|'all'} Selected profile-presence filter.
   */
  function profileStatus() {
    return state.profileMissing ? 'without' : state.profilePresent ? 'with' : 'all';
  }

  /**
   * Creates an independent draft of the active flavor filter settings.
   * @return {{status: 'without'|'with'|'all', criteria: import('../../../shared/collection-saved-views.js').FlavorCriterion[]}} Editable filter state.
   */
  function newFlavorDraft() {
    return {
      status: profileStatus(),
      criteria: normalizeFlavorCriteria(state.flavorCriteria || []),
    };
  }

  /**
   * Prepares flavor criteria and profile-status filtering controls.
   * @return {!import('../ui/render-plan.js').RenderPlan} Flavor criteria and profile-status filtering controls.
   */
  function flavorEditorContent() {
    const draft = flavorDraft || newFlavorDraft();
    const available = FLAVOR_AXES.filter(axis => !draft.criteria.some(item => item.axis === axis));
    const statusOptions = [
      ['all', 'collection.flavor.any'],
      ['with', 'collection.flavor.with'],
      ['without', 'collection.flavor.without'],
    ];
    /**
     * Calculates options from the inputs.
     *
     * @param {*} selected Currently selected item or identifier.
     * @return {import('../ui/render-plan.js').RenderPlan|string} Selectable minimum and maximum sensory-axis scores (or scalar/empty text when no plan is needed).
     */
    const scoreOptions = (selected) => composeMarkup(Array.from(
      {length: 11},
      (_, i) => renderTemplate('scoreOptionsOption', {
        i: i,
        selectedAttributes: selected === i ? {"selected": true} : {},
        scoreLabel: i,
      })
    ));
    return renderTemplate('collectionFlavorStatus', {
      missing: t('collection.flavor.missing'),
      statusOptions: composeMarkup(statusOptions.map((
        [value, label]) =>
        renderTemplate('flavorEditorContentLabel', {
          value: value,
          checkedAttributes: draft.status === value ? {"checked": true} : {},
          t: t(label),
        }))),
      withoutAttributes: draft.status === 'without' ? {"hidden": true} : {},
      criteria: composeMarkup(draft.criteria.map(item => renderTemplate(
        'collectionFlavorRow',
        {
          t: t(`flavor.axis.${item.axis}`),
          axis: item.axis,
          remove: t('collection.flavor.remove', {name: t(`flavor.axis.${item.axis}`)}),
          closeIcon: closeIcon,
          min: t('collection.flavor.min'),
          flavorAxis: item.axis,
          scoreOptions: scoreOptions(item.min),
          max: t('collection.flavor.max'),
          maxAxis: item.axis,
          maxScoreOptions: scoreOptions(item.max),
        }
      ))),
      collectionAddFlavorAxis: available.length ?
        renderTemplate('collectionAddFlavorAxis', {
          axis: t('collection.flavor.axis'),
          selectAxis: t('collection.flavor.selectAxis'),
          available: composeMarkup(available.map(axis => renderTemplate(
            'flavorEditorContentOption',
            {
              axis: axis,
              t: t(`flavor.axis.${axis}`),
            }
          ))),
          add: t('collection.flavor.add'),
        }) : '',
      collectionFlavorResetButton: actionButton({
        label: t('analytics.filters.reset'),
        action: 'collection-flavor-reset',
      }),
      collectionFlavorApplyButton: actionButton({
        label: t('collection.flavor.apply'),
        action: 'collection-flavor-apply',
        variant: 'primary',
      }),
    });
  }

  /**
   * Prepares expandable collection flavor-filter editor.
   * @return {!import('../ui/render-plan.js').RenderPlan} Expandable collection flavor-filter editor.
   */
  function flavorEditorHtml() {
    return renderTemplate('collectionFlavorEditor', {flavorEditorContent: flavorEditorContent(), });
  }

  /**
   * Updates the DOM elements managed by redraw flavor editor.
   *
   * @param {*=} focusSelector Optional selector to restore keyboard focus to after redrawing the editor.
   */
  function redrawFlavorEditor(focusSelector = null) {
    const editor = document.querySelector('[data-collection-flavor-editor]');
    if (!editor) return;
    const scrollTop = editor.closest('.collection-flavor-popover, .dialog')?.scrollTop || 0;
    replaceContent(editor, flavorEditorContent());
    const scroller = editor.closest('.collection-flavor-popover, .dialog');
    if (scroller) scroller.scrollTop = scrollTop;
    if (focusSelector) editor.querySelector(focusSelector)?.focus();
  }

  /**
   * Opens the flavor-filter dialog with a draft of the active criteria.
   */
  function openFlavorFilter() {
    flavorDraft = newFlavorDraft();
    showModal(t('collection.flavor.title'), flavorEditorHtml(), false);
  }

  /**
   * Adds the selected unused flavor axis to the filter draft.
   */
  function addFlavorCriterion() {
    const axis = /** @type {HTMLSelectElement|null} */ (document.querySelector('[data-collection-flavor-editor] #collection-add-flavor-axis'))?.value;
    if (!flavorDraft || !FLAVOR_AXES.includes(axis) || flavorDraft.criteria.some(item => item.axis === axis)) return;
    flavorDraft.criteria.push({axis, min: 0, max: 10});
    if (flavorDraft.status === 'without') flavorDraft.status = 'with';
    redrawFlavorEditor('[data-act="collection-flavor-remove"][data-axis="' + axis + '"]');
  }

  /**
   * Removes or resets flavor criterion.
   *
   * @param {string} axis Identifier of the flavor criterion to remove from the draft.
   */
  function removeFlavorCriterion(axis) {
    if (!flavorDraft) return;
    flavorDraft.criteria = flavorDraft.criteria.filter(item => item.axis !== axis);
    redrawFlavorEditor('#collection-add-flavor-axis');
  }

  /**
   * Updates a flavor criterion from its editor control and redraws the draft.
   *
   * @param {*} input Input element or value to inspect.
   */
  function changeFlavorCriterion(input) {
    if (!flavorDraft) return;
    const axis = input.dataset.flavorAxis;
    const part = input.dataset.flavorPart;
    const entry = flavorDraft.criteria.find(item => item.axis === axis);
    const value = Number(input.value);
    if (!entry || !['min', 'max'].includes(part) || !Number.isInteger(value) || value < 0 || value > 10) return;
    entry[part] = part === 'min' ? Math.min(value, entry.max) : Math.max(value, entry.min);
    redrawFlavorEditor(`[data-flavor-axis="${axis}"][data-flavor-part="${part}"]`);
  }

  /**
   * Changes the draft's profile-presence filter and redraws its controls.
   *
   * @param {*} value Value to process.
   */
  function changeFlavorStatus(value) {
    if (!flavorDraft || !['all', 'with', 'without'].includes(value)) return;
    flavorDraft.status = value;
    redrawFlavorEditor(`[data-flavor-profile-status][value="${value}"]`);
  }

  /**
   * Removes or resets flavor draft.
   */
  function resetFlavorDraft() {
    flavorDraft = {status: 'all', criteria: []};
    redrawFlavorEditor('[data-flavor-profile-status][value="all"]');
  }

  /**
   * Commits the flavor-filter draft to the collection filters and refreshes the overview.
   */
  function applyFlavorDraft() {
    if (!flavorDraft) return;
    state.profileMissing = flavorDraft.status === 'without';
    state.profilePresent = flavorDraft.status === 'with';
    state.flavorCriteria = state.profileMissing ? [] : normalizeFlavorCriteria(flavorDraft.criteria);
    flavorDraft = null;
    state.pageNumber = 1;
    if (document.querySelector('#modal-root [data-collection-flavor-editor]'))
      closeModal();
    home();
  }

  /**
   * Synchronizes the draft with a native details element.
   * @param {boolean} open Whether the flavor picker is open.
   */
  function toggleFlavorPicker(open) {
    if (open) {flavorDraft = newFlavorDraft(); redrawFlavorEditor();}
    else flavorDraft = null;
  }

  /** Closes the inline flavor picker and discards its draft. */
  function closeFlavorFilter() {
    const picker = /** @type {HTMLDetailsElement|null} */ (document.querySelector('[data-collection-flavor-picker]'));
    if (picker) picker.open = false;
    flavorDraft = null;
  }

  return {flavorEditorHtml, openFlavorFilter, addFlavorCriterion, removeFlavorCriterion, changeFlavorCriterion, changeFlavorStatus, resetFlavorDraft, applyFlavorDraft, toggleFlavorPicker, closeFlavorFilter};
}
