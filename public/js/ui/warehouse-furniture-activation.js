/**
 * Resolve single- vs. double-click before the plan is re-rendered. A first
 * click cannot rebuild the SVG/canvas or the browser loses the second click.
 *
 * @param {Function} onSelect Called when furniture is selected.
 * @param {Function} onEdit Called when furniture is activated for editing.
 * @param {number=} delay Time in milliseconds allowed between successive activations.
 * @return {!Object} Furniture click, double-click and cancellation operations.
 */
export function createFurnitureActivation(onSelect, onEdit, delay = 330) {
  let pending = null;
  return {
    /**
     * Distinguishes single selection from a subsequent editing activation.
     *
     * @param {*} id Identifier of the affected record.
     * @param {*=} target Target of the operation.
     */
    activate(id, target = id) {
      if (pending?.id === id && pending.target === target) {
        clearTimeout(pending.timer);
        pending = null;
        onEdit(id, target);
        return;
      }
      if (pending) {
        clearTimeout(pending.timer);
      }
      const item = {id, target, timer: null};
      pending = item;
      item.timer = setTimeout(() => {
        if (pending !== item) return;
        pending = null;
        onSelect(id);
      }, delay);
    },
    /**
     * Cancels the delayed single-click activation of a furniture item.
     */
    cancel() {
      if (pending) clearTimeout(pending.timer);
      pending = null;
    },
  };
}
