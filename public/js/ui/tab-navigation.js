/** Keep the active tab visible when a horizontally scrollable section navigation is redrawn.
 * Adjust only the tab strip scroll position; leave the document's vertical scroll unchanged. */
export function revealActiveTab(nav) {
    const active = nav?.querySelector?.('.analytics-tab.active');
    if (!active || typeof nav.getBoundingClientRect !== 'function' || typeof active.getBoundingClientRect !== 'function') return;
    const strip = nav.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    const gap = 10;
    if (tab.left < strip.left + gap) {
        nav.scrollLeft += tab.left - strip.left - gap;
    } else if (tab.right > strip.right - gap) {
        nav.scrollLeft += tab.right - strip.right + gap;
    }
}
