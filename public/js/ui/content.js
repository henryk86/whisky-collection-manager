import { escapeHtml } from './dom.js';

const safe = value => escapeHtml(String(value ?? ''));
const classes = (...items) => items.filter(Boolean).join(' ');
const assertVariant = (value, allowed, kind) => {
    if (!allowed.includes(value)) throw new RangeError(`Invalid ${kind} variant`);
};
/** App-owned HTML is passed via `content`/`valueHtml`; untrusted text is escaped.
 * The legacy class stays in place until its specialist view is migrated. */
export function panel({ content = '', title = '', variant = 'standard', tag = 'div', className = '' } = {}) {
    assertVariant(variant, ['standard','analytics','plain'], 'panel');
    assertVariant(tag, ['div','section','article'], 'panel tag');
    const legacy = variant === 'analytics' ? 'analytics-panel' : variant === 'plain' ? '' : 'panel';
    return `<${tag} class="${safe(classes(legacy,className))}" data-ds-panel="${variant}">${title ? `<h3>${safe(title)}</h3>` : ''}${content}</${tag}>`;
}
/** Different tag pairs are deliberate: definition list semantics require dt/dd;
 * note and preview fields must not acquire dl semantics or a new border. */
export function detailField({ label, value = '', valueHtml = false, variant = 'definition',
    className = '', extra = '', labelClass = '', valueClass = '' } = {}) {
    assertVariant(variant, ['definition','fact','readonly','note','preview'], 'detail field');
    const definition = variant === 'definition';
    const labelTag = definition ? 'dt' : 'span';
    const valueTag = definition ? 'dd' : variant === 'readonly' ? 'strong' : variant === 'note' ? 'p' : 'div';
    const valueContent = valueHtml ? String(value) : safe(value);
    return `<div${className ? ` class="${safe(className)}"` : ''} data-ds-detail-field="${variant}">` +
        `<${labelTag}${labelClass ? ` class="${safe(labelClass)}"` : ''}>${safe(label)}</${labelTag}>` +
        `<${valueTag}${valueClass ? ` class="${safe(valueClass)}"` : ''}>${valueContent}</${valueTag}>` +
        `${extra ? `<span class="ds-detail-extra">${safe(extra)}</span>` : ''}</div>`;
}
export function detailGrid(content, { columns = 3, tag = 'div', className = '' } = {}) {
    assertVariant(columns, [2, 3], 'detail grid');
    assertVariant(tag, ['div','dl'], 'detail grid tag');
    return `<${tag}${className ? ` class="${safe(className)}"` : ''} data-ds-detail-grid="${columns}">${content}</${tag}>`;
}
/** Collection's introductory empty state is not the same as a quiet no-data
 * notice inside a card. Call sites select the meaning explicitly. */
export function emptyState({ title = '', description = '', actions = '', variant = 'subtle', className = '' } = {}) {
    assertVariant(variant, ['collection','subtle','inline'], 'empty state');
    if (variant === 'inline') return `<p class="${safe(classes('analytics-empty',className))}" data-ds-empty-state="inline">${safe(description || title)}</p>`;
    if (variant === 'subtle') return `<p class="${safe(classes('hint',className))}" data-ds-empty-state="subtle">${safe(description || title)}</p>`;
    return `<div class="${safe(classes('empty-state',className))}" data-ds-empty-state="collection">` +
        `<strong>${safe(title)}</strong><p>${safe(description)}</p>${actions}</div>`;
}
export function divider({ orientation = 'horizontal', className = '' } = {}) {
    assertVariant(orientation, ['horizontal','vertical'], 'divider');
    return orientation === 'horizontal'
        ? `<hr class="${safe(classes('divider',className))}" data-ds-divider="horizontal">`
        : `<span class="${safe(className)}" data-ds-divider="vertical" aria-hidden="true"></span>`;
}
export function actionToolbar(content, { className = '', variant = 'inline', tag = 'div' } = {}) {
    assertVariant(variant, ['inline','filters','end'], 'action toolbar');
    assertVariant(tag, ['div','nav'], 'action toolbar tag');
    const legacy = variant === 'filters' ? 'toolbar' : 'actions';
    return `<${tag} class="${safe(classes(legacy,className))}" data-ds-action-toolbar="${variant}">${content}</${tag}>`;
}
export function documentItem(content, { className = '' } = {}) {
    return className ? `<li class="${safe(className)}">${content}</li>` : `<li>${content}</li>`;
}
export function documentList(items, { className = '' } = {}) {
    return `<ul class="${safe(classes('document-list',className))}" data-ds-document-list>${items.join('')}</ul>`;
}
