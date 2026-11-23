/**
 * Shared headings, back navigation and help actions.
 * Rendered HTML stays here; layout and visual states live in styles/headers.css.
 * Text/identifiers are escaped. Slots are trusted application-rendered HTML only.
 */
import {escapeHtml} from './dom.js';
import {arrowLeftIcon, helpCircleIcon} from './action-icons.js';

/**
 * Arranges trusted action markup alongside a heading without changing events.
 * @param {string} content Application-rendered button markup (not user input).
 * @param {{className: (string|undefined)}=} options Optional layout class.
 * @return {string} Header-actions HTML, or an empty string for no actions.
 */
export function headerActions(content, {className = ''} = {}) {
  if (!content) return '';
  return `<div class="actions ds-header-actions${className ? ` ${escapeHtml(className)}` : ''}">${content}</div>`;
}

/**
 * Renders an escaped heading and optional, separately positioned action.
 * @param {!Object} options Heading configuration.
 * @param {string} options.title Visible title; user data is escaped.
 * @param {number=} options.level Supported HTML heading level (2 or 3).
 * @param {string=} options.trailingAction Trusted UI HTML, never user text.
 * @param {boolean=} options.period Whether to render the decorative punctuation.
 * @return {string} Heading HTML.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function headingTitle({title, level = 3, className = '', id = '', trailingAction = '', period = false}) {
  if (![2, 3].includes(level)) throw new RangeError('Heading level must be 2 or 3');
  const classes = `${className}${trailingAction ? `${className ? ' ' : ''}ds-heading-with-action` : ''}`;
  return `<h${level}${classes ? ` class="${escapeHtml(classes)}"` : ''}${id ? ` id="${escapeHtml(id)}"` : ''}>${escapeHtml(String(title))}${period ? '<span class="heading-period" aria-hidden="true">.</span>' : ''}${trailingAction || ''}</h${level}>`;
}

/**
 * Renders a section title and its actions using an approved layout variant.
 * @param {!Object=} options Section heading and trusted action slots.
 * @param {string} options.title Escaped title text.
 * @param {string=} options.layout One of section-head, tasting-panel-heading,
 *     or dialog-head.
 * @return {string} Section header HTML.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function sectionHeader({title, actions = '', trailingAction = '', className = '', titleClass = '',
  titleId = '', level = 3, layout = 'section-head', description = '',
  descriptionClass = 'hint', copyClass = '', actionsClass = '', actionsBare = false} = {}) {
  if (!['section-head', 'tasting-panel-heading', 'dialog-head'].includes(layout)) throw new RangeError('Invalid section header layout');
  const heading = headingTitle({title, level, className: titleClass, id: titleId, trailingAction});
  const copy = description || copyClass ? `<div class="${copyClass ? escapeHtml(copyClass) : 'ds-section-heading-copy'}">${heading}${description ? `<p class="${escapeHtml(descriptionClass)}">${escapeHtml(description)}</p>` : ''}</div>` : heading;
  return `<div class="${layout} ds-section-header${className ? ` ${escapeHtml(className)}` : ''}">${copy}${actionsBare ? actions : headerActions(actions, {className: actionsClass})}</div>`;
}

/**
 * Renders a page title without mutating user-provided names.
 * @param {!Object=} options Page content and optional trusted HTML slots.
 * @param {string} options.title Escaped page title or bottling name.
 * @param {boolean=} options.period Whether to add a decorative period. Set to
 *     false for persisted names, which must be displayed verbatim.
 * @return {string} Header HTML.
 */
export function pageHeader({title, eyebrow = '', intro = '', className = '', preTitle = '',
  actions = '', copyClass = 'page-heading-copy', period = true} = {}) {
  const classes = `section-head ds-page-header${className ? ` ${escapeHtml(className)}` : ''}`;
  return `<header class="${classes}"><div${copyClass ? ` class="${escapeHtml(copyClass)}"` : ''}>${eyebrow ? `<span class="eyebrow dark">${escapeHtml(eyebrow)}</span>` : ''}${preTitle}${headingTitle({title, level: 2, period})}${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ''}</div>${actions}</header>`;
}

/**
 * Renders the one application-owned back icon and translated text.
 * @param {string} action Delegated data-act action identifier.
 * @param {string} label Translated words; leading legacy arrows are stripped.
 * @param {string=} region Optional view section for delegated navigation.
 * @param {string=} variant Inline or page-action layout.
 * @return {string} Accessible navigation markup.
 * @throws {RangeError} For an unsupported navigation variant.
 */
export function backNavigation(action, label, region = '', variant = 'inline') {
  if (!['inline', 'page-action'].includes(variant)) throw new RangeError('Invalid back-navigation variant');
  const text = escapeHtml(String(label).replace(/^\s*(?:(?:←|⟵|⬅)\s*)+/u, ''));
  const attr = `data-act="${escapeHtml(action)}"${region ? ` data-region="${escapeHtml(region)}"` : ''}`;
  if (variant === 'page-action') {
    return `<nav class="ds-back-nav ds-back-nav--page-action" aria-label="${text}"><button type="button" class="btn ds-back-button ds-back-button--page-action" ${attr}>${arrowLeftIcon}<span>${text}</span></button></nav>`;
  }
  return `<nav class="page-back-nav ds-back-nav ds-back-nav--inline" aria-label="${text}"><button type="button" class="inline-link page-back ds-back-button ds-back-button--inline" ${attr}>${arrowLeftIcon}<span>${text}</span></button></nav>`;
}

/**
 * Renders an accessible help action without changing title line height.
 * @param {!Object=} options Help label and delegated action configuration.
 * @param {string} options.label Translated accessible button label.
 * @param {boolean=} options.disabled Whether interaction is disabled.
 * @return {string} Help icon-button HTML.
 */
export function helpIconButton({label, action = 'flight-plan-help', disabled = false} = {}) {
  const text = escapeHtml(String(label ?? ''));
  return `<button type="button" class="ds-help-icon-button flight-plan-help-button" data-act="${escapeHtml(action)}" aria-label="${text}" title="${text}"${disabled ? ' disabled' : ''}>${helpCircleIcon}</button>`;
}
