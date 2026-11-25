import {composeMarkup} from './render-plan.js';
import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/content.html');


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
export function panel({content = '', variant = 'standard', tag = 'div',
  className = ''} = {}) {
  assertVariant(variant, ['standard', 'analytics', 'plain'], 'panel');
  assertVariant(tag, ['div', 'section', 'article'], 'panel tag');
  const baseClass = variant === 'analytics' ? 'analytics-panel' : variant === 'plain' ? '' : 'panel';
  return renderTemplate('panel', {
    tag: tag,
    className: safe(classes(baseClass, className)),
    variant: variant,
    content: content,
    closingTag: tag,
  });
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
  assertVariant(variant, ['definition', 'fact', 'readonly', 'note', 'preview'], 'detail field');
  const definition = variant === 'definition';
  const labelTag = definition ? 'dt' : 'span';
  const valueTag = definition ? 'dd' : variant === 'readonly' ? 'strong' : variant === 'note' ? 'p' : 'div';
  const valueContent = valueHtml ? value : safe(value);
  return renderTemplate('detailFieldDiv', {
    classAttributes: className ? {"class": className} : {},
    variant,
    children: composeMarkup(
      renderTemplate('detailField', {
        labelTag,
        classAttributes: labelClass ? {"class": labelClass} : {},
        label: safe(label),
        closingLabelTag: labelTag,
      }),
      renderTemplate('detailField2', {
        valueTag,
        classAttributes: valueClass ? {"class": valueClass} : {},
        valueContent,
        closingValueTag: valueTag,
      })
    ),
  });
}

/**
 * Groups detail fields in a responsive two- or three-column grid.
 *
 * @param {string} content Trusted application-generated field HTML.
 * @param {!Object=} options2 Grid layout and semantic wrapper.
 * @return {string} Grid wrapper HTML.
 * @throws {RangeError} If the columns or wrapper tag are unsupported.
 */
export function detailGrid(content, {columns = 3, tag = 'div', className =
  ''} = {}) {
  assertVariant(columns, [2, 3], 'detail grid');
  assertVariant(tag, ['div', 'dl'], 'detail grid tag');
  return renderTemplate('detailGrid', {
    tag: tag,
    classAttributes: className ? {"class": className} : {},
    columns: columns,
    content: content,
    closingTag: tag,
  });
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
  if (variant === 'inline') return renderTemplate('emptyStateP', {
    className: safe(classes('analytics-empty', className)),
    message: safe(description || title),
  });
  if (variant === 'subtle') return renderTemplate('emptyStateP2', {
    className: safe(classes('hint', className)),
    message: safe(description || title),
  });
  return renderTemplate('emptyStateDiv', {
    className: safe(classes('empty-state', className)),
    title: safe(title),
    description: safe(description),
    actions,
  });
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
    ? renderTemplate('hr', {className: safe(classes('divider', className)), })
    : renderTemplate('dividerSpan', {className: safe(className), });
}

/**
 * Groups trusted action markup while preserving delegated events.
 *
 * @param {string} content Trusted application-generated action HTML.
 * @param {!Object=} options2 Toolbar style and extra class.
 * @return {string} Toolbar HTML.
 * @throws {RangeError} If the toolbar variant is unsupported.
 */
export function actionToolbar(content, {className = '', variant = 'inline'} =
  {}) {
  assertVariant(variant, ['inline', 'filters', 'end'], 'action toolbar');
  const baseClass = variant === 'filters' ? 'toolbar' : 'actions';
  return renderTemplate('actionToolbarDiv', {
    className: safe(classes(baseClass, className)),
    variant: variant,
    content: content,
  });
}

/**
 * Wraps trusted document-entry markup in a list item.
 *
 * @param {string} content Trusted application-generated document HTML.
 * @return {string} List-item HTML.
 */
export function documentItem(content) {
  return renderTemplate('li', {content: content, });
}

/**
 * Renders the document list from trusted list-item HTML.
 *
 * @param {!Array<string>} items Complete, application-generated list items.
 * @return {string} Document-list HTML.
 */
export function documentList(items) {
  return renderTemplate('documentList', {items: composeMarkup(items), });
}
