import {request} from '../api.js';
import {toast} from '../ui/notifications.js';
import {moveFurnitureTowards} from '../../../shared/warehouse-placement.js';
import {createFurnitureActivation} from '../ui/warehouse-furniture-activation.js';
import {findFurniture} from './warehouse-presentation.js';

/**
 * Attaches keyboard activation and collision-aware 2D furniture dragging.
 * @param {!Object} options Warehouse access and interaction callbacks.
 */
export function attachWarehousePlanDrag({w, selectFurniture, editFurnitureFromPlan, openForm, refresh, render}) {
  const svg = document.querySelector('.warehouse-floor'); if (!svg) return;
  let drag = null;
  const activation = createFurnitureActivation(selectFurniture, editFurnitureFromPlan);
  svg.addEventListener('keydown', event => {
    const furniture = event.target.closest?.('.warehouse-drag');
    if (!furniture) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.shiftKey) openForm('furniture', furniture.dataset.id);
      else selectFurniture(furniture.dataset.id);
    }
  });
  svg.addEventListener('pointerdown', e => {
    const g = e.target.closest('.warehouse-drag'); if (!g || e.button !== 0) return;
    const found = findFurniture(w(), g.dataset.id); if (!found) return;
    drag = {
      id: g.dataset.id,
      origX: found.furniture.x,
      origY: found.furniture.y,
      startX: e.clientX,
      startY: e.clientY,
      newX: found.furniture.x,
      newY: found.furniture.y,
      moved: false,
      room: found.room,
    };
    svg.setPointerCapture(e.pointerId); e.preventDefault();
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const rect = svg.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return;
    const item = findFurniture(w(), drag.id)?.furniture; if (!item) return;
    const dx = (e.clientX - drag.startX) * drag.room.width / rect.width;
    const dy = (e.clientY - drag.startY) * drag.room.height / rect.height;
    if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 6) drag.moved = true;
    // The preview uses the same 3D collision rules as the server. A fast
    // pointer movement cannot jump through another piece of furniture.
    const position = moveFurnitureTowards(drag.room, item, drag.newX, drag.newY, drag.origX + dx, drag.origY + dy);
    const x = position.x, y = position.y;
    drag.newX = x; drag.newY = y;
    const vb = svg.viewBox.baseVal;
    const g = svg.querySelector(`.warehouse-drag[data-id="${drag.id}"]`);
    if (g) {
      const shape = g.querySelector('rect'); if (shape) {
        const tx = x * vb.width / drag.room.width, ty = y * vb.height / drag.room.height; const oldX = parseFloat(shape.getAttribute('x')) - 1, oldY = parseFloat(shape.getAttribute('y')) - 1; g.setAttribute('transform', `translate(${tx - oldX} ${ty - oldY})`);
      }
    }
  });
  svg.addEventListener('pointerup', async e => {
    if (!drag) return; const current = drag; drag = null;
    if (!current.moved) {activation.activate(current.id); return;}
    const item = findFurniture(w(), current.id)?.furniture; if (!item) return;
    try {
      await request(
        `/api/warehouse/furniture/${current.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            ...item, x: current.newX ?? item.x, y: current.newY ?? item.y,
          }),
        }
      ); await refresh();
    }
    catch (err) {toast(err.message, true); render();}
  });
  svg.addEventListener('pointercancel', () => {drag = null; render();});
}
