import {t} from '../../i18n/index.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates('import/choice-template.html');


/**
 * One accessible, clickable import option; checkbox and its text stay in the
 * same grid row.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!import('../../ui/render-plan.js').RenderPlan} Import checkbox with its incoming value and existing-value comparison.
 */
export function importChoice({
  field,
  label,
  value,
  currentValue,
  checked = false,
  disabled = false,
  distillery = false,
  distilleryId = null
}) {
  const attribute = distillery ? {name: 'import-distillery', value: distilleryId || null} :
    {'data-import-field': field};
  const existing = currentValue === null || currentValue === undefined || currentValue === ''
    ? '' : renderTemplate('importChoiceCurrent', {
      currentValue: t("imports.preview.currentValue", {value: String(currentValue)}),
    });
  return renderTemplate('importChoice', {
    attribute: attribute,
    checkedAttributes: checked ? {"checked": true} : {},
    disabledAttributes: disabled ? {"disabled": true} : {},
    label: label,
    value: String(value),
    existing: existing,
    importChoiceCurrent: disabled ? renderTemplate('importChoiceCurrent2') : '',
  });
}
