import {composeMarkup} from '../../ui/render-plan.js';
import {actionButton} from '../../ui/buttons.js';
import {t} from '../../i18n/index.js';
import {escapeHtml} from '../../ui/dom.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates('forms/bottling-choice.html');


/**
 * Find existing bottlings without changing their data or creating duplicates.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {string=} value Input value to process.
 * @return {*} Entries that meet the selection criteria.
 */
export function matchingBottlings(collection, value = '') {
  const distilleries = new Map((collection.distilleries || []).map(item => [item.id, item.name]));
  const tokens = String(value).trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
  return (collection.bottlings || []).filter(bottling => {
    const ids = bottling.distilleryIds || (bottling.distilleryId ? [bottling.distilleryId] : []);
    const terms = [
      bottling.name,
      bottling.brand,
      bottling.bottler,
      ...ids.map(id => distilleries.get(id)),
    ]
      .filter(Boolean).join(' ').toLocaleLowerCase('de');
    return tokens.every(token => terms.includes(token));
  }).sort((left, right) => left.name.localeCompare(right.name, 'de', {numeric: true}) || left.id.localeCompare(right.id));
}

/**
 * Builds selectable bottling choices from the current collection.
 *
 * @param {!Object} collection Collection data being processed.
 * @param {string=} search Search used by this operation.
 * @return {import('../../ui/render-plan.js').RenderPlan|string} Filtered bottling options with a placeholder reflecting whether matches exist (or scalar/empty text when no plan is needed).
 */
export function bottlingChoiceOptions(collection, search = '') {
  const matches = matchingBottlings(collection, search);
  const placeholder = renderTemplate('placeholderOption', {
    length: matches.length ? t("forms.bottling.selectPlaceholder") : t("forms.bottling.noMatchingBottling"),
  });
  return composeMarkup(placeholder, composeMarkup(matches.map(bottling => {
    const quantity = (bottling.bottles || []).length;
    const details = [bottling.bottler, `${quantity} ${quantity === 1 ? t("forms.bottle.title") : t("forms.bottle.plural")}`,].filter(Boolean).join(' · ');
    return renderTemplate('bottlingChoiceOptionsOption', {
      id: bottling.id,
      name: bottling.name,
      details: details ? ` · ${escapeHtml(details)}` : '',
    });
  })));
}

/**
 * Prepares existing-bottling selection dialog.
 *
 * @param {!Object} collection Collection data being processed.
 * @return {import('../../ui/render-plan.js').RenderPlan|string} Existing-bottling selection dialog (or scalar/empty text when no plan is needed).
 */
export function bottlingChoiceDialog(collection) {
  const count = (collection.bottlings || []).length;
  if (!count) return '';
  return renderTemplate('bottlingChoice', {
    bottlingChoiceOptions: bottlingChoiceOptions(collection),
    availableCount: t("forms.bottling.availableCount", {count}),
    newBottlingDirectButton: actionButton({
      label: t("collection.actions.newBottling"),
      action: 'new-bottling-direct',
    }),
  });
}
