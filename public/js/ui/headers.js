/**
 * Shared headings, back navigation and help actions.
 * Rendered HTML stays here; layout and visual states live in
 * styles/headers.css.
 * Text/identifiers are escaped. Slots are trusted application-rendered HTML
 * only.
 */
import {escapeHtml} from './dom.js';
import {arrowLeftIcon, helpCircleIcon} from './action-icons.js';

/**
 * Renders a shared action container, leaving event delegation untouched.
 *
 * @param {string} content Trusted application-generated button markup.
 * @param {{className: string}=} options Optional additional CSS class.
 * @return {string} HTML, or an empty string when no actions are supplied.
 */
export function headerActions(content, {className = ''} = {}) {
  if (!content) return '';
  return `<div class="actions ds-header-actions${className ?
    ` ${escapeHtml(className)}` : ''}">${content}</div>`;
}

/**
 * Renders an escaped heading and optional trusted action markup.
 *
 * @param {!Object} options Heading text, level and presentation settings.
 * @param {string} options.title Title text (always HTML-escaped).
 * @param {number=} options.level Heading level, restricted to 2 or 3.
 * @param {string=} options.className Optional escaped CSS classes.
 * @param {string=} options.id Optional escaped HTML identifier.
 * @param {string=} options.trailingAction Trusted application HTML appended to
 *     the title.
 * @param {boolean=} options.period Whether to show a decorative punctuation
 *     mark.
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
  const classes = `${className}${trailingAction ? `${className ? ' ' :
    ''}ds-heading-with-action` : ''}`;
  return `<h${level}${classes ? ` class="${escapeHtml(classes)}"` :
    ''}${id ? ` id="${escapeHtml(id)}"` :
      ''}>${escapeHtml(String(title))}${period ?
        '<span class="heading-period" aria-hidden="true">.</span>' :
        ''}${trailingAction || ''}</h${level}>`;
}

/**
 * Renders a section heading with an optional description and actions.
 *
 * @param {!Object=} options Heading and layout configuration.
 * @param {string} options.title Escaped heading text.
 * @param {string=} options.actions Trusted action-button HTML.
 * @param {string=} options.trailingAction Trusted trailing heading action.
 * @param {string=} options.className Additional outer CSS classes.
 * @param {string=} options.titleClass Additional heading CSS classes.
 * @param {string=} options.titleId Optional HTML identifier for the heading.
 * @param {number=} options.level Heading level, 2 or 3.
 * @param {string=} options.layout One of the supported section/modal layouts.
 * @param {string=} options.description Escaped explanatory text.
 * @param {string=} options.descriptionClass Description styling class.
 * @param {string=} options.copyClass Optional title/description wrapper class.
 * @param {string=} options.actionsClass CSS class of the actions wrapper.
 * @param {boolean=} options.actionsBare Whether actions bypass their wrapper.
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
  if (!['section-head', 'tasting-panel-heading', 'dialog-head']
    .includes(layout)) throw new RangeError('Invalid section header layout');
  const heading = headingTitle({title, level, className: titleClass, id: titleId, trailingAction});
  const copy = description || copyClass ? `<div class="${copyClass ?
    escapeHtml(copyClass) :
    'ds-section-heading-copy'}">${heading}${description ?
      `<p class="${escapeHtml(descriptionClass)}">${escapeHtml(description)}</p>` : ''}</div>` : heading;
  return `<div class="${layout} ds-section-header${className ?
    ` ${escapeHtml(className)}` : ''}">${copy}${actionsBare ? actions :
      headerActions(actions, {className: actionsClass})}</div>`;
}

/**
 * Renders the shared page heading without changing persisted names.
 *
 * @param {!Object=} options Page heading and optional application-owned markup.
 * @param {string} options.title User or page title, HTML-escaped.
 * @param {string=} options.eyebrow Short escaped overline.
 * @param {string=} options.intro Optional escaped introductory copy.
 * @param {string=} options.className Extra header CSS classes.
 * @param {string=} options.preTitle Trusted application HTML before the title.
 * @param {string=} options.actions Trusted application action markup.
 * @param {string=} options.copyClass Title container CSS class.
 * @param {boolean=} options.period Add a decorative period only to page titles;
 *     use false for names of saved bottlings.
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
  const classes = `section-head ds-page-header${className ?
    ` ${escapeHtml(className)}` : ''}`;
  return `<header class="${classes}"><div${copyClass ?
    ` class="${escapeHtml(copyClass)}"` : ''}>${eyebrow ?
      `<span class="eyebrow dark">${escapeHtml(eyebrow)}</span>` :
      ''}${preTitle}${headingTitle({title, level: 2, period})}${intro ?
        `<p class="intro">${escapeHtml(intro)}</p>` :
        ''}</div>${actions}</header>`;
}

/**
 * Renders the shared back button with a single accessible arrow.
 *
 * @param {string} action Delegated data-act identifier.
 * @param {string} label Escaped translated label; old arrow glyphs are removed.
 * @param {string=} region Optional data-region attribute.
 * @param {string=} variant Inline or page-action placement.
 * @return {string} Accessible navigation HTML.
 * @throws {RangeError} If the navigation variant is unsupported.
 */
export function backNavigation(action, label, region = '', variant = 'inline') {
  if (!['inline', 'page-action']
    .includes(variant)) throw new RangeError('Invalid back-navigation variant');
  const text = escapeHtml(String(label).replace(/^\s*(?:(?:←|⟵|⬅)\s*)+/u, ''));
  const attr = `data-act="${escapeHtml(action)}"${region ?
    ` data-region="${escapeHtml(region)}"` : ''}`;
  if (variant === 'page-action') {
    return `<nav class="ds-back-nav ds-back-nav--page-action" aria-label="${text}"><button type="button" class="btn ds-back-button ds-back-button--page-action" ${attr}>${arrowLeftIcon}<span>${text}</span></button></nav>`;
  }
  return `<nav class="page-back-nav ds-back-nav ds-back-nav--inline" aria-label="${text}"><button type="button" class="inline-link page-back ds-back-button ds-back-button--inline" ${attr}>${arrowLeftIcon}<span>${text}</span></button></nav>`;
}

/**
 * Renders an accessible help button without changing heading height.
 *
 * @param {!Object=} options Help action configuration.
 * @param {string} options.label Translated accessible name, HTML-escaped.
 * @param {string=} options.action Delegated data-act identifier.
 * @param {boolean=} options.disabled Disable keyboard and pointer interaction.
 * @return {string} Help-button HTML.
 */
export function helpIconButton({label, action = 'flight-plan-help', disabled = false} = {}) {
  const text = escapeHtml(String(label ?? ''));
  return `<button type="button" class="ds-help-icon-button flight-plan-help-button" data-act="${escapeHtml(action)}" aria-label="${text}" title="${text}"${disabled ? ' disabled' : ''}>${helpCircleIcon}</button>`;
}
