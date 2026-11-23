import { arrowLeftIcon } from './action-icons.js';
import { escapeHtml } from './dom.js';

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
