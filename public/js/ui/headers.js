/**
 * Shared headings, back navigation and help actions.
 * Rendered HTML stays here; layout and visual states live in
 * styles/headers.css.
 * Text/identifiers are escaped. Slots are trusted application-rendered HTML
 * only.
 */
import {escapeHtml} from './dom.js';
import {arrowLeftIcon, helpCircleIcon} from './action-icons.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/headers.html');


/**
 * Renders a shared action container, leaving event delegation untouched.
 *
 * @param {string} content Trusted application-generated button markup.
 * @param {{className: string}=} options2 Optional additional CSS class.
 * @return {string} HTML, or an empty string when no actions are supplied.
 */
export function headerActions(content, {className = ''} = {}) {
  if (!content) return '';
  return renderTemplate('actions', {
    className: className ? ` ${escapeHtml(className)}` : '',
    content: content,
  });
}

/**
 * Renders an escaped heading and optional trusted action markup.
 *
 * @param {!Object} options Heading text, level and presentation settings.
 * @return {string} Heading HTML.
 * @throws {RangeError} If the heading level is unsupported.
 */
export function headingTitle({
  title,
  level = 3,
  className = '',
  id = '',
  trailingAction = '',
  period = false
}) {
  if (![2, 3].includes(level)) throw new RangeError('Heading level must be 2 or 3');
  const classes = `${className}${trailingAction ? `${className ? ' ' : ''}ds-heading-with-action` : ''}`;
  return renderTemplate('h', {
    level: `h${level}`,
    classAttributes: classes ? {"class": classes} : {},
    idAttributes: id ? {"id": id} : {},
    title: String(title),
    headingPeriod: period ? renderTemplate('headingPeriod') : '',
    trailingAction: trailingAction || '',
    level2: `h${level}`,
  });
}

/**
 * Renders a section heading with an optional description and actions.
 *
 * @param {!Object=} options Heading and layout configuration.
 * @return {string} Section heading HTML.
 * @throws {RangeError} If the layout or heading level is unsupported.
 */
export function sectionHeader({
  title,
  actions = '',
  trailingAction = '',
  className = '',
  titleClass = '',
  titleId = '',
  level = 3,
  layout = 'section-head',
  description = '',
  descriptionClass = 'hint',
  copyClass = '',
  actionsClass = '',
  actionsBare = false
} = {}) {
  if (!['section-head', 'tasting-panel-heading', 'dialog-head'].includes(layout)) throw new RangeError('Invalid section header layout');
  const heading = headingTitle({
    title, level, className: titleClass,
    id: titleId, trailingAction,
  });
  const copy = description || copyClass ? renderTemplate('copyDiv', {
    copyClass: copyClass ? escapeHtml(copyClass) : 'ds-section-heading-copy',
    heading: heading,
    p: description ?
      renderTemplate('copyP', {
        descriptionClass: descriptionClass,
        description: description,
      }) : '',
  }) : heading;
  return renderTemplate('sectionHeaderDiv', {
    layout: layout,
    className: className ? ` ${escapeHtml(className)}` : '',
    copy: copy,
    actionsBare: actionsBare ? actions : headerActions(actions, {className: actionsClass}),
  });
}

/**
 * Renders the shared page heading without changing persisted names.
 *
 * @param {!Object=} options Page heading and optional application-owned
 * markup.
 * @return {string} Accessible page-header HTML.
 */
export function pageHeader({
  title,
  eyebrow = '',
  intro = '',
  className = '',
  preTitle = '',
  actions = '',
  copyClass = 'page-heading-copy',
  period = true
} = {}) {
  const classes = `section-head ds-page-header${className ? ` ${escapeHtml(className)}` : ''}`;
  return renderTemplate('header', {
    classes: classes,
    classAttributes: copyClass ? {"class": copyClass} : {},
    eyebrow: eyebrow ? renderTemplate('eyebrow', {eyebrow: eyebrow, }) : '',
    preTitle: preTitle,
    headingTitle: headingTitle({title, level: 2, period}),
    intro: intro ? renderTemplate('intro', {intro: intro, }) : '',
    actions: actions,
  });
}

/**
 * Renders the shared back button with a single accessible arrow.
 *
 * @param {string} action Delegated data-act identifier.
 * @param {string} label Escaped translated label; old arrow glyphs are
 * removed.
 * @param {string=} region Optional data-region attribute.
 * @param {string=} variant Inline or page-action placement.
 * @return {string} Accessible navigation HTML.
 * @throws {RangeError} If the navigation variant is unsupported.
 */
export function backNavigation(action, label, region = '', variant = 'inline') {
  if (!['inline', 'page-action'].includes(variant)) throw new RangeError('Invalid back-navigation variant');
  const text = escapeHtml(String(label).replace(/^\s*(?:(?:←|⟵|⬅)\s*)+/u, ''));
  const attr = {'data-act': action, 'data-region': region || null};
  if (variant === 'page-action') {
    return renderTemplate('dsBackNav', {
      text: text,
      attr: attr,
      arrowLeftIcon: arrowLeftIcon,
      text2: text,
    });
  }
  return renderTemplate('pageBackNav', {
    text: text,
    attr: attr,
    arrowLeftIcon: arrowLeftIcon,
    text2: text,
  });
}

/**
 * Renders an accessible help button without changing heading height.
 *
 * @param {!Object=} options Help action configuration.
 * @return {string} Help-button HTML.
 */
export function helpIconButton({label, action = 'flight-plan-help',
  disabled = false} = {}) {
  const text = escapeHtml(String(label ?? ''));
  return renderTemplate('dsHelpIconButton', {
    action: action,
    text: text,
    title: text,
    disabledAttributes: disabled ? {"disabled": true} : {},
    helpCircleIcon: helpCircleIcon,
  });
}
