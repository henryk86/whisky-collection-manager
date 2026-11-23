import { escapeHtml } from './dom.js';

/** Header action layout only. Callers own event handling and data-act values.
 * `content` is trusted application-produced HTML, not user input. */
export function headerActions(content, { className = '' } = {}) {
    if (!content) return '';
    return `<div class="actions ds-header-actions${className ? ` ${escapeHtml(className)}` : ''}">${content}</div>`;
}
