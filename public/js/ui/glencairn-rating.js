import {composeMarkup} from './render-plan.js';
import {t} from '../i18n/index.js';
import {escapeHtml} from './dom.js';
import {glencairnRatingSymbol} from './glencairn-icon.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/glencairn-rating.html');


/**
 * Five Glencairn silhouettes with bottom-up gold liquid fill and precise 0-100
 * manual entry.
 *
 * @param {*} rating Rating used by this operation.
 * @return {string} Resulting text.
 */
export function glencairnRating(rating) {
  const safe = rating == null ? null : Math.max(0, Math.min(100, Number(rating)));
  const inputValue = safe == null ? '' : String(safe).replace('.', ',');
  return renderTemplate('tastingRating', {
    safe: safe ?? '',
    rating: t('tasting.rating'),
    from: composeMarkup(Array.from({length: 5}, (_, i) => {
      const fill = safe == null ? 0 : Math.max(0, Math.min(100, (safe - i * 20) * 5));
      const selected = safe != null && safe > i * 20;
      const state = fill === 100 ? 'full' : fill > 0 ? 'partial' : 'empty';
      const points = (i + 1) * 20;
      return renderTemplate('tastingGlass', {
        state: state,
        points: points,
        selected: selected,
        ratingGlass: t('tasting.ratingGlass', {count: i + 1}),
        points2: points,
        fill: fill,
        glencairnRatingSymbol: glencairnRatingSymbol({
          fill,
          id: `rating-glass-${i}`,
        }),
      });
    })),
    inputValue: inputValue,
    points: t('tasting.points'),
  });
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
    const fill = safe == null ? 0 : Math.max(0, Math.min(100, (safe - i * 20) * 5));
    const rect = button.querySelector('[data-rating-fill]');
    if (rect) {
      const height = 253 * fill / 100;
      rect.setAttribute('y', String(331 - height));
      rect.setAttribute('height', String(height));
    }
    button.style.setProperty('--glass-fill', `${fill}%`);
    button.dataset.glassState = fill === 100 ? 'full' : fill > 0 ? 'partial' : 'empty';
    button.setAttribute('aria-pressed', String(safe != null && safe > i * 20));
  });
}
