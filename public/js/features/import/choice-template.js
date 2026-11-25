import {t} from '../../i18n/index.js';
import {escapeHtml} from '../../ui/dom.js';
import {loadTemplates} from '../../ui/templates.js';

const renderTemplate = await loadTemplates(new URL('./templates/choice-template.html', import.meta.url));


/**
 * One accessible, clickable import option; checkbox and its text stay in the
 * same grid row.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {string} Resulting text.
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
  const attribute = distillery ? `name="import-distillery"${distilleryId ? ` value="${escapeHtml(distilleryId)}"` : ''}` :
    `data-import-field="${escapeHtml(field)}"`;
  const existing = currentValue === null || currentValue === undefined || currentValue === ''
    ? '' : renderTemplate('importChoiceCurrent', {
      currentValue: t("imports.preview.currentValue", {value: escapeHtml(String(currentValue))}),
    });
  return renderTemplate('importChoice', {
    attribute: attribute,
    checked: checked ? ' checked' : '',
    disabled: disabled ? ' disabled' : '',
    label: label,
    value: String(value),
    existing: existing,
    importChoiceCurrent: disabled ? renderTemplate('importChoiceCurrent2') : '',
  });
}
