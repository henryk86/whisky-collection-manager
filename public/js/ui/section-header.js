import { escapeHtml } from './dom.js';
import { headerActions } from './header-actions.js';

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
