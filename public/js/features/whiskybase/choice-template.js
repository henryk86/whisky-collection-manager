import { t } from '../../i18n/index.js';
import { escapeHtml } from '../../ui/dom.js';

/** One accessible, clickable Whiskybase import option; checkbox and its text stay in the same grid row. */
export function importChoice({ field, label, value, currentValue, checked = false, disabled = false, distillery = false, distilleryId = null }) {
    const attribute = distillery ? `name="wb-distillery"${distilleryId ? ` value="${escapeHtml(distilleryId)}"` : ''}` : `data-wb-field="${escapeHtml(field)}"`;
    const existing = currentValue === null || currentValue === undefined || currentValue === ''
        ? '' : `<small class="wb-choice-current">Aktuell: ${escapeHtml(String(currentValue))}</small>`;
    return `<label class="wb-choice">
    <input type="checkbox" ${attribute}${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}>
    <span class="wb-choice-copy">
    <span class="wb-choice-label">${escapeHtml(label)}</span>
    <span class="wb-choice-value">${escapeHtml(String(value))}</span>
    ${existing}${disabled ? `<small class="wb-choice-current">${t("whiskybase.import.choiceNotFound")}</small>` : ''}
    </span>
    </label>`;
}
