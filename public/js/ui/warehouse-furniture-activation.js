/**
 * Resolve single- vs. double-click before the plan is re-rendered. A first
 * click cannot rebuild the SVG/canvas or the browser loses the second click.
 *
 * @param {Function} onSelect On select used by this operation.
 * @param {Function} onEdit On edit used by this operation.
 * @param {number=} delay Delay used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export function createFurnitureActivation(onSelect, onEdit, delay = 330) {
  let pending = null;
  return {
    /**
     * Derives the activate result from the supplied values.
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
     * Performs the cancel lifecycle action.
     */
    cancel() {
      if (pending) clearTimeout(pending.timer);
      pending = null;
    },
  };
}
