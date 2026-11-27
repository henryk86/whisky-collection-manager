import {bottlingName} from '../../../../shared/bottling-name.js';
import {composeMarkup} from '../../ui/render-plan.js';
import {actionButton} from '../../ui/buttons.js';
import {t} from '../../i18n/index.js';
import {inventoryScanIcon} from '../../ui/action-icons.js';
import {textInput, selectInput, areaInput} from '../../ui/fields.js';
import {bottleStatusLabels, whiskyTypeName, photoAccept}
  from '../../domain/labels.js';
import {fileAccept} from '../files.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates('forms/bottle.html');

/**
 * Creates a bottle-form builder bound to the collection state and selectors.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {Function} Function that renders the physical-bottle editor for a selected parent bottling.
 */
export function createBottleForm({state, selectors}) {
  const {distilleryNames} = selectors;
  /**
   * Prepares bottle editor for an existing parent bottling, with inventory, purchase and photo controls.
   *
   * @param {!Object=} bottle Physical bottle record under consideration.
   * @param {string=} bottlingId Identifier of the parent bottling; omitted when the caller has no owner.
   * @param {!Object=} options3 Opening context and reference photo option.
   * @return {!import('../../ui/render-plan.js').RenderPlan} Bottle editor for an existing parent bottling, with inventory, purchase and photo controls.
   */
  function bottleForm(bottle = {}, bottlingId = undefined,
    {fromOverview = false, importPhoto = false} = {}) {
    const owner = state.collection.bottlings.find(entry => entry.id === bottlingId);
    if (!owner) {
      throw Error(t('features.errors.parentBottlingNotFound'));
    }
    const facts = [
      [t('analytics.filters.distillery'), distilleryNames(owner)],
      [t('forms.bottling.whiskyCategory'), whiskyTypeName(owner)],
      [t('forms.bottling.bottler'), owner.bottler],
      [
        t('forms.bottling.ageYears'),
        owner.ageYears == null ? '' : t('home.facts.years', {count: owner.ageYears}),
      ],
      [t('forms.bottling.abv'), owner.abv == null ? '' : `${owner.abv} % Vol.`],
      [
        t('forms.bottling.nominalVolume'),
        owner.volumeMl == null ? '' : `${owner.volumeMl} ml`,
      ],
    ].filter(([, value]) => value && value !== 'Nicht angegeben');
    const context = renderTemplate('bottlingContext', {
      name: bottlingName(owner),
      facts: composeMarkup(facts.map(([label, value]) => renderTemplate(
        'contextDiv',
        {
          label: label,
          value: value,
        }
      ))),
    });
    return renderTemplate('bottleForm', {
      dataFromOverviewAttributes: fromOverview ? {"data-from-overview": "1"} : {},
      photoOption: importPhoto ? renderTemplate('importPhoto') : '',
      id: bottle.id || '',
      bottlingId: bottlingId,
      context: context,
      inventoryNumberField: textInput(
        t("forms.bottle.inventoryNumber"),
        'inventoryNumber',
        bottle.inventoryNumber,
        {
          placeholder: t('forms.bottle.inventoryPlaceholder'),
        }
      ),
      suggestBottleButton: actionButton({
        label: t("forms.bottle.suggestInventoryNumber"),
        action: 'suggest-bottle',
      }),
      volumeTypeField: selectInput(
        t("forms.bottle.type"),
        'volumeType',
        [
          ['standard', t('forms.bottle.normalBottle')],
          ['sample', t('forms.bottle.sampleBottle')],
        ],
        bottle.volumeType || 'standard'
      ),
      volumeMlField: textInput(
        t("forms.bottle.size"),
        'volumeMl',
        bottle.volumeMl,
        {
          type: 'number',
          placeholder: owner.volumeMl == null ? t("forms.bottle.sizeExample") :
            t("forms.bottle.ownerVolumePlaceholder", {volume: owner.volumeMl}),
        }
      ),
      statusField: selectInput(
        t("forms.bottle.statusLabel"),
        'status',
        Object.keys(bottleStatusLabels).map(status => [
          status,
          t(({
            closed: "home.status.closed",
            open: "analytics.inventory.openedStatus",
            empty: "home.status.empty",
          })[status]),
        ]),
        bottle.status || 'closed'
      ),
      purchaseDateField: textInput(t("forms.bottle.purchaseDate"), 'purchaseDate', bottle.purchaseDate, {type: 'date', }),
      purchasePriceField: textInput(
        t("forms.bottle.purchasePrice"),
        'purchasePrice',
        bottle.purchasePrice,
        {
          type: 'number', step: '0.01',
        }
      ),
      currencyField: textInput(t("forms.bottle.currency"), 'currency', bottle.currency || 'EUR'),
      merchantField: textInput(t("forms.bottle.seller"), 'merchant', bottle.merchant),
      openedAtField: textInput(t("forms.bottle.openingDate"), 'openedAt', bottle.openedAt, {type: 'date', }),
      emptiedAtField: textInput(t("forms.bottle.emptyDate"), 'emptiedAt', bottle.emptiedAt, {type: 'date', }),
      commentField: areaInput(t("forms.bottle.personalComment"), 'comment', bottle.comment),
      photoAccept: photoAccept,
      fileAccept: fileAccept,
      inventoryScanIcon: inventoryScanIcon,
      closeModalButton: actionButton({
        label: t("common.actions.cancel"),
        action: 'close-modal',
      }),
    });
  }
  return bottleForm;
}
