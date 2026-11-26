/**
 * Looks up a single matching element within the selected DOM root.
 *
 * @param {string} sel CSS selector.
 * @param {(Document|Element|DocumentFragment)=} from Search root; defaults to the current document.
 * @return {?Element} First matching element, or null if none matches.
 */
export const query = (sel, from = document) => from.querySelector(sel);

/**
 * Returns all matching elements within the selected DOM root.
 *
 * @param {string} sel CSS selector.
 * @param {(Document|Element|DocumentFragment)=} from Search root; defaults to the current document.
 * @return {!Array<Element>} Matching elements in document order.
 */
export const queryAll = (sel, from = document) => [...from.querySelectorAll(sel)];
