import {escapeHtml} from './dom.js';

/**
 * Derives the safe result from the supplied values.
 *
 * @param {*} value Value to process.
 * @return {string} Resulting text.
 */
const safe = value => escapeHtml(String(value ?? ''));

/**
 * Filters records according to the classes selection rules.
 *
 * @param {!Array<*>} items Entries to process.
 * @return {string} Resulting text.
 */
const classes = (...items) => items.filter(Boolean).join(' ');

/**
 * Enforces the variant precondition.
 *
 * @param {*} value Value to process.
 * @param {*} allowed Value used by this operation.
 * @param {*} kind Value used by this operation.
 */
const assertVariant = (value, allowed, kind) => {
  if (!allowed.includes(value)) throw new RangeError(`Invalid ${kind} variant`);
};

/**
 * Renders a shared visual surface with its requested semantic tag.
 *
 * @param {!Object=} options Trusted panel content and styling.
 * @return {string} Panel markup.
 * @throws {RangeError} If tag or style variant is unsupported.
 */
export function panel({content = '', variant = 'standard', tag = 'div', className = ''} = {}) {
  assertVariant(variant, ['standard', 'analytics', 'plain'], 'panel');
  assertVariant(tag, ['div', 'section', 'article'], 'panel tag');
  const baseClass = variant === 'analytics' ? 'analytics-panel' :
    variant === 'plain' ? '' : 'panel';
  return `<${tag} class="${safe(classes(baseClass, className))}" data-ds-panel="${variant}">${content}</${tag}>`;
}

/**
 * Renders a labeled detail value with an appropriate semantic element.
 *
 * @param {!Object=} options Detail field data and formatting.
 * @return {string} Detail-field markup.
 * @throws {RangeError} If the field variant is unsupported.
 */
export function detailField({
  label,
  value = '',
  valueHtml = false,
  variant = 'definition',
  className = '',
  labelClass = '',
  valueClass = ''
} = {}) {
  assertVariant(
    variant,
    ['definition', 'fact', 'readonly', 'note', 'preview'],
    'detail field'
  );
  const definition = variant === 'definition';
  const labelTag = definition ? 'dt' : 'span';
  const valueTag = definition ? 'dd' : variant === 'readonly' ? 'strong' :
    variant === 'note' ? 'p' : 'div';
  const valueContent = valueHtml ? String(value) : safe(value);
  return `<div${className ? ` class="${safe(className)}"` :
    ''} data-ds-detail-field="${variant}">` +
    `<${labelTag}${labelClass ? ` class="${safe(labelClass)}"` :
      ''}>${safe(label)}</${labelTag}>` +
    `<${valueTag}${valueClass ? ` class="${safe(valueClass)}"` :
      ''}>${valueContent}</${valueTag}>` +
    `</div>`;
}

/**
 * Groups detail fields in a responsive two- or three-column grid.
 *
 * @param {string} content Trusted application-generated field HTML.
 * @param {!Object=} options2 Grid layout and semantic wrapper.
 * @return {string} Grid wrapper HTML.
 * @throws {RangeError} If the columns or wrapper tag are unsupported.
 */
export function detailGrid(content, {columns = 3, tag = 'div', className = ''} = {}) {
  assertVariant(columns, [2, 3], 'detail grid');
  assertVariant(tag, ['div', 'dl'], 'detail grid tag');
  return `<${tag}${className ? ` class="${safe(className)}"` :
    ''} data-ds-detail-grid="${columns}">${content}</${tag}>`;
}

/**
 * Renders a missing-data explanation without inventing values.
 *
 * @param {!Object=} options Message, trusted actions and style.
 * @return {string} Empty-state markup.
 * @throws {RangeError} If the variant is unsupported.
 */
export function emptyState({
  title = '',
  description = '',
  actions = '',
  variant = 'subtle',
  className = ''
} = {}) {
  assertVariant(variant, ['collection', 'subtle', 'inline'], 'empty state');
  if (variant === 'inline') return `<p class="${safe(classes('analytics-empty', className))}" data-ds-empty-state="inline">${safe(description || title)}</p>`;
  if (variant === 'subtle') return `<p class="${safe(classes('hint', className))}" data-ds-empty-state="subtle">${safe(description || title)}</p>`;
  return `<div class="${safe(classes('empty-state', className))}" data-ds-empty-state="collection">` +
    `<strong>${safe(title)}</strong><p>${safe(description)}</p>${actions}</div>`;
}

/**
 * Renders an accessible visual separator without view-specific borders.
 *
 * @param {!Object=} options Separator orientation and CSS class.
 * @return {string} HTML separator.
 * @throws {RangeError} If the orientation is unsupported.
 */
export function divider({orientation = 'horizontal', className = ''} = {}) {
  assertVariant(orientation, ['horizontal', 'vertical'], 'divider');
  return orientation === 'horizontal'
    ? `<hr class="${safe(classes('divider', className))}" data-ds-divider="horizontal">`
    : `<span class="${safe(className)}" data-ds-divider="vertical" aria-hidden="true"></span>`;
}

/**
 * Groups trusted action markup while preserving delegated events.
 *
 * @param {string} content Trusted application-generated action HTML.
 * @param {!Object=} options2 Toolbar style and extra class.
 * @return {string} Toolbar HTML.
 * @throws {RangeError} If the toolbar variant is unsupported.
 */
export function actionToolbar(content, {className = '', variant = 'inline'} = {}) {
  assertVariant(variant, ['inline', 'filters', 'end'], 'action toolbar');
  const baseClass = variant === 'filters' ? 'toolbar' : 'actions';
  return `<div class="${safe(classes(baseClass, className))}" data-ds-action-toolbar="${variant}">${content}</div>`;
}

/**
 * Wraps trusted document-entry markup in a list item.
 *
 * @param {string} content Trusted application-generated document HTML.
 * @return {string} List-item HTML.
 */
export function documentItem(content) {
  return `<li>${content}</li>`;
}

/**
 * Renders the document list from trusted list-item HTML.
 *
 * @param {!Array<string>} items Complete, application-generated list items.
 * @return {string} Document-list HTML.
 */
export function documentList(items) {
  return `<ul class="document-list" data-ds-document-list>${items.join('')}</ul>`;
}
