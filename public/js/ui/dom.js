/**
 * Escapes untrusted text before embedding it in HTML markup.
 *
 * @param {*} v V used by this operation.
 * @return {string} Resulting text.
 */
export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/**
 * Looks up a single matching element within the selected DOM root.
 *
 * @param {*} sel Sel used by this operation.
 * @param {!Document=} from From used by this operation.
 * @return {*} Matching DOM element, if present.
 */
export const query = (sel, from = document) => from.querySelector(sel);

/**
 * Returns all matching elements within the selected DOM root.
 *
 * @param {*} sel Sel used by this operation.
 * @param {!Document=} from From used by this operation.
 * @return {!Array<*>} Resulting list of values.
 */
export const queryAll = (sel, from = document) =>
  [...from.querySelectorAll(sel)];
