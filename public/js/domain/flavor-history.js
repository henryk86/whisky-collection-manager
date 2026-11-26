import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';

/**
 * Copies a flavour profile without sharing mutable nested values.
 *
 * @param {*} value Input value to process.
 * @return {?Object} Independent copy of the flavor axes, or null for an unset profile.
 */
export const cloneFlavor = value => value == null ? null : Object.fromEntries(FLAVOR_AXES.map(key => [key, value[key]]));

/**
 * Compares flavour profiles for equivalent values.
 *
 * @param {*} left First flavor profile, or null when absent.
 * @param {*} right Second flavor profile, or null when absent.
 * @return {boolean} True when both profiles contain equal values on every flavor axis or are both null.
 */
export const sameFlavor = (left, right) => left === null || right === null ? left === right : FLAVOR_AXES.every(axis => left[axis] === right[axis]);

/**
 * A single-page undo/redo stack; redo is discarded when a new edit is made.
 *
 * @param {*} initial Starting flavor profile or null; cloned into the undo history.
 * @return {!Object} History operations and accessors for the selected flavor-profile snapshot.
 */
export function createFlavorHistory(initial) {
  const entries = [cloneFlavor(initial)];
  let cursor = 0;
  return {
    /**
     * Returns a defensive copy of the current flavor-profile history entry.
     * @return {*} Independent copy of the selected flavor profile.
     */
    get value() {return cloneFlavor(entries[cursor]);},
    /**
     * Checks whether undo applies.
     * @return {boolean} True when an earlier history entry exists.
     */
    get canUndo() {return cursor > 0;},
    /**
     * Checks whether redo applies.
     * @return {boolean} True when a later history entry exists.
     */
    get canRedo() {return cursor < entries.length - 1;},
    /**
     * Appends a changed sensory profile to history and discards the redo branch.
     *
     * @param {*} value Profile to snapshot.
     * @return {boolean} True when a new history entry was added.
     */
    record(value) {
      if (sameFlavor(entries[cursor], value)) return false;
      entries.splice(cursor + 1);
      entries.push(cloneFlavor(value));
      cursor++;
      return true;
    },
    /**
     * Moves the flavor-history cursor back by one entry.
     * @return {boolean} True if an earlier history entry was selected.
     */
    undo() {if (cursor === 0) return false; cursor--; return true;},
    /**
     * Moves the flavor-history cursor forward by one entry.
     * @return {boolean} True if a later history entry was selected.
     */
    redo() {
      if (cursor >= entries.length - 1) return false; cursor++; return true;
    },
  };
}
