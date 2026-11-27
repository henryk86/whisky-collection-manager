import {composeMarkup} from '../ui/render-plan.js';
import {actionButton} from '../ui/buttons.js';
import {headingTitle, pageHeader, backNavigation} from '../ui/headers.js';
import {t} from '../i18n/index.js';
import {detailField, detailGrid, actionToolbar} from '../ui/content.js';
import {formatDate, imageUrl} from '../ui/format.js';
import {flavorChart} from '../ui/flavor-profile.js';
import {glencairnRatingSymbol} from '../ui/glencairn-icon.js';
import {whiskyColorDisplay} from '../ui/whisky-color-selector.js';
import {flightForTasting} from '../../../shared/tasting-flights.js';
import {editIcon, chevronRightIcon} from '../ui/action-icons.js';

import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('tastings/tastings.html');

/**
 * Creates presentation functions for tasting records and bottling summaries.
 * @param {!Object} options Current collection state and photo selectors.
 * @return {!Object} Tasting presentation functions.
 */
export function createTastingPresentation({state, selectors}) {
  /**
   * Selects and transforms the distillery meta records.
   *
   * @param {*} bottling Bottling record being inspected or updated.
   * @param {boolean=} owned Whether the distillery metadata belongs to an owned bottling.
   * @return {string} Available distillery, age and other release metadata joined for display.
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
   * Prepares back navigation control with a localized label.
   *
   * @param {*} action Operation or action callback to invoke.
   * @param {*} label Label shown to the user.
   * @return {!import('../ui/render-plan.js').RenderPlan} Back navigation control with a localized label.
   */
  const backLink = (action, label) => backNavigation(action, t(label));

  /**
   * Prepares tasting page heading with optional introduction and eyebrow.
   *
   * @param {*} title Title displayed or stored by this operation.
   * @param {*} intro Introductory content shown beneath the page title.
   * @param {*=} eyebrow Optional eyebrow content above the heading.
   * @return {!import('../ui/render-plan.js').RenderPlan} Tasting page heading with optional introduction and eyebrow.
   */
  const pageTitle = (title, intro, eyebrow = t('tastings.childEyebrow')) =>
    pageHeader({title, intro, eyebrow, className: 'analytics-page-heading'});
  // Show exactly the same Abfuellungsfoto (cover image) as the bottling detail
  // page.

  /**
   * Prepares owned or external bottling summary with photo when available.
   *
   * @param {*} bottling Bottling record being inspected or updated.
   * @param {boolean=} external Whether the subject is an external bottling.
   * @param {boolean=} draft Whether the subject is still an unsaved draft.
   * @return {!import('../ui/render-plan.js').RenderPlan} Owned or external bottling summary with photo when available.
   */
  const bottlingInfo = (bottling, external = false, draft = false) => {
    const photo = external ? '' : (selectors?.coverPhoto?.(bottling.id) || '');
    return renderTemplate('analyticsPanel', {
      external: external ? renderTemplate('bottlingInfo', {
        draft: draft ? '' :
          renderTemplate('tastingBottlingSummary', {
            name: bottling.fullName ?? bottling.name,
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
        hiddenAttributes: draft ? {} : {"hidden": true},
        externalFields: externalFields(bottling),
        existingRecordActions: draft ? '' :
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
            bottleAlt: t('home.image.bottleAlt', {name: bottling.fullName ?? bottling.name}),
          }) : '',
          name: bottling.fullName ?? bottling.name,
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
   * Looks up the flight associated with the tasting, if any.
   *
   * @param {*} record Record to validate or persist.
   * @return {*} Flight associated with the tasting, or null when no association exists.
   */
  const associatedFlight = record => record?.id ? flightForTasting(state.collection, record.id) : null;

  /**
   * Prepares navigation hint identifying the tasting's flight and member position.
   *
   * @param {*} record Record to validate or persist.
   * @return {import('../ui/render-plan.js').RenderPlan|string} Navigation hint identifying the tasting's flight and member position (or scalar/empty text when no plan is needed).
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
   * Formats a tasting score out of 100 or the localized unrated label.
   *
   * @param {*} record Record to validate or persist.
   * @return {string} Localized unrated label or formatted rating followed by the 100-point scale.
   */
  const tastingRating = record => record.rating == null ? t('tasting.unrated') : `${String(record.rating)} / 100`;

  /**
   * Prepares displayed scalar value or muted missing-value indicator.
   *
   * @param {*} value Value to process.
   * @return {import('../ui/render-plan.js').RenderPlan|string} Displayed scalar value or muted missing-value indicator (or scalar/empty text when no plan is needed).
   */
  const blank = value => value == null || String(value).trim() === '' ? renderTemplate('muted3') : String(value);

  /**
   * Prepares read-only rating glasses and score display.
   *
   * @param {*} record Record to validate or persist.
   * @return {!import('../ui/render-plan.js').RenderPlan} Read-only rating glasses and score display.
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
   * Prepares read-only tasting metadata, notes, color and flavor details.
   *
   * @param {*} value Value to process.
   * @return {!import('../ui/render-plan.js').RenderPlan} Read-only tasting metadata, notes, color and flavor details.
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
      flavorHeading: headingTitle({title: t('flavor.title')}),
      flavorChart: flavorChart(value.flavorProfile, {editable: false}),
      notesHeading: headingTitle({title: t('tasting.notes'), }),
      notesGrid: detailGrid(
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
      ratingHeading: headingTitle({title: t('tasting.overallRating'), }),
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
   * Prepares compact rating glasses for a valid tasting score.
   *
   * @param {*} record Record to validate or persist.
   * @return {import('../ui/render-plan.js').RenderPlan|string} Compact rating glasses for a valid tasting score (or scalar/empty text when no plan is needed).
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
   * Prepares tasting list row with its navigation action and summary.
   *
   * @param {!Object} options Options controlling the operation.
   * @return {!import('../ui/render-plan.js').RenderPlan} Tasting list row with its navigation action and summary.
   */
  const tastingRow = ({record, b, external = false, home = false}) =>
    renderTemplate('warehouseBottleRow', {
      home: home ? 'tasting-home-row' : 'tasting-list-row',
      act: home ? 'tastings-home-open' : 'tastings-open',
      dataExternalAttributes: home ? {"data-external": external ? '1' : '0', "data-bottling-id": external ? record.id : b.id} : {},
      id: record.id,
      content: `${t('tastings.open')}: ${home ? (b.fullName ?? b.name) : (record.title || formatDate(record.tastedOn))}`,
      entryTitle: home ? (b.fullName ?? b.name) : (record.title || formatDate(record.tastedOn)),
      entryDate: home ? formatDate(record.tastedOn) : (record.title ? formatDate(record.tastedOn) : ''),
      entrySubtitle: home && record.title ? ` · ${String(record.title ?? '')}` : '',
      tastingListGlasses: tastingListGlasses(record),
      tastingRating: tastingRating(record),
      chevronRightIcon: chevronRightIcon,
      deleteAction: home ? '' :
        renderTemplate('tastingDelete', {
          id: record.id,
          delete: t('common.actions.delete'),
        }),
    });

  return {distilleryMeta, backLink, pageTitle, bottlingInfo, associatedFlight, flightHint, tastingRating, blank, staticRating, tastingReadOnly, tastingListGlasses, tastingRow};
}

/**
 * Prepares fields for an external whisky's release metadata.
 *
 * @param {!Object=} info External bottling metadata used to initialize the editor fields.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Fields for an external whisky's release metadata (or scalar/empty text when no plan is needed).
 */
export function externalFields(info = {}) {
  /** @type {Array<[string, string, "text"|"number", number|null, boolean]>} */
  const fields = [
    ['name', 'tastings.externalName', 'text', 180, true],
    ['subtitle', 'forms.bottling.subtitle', 'text', 180, false],
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
      name: key,
      type: type,
      maxlengthAttributes: max ? {"maxlength": max} : {},
      requiredAttributes: required ? {"required": true} : {},
      numberAttributes: type === 'number' ? (key === 'abv' ? {"min": "0", "max": "100", "step": "0.1"} : key === 'ageYears' ? {"min": "0", "max": "200", "step": "1"} : {"min": "1800", "max": "2200", "step": "1"}) : {},
      info: String(info[key] ?? ''),
    })));
}

/**
 * Validates and collects external-bottling form fields, converting numeric fields.
 *
 * @param {*} node Node to inspect or update.
 * @return {*} External-bottling values, or null when validation fails.
 */
export function readExternalFields(node) {
  const data = {};
  for (const key of ['name', 'subtitle', 'distillery', 'bottler', 'ageYears', 'abv',
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
