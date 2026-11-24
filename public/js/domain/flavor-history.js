import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';

/**
 * Copies a flavour profile without sharing mutable nested values.
 *
 * @param {*} value Input value to process.
 * @return {?Object} Entries transformed for the consuming code.
 */
export const cloneFlavor = value => value == null ? null :
  Object.fromEntries(FLAVOR_AXES.map(key => [key, value[key]]));

/**
 * Compares flavour profiles for equivalent values.
 *
 * @param {*} left Left used by this operation.
 * @param {*} right Right used by this operation.
 * @return {boolean} Whether the condition is satisfied.
 */
export const sameFlavor = (left, right) => left === null || right === null
  ? left === right : FLAVOR_AXES.every(axis => left[axis] === right[axis]);

/**
 * A single-page undo/redo stack; redo is discarded when a new edit is made.
 *
 * @param {*} initial Initial used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export function createFlavorHistory(initial) {
  const entries = [cloneFlavor(initial)];
  let cursor = 0;
  return {
    /**
     * Reads the value property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get value() {return cloneFlavor(entries[cursor]);},
    /**
     * Checks whether undo applies.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    get canUndo() {return cursor > 0;},
    /**
     * Checks whether redo applies.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    get canRedo() {return cursor < entries.length - 1;},
    /**
     * Derives the record result from the supplied values.
     *
     * @param {*} value Value to process.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    record(value) {
      if (sameFlavor(entries[cursor], value)) return false;
      entries.splice(cursor + 1);
      entries.push(cloneFlavor(value));
      cursor++;
      return true;
    },
    /**
     * Performs the undo lifecycle action.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    undo() {if (cursor === 0) return false; cursor--; return true;},
    /**
     * Performs the redo lifecycle action.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    redo() {
      if (cursor >= entries.length -
        1) return false; cursor++; return true;
    },
  };
}
