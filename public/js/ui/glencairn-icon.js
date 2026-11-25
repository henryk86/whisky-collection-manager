import {composeMarkup} from './render-plan.js';

import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('icons/glencairn-icon.html');
/**
 * Vector contours traced from the user-provided Glencairn icon, including its
 * internal shine.
 */
export const GLENCAIRN_INK =
  'M170,61 L169,98 L165,135 L154,182 L140,226 L139,248 L145,274 L156,295 L173,314 L192,327 L174,372 L173,384 L175,388 L182,393 L298,392 L305,383 L305,376 L285,328 L308,311 L325,289 L335,266 L339,244 L338,227 L320,170 L313,139 L309,105 L308,61 Z M190,376 L202,348 L274,348 L287,376 Z M187,78 L290,78 L292,80 L293,110 L297,143 L304,175 L321,227 L322,249 L316,271 L308,285 L292,303 L270,318 L267,324 L267,331 L210,331 L209,323 L206,317 L184,303 L168,285 L157,260 L155,249 L155,231 L170,185 L177,157 L183,120 L185,80 Z M215,97 L209,97 L204,102 L202,126 L195,165 L182,207 L183,214 L188,218 L193,218 L198,213 L210,172 L219,117 L219,101 Z';
export const GLENCAIRN_CAVITY =
  'M187,78 L290,78 L292,80 L293,110 L297,143 L304,175 L321,227 L322,249 L316,271 L308,285 L292,303 L270,318 L267,324 L267,331 L210,331 L209,323 L206,317 L184,303 L168,285 L157,260 L155,249 L155,231 L170,185 L177,157 L183,120 L185,80 Z';
/**
 * Renders the Glencairn glass symbol with its requested appearance.
 *
 * @param {!Object=} options Optional configuration for the operation.
 * @return {string} Resulting text.
 */
export function glencairnSymbol({
  fill = 0,
  color = 'var(--gold)',
  liquidColor = null,
  id = 'glass',
  accessible = false
} = {}) {
  const amount = Math.max(0, Math.min(100, Number(fill) || 0));
  const y = 394 - 334 * amount / 100;
  return renderTemplate('glencairnSymbol', {
    roleAttributes: accessible ? {"role": "img"} : {"aria-hidden": "true", "focusable": "false"},
    children: composeMarkup(
      renderTemplate('defs', {id, y, content: 394 - y}),
      liquidColor ? renderTemplate('glencairnLiquid', {
        gLENCAIRNCAVITY: GLENCAIRN_CAVITY, liquidColor,
      }) : '',
      renderTemplate('glencairnInk', {gLENCAIRNINK: GLENCAIRN_INK}),
      renderTemplate('glencairnGold', {gLENCAIRNINK: GLENCAIRN_INK, id, color})
    ),
  });
}

/**
 * Rating shows whisky-gold liquid inside the original Glencairn silhouette. A
 * partial fifth glass has a proportional bottom-up liquid level; the outline
 * and the distinctive inner reflection remain visible at every fill level.
 *
 * @param {!Object=} options Optional configuration for the operation.
 * @return {string} Resulting text.
 */
export function glencairnRatingSymbol({fill = 0, id = 'rating-glass'} = {}) {
  const percent = Math.max(0, Math.min(100, Number(fill) || 0));
  const height = 253 * percent / 100;
  const y = 331 - height;
  return renderTemplate('glencairnSymbol3', {
    children: composeMarkup(
      renderTemplate('defs2', {id, gLENCAIRNCAVITY: GLENCAIRN_CAVITY}),
      renderTemplate('glencairnRatingFill', {y, height, id}),
      renderTemplate('glencairnRatingOutline', {gLENCAIRNINK: GLENCAIRN_INK})
    ),
  });
}
