

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
   * Derives the profile status result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  function profileStatus() {
    return state.profileMissing ? 'without' : state.profilePresent ? 'with' : 'all';
  }

  /**
   * Derives the new flavor draft result from the supplied values.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  function newFlavorDraft() {
    return {
      status: profileStatus(),
      criteria: normalizeFlavorCriteria(state.flavorCriteria || []),
    };
  }

  /**
   * Selects and transforms the flavor editor content records.
   * @return {string} Resulting text.
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
     * @return {string} Resulting text.
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
   * Produces the flavor editor html text used by the caller.
   * @return {string} Resulting text.
   */
  function flavorEditorHtml() {
    return renderTemplate('collectionFlavorEditor', {flavorEditorContent: flavorEditorContent(), });
  }

  /**
   * Updates the DOM elements managed by redraw flavor editor.
   *
   * @param {*=} focusSelector Value used by this operation.
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
   * Performs the open flavor filter lifecycle action.
   */
  function openFlavorFilter() {
    flavorDraft = newFlavorDraft();
    showModal(t('collection.flavor.title'), flavorEditorHtml(), false);
  }

  /**
   * Locates the DOM elements used by add flavor criterion.
   */
  function addFlavorCriterion() {
    const axis = document.querySelector('[data-collection-flavor-editor] #collection-add-flavor-axis')?.value;
    if (!flavorDraft || !FLAVOR_AXES.includes(axis) || flavorDraft.criteria.some(item => item.axis === axis)) return;
    flavorDraft.criteria.push({axis, min: 0, max: 10});
    if (flavorDraft.status === 'without') flavorDraft.status = 'with';
    redrawFlavorEditor('[data-act="collection-flavor-remove"][data-axis="' + axis + '"]');
  }

  /**
   * Removes or resets flavor criterion.
   *
   * @param {*} axis Value used by this operation.
   */
  function removeFlavorCriterion(axis) {
    if (!flavorDraft) return;
    flavorDraft.criteria = flavorDraft.criteria.filter(item => item.axis !== axis);
    redrawFlavorEditor('#collection-add-flavor-axis');
  }

  /**
   * Updates flavor criterion in the current state.
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
   * Updates flavor status in the current state.
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
   * Updates flavor draft in the current state.
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
    const picker = document.querySelector('[data-collection-flavor-picker]');
    if (picker) picker.open = false;
    flavorDraft = null;
  }

  return {flavorEditorHtml, openFlavorFilter, addFlavorCriterion, removeFlavorCriterion, changeFlavorCriterion, changeFlavorStatus, resetFlavorDraft, applyFlavorDraft, toggleFlavorPicker, closeFlavorFilter};
}
