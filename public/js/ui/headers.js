/**
 * Shared headings, back navigation and help actions.
 * Rendered HTML stays here; layout and visual states live in styles/headers.css.
 * Text/identifiers are escaped. Slots are trusted application-rendered HTML only.
 */
import { escapeHtml } from './dom.js';
import { arrowLeftIcon, helpCircleIcon } from './action-icons.js';

/** Header action layout only. Callers own event handling and data-act values.
 * `content` is trusted application-produced HTML, not user input. */
export function headerActions(content, { className = '' } = {}) {
    if (!content) return '';
    return `<div class="actions ds-header-actions${className ? ` ${escapeHtml(className)}` : ''}">${content}</div>`;
}

/** Shared, escaped heading element; trailingAction is trusted app-rendered HTML.
 * The help action is absolutely positioned, never part of the title's line box. */
export function headingTitle({ title, level = 3, className = '', id = '', trailingAction = '', period = false }) {
    if (![2,3].includes(level)) throw new RangeError('Heading level must be 2 or 3');
    const classes = `${className}${trailingAction ? `${className ? ' ' : ''}ds-heading-with-action` : ''}`;
    return `<h${level}${classes ? ` class="${escapeHtml(classes)}"` : ''}${id ? ` id="${escapeHtml(id)}"` : ''}>${escapeHtml(String(title))}${period ? '<span class="heading-period" aria-hidden="true">.</span>' : ''}${trailingAction || ''}</h${level}>`;
}

/** Section-heading geometry. `layout` selects an existing approved variant:
 * section-head (ordinary section) or tasting-panel-heading (compact panel).
 * All actions are app-produced buttons, not strings from the collection. */
export function sectionHeader({ title, actions = '', trailingAction = '', className = '', titleClass = '',
                                titleId = '', level = 3, layout = 'section-head', description = '',
                                descriptionClass = 'hint', copyClass = '', actionsClass = '', actionsBare = false } = {}) {
    if (!['section-head', 'tasting-panel-heading', 'dialog-head'].includes(layout)) throw new RangeError('Invalid section header layout');
    const heading = headingTitle({title, level, className:titleClass, id:titleId, trailingAction});
    const copy = description || copyClass ? `<div class="${copyClass ? escapeHtml(copyClass) : 'ds-section-heading-copy'}">${heading}${description ? `<p class="${escapeHtml(descriptionClass)}">${escapeHtml(description)}</p>` : ''}</div>` : heading;
    return `<div class="${layout} ds-section-header${className ? ` ${escapeHtml(className)}` : ''}">${copy}${actionsBare ? actions : headerActions(actions, {className:actionsClass})}</div>`;
}

/** Page header: fixed heading semantics + optional named slots.
 * `preTitle` and `actions` are trusted application-owned HTML (never raw data).
 * Existing section-head and per-page classes remain for compatible geometry. */
export function pageHeader({ title, eyebrow = '', intro = '', className = '', preTitle = '',
                             actions = '', copyClass = 'page-heading-copy' } = {}) {
    const classes = `section-head ds-page-header${className ? ` ${escapeHtml(className)}` : ''}`;
    return `<header class="${classes}"><div${copyClass ? ` class="${escapeHtml(copyClass)}"` : ''}>${eyebrow ? `<span class="eyebrow dark">${escapeHtml(eyebrow)}</span>` : ''}${preTitle}${headingTitle({title,level:2,period:true})}${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ''}</div>${actions}</header>`;
}

/** One navigation renderer with existing inline and page-action visual variants.
 * The SVG is always generated here; translations must only provide words.
 * Legacy leading arrows are stripped for data already persisted by older locales. */
export function backNavigation(action, label, region = '', variant = 'inline') {
    if (!['inline', 'page-action'].includes(variant)) throw new RangeError('Invalid back-navigation variant');
    const text = escapeHtml(String(label).replace(/^\s*(?:(?:←|⟵|⬅)\s*)+/u, ''));
    const attr = `data-act="${escapeHtml(action)}"${region ? ` data-region="${escapeHtml(region)}"` : ''}`;
    if (variant === 'page-action') {
        return `<nav class="ds-back-nav ds-back-nav--page-action" aria-label="${text}"><button type="button" class="btn ds-back-button ds-back-button--page-action" ${attr}>${arrowLeftIcon}<span>${text}</span></button></nav>`;
    }
    return `<nav class="page-back-nav ds-back-nav ds-back-nav--inline" aria-label="${text}"><button type="button" class="inline-link page-back ds-back-button ds-back-button--inline" ${attr}>${arrowLeftIcon}<span>${text}</span></button></nav>`;
}

/** Accessible help action. The only icon and its 20px button geometry live here.
 * Never include icon glyphs in translated labels. */
export function helpIconButton({ label, action = 'flight-plan-help', disabled = false } = {}) {
    const text = escapeHtml(String(label ?? ''));
    return `<button type="button" class="ds-help-icon-button flight-plan-help-button" data-act="${escapeHtml(action)}" aria-label="${text}" title="${text}"${disabled ? ' disabled' : ''}>${helpCircleIcon}</button>`;
}
