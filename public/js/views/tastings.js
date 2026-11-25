import {createTastingIndexViewModel} from './models/tastings.js';
import {composeMarkup} from '../ui/render-plan.js';
import {replaceElement, replaceContent, appendContent}
  from '../ui/dom-renderer.js';
import {actionButton} from '../ui/buttons.js';
import {checkboxInput} from '../ui/fields.js';
import {
  helpIconButton, sectionHeader, headingTitle, pageHeader,
  backNavigation
} from '../ui/headers.js';
import {t} from '../i18n/index.js';
import {displayPhotoPath} from '../../../shared/photo-images.js';
import {storagePath} from './warehouse-presentation.js';
import {escapeHtml} from '../ui/dom.js';
import {detailField, detailGrid, actionToolbar, panel, emptyState}
  from '../ui/content.js';
import {formatDate, imageUrl} from '../ui/format.js';
import {request} from '../api.js';
import {toast} from '../ui/notifications.js';
import {flavorChart, readFlavorProfile, displayFlavorProfile}
  from '../ui/flavor-profile.js';
import {createTastingHistory} from '../domain/tasting-history.js';
import {glencairnRating, syncGlencairnRating} from '../ui/glencairn-rating.js';
import {glencairnRatingSymbol} from '../ui/glencairn-icon.js';
import {whiskyColorSelector, whiskyColorDisplay, whiskyCustomColorName}
  from '../ui/whisky-color-selector.js';
import {
  isAllowedWhiskyHex, normalizeWhiskyColor, whiskyPickerHex,
  whiskyPickerPosition
} from '../../../shared/whisky-colors.js';
import {parseTastingScore, emptyTastingNotes} from '../../../shared/tasting.js';
import {sortedTastings} from '../../../shared/tasting-records.js';
import {allTastingReferences, flightEntries, flightForTasting}
  from '../../../shared/tasting-flights.js';
import {allStandaloneTastings} from '../../../shared/standalone-tastings.js';
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
import {
  suggestFlight, flightCandidates, flightCandidateDiagnostics, FLIGHT_STYLES,
  FLIGHT_AVAILABILITY, FLIGHT_FOCUSES, CASK_MODES, AGE_MODES,
} from '../domain/flight-planner.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(new URL('./templates/tastings.html', import.meta.url));


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
  confirm: confirmModal
}) {
  let flavorSession = null;
  let createChoiceOpen = false;
  let flightEditing = false;
  let flightAdding = false;
  let flightCreating = false;
  let flightPlanDraft = null;
  let lastFlightId = null;
  /**
   * Checks whether external applies.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  const isExternal = () => state.page === 'external-tasting';

  /**
   * Derives the standalone result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const standalone = () => allStandaloneTastings(state.collection || {});

  /**
   * Derives the subject result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const subject = () => state.collection?.bottlings?.find(b => b.id === state.selected);

  /**
   * Derives the edit page result from the supplied values.
   *
   * @param {boolean=} external Value used by this operation.
   * @return {*} Result computed from the supplied inputs.
   */
  const editPage = (external = isExternal()) => external ? 'external-tasting' : 'tasting';

  /**
   * Selects and transforms the distillery meta records.
   *
   * @param {*} bottling Bottling record being inspected or updated.
   * @param {boolean=} owned Value used by this operation.
   * @return {string} Resulting text.
   */
  const distilleryMeta = (bottling, owned = true) => [
    (bottling?.distilleryIds || []).map(id => state.collection?.distilleries?.find(d => d.id === id)?.name).filter(Boolean).join(', ') || bottling?.distillery || '',
    bottling?.ageYears != null && bottling.ageYears !== '' ?
      `${t('forms.bottling.ageYears')}: ${t('home.facts.years', {count: bottling.ageYears})}` : '',
    owned && typeof bottling?.caskType === 'string' && bottling.caskType.trim() ? `${t('forms.bottling.caskType')}: ${bottling.caskType.trim()}` : '',
    bottling?.abv != null && bottling.abv !== '' ?
      `${t('forms.bottling.abv')}: ${String(bottling.abv).replace('.', ',')} % Vol.` : '',
    !owned && bottling?.bottler ? `${t('forms.bottling.bottler')}: ${bottling.bottler}` : '',
    !owned && bottling?.releaseYear != null && bottling.releaseYear !== '' ?
      `${t('forms.bottling.releaseYear')}: ${bottling.releaseYear}` : '',
  ].filter(Boolean).join(' · ');

  /**
   * Derives the back link result from the supplied values.
   *
   * @param {*} action Operation or action callback to invoke.
   * @param {*} label Label shown to the user.
   * @return {string} Resulting text.
   */
  const backLink = (action, label) => backNavigation(action, t(label));

  /**
   * Derives the page title result from the supplied values.
   *
   * @param {*} title Title displayed or stored by this operation.
   * @param {*} intro Value used by this operation.
   * @param {*=} eyebrow Value used by this operation.
   * @return {string} Resulting text.
   */
  const pageTitle = (title, intro, eyebrow = t('tastings.childEyebrow')) =>
    pageHeader({title, intro, eyebrow, className: 'analytics-page-heading'});
  // Show exactly the same Abfuellungsfoto (cover image) as the bottling detail
  // page.

  /**
   * Builds the localized bottling info text for the current language.
   *
   * @param {*} bottling Bottling record being inspected or updated.
   * @param {boolean=} external Value used by this operation.
   * @param {boolean=} draft Value used by this operation.
   * @return {string} Resulting text.
   */
  const bottlingInfo = (bottling, external = false, draft = false) => {
    const photo = external ? '' : (selectors?.coverPhoto?.(bottling.id) || '');
    return renderTemplate('analyticsPanel', {
      external: external ? renderTemplate('bottlingInfo', {
        draft: draft ? '' :
          renderTemplate('tastingBottlingSummary', {
            name: bottling.name || '',
            editIcon: editIcon,
            edit: t('common.actions.edit'),
            tastingExternalAssignButton: actionButton({
              label: t('tastings.assignToCollection'),
              action: 'tasting-external-assign',
              size: 'small',
            }),
            muted: distilleryMeta(bottling, false) ?
              renderTemplate('muted', {distilleryMeta: distilleryMeta(bottling, false), }) : '',
          }),
        draft2: draft ? '' : 'hidden',
        externalFields: externalFields(bottling),
        draft3: draft ? '' :
          renderTemplate('actions', {
            tastingExternalCancelButton: actionButton({
              label: t('common.actions.cancel'),
              action: 'tasting-external-cancel',
            }),
            tastingExternalSaveButton: actionButton({
              label: t('common.actions.save'),
              action: 'tasting-external-save',
              variant: 'primary',
            }),
          }),
      }) :
        renderTemplate('tastingBottlingSummary2', {
          tastingBottlingPhoto: photo ? renderTemplate('tastingBottlingPhoto', {
            imageUrl: imageUrl(photo),
            bottleAlt: t('home.image.bottleAlt', {name: bottling.name || ''}),
          }) : '',
          name: bottling.name || '',
          tastingOpenBottlingButton: actionButton({
            label: t('tastings.openBottlingDetails'),
            action: 'tasting-open-bottling',
            size: 'small',
          }),
          muted: distilleryMeta(bottling) ? renderTemplate('muted2', {distilleryMeta: distilleryMeta(bottling), }) : '',
        }),
    });
  };

  /**
   * Derives the associated flight result from the supplied values.
   *
   * @param {*} record Record to validate or persist.
   * @return {*} Result computed from the supplied inputs.
   */
  const associatedFlight = record => record?.id ? flightForTasting(state.collection, record.id) : null;

  /**
   * Produces the flight hint text used by the caller.
   *
   * @param {*} record Record to validate or persist.
   * @return {string} Resulting text.
   */
  const flightHint = record => {
    const flight = associatedFlight(record);
    if (!flight) return '';
    const pos = flight.tastingIds.indexOf(record.id) + 1;
    return renderTemplate('tastingOpenFlight', {
      id: flight.id,
      name: flight.name,
      position: t('tastingFlights.position', {position: pos, count: flight.tastingIds.length}),
    });
  };

  /**
   * Builds the localized tasting rating text for the current language.
   *
   * @param {*} record Record to validate or persist.
   * @return {string} Resulting text.
   */
  const tastingRating = record => record.rating == null ? escapeHtml(t('tasting.unrated')) : `${escapeHtml(String(record.rating))} / 100`;

  /**
   * Normalizes the blank text for subsequent processing.
   *
   * @param {*} value Value to process.
   * @return {string} Resulting text.
   */
  const blank = value => value == null || String(value).trim() === '' ? renderTemplate('muted3') : escapeHtml(String(value));

  /**
   * Calculates the static rating numeric value.
   *
   * @param {*} record Record to validate or persist.
   * @return {string} Resulting text.
   */
  const staticRating = record =>
    renderTemplate('tastingReadonlyRating', {
      rating: record.rating == null ? '' : composeMarkup(Array.from(
        {length: 5},
        (_, i) => {
          const fill = Math.max(0, Math.min(100, (Number(record.rating) - i * 20) * 5));
          return glencairnRatingSymbol({fill, id: `read-rating-${i}`});
        }
      )),
      tastingRating: tastingRating(record),
    });

  /**
   * Transforms the entries used by tasting read only.
   *
   * @param {*} value Value to process.
   * @return {string} Resulting text.
   */
  const tastingReadOnly = value =>
    renderTemplate('flavorDetailPanel', {
      detailGrid: detailGrid(composeMarkup([
        detailField({
          label: t('tastings.date'),
          value: formatDate(value.tastedOn || ''),
          variant: 'readonly',
          className: 'tasting-readonly-field',
          labelClass: 'tasting-readonly-label',
        }),
        value.title ? detailField({
          label: t('tastings.nameReadonly'),
          value: value.title,
          variant: 'readonly',
          className: 'tasting-readonly-field',
          labelClass: 'tasting-readonly-label',
        }) : '',
      ]), {columns: 2, className: 'tasting-readonly-meta-fields'}),
      actionToolbar: actionToolbar(
        renderTemplate('tastingEditStart', {
          editIcon: editIcon,
          edit: t('common.actions.edit'),
        }),
        {className: 'tasting-readonly-meta-actions'}
      ),
      headingTitle: headingTitle({title: t('tasting.colorHeading')}),
      whiskyColorDisplay: whiskyColorDisplay(value.whiskyColor) || renderTemplate('hint', {notRecorded: t('tastings.notRecorded'), }),
      headingTitle2: headingTitle({title: t('flavor.title')}),
      flavorChart: flavorChart(value.flavorProfile, {editable: false}),
      headingTitle3: headingTitle({title: t('tasting.notes'), }),
      detailGrid2: detailGrid(
        composeMarkup(['nose', 'palate', 'finish'].map(key => detailField({
          label: t(`forms.bottling.${key}`),
          value: blank(value.tastingNotes?.[key]),
          valueHtml: true,
          variant: 'note',
          className: 'tasting-readonly-field',
          labelClass: 'tasting-readonly-label',
          valueClass: 'tasting-readonly-note',
        }))),
        {columns: 3, className: 'tasting-notes tasting-readonly-notes'}
      ),
      headingTitle4: headingTitle({title: t('tasting.overallRating'), }),
      staticRating: staticRating(value),
      trim: value.ratingComment?.trim() ? detailField({
        label: t('tasting.ratingComment'),
        value: value.ratingComment,
        variant: 'note',
        className: 'tasting-rating-comment',
        labelClass: 'tasting-readonly-label',
        valueClass: 'tasting-readonly-note',
      }) : '',
    });

  /**
   * Calculates the tasting list glasses numeric value.
   *
   * @param {*} record Record to validate or persist.
   * @return {string} Resulting text.
   */
  const tastingListGlasses = record => {
    if (record.rating == null || !Number.isFinite(Number(record.rating))) return '';
    const safe = Math.max(0, Math.min(100, Number(record.rating)));
    const unique = String(record.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    return renderTemplate('tastingListGlasses', {
      from: composeMarkup(Array.from(
        {length: 5},
        (_, i) =>
          glencairnRatingSymbol({
            fill: Math.max(0, Math.min(100, (safe - i * 20) * 5)),
            id: `tasting-list-${unique}-${i}`,
          })
      )),
    });
  };

  /**
   * Builds the localized tasting row text for the current language.
   *
   * @param {!Object} options Options controlling the operation.
   * @return {string} Resulting text.
   */
  const tastingRow = ({record, b, external = false, home = false}) =>
    renderTemplate('warehouseBottleRow', {
      home: home ? 'tasting-home-row' : 'tasting-list-row',
      home2: home ? 'tastings-home-open' : 'tastings-open',
      home3: home ? `data-external="${external ? '1' : '0'}" data-bottling-id="${escapeHtml(external ? record.id : b.id)}"` : '',
      id: record.id,
      content: `${t('tastings.open')}: ${home ? b.name : (record.title || formatDate(record.tastedOn))}`,
      home4: home ? b.name : (record.title || formatDate(record.tastedOn)),
      home5: home ? formatDate(record.tastedOn) : (record.title ? formatDate(record.tastedOn) : ''),
      home6: home && record.title ? ` · ${escapeHtml(record.title)}` : '',
      tastingListGlasses: tastingListGlasses(record),
      tastingRating: tastingRating(record),
      chevronRightIcon: chevronRightIcon,
      home7: home ? '' :
        renderTemplate('tastingDelete', {
          id: record.id,
          delete: t('common.actions.delete'),
        }),
    });

  /**
   * Derives the empty record result from the supplied values.
   * @return {!Object} Result computed from the supplied inputs.
   */
  const emptyRecord = () => ({
    tastedOn: localToday(),
    title: '',
    flavorProfile: null,
    tastingNotes: emptyTastingNotes(),
    rating: null,
    ratingComment: '',
    whiskyColor: null,
  });

  /**
   * Derives the empty bottling result from the supplied values.
   * @return {!Object} Result computed from the supplied inputs.
   */
  const emptyBottling = () => ({
    name: '',
    distillery: '',
    bottler: '',
    ageYears: null,
    abv: null,
    releaseYear: null,
  });
  let flavorSaveQueue = Promise.resolve();
  let draftSavePending = null;
  /**
   * Derives the flavor node result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  function flavorNode() {
    return globalThis.document?.querySelector?.('[data-flavor-detail]') || null;
  }

  /**
   * Retrieves tasting editor from the available state.
   * @return {!Object} Structured result assembled from the input data.
   */
  function readTastingEditor() {
    const node = flavorNode();
    return {
      flavorProfile: readFlavorProfile(node),
      tastingNotes: Object.fromEntries(['nose', 'palate', 'finish'].map(key => [key, node.querySelector(`[data-tasting-note="${key}"]`)?.value || '',])),
      rating: parseTastingScore(node.querySelector('[data-tasting-score]')?.value),
      ratingComment: node.querySelector('[data-tasting-rating-comment]')?.value || '',
      whiskyColor: node.querySelector('[data-whisky-color]')?.dataset.whiskyColor || null,
    };
  }

  /**
   * Updates tasting buttons for tastings.
   */
  function updateTastingButtons() {
    const node = flavorNode();
    if (!node || !flavorSession) return;
    const undo = node.querySelector('[data-act="flavor-detail-undo"]');
    const redo = node.querySelector('[data-act="flavor-detail-redo"]');
    if (undo) undo.disabled = !flavorSession.history.canUndo;
    if (redo) redo.disabled = !flavorSession.history.canRedo;
    const missing = node.querySelector('[data-flavor-missing]');
    if (missing) missing.hidden = Boolean(flavorSession.history.value.flavorProfile);
    const clearRating = node.querySelector('[data-act="tasting-rating-clear"]');
    if (clearRating) clearRating.disabled = flavorSession.history.value.rating == null;
    const clearColor = node.querySelector('[data-act="tasting-color-clear"]');
    const clearFlavor = node.querySelector('[data-act="tasting-flavor-clear"]');
    if (clearFlavor) clearFlavor.disabled = !flavorSession.history.value.flavorProfile;
    if (clearColor) clearColor.disabled = !flavorSession.history.value.whiskyColor;
  }

  /**
   * Locates the DOM elements used by redraw tasting.
   */
  function redrawTasting() {
    const node = flavorNode();
    if (!node || !flavorSession) return;
    const value = flavorSession.history.value;
    displayFlavorProfile(node, value.flavorProfile);
    for (const key of ['nose', 'palate', 'finish']) {
      const input = node.querySelector(`[data-tasting-note="${key}"]`);
      if (input) input.value = value.tastingNotes[key];
    }
    const ratingComment = node.querySelector('[data-tasting-rating-comment]');
    if (ratingComment) ratingComment.value = value.ratingComment;
    const rating = node.querySelector('[data-tasting-rating]');
    if (rating) replaceElement(rating, glencairnRating(value.rating));
    const color = node.querySelector('[data-whisky-color]');
    if (color) replaceElement(color, whiskyColorSelector(value.whiskyColor));
    updateTastingButtons();
  }

  /**
   * Updates tasting for tastings.
   *
   * @return {!Promise<void>} Promise fulfilled when the operation completes.
   */
  function persistTasting() {
    const session = flavorSession;
    if (!session?.editing) return Promise.resolve();
    const value = session.history.value;
    flavorSaveQueue = flavorSaveQueue.then(async () => {
      if (session.draft) return;
      const updated = await request(
        session.external ?
          `/api/external-tastings/${encodeURIComponent(session.id)}` :
          `/api/bottlings/${encodeURIComponent(session.bottlingId)}/tastings/${encodeURIComponent(session.id)}`,
        {
          method: 'PATCH', body: JSON.stringify(value),
        }
      );
      if (session.external) {
        const item = state.collection?.externalTastings?.find(t => t.id === session.id);
        if (item) Object.assign(item, updated);
      } else {
        const entry = state.collection?.bottlings?.find(b => b.id === session.bottlingId);
        const tasting = entry?.tastings?.find(t => t.id === session.id);
        if (tasting) Object.assign(tasting, updated);
      }
    }).catch(error => toast(error.message, true));
    return flavorSaveQueue;
  }

  /**
   * Performs the commit tasting lifecycle action.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  function commitTasting() {
    if (!flavorSession?.editing) return true;
    const node = flavorNode();
    if (!node || !flavorSession) return;
    let value;
    const score = node.querySelector('[data-tasting-score]');
    try {value = readTastingEditor();}
    catch {
      if (score) {
        score.setCustomValidity(t('tasting.ratingInvalid'));
        const error = node.querySelector('#tasting-score-error');
        if (error) error.textContent = t('tasting.ratingInvalid');
        score.setAttribute('aria-invalid', 'true');
      }
      return false;
    }
    if (score) {
      score.setCustomValidity(''); score.removeAttribute('aria-invalid');
      const error = node.querySelector('#tasting-score-error');
      if (error) error.textContent = '';
    }
    if (flavorSession.history.record(value)) {
      syncGlencairnRating(node.querySelector('[data-tasting-rating]'), value.rating);
      // Do not replace focused form controls while a blur/change event fires.
      // This also prevents the browser from losing a pending glass-button
      // click.
      updateTastingButtons();
      void persistTasting();
    }
    return true;
  }

  /**
   * Locates the DOM elements used by preview rating.
   */
  function previewRating() {
    const widget = flavorNode()?.querySelector('[data-tasting-rating]');
    if (!widget) return;
    try {
      syncGlencairnRating(widget, parseTastingScore(widget.querySelector('[data-tasting-score]')?.value));
    }
    catch {
      // Leave the last valid preview intact until the input is corrected.
    }
  }

  /**
   * Locates the DOM elements used by choose rating.
   *
   * @param {*} value Value to process.
   */
  function chooseRating(value) {
    if (!flavorSession?.editing) return;
    const node = flavorNode()?.querySelector('[data-tasting-rating]');
    if (!node) return;
    node.dataset.ratingValue = value == null ? '' : String(value);
    const input = node.querySelector('[data-tasting-score]');
    if (input) input.value = value == null ? '' : String(value).replace('.', ',');
    commitTasting();
    redrawTasting();
    const selector = value == null ? '[data-act="tasting-rating-clear"]' : `[data-rating-points="${value}"]`;
    flavorNode()?.querySelector(selector)?.focus?.();
  }

  /**
 * Update the preview during pointer movement without saving every intermediate
 * colour.
 *
 * @param {*} hex Hex used by this operation.
 * @param {number} x Horizontal coordinate in the current coordinate system.
 * @param {number} y Vertical coordinate in the current coordinate system.
 */
  function previewCustomColor(hex, x, y) {
    if (!flavorSession?.editing || !isAllowedWhiskyHex(hex)) return;
    const color = flavorNode()?.querySelector('.whisky-custom-row');
    if (!color) return;
    color.classList.add('is-previewing');
    const position = x == null || y == null ? whiskyPickerPosition(hex) : {x, y};
    const picker = color.querySelector('[data-whisky-picker-area]');
    if (picker) {
      picker.style.setProperty('--picker-x', `${(position.x * 100).toFixed(1)}%`);
      picker.style.setProperty('--picker-y', `${(position.y * 100).toFixed(1)}%`);
      picker.dataset.pickerX = String(position.x);
      picker.dataset.pickerY = String(position.y);
    }
    const liquid = color.querySelector('.whisky-custom-preview .glencairn-liquid');
    if (liquid) liquid.style.fill = hex;
    const input = color.querySelector('[data-whisky-custom-hex]');
    if (input) input.value = hex.toUpperCase();
    const label = color.querySelector('[data-whisky-custom-name]');
    if (label) {
      const name = whiskyCustomColorName(hex);
      if (label.textContent !== name) label.textContent = name;
    }
  }

  /**
   * Calculates the preview custom from pointer numeric value.
   *
   * @param {!Event} event Event that triggered this operation.
   */
  function previewCustomFromPointer(event) {
    if (!flavorSession?.editing) return;
    const picker = event.target.closest?.('[data-whisky-picker-area]');
    if (!picker) return;
    const rect = picker.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    previewCustomColor(whiskyPickerHex(x, y), x, y);
  }

  /**
 * Arrow keys are a keyboard-accessible alternative to dragging the
 * two-dimensional picker.
 *
 * @param {!KeyboardEvent} event Event that triggered the handler.
 * @return {boolean} Whether the condition is satisfied.
 */
  function nudgeCustomColor(event) {
    if (!flavorSession?.editing || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false;
    const picker = event.target.closest?.('[data-whisky-picker-area]');
    if (!picker) return false;
    event.preventDefault();
    const input = flavorNode()?.querySelector('[data-whisky-custom-hex]');
    const current = isAllowedWhiskyHex(input?.value) ? input.value : whiskyPickerHex(0.65, 0.48);
    const position = whiskyPickerPosition(current);
    const x = Number(picker.dataset.pickerX ?? position.x);
    const y = Number(picker.dataset.pickerY ?? position.y);
    const delta = event.shiftKey ? 0.10 : 0.02;
    const nx = Math.max(0, Math.min(1, x + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0)));
    const ny = Math.max(0, Math.min(1, y + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0)));
    previewCustomColor(whiskyPickerHex(nx, ny), nx, ny);
    return true;
  }

  /**
 * Validate the internal HEX draft; the same restriction is enforced during API
 * normalization.
 *
 * @param {*} raw Raw used by this operation.
 * @return {boolean} Whether the condition is satisfied.
 */
  function chooseCustomHex(raw) {
    if (!flavorSession?.editing) return false;
    let value;
    try {value = normalizeWhiskyColor(`custom:${String(raw).trim()}`);}
    catch {return false;}
    chooseColor(value);
    return true;
  }

  /**
   * Performs the commit custom preview lifecycle action.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  function commitCustomPreview() {
    const hex = flavorNode()?.querySelector('[data-whisky-custom-hex]')?.value;
    return hex ? chooseCustomHex(hex) : false;
  }

  /**
   * Removes or resets custom preview.
   */
  function resetCustomPreview() {redrawTasting();}

  /**
 * Discard the custom draft itself, not only its visible HEX label.
 *
 * @param {!Element} node DOM or syntax node to process.
 */
  function clearCustomDraft(node) {
    const row = node.querySelector('.whisky-custom-row');
    if (!row) return;
    const hex = row.querySelector('[data-whisky-custom-hex]');
    if (hex) {
      hex.value = '';
      hex.defaultValue = '';
    }
    const label = row.querySelector('[data-whisky-custom-name]');
    if (label) label.textContent = '';
    const liquid = row.querySelector('.whisky-custom-preview .glencairn-liquid');
    if (liquid) liquid.style.fill = 'transparent';
    const picker = row.querySelector('[data-whisky-picker-area]');
    if (picker) {
      picker.style.removeProperty('--picker-x');
      picker.style.removeProperty('--picker-y');
      delete picker.dataset.pickerX;
      delete picker.dataset.pickerY;
    }
    row.classList.remove('is-selected', 'is-previewing');
  }

  /**
   * Locates the DOM elements used by choose color.
   *
   * @param {*} value Value to process.
   */
  function chooseColor(value) {
    if (!flavorSession?.editing) return;
    const node = flavorNode()?.querySelector('[data-whisky-color]');
    if (!node) return;
    // Fixed colours (and clear) discard the previous custom HEX entirely.
    if (!value || !value.startsWith('custom:')) clearCustomDraft(node);
    node.dataset.whiskyColor = value || '';
    commitTasting();
    redrawTasting();
    const selector = value?.startsWith('custom:') ?
      '[data-whisky-picker-area]' :
      (value ? `[data-color-key="${value}"]` : '[data-act="tasting-color-clear"]');
    flavorNode()?.querySelector(selector)?.focus?.({preventScroll: true});
  }

  /**
   * Removes or resets flavor.
   */
  function clearFlavor() {
    if (!flavorSession?.editing) return;
    if (!flavorSession || !flavorSession.history.value.flavorProfile) return;
    if (flavorSession.history.record({
      ...flavorSession.history.value, flavorProfile: null,
    })) {
      redrawTasting();
      void persistTasting();
      flavorNode()?.querySelector('[data-act="tasting-flavor-clear"]')?.focus?.();
    }
  }

  /**
   * Derives the step flavor result from the supplied values.
   *
   * @param {*} direction Direction used for traversal or movement.
   */
  function stepFlavor(direction) {
    if (!flavorSession?.editing) return;
    const changed = direction < 0 ? flavorSession.history.undo() : flavorSession.history.redo();
    if (changed) {redrawTasting(); void persistTasting();}
  }

  /**
   * Transforms the entries used by external fields.
   *
   * @param {!Object=} info Value used by this operation.
   * @return {string} Resulting text.
   */
  function externalFields(info = {}) {
    const fields = [
      ['name', 'tastings.externalName', 'text', 180, true],
      ['distillery', 'tastings.externalDistillery', 'text', 140, false],
      ['bottler', 'tastings.externalBottler', 'text', 140, false],
      ['ageYears', 'tastings.externalAge', 'number', null, false],
      ['abv', 'tastings.externalAbv', 'number', null, false],
      ['releaseYear', 'tastings.externalYear', 'number', null, false],
    ];
    return composeMarkup(fields.map(([key, label, type, max, required]) =>
      renderTemplate('externalFieldsLabel', {
        t: t(label),
        key: key,
        key2: key,
        type: type,
        max: max ? `maxlength="${max}"` : '',
        required: required ? 'required' : '',
        type2: type === 'number' ? (key === 'abv' ?
          'min="0" max="100" step="0.1"' : key === 'ageYears' ? 'min="0" max="200" step="1"' : 'min="1800" max="2200" step="1"') : '',
        info: String(info[key] ?? ''),
      })));
  }

  /**
   * Retrieves external fields from the available state.
   *
   * @param {*} node Node to inspect or update.
   * @return {*} Computed value, or null when the input has no match.
   */
  function readExternalFields(node) {
    const data = {};
    for (const key of ['name', 'distillery', 'bottler', 'ageYears', 'abv',
      'releaseYear']) {
      const input = node.querySelector(`[data-external-field="${key}"]`);
      if (!input?.checkValidity()) {input?.reportValidity(); return null;}
      data[key] = ['ageYears', 'abv', 'releaseYear'].includes(key) ?
        (input.value === '' ? null : Number(input.value)) : input.value.trim();
    }
    if (!data.name) {
      node.querySelector('[data-external-field="name"]')?.reportValidity(); return null;
    }
    return data;
  }

  /**
   * Orders the flight list records using the configured comparison.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  const flightList = () => [...(state.collection?.tastingFlights || [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  /**
   * Transforms the entries used by home flights.
   * @return {string} Resulting text.
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
              phase: item.phase ? escapeHtml(t(`flightPlan.phase.${item.phase}`)) + ' · ' : '',
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
   * Builds the localized flight planning help button text for the current
   * language.
   * @return {string} Resulting text.
   */
  function flightPlanningHelpButton() {
    return helpIconButton({label: t('flightPlan.help.title')});
  }

  /**
   * Updates the DOM elements managed by sync flight plan options.
   */
  function syncFlightPlanOptions() {
    const box = globalThis.document?.querySelector?.('#modal-root');
    const style = box?.querySelector('[data-flight-plan-style]')?.value;
    const similar = box?.querySelector('[data-flight-plan-focus-wrap]');
    const discover = box?.querySelector('[data-flight-plan-unfamiliar-wrap]');
    const caskMode = box?.querySelector('[data-flight-plan-cask-mode]')?.value;
    syncFlightCaskOptions(box, caskMode === 'specific', t);
    const ageMode = box?.querySelector('[data-flight-plan-age-mode]')?.value;
    if (similar) similar.hidden = style !== 'similar';
    if (discover) discover.hidden = style !== 'discover';
    for (const [selector, visible] of [
      ['[data-flight-plan-age-range-wrap]', ageMode === 'range'],
      [
        '[data-flight-plan-strict-wrap]',
        caskMode === 'specific' || ageMode === 'range',
      ],
    ]) {
      const element = box?.querySelector(selector); if (element) element.hidden = !visible;
    }
  }

  /**
   * Performs the start planned flight lifecycle action.
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
        fLIGHTSTYLES: composeMarkup(FLIGHT_STYLES.map(id =>
          renderTemplate('startPlannedFlightOption', {
            id: id,
            t: t(`flightPlan.${id}`),
          }))),
        content: composeMarkup([3, 4, 5, 6].map(n =>
          renderTemplate('startPlannedFlightOption2', {
            n: n,
            selected: n === 5 ? 'selected' : '',
            n2: n,
          }))),
        fLIGHTAVAILABILITY: composeMarkup(FLIGHT_AVAILABILITY.map(id => renderTemplate('startPlannedFlightOption3', {
          id: id,
          t: t(`flightPlan.${id}`),
        }))),
        focus: t('flightPlan.focus'),
        fLIGHTFOCUSES: composeMarkup(FLIGHT_FOCUSES.map(id =>
          renderTemplate('startPlannedFlightOption4', {
            id: id,
            t: t(`flightPlan.focus.${id}`),
          }))),
        checkboxInput: checkboxInput(t('flightPlan.unfamiliar'), 'flight-plan-unfamiliar', true),
        title: t('flightPlan.caskAge.title'),
        hint: t('flightPlan.caskAge.hint'),
        caskMode: t('flightPlan.caskAge.caskMode'),
        cASKMODES: composeMarkup(CASK_MODES.map(
          id => renderTemplate('startPlannedFlightOption5', {
            id: id,
            t: t(`flightPlan.caskAge.caskMode.${id}`),
          }))),
        ageMode: t('flightPlan.caskAge.ageMode'),
        aGEMODES: composeMarkup(AGE_MODES.map(id =>
          renderTemplate('startPlannedFlightOption6', {
            id: id,
            t: t(`flightPlan.caskAge.ageMode.${id}`),
          }))),
        flightCaskOptionsHtml: flightCaskOptionsHtml(t),
        ageRange: t('flightPlan.caskAge.ageRange'),
        ageMin: t('flightPlan.caskAge.ageMin'),
        ageMin2: t('flightPlan.caskAge.ageMin'),
        ageMax: t('flightPlan.caskAge.ageMax'),
        ageMax2: t('flightPlan.caskAge.ageMax'),
        checkboxInput2: checkboxInput(t('flightPlan.caskAge.strict'), 'flight-plan-strict'),
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
    const button = box?.querySelector('[data-act="flight-plan-create"]');
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
    const style = box?.querySelector('[data-flight-plan-style]')?.value || 'balanced';
    const count = Number(box?.querySelector('[data-flight-plan-count]')?.value || 5);
    const availability = box?.querySelector('[data-flight-plan-availability]')?.value || 'open';
    const focus = style === 'similar' ? (box?.querySelector('[data-flight-plan-focus]')?.value || 'any') : 'any';
    const preferUnfamiliar = style === 'discover' ? Boolean(box?.querySelector('[name="flight-plan-unfamiliar"]')?.checked) : false;
    const caskMode = box?.querySelector('[data-flight-plan-cask-mode]')?.value || 'auto';
    const caskFilters = caskMode === 'specific' ? readFlightCaskFilters(box) : {};
    const caskPhase = caskMode === 'specific' ? box?.querySelector('[data-flight-plan-cask-phase]')?.value || 'any' : 'any';
    const ageMode = box?.querySelector('[data-flight-plan-age-mode]')?.value || 'auto';
    // Clear any stale cross-field error before validating a corrected range.
    box?.querySelector('[data-flight-plan-age-max]')?.setCustomValidity?.('');
    /**
     * Parses age from its input.
     *
     * @param {function(...*): *} selector Selector used to obtain matching
     *     values.
     * @return {number} Calculated numeric value.
     */
    const parseAge = (selector) => {
      const field = box?.querySelector(selector); if (!field || field.value === '') return null;
      if (!field.reportValidity()) return undefined; return Number(field.value);
    };
    const ageMin = ageMode === 'range' ? parseAge('[data-flight-plan-age-min]') : null;
    const ageMax = ageMode === 'range' ? parseAge('[data-flight-plan-age-max]') : null;
    if (ageMin === undefined || ageMax === undefined) return;
    if (ageMin !== null && ageMax !== null && ageMin > ageMax) {
      box?.querySelector('[data-flight-plan-age-max]')?.setCustomValidity?.(t('flightPlan.caskAge.invalidRange'));
      box?.querySelector('[data-flight-plan-age-max]')?.reportValidity?.();
      return;
    }
    box?.querySelector('[data-flight-plan-age-max]')?.setCustomValidity?.('');
    const strictMatches = Boolean(box?.querySelector('[name="flight-plan-strict"]')?.checked);
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
    if (view) replaceContent(view, draft.length ?
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
            name: b?.name || '',
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
      appendContent(view, composeMarkup(messages.map(message => renderTemplate('hint6', {message: message, }))));
    }
    const button = box?.querySelector('[data-act="flight-plan-create"]');
    if (button) button.disabled = !draft.length;
  }
  // Keep the filtered collection candidates when opening the planner modal.
  let flightPlanSourceIds = null;
  /**
   * Performs the open planned flight lifecycle action.
   */
  function openPlannedFlight() {
    flightPlanSourceIds = Array.isArray(state.flightCandidateIds) ? [...state.flightCandidateIds] : null;
    startPlannedFlight();
  }

  /**
   * Creates planned flight for tastings.
   */
  async function createPlannedFlight() {
    const box = document.querySelector('#modal-root');
    const name = box?.querySelector('[data-flight-name]');
    const date = box?.querySelector('[data-flight-date]');
    if (!name?.reportValidity() || !date?.reportValidity() || !flightPlanDraft?.items.length || flightCreating) return;
    flightCreating = true;
    try {
      const result = await request('/api/tasting-flights', {
        method: 'POST', body: JSON.stringify({
          name: name.value,
          date: date.value,
          notes: box.querySelector('[data-flight-notes]')?.value || '',
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
   * Builds the localized plan member label text for the current language.
   *
   * @param {*} item Current item under consideration.
   * @return {!Object} Structured result assembled from the input data.
   */
  function planMemberLabel(item) {
    const b = state.collection?.bottlings?.find(b => b.id === item.bottlingId);
    const bottle = b?.bottles?.find(x => x.id === item.bottleId);
    return {
      b,
      bottle,
      label: b ? `${b.name}${bottle?.inventoryNumber ? ' · #' + bottle.inventoryNumber : ''}` : t('flightPlan.missing'),
      unavailable: !bottle || bottle.status === 'empty',
    };
  }

  /**
   * Selects and transforms the planned flight detail records.
   *
   * @param {*} current Value used by this operation.
   * @return {string} Resulting text.
   */
  function plannedFlightDetail(current) {
    const editable = current.phase === 'planned';
    const candidates = flightCandidates(state.collection, {availability: 'all', });
    const selected = new Set(current.planItems.map(item => item.bottlingId));
    /**
     * Selects and transforms the choices records.
     *
     * @param {string=} excludeId Value used by this operation.
     * @return {*} Entries that meet the selection criteria.
     */
    const choices = (excludeId = '') => composeMarkup(candidates.filter(x => !selected.has(x.bottling.id) || x.bottling.id === excludeId).map(x => renderTemplate('choicesOption', {
      id: x.bottle.id,
      name: x.bottling.name,
      inventoryNumber: x.bottle.inventoryNumber || '–',
    })));
    return renderTemplate('analyticsPanel3', {
      headingTitle: headingTitle({title: `${t('flightPlan.plannedMembers')} · ${current.planItems.length}`, }),
      planItems: composeMarkup(current.planItems.map((item, index) => {
        const {b, bottle, label, unavailable} = planMemberLabel(item);
        const photo = displayPhotoPath(bottle?.photos?.[0]) || (b ? selectors?.coverPhoto?.(b.id) : null);
        const place = bottle && state.warehouse ? storagePath(state.warehouse, state.warehouse.assignments?.[bottle.id]) : null;
        return renderTemplate('flightPlanMember', {
          index: index + 1,
          flightPlanMemberPhoto: photo ? renderTemplate('flightPlanMemberPhoto', {imageUrl: imageUrl(photo), }) : '',
          label: label,
          unavailable: unavailable ? t('flightPlan.missing') : escapeHtml(t(`flightPlan.reason.${item.reason || 'manual'}`)),
          bottle: bottle ? ' · ' + escapeHtml(t(bottle.status === 'open' ? 'analytics.inventory.openedStatus' : 'home.status.closed')) : '',
          flightPlanLocation: place ?
            renderTemplate('flightPlanLocation', {
              bottleId: item.bottleId,
              label: place.label,
            }) : '',
          flightPlanOpenBottling: b ? renderTemplate('flightPlanOpenBottling', {id: b.id, }) : '',
          flightPlanMove: editable ? renderTemplate('flightPlanMove', {
            index: index,
            disabled: index === 0 ? 'disabled' : '',
            arrowUpIcon: arrowUpIcon,
            index2: index,
            disabled2: index === current.planItems.length - 1 ? 'disabled' : '',
            arrowDownIcon: arrowDownIcon,
            index3: index,
            choices: choices(item.bottlingId),
            index4: index,
            index5: index,
          }) : current.phase === 'inProgress' && !unavailable ?
            renderTemplate('flightPlanRecord', {bottlingId: item.bottlingId, }) : '',
        });
      })),
      flightPlanAdd: editable && candidates.some(x => !selected.has(x.bottling.id)) && current.planItems.length < 6 ?
        renderTemplate('flightPlanAdd', {
          choices: choices(),
          flightPlanAddButton: actionButton({
            label: t('flightPlan.add'),
            action: 'flight-plan-add',
          }),
        }) : '',
      flightPlanStart: editable ?
        renderTemplate('flightPlanStart', {
          disabled: current.planItems.some(i => planMemberLabel(i).unavailable) || !current.planItems.length ? 'disabled' : '',
        }) : '',
    });
  }

  /**
   * Updates plan in the current state.
   *
   * @param {*} items Entries to process.
   * @return {!Promise<*>} Promise for the asynchronous operation.
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
   * Updates planned member in the current state.
   *
   * @param {*} index Zero-based index of the selected entry.
   * @param {*} action Operation or action callback to invoke.
   * @param {number=} step Relative movement or step size.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  function changePlannedMember(index, action, step = 0) {
    const current = state.collection?.tastingFlights?.find(f => f.id === state.selected);
    if (current?.phase !== 'planned') return;
    const items = [...current.planItems];
    if (action === 'move' && index >= 0 && index < items.length && index + step >= 0 && index + step < items.length) {
      [items[index], items[index + step]] = [items[index + step], items[index]];
    } else if (action === 'remove' && index >= 0 && index < items.length) items.splice(index, 1);
    else if (action === 'replace' || action === 'add') {
      const value = document.querySelector(action === 'add' ? '[data-flight-manual-add]' : `[data-flight-replace="${index}"]`)?.value;
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
   * @return {!Promise<*>} Promise for the asynchronous operation.
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
   * Performs the start flight lifecycle action.
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
   * Creates flight for tastings.
   */
  async function createFlight() {
    const box = document.querySelector('#modal-root');
    const name = box?.querySelector('[data-flight-name]');
    const date = box?.querySelector('[data-flight-date]');
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
            notes: box.querySelector('[data-flight-notes]')?.value || '',
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
   * @return {string} Resulting text.
   */
  const flightEntryLabel = item => `${item.bottling?.name || ''}${item.record.title ? ` · ${item.record.title}` : ''} · ${formatDate(item.record.tastedOn || '')}`;

  /**
   * Selects and transforms the flight records.
   */
  function flight() {
    flavorSession = null;
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
    const refs = flightEntries(state.collection, current);
    const available = allTastingReferences(state.collection).filter(item => !flightForTasting(state.collection, item.record.id)).sort((a, b) => a.bottling.name.localeCompare(b.bottling.name));
    /**
     * Builds the localized entry row text for the current language.
     *
     * @param {*} item Current item under consideration.
     * @param {*} i Position in the iteration.
     * @return {string} Resulting text.
     */
    const entryRow = (item, i) =>
      renderTemplate('tastingFlightMember', {
        id: item.record.id,
        dragHandle: t('tastingFlights.dragHandle'),
        dragHandle2: t('tastingFlights.dragHandle'),
        position: t('tastingFlights.position', {position: i + 1, count: refs.length}),
        i: i + 1,
        id2: item.record.id,
        external: item.external ? item.record.id : item.bottling.id,
        external2: item.external ? '1' : '0',
        name: item.bottling.name,
        title: item.record.title || formatDate(item.record.tastedOn),
        tastingListGlasses: tastingListGlasses(item.record) || renderTemplate('tastingListGlasses2'),
        tastingRating: tastingRating(item.record),
        i2: i,
        disabled: i === 0 ? 'disabled' : '',
        moveUp: t('tastingFlights.moveUp'),
        arrowUpIcon: arrowUpIcon,
        i3: i,
        disabled2: i === refs.length - 1 ? 'disabled' : '',
        moveDown: t('tastingFlights.moveDown'),
        arrowDownIcon: arrowDownIcon,
        id3: item.record.id,
        detach: t('tastingFlights.detach'),
      });
    shell(renderTemplate('analyticsPage2', {
      backLink: backLink('tasting-flight-back', 'tastingFlights.back'),
      pageTitle: pageTitle(t('tastingFlights.detailTitle'), t('tastingFlights.detailIntro')),
      tastingFlightForm: flightEditing ? renderTemplate('tastingFlightForm4', {
        name: t('tastingFlights.name'),
        name2: current.name,
        date: t('tastingFlights.date'),
        date2: current.date,
        notes: t('tastingFlights.notes'),
        notes2: current.notes,
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
        renderTemplate('flightPlanFinish', {length: refs.length ? '' : 'disabled', }) : '',
      headingTitle: headingTitle({
        title: t(refs.length === 1 ? 'tastingFlights.oneEntry' : 'tastingFlights.entriesCount', {count: refs.length}),
      }),
      phase: current.phase === 'inProgress' ? '' :
        renderTemplate('tastingFlightToggleAdd', {
          disabled: current.phase === 'completed' ? 'disabled' : '',
          newBottlingIcon: newBottlingIcon,
          add: t('tastingFlights.add'),
        }),
      tastingFlightAdd: flightAdding && current.phase !== 'inProgress' ?
        renderTemplate('tastingFlightAdd', {
          selectExisting: t('tastingFlights.selectExisting'),
          length: available.length ? '' : 'disabled',
          available: composeMarkup(available.map(item =>
            renderTemplate('flightOption', {
              id: item.record.id,
              flightEntryLabel: flightEntryLabel(item),
            }))),
          length2: available.length ? '' : 'disabled',
          addExisting: t('tastingFlights.addExisting'),
          chooseBottling: t('tastings.chooseBottling'),
          bottlings: composeMarkup((state.collection?.bottlings || []).map(b =>
            renderTemplate('flightOption2', {
              id: b.id,
              name: b.name,
            }))),
          length3: (state.collection?.bottlings || []).length ? '' : 'disabled',
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
   * Updates the toggle flight edit state for its caller.
   *
   * @param {*} editing Value used by this operation.
   */
  function toggleFlightEdit(editing) {flightEditing = editing; flight();}

  /**
   * Updates the toggle flight add state for its caller.
   */
  function toggleFlightAdd() {flightAdding = !flightAdding; flight();}

  /**
   * Persists flight to its backing store.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function saveFlight() {
    const name = document.querySelector('.tasting-flight-page [data-flight-name]');
    const date = document.querySelector('.tasting-flight-page [data-flight-date]');
    if (!name?.reportValidity() || !date?.reportValidity()) return;
    const notes = document.querySelector('.tasting-flight-page [data-flight-notes]')?.value || '';
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
   * Updates flight members in the current state.
   *
   * @param {*} ids Identifiers in their current order.
   * @return {!Promise<*>} Promise for the asynchronous operation.
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
   * Derives the reorder flight member result from the supplied values.
   *
   * @param {*} sourceId Value used by this operation.
   * @param {*} targetId Value used by this operation.
   * @param {*} after Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
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
   * @return {!Promise<*>} Promise for the asynchronous operation.
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
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  function attachFlightMember() {
    const id = document.querySelector('[data-flight-tasting-option]')?.value;
    const current = (state.collection?.tastingFlights || []).find(x => x.id === state.selected);
    if (id && current) return updateFlightMembers([...current.tastingIds, id]);
  }

  /**
   * Filters records according to the detach flight member selection rules.
   *
   * @param {*} id Identifier of the affected record.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  function detachFlightMember(id) {
    const current = (state.collection?.tastingFlights || []).find(x => x.id === state.selected);
    if (current?.tastingIds.includes(id)) return updateFlightMembers(current.tastingIds.filter(x => x !== id));
  }

  /**
   * Removes or resets flight.
   * @return {!Promise<*>} Promise for the asynchronous operation.
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

  /**
   * Orders the home records using the configured comparison.
   */
  function home() {
    // Returning to an index ends any prior edit session. Reopening is always
    // read-only.
    flavorSession = null;
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
          length: owned.length ? '' : 'disabled',
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
    flavorSession = null;
    const bottling = subject();
    if (!bottling) {navigate('tastings-home', null, {replace: true}); return;}
    const tastings = sortedTastings(bottling);
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

  /**
   * Transforms the entries used by editor.
   */
  function editor() {
    // Returning from a tasting should show the compact flight list, not the
    // expanded add form.
    if (state.flightId) flightAdding = false;
    const external = isExternal();
    const record = external ? standalone().find(x => x.id === state.selected) : null;
    const bottling = external ? (record?.bottling || emptyBottling()) : subject();
    const draft = external ? state.selected === 'new' : state.tastingId === 'new';
    const existing = external ? record : (draft ? null : (bottling?.tastings || []).find(x => x.id === state.tastingId));
    if (!external && !bottling) {
      navigate('tastings-home', null, {replace: true}); return;
    }
    if (!draft && !existing) {
      navigate(external ? 'tastings-home' : 'tastings', external ? null : bottling.id, {replace: true}); return;
    }
    const value = existing || emptyRecord();
    const flightBack = state.flightId &&
      (state.collection?.tastingFlights || []).some(f => f.id === state.flightId && (draft || f.tastingIds.includes(existing?.id)));
    const backAction = flightBack ? 'tasting-back-flight' : (external ? 'tastings-back-home' : 'tastings-back-list');
    const backLabel = flightBack ? 'tastingFlights.backToFlight' : (external ? 'tastings.backHome' : 'tastings.backList');
    const id = existing?.id || 'new';
    if (!flavorSession || flavorSession.id !== id || flavorSession.bottlingId !== (bottling.id || id) ||
      flavorSession.external !== external) {
      flavorSession = {
        id,
        bottlingId: bottling.id || id,
        draft,
        external,
        editing: draft,
        history: createTastingHistory(value),
      };
      flavorSaveQueue = Promise.resolve();
    }
    if (!draft && !flavorSession.editing) {
      shell(renderTemplate('analyticsPage5', {
        backLink: backLink(backAction, backLabel),
        pageTitle: pageTitle(t('tastings.editorViewTitle'), t('tastings.editorViewIntro')),
        bottlingInfo: bottlingInfo(bottling, external, false),
        flightHint: flightHint(existing),
        sectionHeader: sectionHeader({title: t('tastings.editorSection')}),
        tastingReadOnly: tastingReadOnly(value),
      }));
      return;
    }
    shell(renderTemplate('analyticsPage6', {
      backLink: backLink(backAction, backLabel),
      pageTitle: pageTitle(
        draft ? t('tastings.editorCreateTitle') : t('tastings.editorEditTitle'),
        draft ? t('tastings.editorCreateIntro') : t('tastings.editorEditIntro')
      ),
      id: bottling?.id || record?.id || 'new',
      title: t('flavor.title'),
      bottlingInfo: bottlingInfo(bottling, external, draft),
      existing: existing ? flightHint(existing) : (flightBack ? renderTemplate('tastingFlightContext', {newInFlight: t('tastingFlights.newInFlight'), }) : ''),
      sectionHeader: sectionHeader({
        title: t('tastings.editorSection'),
        className: 'tasting-editor-section-head',
      }),
      date: t('tastings.date'),
      tastedOn: value.tastedOn,
      nameOptional: t('tastings.nameOptional'),
      title2: value.title || '',
      titlePlaceholder: t('tastings.titlePlaceholder'),
      undo: t('flavor.undo'),
      undo2: t('flavor.undo'),
      canUndo: flavorSession.history.canUndo ? '' : 'disabled',
      redo: t('flavor.redo'),
      redo2: t('flavor.redo'),
      canRedo: flavorSession.history.canRedo ? '' : 'disabled',
      draft: draft ? '' :
        renderTemplate('tastingEditDone', {
          done: t('tastings.done'),
          id: value.id,
          delete: t('common.actions.delete'),
        }),
      sectionHeader2: sectionHeader({
        title: t('tasting.colorHeading'),
        layout: 'tasting-panel-heading',
        actionsBare: true,
        actions:
          renderTemplate('tastingColorClear', {
            whiskyColor: flavorSession.history.value.whiskyColor ? '' : 'disabled',
            colorClear: t('tasting.colorClear'),
          }),
      }),
      whiskyColorSelector: whiskyColorSelector(flavorSession.history.value.whiskyColor),
      sectionHeader3: sectionHeader({
        title: t('flavor.title'),
        layout: 'tasting-panel-heading',
        actionsBare: true,
        actions:
          renderTemplate('tastingFlavorClear', {
            flavorProfile: flavorSession.history.value.flavorProfile ? '' : 'disabled',
            clearRadar: t('tastings.clearRadar'),
          }),
      }),
      hidden: flavorSession.history.value.flavorProfile ? 'hidden' : '',
      notRecorded: t('flavor.notRecorded'),
      flavorChart: flavorChart(flavorSession.history.value.flavorProfile, {editable: true}),
      headingTitle: headingTitle({title: t('tasting.notes'), }),
      content: composeMarkup(['nose', 'palate', 'finish'].map(key => renderTemplate('editorLabel', {
        t: t(`forms.bottling.${key}`),
        key: key,
        tastingNotes: flavorSession.history.value.tastingNotes[key],
      }))),
      sectionHeader4: sectionHeader({
        title: t('tasting.overallRating'),
        layout: 'tasting-panel-heading',
        actionsBare: true,
        actions:
          renderTemplate('tastingRatingClear', {
            disabled: flavorSession.history.value.rating == null ? 'disabled' : '',
            clearRating: t('tasting.clearRating'),
          }),
      }),
      glencairnRating: glencairnRating(flavorSession.history.value.rating),
      ratingComment: t('tasting.ratingComment'),
      ratingComment2: flavorSession.history.value.ratingComment,
      actions: draft ? renderTemplate('actions2', {
        tastingCreateButton: actionButton({
          label: t('tastings.save'),
          action: 'tasting-create',
          variant: 'primary',
        }),
      }) : '',
    }));
  }

  /**
   * Converts date information for the local today operation.
   * @return {string} Resulting text.
   */
  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Updates draft for tastings.
   *
   * @return {!Promise<*>} Promise fulfilled when the operation completes.
   */
  async function saveDraft() {
    // A save can outlive the click that started it. While the POST and its
    // collection refresh are pending, another Back click would render the
    // old list and a late save completion could navigate away unexpectedly.
    if (draftSavePending) return draftSavePending;
    const session = flavorSession;
    if (!session?.draft) return;
    if (!commitTasting()) return;
    const node = flavorNode();
    const tastedOn = node?.querySelector('[data-tasting-date]')?.value;
    const title = node?.querySelector('[data-tasting-title]')?.value || '';
    if (!node?.querySelector('[data-tasting-date]')?.checkValidity()) {
      node?.querySelector('[data-tasting-date]')?.reportValidity(); return;
    }
    let externalBottling;
    try {
      externalBottling = session.external ? readExternalFields(node) : null;
    } catch (error) {toast(error.message, true); return;}
    if (session.external && !externalBottling) return;
    // Disable the draft's Back and Save controls (plus editable controls)
    // until both the request and data refresh have finished. The button
    // state is restored on errors, so the draft remains editable.
    const draftPage = node.closest('.tasting-child-page');
    const controls = [...(draftPage?.querySelectorAll('button, input, textarea, select') || [])];
    const enabled = controls.filter(control => !control.disabled);
    for (const control of enabled) control.disabled = true;
    draftPage?.setAttribute('aria-busy', 'true');
    const route = {
      page: state.page,
      selected: state.selected,
      tastingId: state.tastingId,
      flightId: state.flightId,
    };
    const save = (async () => {
      try {
        const flightId = state.flightId;
        const data = {
          ...session.history.value,
          tastedOn,
          title,
          ...(session.external ? {bottling: externalBottling} : flightId ? {bottlingId: session.bottlingId} : {}),
        };
        const response = await request(
          flightId ? `/api/tasting-flights/${encodeURIComponent(flightId)}/tastings` :
            (session.external ? '/api/external-tastings' : `/api/bottlings/${encodeURIComponent(session.bottlingId)}/tastings`),
          {
            method: 'POST', body: JSON.stringify(data),
          }
        );
        const created = flightId ? response.record : response;
        await refresh('collection');
        // If a header navigation occurred meanwhile, never override it.
        if (state.page === route.page && state.selected === route.selected && state.tastingId === route.tastingId && state.flightId === route.flightId) {
          navigate(
            editPage(session.external),
            session.external ? created.id : session.bottlingId,
            {
              tastingId: session.external ? null : created.id,
              flightId,
              replace: true,
            }
          );
        }
      } catch (error) {toast(error.message, true);}
      finally {
        draftPage?.removeAttribute('aria-busy');
        for (const control of enabled) if (control.isConnected) control.disabled = false;
      }
    })();
    draftSavePending = save;
    try {return await save;}
    finally {if (draftSavePending === save) draftSavePending = null;}
  }

  /**
   * Updates meta for tastings.
   */
  async function persistMeta() {
    const session = flavorSession;
    if (!session?.editing || session.draft) return;
    const node = flavorNode();
    const date = node?.querySelector('[data-tasting-date]');
    if (!date?.checkValidity()) {date?.reportValidity(); return;}
    const patch = {
      tastedOn: date.value,
      title: node.querySelector('[data-tasting-title]').value,
    };
    flavorSaveQueue = flavorSaveQueue.then(async () => {
      const updated = await request(
        session.external ?
          `/api/external-tastings/${encodeURIComponent(session.id)}` :
          `/api/bottlings/${encodeURIComponent(session.bottlingId)}/tastings/${encodeURIComponent(session.id)}`,
        {method: 'PATCH', body: JSON.stringify(patch)}
      );
      if (session.external) {
        const item = state.collection?.externalTastings?.find(t => t.id === session.id);
        if (item) Object.assign(item, updated);
      } else {
        const b = state.collection?.bottlings?.find(b => b.id === session.bottlingId);
        const item = b?.tastings?.find(t => t.id === session.id);
        if (item) Object.assign(item, updated);
      }
    }).catch(error => toast(error.message, true));
    await flavorSaveQueue;
  }

  /**
   * Performs the start editing lifecycle action.
   */
  function startEditing() {
    if (!flavorSession || flavorSession.draft) return;
    flavorSession.editing = true;
    editor();
    flavorNode()?.querySelector('[data-tasting-date]')?.focus?.();
  }

  /**
   * Locates the DOM elements used by finish editing.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function finishEditing() {
    if (!flavorSession?.editing || flavorSession.draft) return;
    if (!commitTasting()) return;
    const session = flavorSession;
    await flavorSaveQueue;
    if (session !== flavorSession) return;
    session.editing = false;
    editor();
    flavorNode()?.querySelector('[data-act="tasting-edit-start"]')?.focus?.();
  }

  /**
   * Renders external edit in the current view.
   *
   * @param {*} editing Value used by this operation.
   */
  function showExternalEdit(editing) {
    if (!flavorSession?.external || flavorSession.draft) return;
    const panel = flavorNode()?.querySelector('.tasting-bottling-info');
    const read = panel?.querySelector('[data-external-read]');
    const form = panel?.querySelector('[data-external-edit]');
    if (!read || !form) return;
    read.hidden = editing;
    form.hidden = !editing;
    if (editing) form.querySelector('[data-external-field="name"]')?.focus?.();
  }

  /**
   * Performs the cancel external edit lifecycle action.
   */
  function cancelExternalEdit() {
    const record = standalone().find(item => item.id === flavorSession?.id);
    const panel = flavorNode()?.querySelector('.tasting-bottling-info');
    if (record && panel) {
      for (const key of ['name', 'distillery', 'bottler', 'ageYears', 'abv',
        'releaseYear']) {
        const input = panel.querySelector(`[data-external-field="${key}"]`);
        if (input) input.value = String(record.bottling?.[key] ?? '');
      }
    }
    showExternalEdit(false);
  }

  /**
   * Updates external details for tastings.
   */
  async function persistExternalDetails() {
    const session = flavorSession;
    if (!session?.external || session.draft) return;
    const node = flavorNode();
    const fields = readExternalFields(node);
    if (!fields) return;
    const panel = node?.querySelector('.tasting-bottling-info');
    try {
      await flavorSaveQueue;
      const updated = await request(
        `/api/external-tastings/${encodeURIComponent(session.id)}`,
        {method: 'PATCH', body: JSON.stringify({bottling: fields})}
      );
      const item = state.collection?.externalTastings?.find(t => t.id === session.id);
      if (item) Object.assign(item, updated);
      if (panel?.isConnected) {
        replaceElement(panel, bottlingInfo(updated.bottling, true, false));
      }
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Renders assign dialog for tastings.
   */
  function showAssignDialog() {
    const session = flavorSession;
    if (!session?.external || session.draft) return;
    const owned = [...(state.collection?.bottlings || [])].sort((a, b) => a.name.localeCompare(b.name));
    if (!owned.length) {
      toast(t('tastings.assignNoBottlings'), true);
      return;
    }
    const options = composeMarkup(owned.map(b =>
      renderTemplate('optionsOption', {
        id: b.id,
        name: b.name,
      })));
    showModal(
      t('tastings.assignToCollection'),
      renderTemplate('showAssignDialogP', {
        assignExplanation: t('tastings.assignExplanation'),
        chooseBottling: t('tastings.chooseBottling'),
        options: options,
        closeModalButton: actionButton({
          label: t('common.actions.cancel'),
          action: 'close-modal',
        }),
        tastingExternalAssignConfirmButton: actionButton({
          label: t('tastings.assignToCollection'),
          action: 'tasting-external-assign-confirm',
          variant: 'primary',
        }),
      }),
      false
    );
  }

  /**
   * Locates the DOM elements used by assign external to bottling.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function assignExternalToBottling() {
    const session = flavorSession;
    if (!session?.external || session.draft) return;
    const select = document.querySelector('[data-tasting-assign-target]');
    if (!select?.checkValidity()) {select?.reportValidity(); return;}
    const bottlingId = select.value;
    if (!(state.collection?.bottlings || []).some(b => b.id === bottlingId)) return;
    // A pending notes/rating autosave must finish before the record moves.
    if (!commitTasting()) return;
    await flavorSaveQueue;
    const confirmButton = document.querySelector('[data-act="tasting-external-assign-confirm"]');
    if (confirmButton) confirmButton.disabled = true;
    try {
      const result = await request(
        `/api/external-tastings/${encodeURIComponent(session.id)}/assign`,
        {
          method: 'POST', body: JSON.stringify({bottlingId}),
        }
      );
      closeModal();
      // Refresh while on the overview, so the removed external URL cannot
      // redirect.
      state.page = 'tastings-home';
      await refresh('collection');
      navigate('tasting', result.bottlingId, {tastingId: result.tastingId, replace: true});
    } catch (error) {
      toast(error.message, true);
      if (confirmButton?.isConnected) confirmButton.disabled = false;
    }
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
