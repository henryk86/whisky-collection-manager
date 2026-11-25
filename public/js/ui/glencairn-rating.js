import {t} from '../i18n/index.js';
import {escapeHtml} from './dom.js';
import {glencairnRatingSymbol} from './glencairn-icon.js';

/**
 * Five Glencairn silhouettes with bottom-up gold liquid fill and precise 0-100
 * manual entry.
 *
 * @param {*} rating Rating used by this operation.
 * @return {string} Resulting text.
 */
export function glencairnRating(rating) {
  const safe = rating == null ? null :
    Math.max(0, Math.min(100, Number(rating)));
  const inputValue = safe == null ? '' : String(safe).replace('.', ',');
  return `<div class="tasting-rating" data-tasting-rating \
data-rating-value="${safe ?? ''}">
        <div class="tasting-glasses" role="group" aria-label="${escapeHtml(t(
    'tasting.rating'))}">
        ${Array.from({length: 5}, (_, i) => {
      const fill = safe == null ? 0 : Math.max(0, Math.min(100, (safe - i *
        20) * 5));
      const selected = safe != null && safe > i * 20;
      const state = fill === 100 ? 'full' : fill > 0 ? 'partial' : 'empty';
      const points = (i + 1) * 20;
      return `<button type="button" class="tasting-glass" \
data-glass-state="${state}" data-act="tasting-rating" data-rating-points="\
${points}" aria-pressed="${selected}" aria-label="${escapeHtml(t('tasting.ra\
tingGlass', {count: i + 1}))}" title="${points} / 100" style="--glass-fill:\
${fill}%">${glencairnRatingSymbol({fill, id: `rating-glass-${i}`})}</button>`;
    }).join('')}</div>
        <div class="tasting-score-field">
            <label class="tasting-score-control"><input type="text" \
data-tasting-score inputmode="decimal" autocomplete="off" value="${
escapeHtml(inputValue)}" aria-label="${escapeHtml(t('tasting.points'))
    }" aria-describedby="tasting-score-suffix tasting-score-error" placehold\
er="\
–"/><span id="tasting-score-suffix">/ 100</span></label>
            <span id="tasting-score-error" class="tasting-score-error" \
role="status" aria-live="polite"></span>
        </div>
    </div>`;
}

/**
 * Preview fractional glass fills without replacing the focused numeric input.
 *
 * @param {!Element} node DOM or syntax node to process.
 * @param {*} value Input value to process.
 */
export function syncGlencairnRating(node, value) {
  if (!node) return;
  const safe = value == null ? null : Math.max(0, Math.min(100, Number(value)));
  node.dataset.ratingValue = safe == null ? '' : String(safe);
  node.querySelectorAll('[data-rating-points]').forEach((button, i) => {
    const fill = safe == null ? 0 : Math.max(0, Math.min(100, (safe - i *
      20) * 5));
    const rect = button.querySelector('[data-rating-fill]');
    if (rect) {
      const height = 253 * fill / 100;
      rect.setAttribute('y', String(331 - height));
      rect.setAttribute('height', String(height));
    }
    button.style.setProperty('--glass-fill', `${fill}%`);
    button.dataset.glassState = fill === 100 ? 'full' : fill > 0 ?
      'partial' : 'empty';
    button.setAttribute('aria-pressed', String(safe != null && safe > i * 20));
  });
}
