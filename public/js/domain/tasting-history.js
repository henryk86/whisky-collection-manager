import {cloneFlavor} from './flavor-history.js';
import {normalizeTastingNotes} from '../../../shared/tasting.js';
/**
 * Copies a tasting record for editing without mutating the source.
 *
 * @param {*} value Input value to process.
 * @return {!Object} Structured result for the caller.
 */
export function cloneTasting(value) {
  return {
    flavorProfile: cloneFlavor(value.flavorProfile),
    tastingNotes: normalizeTastingNotes(value.tastingNotes),
    rating: value.rating ?? null,
    ratingComment: value.ratingComment ?? '',
    whiskyColor: value.whiskyColor ?? null,
  };
}

/**
 * History belongs to a single opened detail page; redo is invalidated on edit.
 *
 * @param {*} value Input value to process.
 * @return {!Object} Structured result for the caller.
 */
export function createTastingHistory(value) {
  const entries = [cloneTasting(value)];
  let index = 0;
  return {
    /**
     * Reads the value property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get value() {return cloneTasting(entries[index]);},
    /**
     * Checks whether undo applies.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    get canUndo() {return index > 0;},
    /**
     * Checks whether redo applies.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    get canRedo() {return index < entries.length - 1;},
    /**
     * Serializes record data to JSON.
     *
     * @param {*} value Value to process.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    record(value) {
      const next = cloneTasting(value);
      if (JSON.stringify(entries[index]) === JSON.stringify(next)) return false;
      entries.splice(index + 1); entries.push(next); index++; return true;
    },
    /**
     * Performs the undo lifecycle action.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    undo() {if (index === 0) return false; index--; return true;},
    /**
     * Performs the redo lifecycle action.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    redo() {
      if (index >= entries.length - 1) return false; index++; return true;
    },
  };
}
