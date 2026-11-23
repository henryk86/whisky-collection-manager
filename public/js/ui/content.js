import {escapeHtml} from './dom.js';

const safe = value => escapeHtml(String(value ?? ''));
const classes = (...items) => items.filter(Boolean).join(' ');
const assertVariant = (value, allowed, kind) => {
  if (!allowed.includes(value)) throw new RangeError(`Invalid ${kind} variant`);
};
/**
 * Renders a visual surface without adding nested panel wrappers.
 * @param {!Object=} options Panel content and style variant.
 * @param {string=} options.content Trusted application-rendered HTML.
 * @param {string=} options.variant Standard, analytics or plain.
 * @param {string=} options.tag Div, section or article semantic element.
 * @return {string} Panel markup.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function panel({content = '', variant = 'standard', tag = 'div', className = ''} = {}) {
  assertVariant(variant, ['standard', 'analytics', 'plain'], 'panel');
  assertVariant(tag, ['div', 'section', 'article'], 'panel tag');
  const baseClass = variant === 'analytics' ? 'analytics-panel' : variant === 'plain' ? '' : 'panel';
  return `<${tag} class="${safe(classes(baseClass, className))}" data-ds-panel="${variant}">${content}</${tag}>`;
}
/**
 * Renders a labeled value using the correct semantic element pair.
 * @param {!Object=} options Field content and presentation variant.
 * @param {string} options.label Escaped field caption.
 * @param {*=} options.value Field value (escaped unless valueHtml).
 * @param {boolean=} options.valueHtml Set only for trusted UI-generated markup.
 * @param {string=} options.variant Definition, fact, readonly, note or preview.
 * @return {string} Detail-field HTML.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function detailField({label, value = '', valueHtml = false, variant = 'definition',
  className = '', labelClass = '', valueClass = ''} = {}) {
  assertVariant(variant, ['definition', 'fact', 'readonly', 'note', 'preview'], 'detail field');
  const definition = variant === 'definition';
  const labelTag = definition ? 'dt' : 'span';
  const valueTag = definition ? 'dd' : variant === 'readonly' ? 'strong' : variant === 'note' ? 'p' : 'div';
  const valueContent = valueHtml ? String(value) : safe(value);
  return `<div${className ? ` class="${safe(className)}"` : ''} data-ds-detail-field="${variant}">` +
    `<${labelTag}${labelClass ? ` class="${safe(labelClass)}"` : ''}>${safe(label)}</${labelTag}>` +
    `<${valueTag}${valueClass ? ` class="${safe(valueClass)}"` : ''}>${valueContent}</${valueTag}>` +
    `</div>`;
}
/**
 * Groups detail fields in a responsive two- or three-column layout.
 * @param {string} content Trusted field markup.
 * @param {!Object=} options Grid layout and semantic wrapper.
 * @param {number=} options.columns Two or three columns.
 * @param {string=} options.tag Div or definition list (dl).
 * @return {string} Responsive detail-grid HTML.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function detailGrid(content, {columns = 3, tag = 'div', className = ''} = {}) {
  assertVariant(columns, [2, 3], 'detail grid');
  assertVariant(tag, ['div', 'dl'], 'detail grid tag');
  return `<${tag}${className ? ` class="${safe(className)}"` : ''} data-ds-detail-grid="${columns}">${content}</${tag}>`;
}
/**
 * Distinguishes a missing optional value from an empty collection.
 * @param {!Object=} options Empty-state text, actions and variant.
 * @param {string=} options.title Escaped heading or short message.
 * @param {string=} options.description Escaped explanatory text.
 * @param {string=} options.actions Trusted UI-generated HTML.
 * @param {string=} options.variant Collection, subtle or inline.
 * @return {string} Empty-state HTML.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function emptyState({title = '', description = '', actions = '', variant = 'subtle', className = ''} = {}) {
  assertVariant(variant, ['collection', 'subtle', 'inline'], 'empty state');
  if (variant === 'inline') return `<p class="${safe(classes('analytics-empty', className))}" data-ds-empty-state="inline">${safe(description || title)}</p>`;
  if (variant === 'subtle') return `<p class="${safe(classes('hint', className))}" data-ds-empty-state="subtle">${safe(description || title)}</p>`;
  return `<div class="${safe(classes('empty-state', className))}" data-ds-empty-state="collection">` +
    `<strong>${safe(title)}</strong><p>${safe(description)}</p>${actions}</div>`;
}
/**
 * Renders a shared separator without adding content-specific borders.
 * @param {!Object=} options Orientation and optional class.
 * @param {string=} options.orientation Horizontal or vertical.
 * @return {string} Divider HTML.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function divider({orientation = 'horizontal', className = ''} = {}) {
  assertVariant(orientation, ['horizontal', 'vertical'], 'divider');
  return orientation === 'horizontal'
    ? `<hr class="${safe(classes('divider', className))}" data-ds-divider="horizontal">`
    : `<span class="${safe(className)}" data-ds-divider="vertical" aria-hidden="true"></span>`;
}
/**
 * Groups trusted action elements, preserving delegated event handling.
 * @param {string} content Application-rendered action markup.
 * @param {!Object=} options Toolbar style and optional class.
 * @param {string=} options.variant Inline, filters or end.
 * @return {string} Toolbar HTML.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function actionToolbar(content, {className = '', variant = 'inline'} = {}) {
  assertVariant(variant, ['inline', 'filters', 'end'], 'action toolbar');
  const baseClass = variant === 'filters' ? 'toolbar' : 'actions';
  return `<div class="${safe(classes(baseClass, className))}" data-ds-action-toolbar="${variant}">${content}</div>`;
}
/**
 * Wraps trusted document-entry markup in a list item.
 * @param {string} content Application-rendered document content.
 * @return {string} List item HTML.
 */
export function documentItem(content) {
  return `<li>${content}</li>`;
}
/**
 * Renders a shared document list from trusted item markup.
 * @param {!Array<string>} items HTML list items, not untrusted user input.
 * @return {string} List HTML.
 */
export function documentList(items) {
  return `<ul class="document-list" data-ds-document-list>${items.join('')}</ul>`;
}
