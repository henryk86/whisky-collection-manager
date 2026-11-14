/** Resolve single- vs. double-click before the plan is re-rendered.
 * A first click cannot rebuild the SVG/canvas or the browser loses the second click.
 */
export function createFurnitureActivation(onSelect, onEdit, delay = 330) {
    let pending = null;
    return {
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
            const item = {id, target, timer:null};
            pending = item;
            item.timer = setTimeout(() => {
                if (pending !== item) return;
                pending = null;
                onSelect(id);
            }, delay);
        },
        cancel() {
            if (pending) clearTimeout(pending.timer);
            pending = null;
        },
    };
}
