/** Resolve single- vs. double-click before the plan is re-rendered.
 * A first click cannot rebuild the SVG/canvas or the browser loses the second click.
 */
export function createFurnitureActivation(onSelect, onEdit, delay = 330) {
    let pending = null;
    return {
        activate(id) {
            if (pending?.id === id) {
                clearTimeout(pending.timer);
                pending = null;
                onEdit(id);
                return;
            }
            if (pending) {
                clearTimeout(pending.timer);
            }
            const item = {id, timer:null};
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
