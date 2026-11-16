import { t } from '../i18n/index.js';
import { escapeHtml } from './dom.js';
import { FLAVOR_AXES } from '../../../shared/flavor-profile.js';

export const flavorAxisTitle = axis => t(`flavor.axis.${axis}`);
const radius = 118, cx = 230, cy = 195;
const point = (index, value) => {
    const angle = -Math.PI / 2 + index * Math.PI / 4;
    return [cx + Math.cos(angle) * (value / 10) * radius,
        cy + Math.sin(angle) * (value / 10) * radius];
};
export function flavorPolygon(values) {
    return FLAVOR_AXES.map((axis, index) => point(index, values?.[axis] ?? 0).map(n => n.toFixed(2)).join(',')).join(' ');
}
export function flavorChart(values, { editable = false, colorSection = null } = {}) {
    if (!values && !editable) return `<p class="hint">${escapeHtml(t('flavor.notRecorded'))}</p>`;
    const scores = values || Object.fromEntries(FLAVOR_AXES.map(axis => [axis, 0]));
    return `<div class="flavor-editor${editable ? ' is-editable' : ''}${colorSection ? ' has-color' : ''}" ${editable ? `data-flavor-editor data-flavor-set="${values ? '1' : ''}"` : ''}>
        ${colorSection || ''}
        <svg class="flavor-chart" viewBox="0 0 460 390" role="img" aria-label="${escapeHtml(t('flavor.chartLabel'))}">
            ${[2,4,6,8,10].map(score => `<polygon class="flavor-grid" points="${FLAVOR_AXES.map((_,i) => point(i,score).join(',')).join(' ')}"/>`).join('')}
            ${FLAVOR_AXES.map((axis,i) => { const [x,y] = point(i,10); return `<line class="flavor-grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join('')}
            <polygon class="flavor-area" data-flavor-polygon points="${flavorPolygon(scores)}"/>
            ${editable ? `<circle class="flavor-hit-target" data-flavor-hit="1" cx="${cx}" cy="${cy}" r="${radius}"/>` : ''}
            ${FLAVOR_AXES.map((axis,i) => { const [x,y]=point(i,scores[axis]); return `<circle class="flavor-point" data-flavor-point="${i}" cx="${x}" cy="${y}" r="${editable ? 6 : 4}"/>`; }).join('')}
            ${FLAVOR_AXES.map((axis,i) => { const [x,y] = point(i,13.5); const side = Math.cos(-Math.PI/2 + i*Math.PI/4); const anchor = side > .3 ? 'start' : side < -.3 ? 'end' : 'middle'; return `<text class="flavor-axis-text" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle">${escapeHtml(flavorAxisTitle(axis))}</text>`; }).join('')}
        </svg>
        <div class="flavor-sliders">${FLAVOR_AXES.map((axis,i) => `<label class="flavor-scale"><span>${escapeHtml(flavorAxisTitle(axis))}</span>${editable ? `<input type="range" min="0" max="10" step="1" value="${scores[axis]}" name="flavor-${axis}" data-flavor-range="${i}" aria-label="${escapeHtml(flavorAxisTitle(axis))}"><output data-flavor-value="${i}">${scores[axis]}</output>` : `<strong>${scores[axis]} / 10</strong>`}</label>`).join('')}</div>
    </div>`;
}
export function readFlavorProfile(form) {
    const section = form?.querySelector('[data-flavor-editor]');
    if (!section || !section.dataset.flavorSet) return null;
    return Object.fromEntries(FLAVOR_AXES.map(axis => [axis, Number(section.querySelector(`[name="flavor-${axis}"]`).value)]));
}
export function handleFlavorRange(event) {
    const range = event.target.closest?.('[data-flavor-range]');
    if (!range) return false;
    const container = range.closest('[data-flavor-editor]');
    if (!container) return false;
    container.dataset.flavorSet = '1';
    const values = Object.fromEntries(FLAVOR_AXES.map(axis => [axis, Number(container.querySelector(`[name="flavor-${axis}"]`).value)]));
    container.querySelector('[data-flavor-polygon]').setAttribute('points',flavorPolygon(values));
    FLAVOR_AXES.forEach((axis,i) => {
        const [x,y] = point(i,values[axis]);
        const marker = container.querySelector(`[data-flavor-point="${i}"]`);
        marker?.setAttribute('cx',x); marker?.setAttribute('cy',y);
        const out = container.querySelector(`[data-flavor-value="${i}"]`); if (out) out.textContent = String(values[axis]);
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
    const index = ((Math.round((rawAngle + Math.PI/2) / (Math.PI/4)) % 8) + 8) % 8;
    const angle = -Math.PI/2 + index * Math.PI/4;
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
    sliders.forEach((slider,i) => { if (slider) slider.value = String(scores[FLAVOR_AXES[i]]); });
    // handleFlavorRange marks the profile as recorded. Restore the real missing-value state.
    if (sliders[0]) handleFlavorRange({target:sliders[0]});
    const editor = container.matches?.('[data-flavor-editor]') ? container : container.querySelector('[data-flavor-editor]');
    if (editor) editor.dataset.flavorSet = values ? '1' : '';
}
