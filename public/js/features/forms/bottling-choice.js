import { t } from '../../i18n/index.js';
import { escapeHtml } from '../../ui/dom.js';

/** Find existing bottlings without changing their data or creating duplicates. */
export function matchingBottlings(collection, value = '') {
    const distilleries = new Map((collection.distilleries || []).map(item => [item.id, item.name]));
    const tokens = String(value).trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
    return (collection.bottlings || []).filter(bottling => {
        const ids = bottling.distilleryIds || (bottling.distilleryId ? [bottling.distilleryId] : []);
        const terms = [bottling.name, bottling.brand, bottling.bottler, ...ids.map(id => distilleries.get(id))]
            .filter(Boolean).join(' ').toLocaleLowerCase('de');
        return tokens.every(token => terms.includes(token));
    }).sort((left, right) => left.name.localeCompare(right.name, 'de', { numeric: true }) || left.id.localeCompare(right.id));
}

export function bottlingChoiceOptions(collection, search = '') {
    const matches = matchingBottlings(collection, search);
    const placeholder = `<option value="">${matches.length ? t("forms.bottling.selectPlaceholder") : t("forms.bottling.noMatchingBottling")}</option>`;
    return placeholder + matches.map(bottling => {
        const quantity = (bottling.bottles || []).length;
        const details = [bottling.bottler, `${quantity} ${quantity === 1 ? t("forms.bottle.title") : t("forms.bottle.plural")}`].filter(Boolean).join(' · ');
        return `<option value="${escapeHtml(bottling.id)}">${escapeHtml(bottling.name)}${details ? ` · ${escapeHtml(details)}` : ''}</option>`;
    }).join('');
}

export function bottlingChoiceDialog(collection) {
    const count = (collection.bottlings || []).length;
    if (!count) return '';
    return `<div class="bottling-choice">
    <p>${t("forms.bottle.existingBottlingHint")}</p>
    <form id="new-bottle-choice-form">
    <label class="form-field full">${t("forms.bottling.searchExisting")}
    <input id="bottling-choice-search" type="search" placeholder="${t("forms.bottling.searchNameDistilleryBottler")}" autocomplete="off">
    </label>
    <label class="form-field full">${t("forms.bottling.select")}
    <select id="bottling-choice-select" name="bottlingId" required>${bottlingChoiceOptions(collection)}</select>
    </label>
    <p class="hint" id="bottling-choice-count" aria-live="polite">${t("forms.bottling.availableCount", {count})}</p>
    <div class="actions"><button class="btn primary" type="submit">${t("forms.bottle.addToBottling")}</button></div>
    </form>
    <div class="bottling-choice-divider"><span>${t("forms.common.or")}</span></div>
    <button type="button" class="btn" data-act="new-bottling-direct">${t("collection.actions.newBottling")}</button>
    </div>`;
}
