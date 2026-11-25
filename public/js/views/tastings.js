import {createTastingEditorController} from './tasting-editor-controller.js';
import {createTastingFlightController} from './tasting-flight-controller.js';
import {createTastingPresentation} from './tasting-presentation.js';
import {createTastingIndexViewModel, createTastingListViewModel} from './models/tastings.js';
import {composeMarkup} from '../ui/render-plan.js';

import {actionButton} from '../ui/buttons.js';

import {sectionHeader, pageHeader} from '../ui/headers.js';
import {t} from '../i18n/index.js';


import {newBottlingIcon} from '../ui/action-icons.js';

import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('tastings/tastings.html');

/**
 * Tasting list and single-record editor; no migration of earlier bottling
 * notes.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createTastingsView({
  state,
  selectors,
  shell,
  navigate,
  refresh,
  showModal,
  closeModal,
  confirm: confirmModal, mountContent, mountAppend
}) {
  let createChoiceOpen = false;

  const presentation = createTastingPresentation({state, selectors});
  const {backLink, pageTitle, bottlingInfo, tastingRow} = presentation;
  const editorController = createTastingEditorController({
    state, shell, navigate, refresh, showModal, closeModal, presentation,
    /** Closes the flight member chooser before editing a tasting. */
    closeAddChooser: () => {flightController.closeAddChooser();},
  });
  const flightController = createTastingFlightController({
    state, selectors, shell, navigate, refresh, showModal, closeModal, confirmModal, presentation,
    resetEditor: editorController.resetEditor, mountContent, mountAppend,
  });
  const {editor, saveDraft, persistMeta, commitTasting, chooseRating, previewRating, chooseColor, chooseCustomHex, commitCustomPreview, previewCustomColor, previewCustomFromPointer, nudgeCustomColor, resetCustomPreview, clearFlavor, showAssignDialog, assignExternalToBottling, startEditing, finishEditing, showExternalEdit, cancelExternalEdit, persistExternalDetails, stepFlavor, subject, resetEditor} = editorController;
  const {homeFlights, flight, startFlight, openPlannedFlight, showFlightPlanningHelp, generateFlightPlan, invalidateFlightPlan, resetFlightCaskSelection, createPlannedFlight, changePlannedMember, transitionPlannedFlight, createFlight, saveFlight, deleteFlight, moveFlightMember, reorderFlightMember, attachFlightMember, detachFlightMember, toggleFlightEdit, toggleFlightAdd} = flightController;

  /**
   * Orders the home records using the configured comparison.
   */
  function home() {
    // Returning to an index ends any prior edit session. Reopening is always
    // read-only.
    resetEditor();
    const {owned, entries} = createTastingIndexViewModel(state);
    shell(renderTemplate('analyticsPage3', {
      pageHeader: pageHeader({
        title: t('tastings.homeTitle'),
        eyebrow: t('tastings.homeEyebrow'),
        intro: t('tastings.homeIntro'),
        className: 'analytics-page-heading',
      }),
      homeFlights: homeFlights(),
      sectionHeader: sectionHeader({
        title: t('tastings.entries'),
        layout: 'tasting-panel-heading',
        actionsBare: true,
        actions:
          renderTemplate('tastingsStartChoice', {
            newBottlingIcon: newBottlingIcon,
            add: t('tastings.add'),
          }),
      }),
      tastingCreateChooser: createChoiceOpen ?
        renderTemplate('tastingCreateChooser', {
          chooseBottling: t('tastings.chooseBottling'),
          owned: composeMarkup(owned.map(b =>
            renderTemplate('homeOption', {
              id: b.id,
              name: b.name,
            }))),
          disabledAttributes: owned.length ? {} : {"disabled": true},
          fromCollection: t('tastings.fromCollection'),
          tastingsStartExternalButton: actionButton({
            label: t('tastings.outsideCollection'),
            action: 'tastings-start-external',
          }),
        }) : '',
      warehouseBottleList: entries.length ?
        renderTemplate('warehouseBottleList3', {
          entries: composeMarkup(entries.map(item => tastingRow({...item, home: true}))),
        }) :
        renderTemplate('hint8', {emptyHome: t('tastings.emptyHome'), }),
    }));
  }

  /**
   * Updates the toggle create choice state for its caller.
   */
  function toggleCreateChoice() {createChoiceOpen = !createChoiceOpen; home();}

  /**
   * Transforms the entries used by list.
   */
  function list() {
    resetEditor();
    const bottling = subject();
    if (!bottling) {navigate('tastings-home', null, {replace: true}); return;}
    const {tastings} = createTastingListViewModel(bottling);
    shell(renderTemplate('analyticsPage4', {
      backLink: backLink('tastings-back-detail', 'tastings.backDetail'),
      pageTitle: pageTitle(t('tastings.overviewTitle'), t('tastings.overviewIntro')),
      bottlingInfo: bottlingInfo(bottling),
      sectionHeader: sectionHeader({
        title: t('tastings.entriesCount', {count: tastings.length}),
        layout: 'tasting-panel-heading',
        actionsBare: true,
        actions:
          renderTemplate('tastingsNew', {
            newBottlingIcon: newBottlingIcon,
            add: t('tastings.add'),
          }),
      }),
      warehouseBottleList: tastings.length ?
        renderTemplate('warehouseBottleList4', {
          tastings: composeMarkup(tastings.map(record => tastingRow({record, b: bottling}))),
        }) :
        renderTemplate('hint9', {none: t('tastings.none'), }),
    }));
  }
  return {
    home,
    list,
    editor,
    flight,
    startFlight,
    startPlannedFlight: openPlannedFlight,
    showFlightPlanningHelp,
    generateFlightPlan,
    invalidateFlightPlan,
    resetFlightCaskSelection,
    createPlannedFlight,
    changePlannedMember,
    transitionPlannedFlight,
    createFlight,
    saveFlight,
    deleteFlight,
    moveFlightMember,
    reorderFlightMember,
    attachFlightMember,
    detachFlightMember,
    toggleFlightEdit,
    toggleFlightAdd,
    saveDraft,
    persistMeta,
    toggleCreateChoice,
    commitFlavor: commitTasting,
    chooseRating,
    previewRating,
    chooseColor,
    chooseCustomHex,
    commitCustomPreview,
    previewCustomColor,
    previewCustomFromPointer,
    nudgeCustomColor,
    resetCustomPreview,
    clearFlavor,
    showAssignDialog,
    assignExternalToBottling,
    startEditing,
    finishEditing,
    /**
     * Performs the start external edit lifecycle action.
          * @return {*} Result of this expression.
*/
    startExternalEdit: () => showExternalEdit(true),
    cancelExternalEdit,
    persistExternalDetails,
    /**
     * Performs the undo flavor lifecycle action.
          * @return {*} Result of this expression.
*/
    undoFlavor: () => stepFlavor(-1),
    /**
     * Performs the redo flavor lifecycle action.
          * @return {*} Result of this expression.
*/
    redoFlavor: () => stepFlavor(1),
  };
}
