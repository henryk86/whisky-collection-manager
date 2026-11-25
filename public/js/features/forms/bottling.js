import {composeMarkup} from '../../ui/render-plan.js';
import {actionButton} from '../../ui/buttons.js';
import {t} from '../../i18n/index.js';
import {addActionLabel} from '../../ui/action-icons.js';
import {escapeHtml} from '../../ui/dom.js';
import {textInput, selectInput, areaInput} from '../../ui/fields.js';
import {bottleStatusLabels, whiskyTypeLabels, photoAccept}
  from '../../domain/labels.js';
import {fileAccept} from '../files.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates('forms/bottling.html');

/**
 * Creates bottling form for bottling.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {Function} Structured result assembled from the input data.
 */
export function createBottlingForm({state, selectors}) {
  const {distilleryIds} = selectors;
  /**
   * Orders the distillery picker records using the configured comparison.
   *
   * @param {*} bottling Bottling record being inspected or updated.
   * @return {string} Resulting text.
   */
  function distilleryPicker(bottling) {
    const selected = new Set(distilleryIds(bottling));
    const options = state.collection.distilleries.slice().sort((a, z) => a.name.localeCompare(z.name, 'de'));
    return renderTemplate('formField', {
      options: composeMarkup(options.map(distillery =>
        renderTemplate('distilleryOption', {
          id: distillery.id,
          checkedAttributes: selected.has(distillery.id) ? {"checked": true} : {},
          name: distillery.name,
          status: distillery.status === 'closed' ? ` · ${t('home.status.closed').toLowerCase()}` : '',
        }))),
    });
  }

  /**
   * Transforms the entries used by bottling form.
   *
   * @param {!Object=} bottling Bottling record being inspected or updated.
   * @return {string} Resulting text.
   */
  function bottlingForm(bottling = {}) {
    return renderTemplate('bottlingForm', {
      id: bottling.id || '',
      nameField: textInput(
        t("forms.bottling.whiskyNameRequired"),
        'name',
        bottling.name,
        {
          required: true,
          full: true,
          placeholder: t('forms.bottling.exampleName'),
        }
      ),
      whiskyTypeField: selectInput(
        t("forms.bottling.whiskyCategory"),
        'whiskyType',
        [
          ['', t('forms.bottling.notProvided')],
          ...Object.entries(whiskyTypeLabels),
        ],
        bottling.whiskyType
      ),
      brandField: textInput(
        t("forms.bottling.brandOrProductLine"),
        'brand',
        bottling.brand,
        {
          placeholder: t('forms.bottling.exampleBrand'),
        }
      ),
      distilleryPicker: distilleryPicker(bottling),
      compositionCompleteField: selectInput(
        t("forms.bottling.blendCompositionComplete"),
        'compositionComplete',
        [
          ['false', t('forms.bottling.compositionUnknown')],
          ['true', t('forms.bottling.compositionKnown')],
        ],
        String(bottling.compositionComplete === true)
      ),
      addDistilleryButton: actionButton({
        trustedContent: addActionLabel(t("forms.common.createButton")),
        action: 'add-distillery',
      }),
      bottlerField: textInput(t("forms.bottling.bottler"), 'bottler', bottling.bottler),
      ageYearsField: textInput(t("forms.bottling.ageYears"), 'ageYears', bottling.ageYears, {type: 'number', }),
      abvField: textInput(t("forms.bottling.abv"), 'abv', bottling.abv, {
        type: 'number', step: '0.01',
      }),
      volumeMlField: textInput(t("forms.bottling.nominalVolume"), 'volumeMl', bottling.volumeMl, {type: 'number', }),
      releaseYearField: textInput(t("forms.bottling.releaseYear"), 'releaseYear', bottling.releaseYear, {type: 'number', }),
      distillationDateField: textInput(t("forms.bottling.distillationDate"), 'distillationDate', bottling.distillationDate, {type: 'date', }),
      distillationYearField: textInput(
        t("forms.bottling.distillationYear"),
        'distillationYear',
        bottling.distillationYear,
        {
          type: 'number',
        }
      ),
      bottlingDateField: textInput(t("forms.bottling.bottlingDate"), 'bottlingDate', bottling.bottlingDate, {type: 'date', }),
      bottlingYearField: textInput(t("forms.bottling.bottlingYear"), 'bottlingYear', bottling.bottlingYear, {type: 'number', }),
      caskTypeField: textInput(t("forms.bottling.caskType"), 'caskType', bottling.caskType),
      caskNumberField: textInput(t("forms.bottling.caskNumber"), 'caskNumber', bottling.caskNumber),
      limitedEditionCountField: textInput(
        t("forms.bottling.limitedBottleCount"),
        'limitedEditionCount',
        bottling.limitedEditionCount,
        {
          type: 'number',
        }
      ),
      whiskybaseUrlField: textInput(
        t("forms.bottling.whiskybaseUrl"),
        'whiskybaseUrl',
        bottling.whiskybaseUrl,
        {
          type: 'url', full: true,
        }
      ),
      whiskybaseIdField: textInput(t("forms.bottling.whiskybaseId"), 'whiskybaseId', bottling.whiskybaseId),
      completionStatusField: selectInput(
        t("forms.bottle.editStatus"),
        'completionStatus',
        [
          ['incomplete', t('detail.status.incomplete')],
          ['complete', t('detail.status.complete')],
        ],
        bottling.completionStatus || 'incomplete'
      ),
      descriptionField: areaInput(t("forms.bottling.comment"), 'description', bottling.description),
      firstInventoryFields: bottling.id ? '' : renderTemplate('divider', {
        firstInventoryNumberField: textInput(
          t("forms.bottle.inventoryNumberOptional"),
          'firstInventoryNumber',
          '',
          {
            placeholder: t('forms.bottle.inventoryPlaceholderShort'),
          }
        ),
        suggestFirstButton: actionButton({
          label: t("forms.bottle.suggestInventoryNumber"),
          action: 'suggest-first',
        }),
        firstVolumeTypeField: selectInput(
          t("forms.bottle.initialType"),
          'firstVolumeType',
          [
            ['standard', t('forms.bottle.normalBottle')],
            ['sample', t('forms.bottle.sampleBottle')],
          ],
          'standard'
        ),
        firstVolumeMlField: textInput(t("forms.bottle.initialSize"), 'firstVolumeMl', '', {type: 'number'}),
        firstStatusField: selectInput(
          t("forms.bottle.status"),
          'firstStatus',
          Object.keys(bottleStatusLabels).map(status => [
            status,
            t(({
              closed: "home.status.closed",
              open: "analytics.inventory.openedStatus",
              empty: "home.status.empty",
            })[status]),
          ]),
          'closed'
        ),
        photoAccept: photoAccept,
        fileAccept: fileAccept,
      }),
      closeModalButton: actionButton({
        label: t("common.actions.cancel"),
        action: 'close-modal',
      }),
    });
  }
  return bottlingForm;
}
