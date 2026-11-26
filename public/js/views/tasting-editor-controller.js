import {readExternalFields} from './tasting-presentation.js';
import {composeMarkup} from '../ui/render-plan.js';
import {replaceElement} from '../ui/dom-renderer.js';
import {actionButton} from '../ui/buttons.js';
import {sectionHeader, headingTitle} from '../ui/headers.js';
import {t} from '../i18n/index.js';
import {panel} from '../ui/content.js';
import {request} from '../api.js';
import {toast} from '../ui/notifications.js';
import {flavorChart, readFlavorProfile, displayFlavorProfile}
  from '../ui/flavor-profile.js';
import {createTastingHistory} from '../domain/tasting-history.js';
import {glencairnRating, syncGlencairnRating} from '../ui/glencairn-rating.js';
import {whiskyColorSelector, whiskyCustomColorName} from '../ui/whisky-color-selector.js';
import {
  isAllowedWhiskyHex, normalizeWhiskyColor, whiskyPickerHex,
  whiskyPickerPosition
} from '../../../shared/whisky-colors.js';
import {parseTastingScore} from '../../../shared/tasting.js';
import {allStandaloneTastings} from '../../../shared/standalone-tastings.js';
import {loadTemplates} from '../ui/templates.js';
import {createTastingEditorViewModel} from './models/tastings.js';

const renderTemplate = await loadTemplates('tastings/tastings.html');

/**
 * Owns tasting editor state, history, draft creation and persisted edits.
 * @param {!Object} options Collection state and editor dependencies.
 * @return {!Object} Editor lifecycle and input actions.
 */
export function createTastingEditorController({state, shell, navigate, refresh, showModal, closeModal, presentation, closeAddChooser}) {
  const {backLink, pageTitle, bottlingInfo, flightHint, tastingReadOnly} = presentation;
  let flavorSession = null;

  /**
   * Checks whether external applies.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  const isExternal = () => state.page === 'external-tasting';

  /**
   * Checks whether the editor is working with a standalone tasting.
   * @return {*} Result computed from the supplied inputs.
   */
  const standalone = () => allStandaloneTastings(state.collection || {});

  /**
   * Resolves the current editor's tasting subject.
   * @return {*} Result computed from the supplied inputs.
   */
  const subject = () => state.collection?.bottlings?.find(b => b.id === state.selected);

  /**
   * Selects the tasting editor page appropriate to the subject.
   *
   * @param {boolean=} external Whether the tasting is external rather than attached to an owned bottling.
   * @return {*} Result computed from the supplied inputs.
   */
  const editPage = (external = isExternal()) => external ? 'external-tasting' : 'tasting';

  let flavorSaveQueue = Promise.resolve();

  let draftSavePending = null;

  /**
   * Finds the flavor editor section in the current tasting form.
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
 * @param {*} hex Custom whisky color to preview in the editor.
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
 * @param {*} raw Untrusted custom color input to normalize and validate before selecting.
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
   * Moves the flavor editing history to the adjacent available snapshot.
   *
   * @param {*} direction Direction used for traversal or movement.
   */
  function stepFlavor(direction) {
    if (!flavorSession?.editing) return;
    const changed = direction < 0 ? flavorSession.history.undo() : flavorSession.history.redo();
    if (changed) {redrawTasting(); void persistTasting();}
  }

  /**
   * Transforms the entries used by editor.
   */
  function editor() {
    // Returning from a tasting should show the compact flight list, not the
    // expanded add form.
    if (state.flightId) closeAddChooser();
    const {external, record, bottling, draft, existing, value, flightBack, backAction, backLabel, redirect} = createTastingEditorViewModel(state);
    if (redirect) {
      navigate(redirect.page, redirect.selected, {replace: true}); return;
    }
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
      value: value.title || '',
      titlePlaceholder: t('tastings.titlePlaceholder'),
      undo: t('flavor.undo'),
      ariaLabel: t('flavor.undo'),
      disabledAttributes: flavorSession.history.canUndo ? {} : {"disabled": true},
      redo: t('flavor.redo'),
      redoLabel: t('flavor.redo'),
      canRedo: flavorSession.history.canRedo ? {} : {"disabled": true},
      draft: draft ? '' :
        renderTemplate('tastingEditDone', {
          done: t('tastings.done'),
          id: value.id,
          delete: t('common.actions.delete'),
        }),
      colorHeading: sectionHeader({
        title: t('tasting.colorHeading'),
        layout: 'tasting-panel-heading',
        actionsBare: true,
        actions:
          renderTemplate('tastingColorClear', {
            disabledAttributes: flavorSession.history.value.whiskyColor ? {} : {"disabled": true},
            colorClear: t('tasting.colorClear'),
          }),
      }),
      whiskyColorSelector: whiskyColorSelector(flavorSession.history.value.whiskyColor),
      flavorHeading: sectionHeader({
        title: t('flavor.title'),
        layout: 'tasting-panel-heading',
        actionsBare: true,
        actions:
          renderTemplate('tastingFlavorClear', {
            disabledAttributes: flavorSession.history.value.flavorProfile ? {} : {"disabled": true},
            clearRadar: t('tastings.clearRadar'),
          }),
      }),
      hiddenAttributes: flavorSession.history.value.flavorProfile ? {"hidden": true} : {},
      notRecorded: t('flavor.notRecorded'),
      flavorChart: flavorChart(flavorSession.history.value.flavorProfile, {editable: true}),
      headingTitle: headingTitle({title: t('tasting.notes'), }),
      content: composeMarkup(['nose', 'palate', 'finish'].map(key => renderTemplate('editorLabel', {
        t: t(`forms.bottling.${key}`),
        key: key,
        tastingNotes: flavorSession.history.value.tastingNotes[key],
      }))),
      ratingHeading: sectionHeader({
        title: t('tasting.overallRating'),
        layout: 'tasting-panel-heading',
        actionsBare: true,
        actions:
          renderTemplate('tastingRatingClear', {
            disabledAttributes: flavorSession.history.value.rating == null ? {"disabled": true} : {},
            clearRating: t('tasting.clearRating'),
          }),
      }),
      glencairnRating: glencairnRating(flavorSession.history.value.rating),
      ratingComment: t('tasting.ratingComment'),
      ratingCommentValue: flavorSession.history.value.ratingComment,
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
   * @param {boolean} editing Whether the external tasting fields should be editable.
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

  /** Discards the local edit session when navigating to an index or flight. */
  function resetEditor() {flavorSession = null;}
  return {editor, saveDraft, persistMeta, commitTasting, chooseRating, previewRating, chooseColor, chooseCustomHex, commitCustomPreview, previewCustomColor, previewCustomFromPointer, nudgeCustomColor, resetCustomPreview, clearFlavor, showAssignDialog, assignExternalToBottling, startEditing, finishEditing, showExternalEdit, cancelExternalEdit, persistExternalDetails, stepFlavor, subject, resetEditor};
}
