import { t } from '../../i18n/index.js';
import { escapeHtml } from '../../ui/dom.js';

/** One accessible, clickable import option; checkbox and its text stay in the same grid row. */
export function importChoice({ field, label, value, currentValue, checked = false, disabled = false, distillery = false, distilleryId = null }) {
    const attribute = distillery ? `name="import-distillery"${distilleryId ? ` value="${escapeHtml(distilleryId)}"` : ''}` : `data-import-field="${escapeHtml(field)}"`;
    const existing = currentValue === null || currentValue === undefined || currentValue === ''
        ? '' : `<small class="import-choice-current">${t("imports.preview.currentValue", {value: escapeHtml(String(currentValue))})}</small>`;
    return `<label class="import-choice">
    <input type="checkbox" ${attribute}${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}>
    <span class="import-choice-copy">
    <span class="import-choice-label">${escapeHtml(label)}</span>
    <span class="import-choice-value">${escapeHtml(String(value))}</span>
    ${existing}${disabled ? `<small class="import-choice-current">${t("imports.preview.choiceNotFound")}</small>` : ''}
    </span>
    </label>`;
}
