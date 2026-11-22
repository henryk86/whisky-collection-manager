import { t } from '../i18n/index.js';
import { escapeHtml } from './dom.js';
import { FLAVOR_AXES } from '../../../shared/flavor-profile.js';

export const flavorAxisTitle = axis => t(`flavor.axis.${axis}`);
const radius = 118, cx = 230, cy = 195;
const step = 2 * Math.PI / FLAVOR_AXES.length;
const angleAt = index => -Math.PI / 2 + index * step;
const point = (index, value) => {
    const angle = angleAt(index);
    return [cx + Math.cos(angle) * (value / 10) * radius,
        cy + Math.sin(angle) * (value / 10) * radius];
};
const scorePresent = value => Number.isInteger(value) && value >= 0 && value <= 10;
const scoresFromEditor = section => Object.fromEntries(FLAVOR_AXES.map(axis => {
    const input = section.querySelector(`[name="flavor-${axis}"]`);
    return [axis, input.dataset?.flavorUnset ? null : Number(input.value)];
}));

export function flavorPolygon(values) {
    // Omit unassessed points from older tastings instead of silently plotting them at zero.
    return FLAVOR_AXES.flatMap((axis, index) => scorePresent(values?.[axis])
        ? [point(index, values[axis]).map(n => n.toFixed(2)).join(',')] : []).join(' ');
}
export function flavorChart(values, { editable = false, colorSection = null, compact = false } = {}) {
    if (!values && !editable) return `<p class="hint">${escapeHtml(t('flavor.notRecorded'))}</p>`;
    const scores = values || Object.fromEntries(FLAVOR_AXES.map(axis => [axis, 0]));
    return `<div class="flavor-editor${editable ? ' is-editable' : ''}${colorSection ? ' has-color' : ''}${compact ? ' is-preview' : ''}" ${editable ? `data-flavor-editor data-flavor-set="${values ? '1' : ''}"` : ''}>
        ${colorSection || ''}
        <svg class="flavor-chart" viewBox="0 0 460 390" role="img" aria-label="${escapeHtml(t('flavor.chartLabel'))}">
            ${[2,4,6,8,10].map(score => `<polygon class="flavor-grid" points="${FLAVOR_AXES.map((_,i) => point(i,score).join(',')).join(' ')}"/>`).join('')}
            ${FLAVOR_AXES.map((axis,i) => { const [x,y] = point(i,10); return `<line class="flavor-grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join('')}
            <polygon class="flavor-area" data-flavor-polygon points="${flavorPolygon(scores)}"/>
            ${editable ? `<circle class="flavor-hit-target" data-flavor-hit="1" cx="${cx}" cy="${cy}" r="${radius}"/>` : ''}
            ${FLAVOR_AXES.map((axis,i) => { const score = scores[axis]; const [x,y]=point(i,scorePresent(score) ? score : 0); return `<circle class="flavor-point" data-flavor-point="${i}" cx="${x}" cy="${y}" r="${editable ? 6 : 4}" ${scorePresent(score) ? '' : 'visibility="hidden"'}/>`; }).join('')}
            ${FLAVOR_AXES.map((axis,i) => { const [x,y] = point(i,13.5); const side = Math.cos(angleAt(i)); const anchor = side > .3 ? 'start' : side < -.3 ? 'end' : 'middle'; return `<text class="flavor-axis-text" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle">${escapeHtml(flavorAxisTitle(axis))}</text>`; }).join('')}
        </svg>
        ${compact ? '' : `<div class="flavor-sliders">${FLAVOR_AXES.map((axis,i) => { const score = scores[axis]; const missing = !scorePresent(score); return `<label class="flavor-scale"><span>${escapeHtml(flavorAxisTitle(axis))}</span>${editable ? `<input type="range" min="0" max="10" step="1" value="${missing ? 0 : score}" name="flavor-${axis}" data-flavor-range="${i}" ${missing ? 'data-flavor-unset="1"' : ''} aria-label="${escapeHtml(flavorAxisTitle(axis))}"><output data-flavor-value="${i}">${missing ? '–' : score}</output>` : `<strong>${missing ? '–' : `${score} / 10`}</strong>`}</label>`; }).join('')}</div>`}
    </div>`;
}
export function readFlavorProfile(form) {
    const section = form?.querySelector('[data-flavor-editor]');
    if (!section || !section.dataset.flavorSet) return null;
    return scoresFromEditor(section);
}
export function handleFlavorRange(event) {
    const range = event.target.closest?.('[data-flavor-range]');
    if (!range) return false;
    const container = range.closest('[data-flavor-editor]');
    if (!container) return false;
    if (range.dataset) delete range.dataset.flavorUnset;
    container.dataset.flavorSet = '1';
    const values = scoresFromEditor(container);
    container.querySelector('[data-flavor-polygon]').setAttribute('points',flavorPolygon(values));
    FLAVOR_AXES.forEach((axis,i) => {
        const present = scorePresent(values[axis]);
        const [x,y] = point(i,present ? values[axis] : 0);
        const marker = container.querySelector(`[data-flavor-point="${i}"]`);
        marker?.setAttribute('cx',x); marker?.setAttribute('cy',y);
        marker?.setAttribute('visibility',present ? 'visible' : 'hidden');
        const out = container.querySelector(`[data-flavor-value="${i}"]`);
        if (out) out.textContent = present ? String(values[axis]) : '–';
    });
    return true;
}
/** Accessible native sliders are the input controls. SVG rays are optional touch targets. */
export function setFlavorFromPointer(event) {
    const hit = event.target.closest?.('[data-flavor-hit]');
    if (!hit) return false;
    const svg = hit.ownerSVGElement;
    const pointInSvg = svg.createSVGPoint(); pointInSvg.x = event.clientX; pointInSvg.y = event.clientY;
    const matrix = svg.getScreenCTM(); if (!matrix) return false;
    const pos = pointInSvg.matrixTransform(matrix.inverse());
    const rawAngle = Math.atan2(pos.y - cy, pos.x - cx);
    const index = ((Math.round((rawAngle + Math.PI/2) / step) % FLAVOR_AXES.length) + FLAVOR_AXES.length) % FLAVOR_AXES.length;
    const angle = angleAt(index);
    const projected = (pos.x - cx) * Math.cos(angle) + (pos.y - cy) * Math.sin(angle);
    const slider = hit.closest('[data-flavor-editor]').querySelector(`[data-flavor-range="${index}"]`);
    slider.value = String(Math.max(0, Math.min(10, Math.round(projected/radius * 10))));
    handleFlavorRange({target:slider}); return true;
}

/** Keep the SVG, native sliders and accessibility labels in sync after undo/redo. */
export function displayFlavorProfile(container, values) {
    if (!container) return;
    const scores = values || Object.fromEntries(FLAVOR_AXES.map(axis => [axis, 0]));
    const sliders = FLAVOR_AXES.map((axis,i) => container.querySelector(`[data-flavor-range="${i}"]`));
    sliders.forEach((slider,i) => {
        if (!slider) return;
        const score = scores[FLAVOR_AXES[i]];
        slider.value = String(scorePresent(score) ? score : 0);
        if (slider.dataset) {
            if (scorePresent(score)) delete slider.dataset.flavorUnset;
            else slider.dataset.flavorUnset = '1';
        }
    });
    // Update the drawing without marking unassessed axes as explicitly zero.
    // handleFlavorRange clears only the slider it receives, so update via a previously recorded axis.
    const recordedIndex = scores && FLAVOR_AXES.findIndex(axis => scorePresent(scores[axis]));
    const recorded = sliders[recordedIndex < 0 ? 0 : recordedIndex];
    if (recorded) handleFlavorRange({target:recorded});
    const editor = container.matches?.('[data-flavor-editor]') ? container : container.querySelector('[data-flavor-editor]');
    if (editor) editor.dataset.flavorSet = values ? '1' : '';
}
