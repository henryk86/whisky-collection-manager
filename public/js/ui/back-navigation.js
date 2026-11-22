import { arrowLeftIcon } from './action-icons.js';
import { escapeHtml } from './dom.js';

/** Shared return navigation for bottling and tasting detail pages. */
export function backNavigation(action, label, region = '') {
    // The icon is part of the component, never part of its translated text.
    const text = escapeHtml(String(label).replace(/^\s*(?:←|⟵)\s*/u, ''));
    return `<nav class="page-back-nav" aria-label="${text}"><button type="button" class="inline-link page-back" data-act="${escapeHtml(action)}"${region ? ` data-region="${escapeHtml(region)}"` : ''}>${arrowLeftIcon}<span>${text}</span></button></nav>`;
}
