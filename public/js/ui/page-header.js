import { escapeHtml } from './dom.js';
import { headingTitle } from './section-header.js';

/** Page header: fixed heading semantics + optional named slots.
 * `preTitle` and `actions` are trusted application-owned HTML (never raw data).
 * Existing section-head and per-page classes remain for compatible geometry. */
export function pageHeader({ title, eyebrow = '', intro = '', className = '', preTitle = '',
                             actions = '', period = true, copyClass = 'page-heading-copy' } = {}) {
    const classes = `section-head ds-page-header${className ? ` ${escapeHtml(className)}` : ''}`;
    return `<header class="${classes}"><div${copyClass ? ` class="${escapeHtml(copyClass)}"` : ''}>${eyebrow ? `<span class="eyebrow dark">${escapeHtml(eyebrow)}</span>` : ''}${preTitle}${headingTitle({title,level:2,period})}${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ''}</div>${actions}</header>`;
}
