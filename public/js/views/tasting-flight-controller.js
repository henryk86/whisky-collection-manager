import {createPlannedFlightViewModel} from './models/tastings.js';
import {composeMarkup} from '../ui/render-plan.js';
import {replaceContent, appendContent} from '../ui/dom-renderer.js';
import {actionButton} from '../ui/buttons.js';
import {checkboxInput} from '../ui/fields.js';
import {helpIconButton, sectionHeader, headingTitle} from '../ui/headers.js';
import {t} from '../i18n/index.js';

import {formatDate, imageUrl} from '../ui/format.js';
import {request} from '../api.js';
import {toast} from '../ui/notifications.js';

import {
  editIcon, newBottlingIcon, flightPlanIcon, chevronRightIcon,
  arrowUpIcon, arrowDownIcon
} from '../ui/action-icons.js';
import {flightPlanningHelpHtml} from '../ui/flight-planning-help.js';
import {
  flightCaskOptionsHtml, readFlightCaskFilters, syncFlightCaskOptions,
  resetFlightCaskOptions,
} from '../ui/flight-cask-options.js';
import {reorderFlightIds} from '../features/flight-order.js';
import {suggestFlight, flightCandidateDiagnostics, FLIGHT_STYLES, FLIGHT_AVAILABILITY, FLIGHT_FOCUSES, CASK_MODES, AGE_MODES} from '../domain/flight-planner.js';
import {loadTemplates} from '../ui/templates.js';
import {localToday, createRecordedFlightViewModel} from './models/tastings.js';

const renderTemplate = await loadTemplates('tastings/tastings.html');

/**
 * Owns flight planning, membership, editing, and navigation.
 * @param {!Object} options Collection state, navigation, presentation, and dialog dependencies.
 * @return {!Object} Flight actions and overview presentation.
 */
export function createTastingFlightController({state, selectors, shell, navigate, refresh, showModal, closeModal, confirmModal, presentation, resetEditor, mountContent = replaceContent, mountAppend = appendContent}) {
  const {backLink, pageTitle, tastingListGlasses, tastingRating} = presentation;
  let flightEditing = false;

  let flightAdding = false;

  let flightCreating = false;

  let flightPlanDraft = null;

  let lastFlightId = null;

  /**
   * Orders the flight list records using the configured comparison.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  const flightList = () => [...(state.collection?.tastingFlights || [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  /**
   * Prepares flight overview with planning and navigation actions.
   * @return {!import('../ui/render-plan.js').RenderPlan} Flight overview with planning and navigation actions.
   */
  function homeFlights() {
    const flights = flightList();
    return renderTemplate('analyticsPanel2', {
      sectionHeader: sectionHeader({
        title: t('tastingFlights.plural'),
        layout: 'tasting-panel-heading',
        titleClass: 'flight-plan-heading-title',
        trailingAction: flightPlanningHelpButton(),
        actions:
          renderTemplate('tastingFlightNew', {
            newBottlingIcon: newBottlingIcon,
            document: t('flightPlan.document'),
            flightPlanIcon: flightPlanIcon,
            plan: t('flightPlan.plan'),
          }),
      }),
      warehouseBottleList: flights.length ?
        renderTemplate('warehouseBottleList', {
          flights: composeMarkup(flights.map(
            item => renderTemplate('tastingFlightOpen', {
              id: item.id,
              name: item.name,
              formatDate: formatDate(item.date),
              phase: item.phase ? t(`flightPlan.phase.${item.phase}`) + ' · ' : '',
              t: t(
                item.phase === 'planned' ? 'flightPlan.countSelected' :
                  item.tastingIds.length === 1 ? 'tastingFlights.oneEntry' : 'tastingFlights.entriesCount',
                {
                  count: item.phase === 'planned' ? item.planItems.length : item.tastingIds.length,
                }
              ),
              chevronRightIcon: chevronRightIcon,
            }))),
        }) : renderTemplate('hint2', {none: t('tastingFlights.none'), }),
    });
  }

  /**
   * Renders flight planning help in the current view.
   */
  function showFlightPlanningHelp() {
    // Preserve the planner's live inputs, generated proposal and scroll
    // position.
    // From the overview this opens as a normal top-level modal.
    showModal(t('flightPlan.help.title'), flightPlanningHelpHtml(t), true, true);
  }

  /**
   * Prepares accessible flight-planning help button.
   * @return {!import('../ui/render-plan.js').RenderPlan} Accessible flight-planning help button.
   */
  function flightPlanningHelpButton() {
    return helpIconButton({label: t('flightPlan.help.title')});
  }

  /**
   * Updates the DOM elements managed by sync flight plan options.
   */
  function syncFlightPlanOptions() {
    const box = globalThis.document?.querySelector?.('#modal-root');
    const style = /** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-style]'))?.value;
    const similar = /** @type {HTMLElement} */ (box?.querySelector('[data-flight-plan-focus-wrap]'));
    const discover = /** @type {HTMLElement} */ (box?.querySelector('[data-flight-plan-unfamiliar-wrap]'));
    const caskMode = /** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-cask-mode]'))?.value;
    syncFlightCaskOptions(box, caskMode === 'specific', t);
    const ageMode = /** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-age-mode]'))?.value;
    if (similar) similar.hidden = style !== 'similar';
    if (discover) discover.hidden = style !== 'discover';
    for (const [selector, visible] of /** @type {Array<[string, boolean]>} */ ([
      ['[data-flight-plan-age-range-wrap]', ageMode === 'range'],
      [
        '[data-flight-plan-strict-wrap]',
        caskMode === 'specific' || ageMode === 'range',
      ],
    ])) {
      const element = /** @type {HTMLElement} */ (box?.querySelector(selector)); if (element) element.hidden = !visible;
    }
  }

  /**
   * Opens the flight-planning dialog with a fresh draft and any collection candidates.
   */
  function startPlannedFlight() {
    flightPlanDraft = null;
    const fromCollection = Array.isArray(state.flightCandidateIds);
    const candidateText = fromCollection ? renderTemplate('hint3', {length: state.flightCandidateIds.length, }) : '';
    showModal(
      t('flightPlan.plan'),
      renderTemplate('tastingFlightForm', {
        candidateText: candidateText,
        namePlaceholder: t('tastingFlights.namePlaceholder'),
        localToday: localToday(),
        styleOptions: composeMarkup(FLIGHT_STYLES.map(id =>
          renderTemplate('startPlannedFlightOption', {
            id: id,
            t: t(`flightPlan.${id}`),
          }))),
        content: composeMarkup([3, 4, 5, 6].map(n =>
          renderTemplate('startPlannedFlightOption2', {
            n: n,
            selectedAttributes: n === 5 ? {"selected": true} : {},
            memberCountLabel: n,
          }))),
        availabilityOptions: composeMarkup(FLIGHT_AVAILABILITY.map(id => renderTemplate('startPlannedFlightOption3', {
          id: id,
          t: t(`flightPlan.${id}`),
        }))),
        focus: t('flightPlan.focus'),
        focusOptions: composeMarkup(FLIGHT_FOCUSES.map(id =>
          renderTemplate('startPlannedFlightOption4', {
            id: id,
            t: t(`flightPlan.focus.${id}`),
          }))),
        checkboxInput: checkboxInput(t('flightPlan.unfamiliar'), 'flight-plan-unfamiliar', true),
        title: t('flightPlan.caskAge.title'),
        hint: t('flightPlan.caskAge.hint'),
        caskMode: t('flightPlan.caskAge.caskMode'),
        caskModeOptions: composeMarkup(CASK_MODES.map(
          id => renderTemplate('startPlannedFlightOption5', {
            id: id,
            t: t(`flightPlan.caskAge.caskMode.${id}`),
          }))),
        ageMode: t('flightPlan.caskAge.ageMode'),
        ageModeOptions: composeMarkup(AGE_MODES.map(id =>
          renderTemplate('startPlannedFlightOption6', {
            id: id,
            t: t(`flightPlan.caskAge.ageMode.${id}`),
          }))),
        flightCaskOptionsHtml: flightCaskOptionsHtml(t),
        ageRange: t('flightPlan.caskAge.ageRange'),
        ageMin: t('flightPlan.caskAge.ageMin'),
        ariaLabel: t('flightPlan.caskAge.ageMin'),
        ageMax: t('flightPlan.caskAge.ageMax'),
        maxAgeLabel: t('flightPlan.caskAge.ageMax'),
        strictCheckbox: checkboxInput(t('flightPlan.caskAge.strict'), 'flight-plan-strict'),
        flightPlanGenerateButton: actionButton({
          label: t('flightPlan.suggest'),
          action: 'flight-plan-generate',
        }),
        closeModalButton: actionButton({
          label: t('common.actions.cancel'),
          action: 'close-modal',
        }),
      }),
      true,
      false,
      flightPlanningHelpButton()
    );
    state.flightCandidateIds = null;
    syncFlightPlanOptions();
  }

  /**
   * Updates the DOM elements managed by invalidate flight plan.
   */
  function invalidateFlightPlan() {
    syncFlightPlanOptions();
    flightPlanDraft = null;
    const box = globalThis.document?.querySelector?.('#modal-root');
    const button = /** @type {HTMLButtonElement} */ (box?.querySelector('[data-act="flight-plan-create"]'));
    if (button) button.disabled = true;
    const view = box?.querySelector('.flight-plan-preview');
    if (view) view.replaceChildren();
  }

  /**
   * Clears cask preferences without affecting other planner inputs.
   */
  function resetFlightCaskSelection() {
    resetFlightCaskOptions(document.querySelector('#modal-root'));
    invalidateFlightPlan();
  }

  /**
   * Updates the DOM elements managed by generate flight plan.
   */
  function generateFlightPlan() {
    const box = document.querySelector('#modal-root');
    const style = /** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-style]'))?.value || 'balanced';
    const count = Number(/** @type {HTMLSelectElement} */(box?.querySelector('[data-flight-plan-count]'))?.value || 5);
    const availability = /** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-availability]'))?.value || 'open';
    const focus = style === 'similar' ? (/** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-focus]'))?.value || 'any') : 'any';
    const preferUnfamiliar = style === 'discover' ? Boolean(/** @type {HTMLInputElement} */(box?.querySelector('[name="flight-plan-unfamiliar"]'))?.checked) : false;
    const caskMode = /** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-cask-mode]'))?.value || 'auto';
    const caskFilters = caskMode === 'specific' ? readFlightCaskFilters(box) : {};
    const caskPhase = caskMode === 'specific' ? /** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-cask-phase]'))?.value || 'any' : 'any';
    const ageMode = /** @type {HTMLSelectElement} */ (box?.querySelector('[data-flight-plan-age-mode]'))?.value || 'auto';
    // Clear any stale cross-field error before validating a corrected range.
    /** @type {HTMLInputElement} */ (box?.querySelector('[data-flight-plan-age-max]'))?.setCustomValidity?.('');
    /**
     * Parses age from its input.
     *
     * @param {string} selector Selector of the age-limit number input.
     * @return {number|null|undefined} Parsed age, null for an empty field or undefined for invalid input.
     */
    const parseAge = (selector) => {
      const field = /** @type {HTMLInputElement} */ (box?.querySelector(selector)); if (!field || field.value === '') return null;
      if (!field.reportValidity()) return undefined; return Number(field.value);
    };
    const ageMin = ageMode === 'range' ? parseAge('[data-flight-plan-age-min]') : null;
    const ageMax = ageMode === 'range' ? parseAge('[data-flight-plan-age-max]') : null;
    if (ageMin === undefined || ageMax === undefined) return;
    if (ageMin !== null && ageMax !== null && ageMin > ageMax) {
      /** @type {HTMLInputElement} */ (box?.querySelector('[data-flight-plan-age-max]'))?.setCustomValidity?.(t('flightPlan.caskAge.invalidRange'));
      /** @type {HTMLInputElement} */ (box?.querySelector('[data-flight-plan-age-max]'))?.reportValidity?.();
      return;
    }
    /** @type {HTMLInputElement} */ (box?.querySelector('[data-flight-plan-age-max]'))?.setCustomValidity?.('');
    const strictMatches = Boolean(/** @type {HTMLInputElement} */(box?.querySelector('[name="flight-plan-strict"]'))?.checked);
    const options = {
      style,
      count,
      availability,
      focus,
      preferUnfamiliar,
      caskMode,
      caskFilters,
      caskPhase,
      ageMode,
      ageMin,
      ageMax,
      strictMatches,
    };
    const draft = suggestFlight(state.collection, {...options, bottlingIds: flightPlanSourceIds});
    flightPlanDraft = {
      items: draft, ...options, sourceIds: flightPlanSourceIds,
    };
    const view = box?.querySelector('.flight-plan-preview');
    if (view) mountContent(view, draft.length ?
      renderTemplate('hint4', {
        description: t('flightPlan.description'),
        draft: composeMarkup(draft.map(item => {
          const b = state.collection.bottlings.find(b => b.id === item.bottlingId);
          const metadata = [
            b?.caskType?.trim() ? `${t('forms.bottling.caskType')}: ${b.caskType.trim()}` : '',
            b?.ageYears !== null && b?.ageYears !== undefined && b?.ageYears !== '' ?
              `${t('forms.bottling.ageYears')}: ${t('home.facts.years', {count: b.ageYears})}` : '',
          ].filter(Boolean);
          return renderTemplate('li', {
            name: b.fullName ?? b.name,
            t: t(`flightPlan.reason.${item.reason}`),
            small: metadata.length ? renderTemplate('small', {metadata: metadata.join(' · '), }) : '',
          });
        })),
      }) : renderTemplate('hint5'));
    if (view && (caskMode === 'specific' || ageMode === 'range')) {
      const counts = flightCandidateDiagnostics(state.collection, {...options, bottlingIds: flightPlanSourceIds}, draft);
      const messages = [t('flightPlan.matches', counts)];
      if (counts.excludedAvailability) messages.push(t('flightPlan.excludedAvailability', counts));
      if (counts.excludedScope) messages.push(t('flightPlan.excludedScope', counts));
      mountAppend(view, composeMarkup(messages.map(message => renderTemplate('hint6', {message: message, }))));
    }
    const button = /** @type {HTMLButtonElement} */ (box?.querySelector('[data-act="flight-plan-create"]'));
    if (button) button.disabled = !draft.length;
  }

  // Keep the filtered collection candidates when opening the planner modal.
  let flightPlanSourceIds = null;

  /**
   * Captures the current collection candidate restriction and opens flight planning.
   */
  function openPlannedFlight() {
    flightPlanSourceIds = Array.isArray(state.flightCandidateIds) ? [...state.flightCandidateIds] : null;
    startPlannedFlight();
  }

  /**
   * Validates the plan and metadata, then creates a planned tasting flight once.
   */
  async function createPlannedFlight() {
    const box = document.querySelector('#modal-root');
    const name = /** @type {HTMLInputElement} */ (box?.querySelector('[data-flight-name]'));
    const date = /** @type {HTMLInputElement} */ (box?.querySelector('[data-flight-date]'));
    if (!name?.reportValidity() || !date?.reportValidity() || !flightPlanDraft?.items.length || flightCreating) return;
    flightCreating = true;
    try {
      const result = await request('/api/tasting-flights', {
        method: 'POST', body: JSON.stringify({
          name: name.value,
          date: date.value,
          notes: /** @type {HTMLTextAreaElement} */ (box.querySelector('[data-flight-notes]'))?.value || '',
          phase: 'planned',
          planItems: flightPlanDraft.items,
        }),
      });
      flightPlanDraft = null; flightPlanSourceIds = null;
      closeModal();
      await refresh('collection');
      navigate('tasting-flight', result.id);
    } catch (error) {toast(error.message, true);}
    finally {flightCreating = false;}
  }

  /**
   * Prepares planned flight details, editable member list and available actions.
   *
   * @param {*} current Current flight record whose planned details are displayed.
   * @return {!import('../ui/render-plan.js').RenderPlan} Planned flight details, editable member list and available actions.
   */
  function plannedFlightDetail(current) {
    const model = createPlannedFlightViewModel(current, state.collection, state.warehouse, selectors);
    const {editable, members, canAdd, canStart, choicesFor} = model;
    /**
     * Selects and transforms the choices records.
     *
     * @param {string=} excludeId Identifier of the tasting to omit from the flight-member choices.
     * @return {*} Render plan containing eligible flight-member option elements.
     */
    const choices = (excludeId = '') => composeMarkup(choicesFor(excludeId).map(x => renderTemplate('choicesOption', {
      id: x.bottle.id,
      name: x.bottling.fullName ?? x.bottling.name,
      inventoryNumber: x.bottle.inventoryNumber || '–',
    })));
    return renderTemplate('analyticsPanel3', {
      headingTitle: headingTitle({title: `${t('flightPlan.plannedMembers')} · ${current.planItems.length}`, }),
      planItems: composeMarkup(members.map(({item, b, bottle, label, unavailable, photo, place}, index) => {
        return renderTemplate('flightPlanMember', {
          index: index + 1,
          flightPlanMemberPhoto: photo ? renderTemplate('flightPlanMemberPhoto', {imageUrl: imageUrl(photo), }) : '',
          label: label,
          unavailable: unavailable ? t('flightPlan.missing') : t(`flightPlan.reason.${item.reason || 'manual'}`),
          bottle: bottle ? ' · ' + t(bottle.status === 'open' ? 'analytics.inventory.openedStatus' : 'home.status.closed') : '',
          flightPlanLocation: place ?
            renderTemplate('flightPlanLocation', {
              bottleId: item.bottleId,
              label: place.label,
            }) : '',
          flightPlanOpenBottling: b ? renderTemplate('flightPlanOpenBottling', {id: b.id, }) : '',
          flightPlanMove: editable ? renderTemplate('flightPlanMove', {
            index: index,
            disabledAttributes: index === 0 ? {"disabled": true} : {},
            arrowUpIcon: arrowUpIcon,
            moveDownIndex: index,
            moveDownDisabled: index === current.planItems.length - 1 ? {"disabled": true} : {},
            arrowDownIcon: arrowDownIcon,
            flightReplace: index,
            choices: choices(item.bottlingId),
            replaceIndex: index,
            removeIndex: index,
          }) : current.phase === 'inProgress' && !unavailable ?
            renderTemplate('flightPlanRecord', {bottlingId: item.bottlingId, }) : '',
        });
      })),
      flightPlanAdd: canAdd ?
        renderTemplate('flightPlanAdd', {
          choices: choices(),
          flightPlanAddButton: actionButton({
            label: t('flightPlan.add'),
            action: 'flight-plan-add',
          }),
        }) : '',
      flightPlanStart: editable ?
        renderTemplate('flightPlanStart', {
          disabledAttributes: !canStart ? {"disabled": true} : {},
        }) : '',
    });
  }

  /**
   * Persists a changed member list for the selected planned flight and reloads collection data.
   *
   * @param {*} items Entries to process.
   * @return {!Promise<*>} Completion of persisting the revised planned flight and refreshing collection data.
   */
  async function updatePlan(items) {
    const current = state.collection?.tastingFlights?.find(f => f.id === state.selected);
    if (current?.phase !== 'planned') return;
    try {
      await request(
        `/api/tasting-flights/${encodeURIComponent(current.id)}`,
        {method: 'PATCH', body: JSON.stringify({planItems: items})}
      ); await refresh('collection');
    }
    catch (error) {toast(error.message, true);}
  }

  /**
   * Moves, adds, replaces or removes a member of the current planned flight.
   *
   * @param {*} index Zero-based index of the selected entry.
   * @param {*} action Operation or action callback to invoke.
   * @param {number=} step Relative movement or step size.
   * @return {!Promise<*>} Completion of the planned-member update when a supported change was requested.
   */
  function changePlannedMember(index, action, step = 0) {
    const current = state.collection?.tastingFlights?.find(f => f.id === state.selected);
    if (current?.phase !== 'planned') return;
    const items = [...current.planItems];
    if (action === 'move' && index >= 0 && index < items.length && index + step >= 0 && index + step < items.length) {
      [items[index], items[index + step]] = [items[index + step], items[index]];
    } else if (action === 'remove' && index >= 0 && index < items.length) items.splice(index, 1);
    else if (action === 'replace' || action === 'add') {
      const value = /** @type {HTMLSelectElement} */ (document.querySelector(action === 'add' ? '[data-flight-manual-add]' : `[data-flight-replace="${index}"]`))?.value;
      const selected = state.collection.bottlings.find(b => b.bottles?.some(x => x.id === value && x.status !== 'empty'));
      if (!selected || items.some(x => x.bottlingId === selected.id)) return;
      const replacement = {bottlingId: selected.id, bottleId: value, reason: 'manual'};
      if (action === 'add') {
        if (items.length >= 6) return; items.push(replacement);
      }
      else if (index >= 0 && index < items.length) items[index] = replacement;
    } else return;
    return updatePlan(items);
  }

  /**
   * Serializes transition planned flight data to JSON.
   *
   * @param {*} target Target of the operation.
   * @return {!Promise<*>} Completion of the planned-flight phase transition.
   */
  async function transitionPlannedFlight(target) {
    const current = state.collection?.tastingFlights?.find(f => f.id === state.selected);
    if (!current || !(await confirmModal(t(`flightPlan.phase.${target}`),
      t(target === 'inProgress' ? 'flightPlan.confirmStart' : 'flightPlan.confirmFinish'),
      t(target === 'inProgress' ? 'flightPlan.start' : 'flightPlan.finish')))) return;
    try {
      await request(
        `/api/tasting-flights/${encodeURIComponent(current.id)}`,
        {method: 'PATCH', body: JSON.stringify({phase: target})}
      ); await refresh('collection');
    }
    catch (error) {toast(error.message, true);}
  }

  /**
   * Opens the dialog for creating a tasting flight with date, name and notes.
   */
  function startFlight() {
    showModal(t('tastingFlights.create'), renderTemplate('tastingFlightForm2', {
      name: t('tastingFlights.name'),
      namePlaceholder: t('tastingFlights.namePlaceholder'),
      date: t('tastingFlights.date'),
      localToday: localToday(),
      notes: t('tastingFlights.notes'),
      closeModalButton: actionButton({
        label: t('common.actions.cancel'),
        action: 'close-modal',
      }),
      tastingFlightCreateConfirmButton: actionButton({
        label: t('tastingFlights.create'),
        action: 'tasting-flight-create-confirm',
        variant: 'primary',
      }),
    }), false);
  }

  /**
   * Validates the dialog and creates a new tasting flight once.
   */
  async function createFlight() {
    const box = document.querySelector('#modal-root');
    const name = /** @type {HTMLInputElement} */ (box?.querySelector('[data-flight-name]'));
    const date = /** @type {HTMLInputElement} */ (box?.querySelector('[data-flight-date]'));
    if (!name?.reportValidity() || !date?.reportValidity() || flightCreating) return;
    flightCreating = true;
    try {
      const flight = await request(
        '/api/tasting-flights',
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.value,
            date: date.value,
            notes: /** @type {HTMLTextAreaElement} */ (box.querySelector('[data-flight-notes]'))?.value || '',
          }),
        }
      );
      closeModal();
      state.page = 'tastings-home';
      await refresh('collection');
      navigate('tasting-flight', flight.id);
    } catch (error) {toast(error.message, true);}
    finally {flightCreating = false;}
  }

  /**
   * Produces the flight entry label text used by the caller.
   *
   * @param {*} item Current item under consideration.
   * @return {string} Whisky name, optional tasting title and formatted date for a flight entry.
   */
  const flightEntryLabel = item => `${item.bottling.fullName ?? item.bottling.name}${item.record.title ? ` · ${item.record.title}` : ''} · ${formatDate(item.record.tastedOn || '')}`;

  /**
   * Selects and transforms the flight records.
   */
  function flight() {
    resetEditor();
    if (lastFlightId !== state.selected) {
      flightEditing = false; flightAdding = false; lastFlightId = state.selected;
    }
    const current = (state.collection?.tastingFlights || []).find(item => item.id === state.selected);
    if (!current) {navigate('tastings-home', null, {replace: true}); return;}
    if (current.phase === 'planned') {
      shell(renderTemplate('analyticsPage', {
        backLink: backLink('tasting-flight-back', 'tastingFlights.back'),
        pageTitle: pageTitle(t('flightPlan.plan'), t('flightPlan.description')),
        tastingFlightForm: flightEditing ? renderTemplate(
          'tastingFlightForm3',
          {
            name: current.name,
            date: current.date,
            notes: current.notes,
            tastingFlightCancelEditButton: actionButton({
              label: t('common.actions.cancel'),
              action: 'tasting-flight-cancel-edit',
            }),
            tastingFlightSaveButton: actionButton({
              label: t('common.actions.save'),
              action: 'tasting-flight-save',
              variant: 'primary',
            }),
          }
        ) :
          renderTemplate('tastingPanelHeading', {
            headingTitle: headingTitle({title: current.name, }),
            formatDate: formatDate(current.date),
            p: current.notes ? renderTemplate('flightP', {notes: current.notes, }) : '',
          }),
        plannedFlightDetail: plannedFlightDetail(current),
      }));
      return;
    }
    const {refs, available} = createRecordedFlightViewModel(state.collection, current);
    /**
     * Prepares flight member row with reorder and removal controls.
     *
     * @param {*} item Current item under consideration.
     * @param {*} i Position in the iteration.
     * @return {!import('../ui/render-plan.js').RenderPlan} Flight member row with reorder and removal controls.
     */
    const entryRow = (item, i) =>
      renderTemplate('tastingFlightMember', {
        id: item.record.id,
        dragHandle: t('tastingFlights.dragHandle'),
        dragTitle: t('tastingFlights.dragHandle'),
        position: t('tastingFlights.position', {position: i + 1, count: refs.length}),
        i: i + 1,
        tastingId: item.record.id,
        external: item.external ? item.record.id : item.bottling.id,
        externalFlag: item.external ? '1' : '0',
        name: item.bottling.fullName ?? item.bottling.name,
        title: item.record.title || formatDate(item.record.tastedOn),
        tastingListGlasses: tastingListGlasses(item.record) || renderTemplate('tastingListGlasses2'),
        tastingRating: tastingRating(item.record),
        index: i,
        disabledAttributes: i === 0 ? {"disabled": true} : {},
        moveUp: t('tastingFlights.moveUp'),
        arrowUpIcon: arrowUpIcon,
        moveDownIndex: i,
        moveDownDisabled: i === refs.length - 1 ? {"disabled": true} : {},
        moveDown: t('tastingFlights.moveDown'),
        arrowDownIcon: arrowDownIcon,
        detachTastingId: item.record.id,
        detach: t('tastingFlights.detach'),
      });
    shell(renderTemplate('analyticsPage2', {
      backLink: backLink('tasting-flight-back', 'tastingFlights.back'),
      pageTitle: pageTitle(t('tastingFlights.detailTitle'), t('tastingFlights.detailIntro')),
      tastingFlightForm: flightEditing ? renderTemplate('tastingFlightForm4', {
        name: t('tastingFlights.name'),
        value: current.name,
        date: t('tastingFlights.date'),
        flightDate: current.date,
        notes: t('tastingFlights.notes'),
        flightNotes: current.notes,
        tastingFlightCancelEditButton: actionButton({
          label: t('common.actions.cancel'),
          action: 'tasting-flight-cancel-edit',
        }),
        tastingFlightSaveButton: actionButton({
          label: t('common.actions.save'),
          action: 'tasting-flight-save',
          variant: 'primary',
        }),
      }) :
        renderTemplate('tastingPanelHeading2', {
          headingTitle: headingTitle({title: current.name, }),
          formatDate: formatDate(current.date),
          editIcon: editIcon,
          edit: t('common.actions.edit'),
          tastingFlightDeleteButton: actionButton({
            label: t('common.actions.delete'),
            action: 'tasting-flight-delete',
            variant: 'destructive',
            size: 'small',
          }),
          tastingFlightComment: current.notes ? renderTemplate('tastingFlightComment', {notes: current.notes, }) : '',
        }),
      length: current.planItems?.length ? plannedFlightDetail(current) : '',
      flightPlanFinish: current.phase === 'inProgress' ?
        renderTemplate('flightPlanFinish', {disabledAttributes: refs.length ? {} : {"disabled": true}, }) : '',
      headingTitle: headingTitle({
        title: t(refs.length === 1 ? 'tastingFlights.oneEntry' : 'tastingFlights.entriesCount', {count: refs.length}),
      }),
      phase: current.phase === 'inProgress' ? '' :
        renderTemplate('tastingFlightToggleAdd', {
          completedAttributes: current.phase === 'completed' ? {"disabled": true} : {},
          newBottlingIcon: newBottlingIcon,
          add: t('tastingFlights.add'),
        }),
      tastingFlightAdd: flightAdding && current.phase !== 'inProgress' ?
        renderTemplate('tastingFlightAdd', {
          selectExisting: t('tastingFlights.selectExisting'),
          disabledAttributes: available.length ? {} : {"disabled": true},
          available: composeMarkup(available.map(item =>
            renderTemplate('flightOption', {
              id: item.record.id,
              flightEntryLabel: flightEntryLabel(item),
            }))),
          attachDisabled: available.length ? {} : {"disabled": true},
          addExisting: t('tastingFlights.addExisting'),
          chooseBottling: t('tastings.chooseBottling'),
          bottlings: composeMarkup((state.collection?.bottlings || []).map(b =>
            renderTemplate('flightOption2', {
              id: b.id,
              name: b.fullName ?? b.name,
            }))),
          ownedDisabled: (state.collection?.bottlings || []).length ? {} : {"disabled": true},
          fromCollection: t('tastings.fromCollection'),
          tastingFlightNewExternalButton: actionButton({
            label: t('tastings.outsideCollection'),
            action: 'tasting-flight-new-external',
          }),
        }) : '',
      warehouseBottleList: refs.length ?
        renderTemplate('warehouseBottleList2', {refs: composeMarkup(refs.map(entryRow)), }) : renderTemplate('hint7', {noEntries: t('tastingFlights.noEntries'), }),
    }));
  }

  /**
   * Sets the flight metadata edit mode and redraws the flight.
   *
   * @param {boolean} editing Whether to enter or leave flight-edit mode.
   */
  function toggleFlightEdit(editing) {flightEditing = editing; flight();}

  /**
   * Toggles the flight member chooser and redraws the flight.
   */
  function toggleFlightAdd() {flightAdding = !flightAdding; flight();}

  /**
   * Persists flight to its backing store.
   * @return {!Promise<*>} Completion of saving the selected flight's metadata.
   */
  async function saveFlight() {
    const name = /** @type {HTMLInputElement} */ (document.querySelector('.tasting-flight-page [data-flight-name]'));
    const date = /** @type {HTMLInputElement} */ (document.querySelector('.tasting-flight-page [data-flight-date]'));
    if (!name?.reportValidity() || !date?.reportValidity()) return;
    const notes = /** @type {HTMLTextAreaElement} */ (document.querySelector('.tasting-flight-page [data-flight-notes]'))?.value || '';
    try {
      await request(
        `/api/tasting-flights/${encodeURIComponent(state.selected)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({name: name.value, date: date.value, notes}),
        }
      );
      flightEditing = false;
      await refresh('collection');
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Replaces the selected flight's ordered tasting IDs on the server and refreshes the collection.
   *
   * @param {*} ids Identifiers in their current order.
   * @return {!Promise<*>} Completion of saving the ordered flight membership and refreshing collection data.
   */
  async function updateFlightMembers(ids) {
    try {
      await request(
        `/api/tasting-flights/${encodeURIComponent(state.selected)}/tastings`,
        {method: 'PUT', body: JSON.stringify({tastingIds: ids})}
      );
      await refresh('collection');
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Reorders a member of the current flight and persists the new member order.
   *
   * @param {string} sourceId Identifier of the moved tasting.
   * @param {string} targetId Identifier of the destination tasting.
   * @param {boolean} after Whether to insert after rather than before the destination.
   * @return {!Promise<*>} Completion of saving the reordered flight members, if the order changed.
   */
  function reorderFlightMember(sourceId, targetId, after) {
    const record = (state.collection?.tastingFlights || []).find(x => x.id === state.selected);
    const reordered = record && reorderFlightIds(record.tastingIds, sourceId, targetId, after);
    if (reordered) return updateFlightMembers(reordered);
  }

  /**
   * Derives the move flight member numeric value from its input.
   *
   * @param {*} index Zero-based index of the selected entry.
   * @param {*} step Relative movement or step size.
   * @return {!Promise<*>} Completion of moving the requested flight member when the new index is valid.
   */
  function moveFlightMember(index, step) {
    const record = (state.collection?.tastingFlights || []).find(x => x.id === state.selected);
    if (!record) return;
    const ids = [...record.tastingIds], to = index + step;
    if (!Number.isInteger(index) || to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    return updateFlightMembers(ids);
  }

  /**
   * Registers flight member behavior.
   * @return {!Promise<*>} Completion of attaching the selected tasting to the flight.
   */
  function attachFlightMember() {
    const id = /** @type {HTMLSelectElement} */ (document.querySelector('[data-flight-tasting-option]'))?.value;
    const current = (state.collection?.tastingFlights || []).find(x => x.id === state.selected);
    if (id && current) return updateFlightMembers([...current.tastingIds, id]);
  }

  /**
   * Removes the specified tasting from the selected flight if it is a member.
   *
   * @param {*} id Identifier of the affected record.
   * @return {!Promise<*>} Completion of the member update, or undefined when no matching member exists.
   */
  function detachFlightMember(id) {
    const current = (state.collection?.tastingFlights || []).find(x => x.id === state.selected);
    if (current?.tastingIds.includes(id)) return updateFlightMembers(current.tastingIds.filter(x => x !== id));
  }

  /**
   * Removes or resets flight.
   * @return {!Promise<*>} Completion of deleting the selected flight.
   */
  async function deleteFlight() {
    try {
      await request(`/api/tasting-flights/${encodeURIComponent(state.selected)}`, {method: 'DELETE'});
      closeModal();
      state.page = 'tastings-home';
      await refresh('collection');
      navigate('tastings-home', null, {replace: true});
      return true;
    } catch (error) {toast(error.message, true); return false;}
  }

  /** Closes the add-member chooser when returning from a tasting. */
  function closeAddChooser() {flightAdding = false;}
  return {homeFlights, flight, startFlight, openPlannedFlight, showFlightPlanningHelp, generateFlightPlan, invalidateFlightPlan, resetFlightCaskSelection, createPlannedFlight, changePlannedMember, transitionPlannedFlight, createFlight, saveFlight, deleteFlight, moveFlightMember, reorderFlightMember, attachFlightMember, detachFlightMember, toggleFlightEdit, toggleFlightAdd, closeAddChooser};
}
