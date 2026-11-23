import { escapeHtml } from './dom.js';
import { helpCircleIcon } from './action-icons.js';

/** Accessible help action. The only icon and its 20px button geometry live here.
 * Never include icon glyphs in translated labels. */
export function helpIconButton({ label, action = 'flight-plan-help', disabled = false } = {}) {
    const text = escapeHtml(String(label ?? ''));
    return `<button type="button" class="ds-help-icon-button flight-plan-help-button" data-act="${escapeHtml(action)}" aria-label="${text}" title="${text}"${disabled ? ' disabled' : ''}>${helpCircleIcon}</button>`;
}
