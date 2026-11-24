import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';

export const cloneFlavor = value => value == null ? null :
  Object.fromEntries(FLAVOR_AXES.map(key => [key, value[key]]));

export const sameFlavor = (left, right) => left === null || right === null
  ? left === right : FLAVOR_AXES.every(axis => left[axis] === right[axis]);

/** A single-page undo/redo stack; redo is discarded when a new edit is made. */
export function createFlavorHistory(initial) {
  const entries = [cloneFlavor(initial)];
  let cursor = 0;
  return {
    get value() {return cloneFlavor(entries[cursor]);},
    get canUndo() {return cursor > 0;},
    get canRedo() {return cursor < entries.length - 1;},
    record(value) {
      if (sameFlavor(entries[cursor], value)) return false;
      entries.splice(cursor + 1);
      entries.push(cloneFlavor(value));
      cursor++;
      return true;
    },
    undo() {if (cursor === 0) return false; cursor--; return true;},
    redo() {
      if (cursor >= entries.length -
        1) return false; cursor++; return true;
    },
  };
}
