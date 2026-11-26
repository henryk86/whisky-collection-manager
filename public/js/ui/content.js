import {composeMarkup} from './render-plan.js';
import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/content.html');


/**
 * Encodes a scalar for the renderer's legacy escaped-text binding.
 *
 * @param {*} value Value to convert to text; nullish values become empty.
 * @return {string} Encoded scalar text.
 */
const safe = value => escapeHtml(String(value ?? ''));

/**
 * Combines optional class names without introducing empty class tokens.
 *
 * @param {...(string|boolean|null|undefined)} items Class names or falsy placeholders.
 * @return {string} Space-separated CSS class names.
 */
const classes = (...items) => items.filter(Boolean).join(' ');

/**
 * Rejects unsupported semantic tags and design-system variants.
 *
 * @param {string|number} value Requested variant, tag or column count.
 * @param {Array<string|number>} allowed Supported values.
 * @param {string} kind Name of the configuration field in the error.
 * @throws {RangeError} If the requested value is not supported.
 */
const assertVariant = (value, allowed, kind) => {
  if (!allowed.includes(value)) throw new RangeError(`Invalid ${kind} variant`);
};

/**
 * Renders a shared visual surface with its requested semantic tag.
 *
 * @param {!Object=} options Trusted panel content and styling.
 * @return {!import('./render-plan.js').RenderPlan} Semantic panel in the requested surface variant.
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
 * @return {!import('./render-plan.js').RenderPlan} Labeled value with semantic definition or detail elements.
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
 * @param {import('./render-plan.js').RenderContent} content Prepared detail-field content.
 * @param {!Object=} options2 Grid layout and semantic wrapper.
 * @return {!import('./render-plan.js').RenderPlan} Responsive grid containing the supplied detail fields.
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
 * @return {!import('./render-plan.js').RenderPlan} Missing-data message in the requested visual variant.
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
 * @return {!import('./render-plan.js').RenderPlan} Horizontal or vertical visual separator.
 * @throws {RangeError} If the orientation is unsupported.
 */
export function divider({orientation = 'horizontal', className = ''} = {}) {
  assertVariant(orientation, ['horizontal', 'vertical'], 'divider');
  return orientation === 'horizontal'
    ? renderTemplate('hr', {className: safe(classes('divider', className)), })
    : renderTemplate('dividerSpan', {className: safe(className), });
}

/**
 * Groups composed action controls while preserving delegated events.
 *
 * @param {import('./render-plan.js').RenderContent} content Prepared action controls.
 * @param {!Object=} options2 Toolbar style and extra class.
 * @return {!import('./render-plan.js').RenderPlan} Action toolbar containing the supplied controls.
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
 * Wraps prepared document-entry content in a list item.
 *
 * @param {import('./render-plan.js').RenderContent} content Prepared document entry.
 * @return {!import('./render-plan.js').RenderPlan} List item containing the supplied document entry.
 */
export function documentItem(content) {
  return renderTemplate('li', {content: content, });
}

/**
 * Groups prepared document list items without string concatenation.
 *
 * @param {import('./render-plan.js').PlanPart[]} items Prepared list-item plans.
 * @return {!import('./render-plan.js').RenderPlan} Document list containing the supplied list items.
 */
export function documentList(items) {
  return renderTemplate('documentList', {items: composeMarkup(items), });
}
