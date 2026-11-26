import {cloneFlavor} from './flavor-history.js';
import {normalizeTastingNotes} from '../../../shared/tasting.js';
/**
 * Copies a tasting record for editing without mutating the source.
 *
 * @param {*} value Input value to process.
 * @return {!Object} Independent copy of the tasting values used by the editor.
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
 * @return {!Object} History operations and accessors for the active tasting snapshot.
 */
export function createTastingHistory(value) {
  const entries = [cloneTasting(value)];
  let index = 0;
  return {
    /**
     * Returns a defensive copy of the current tasting-history entry.
     * @return {*} Independent copy of the selected tasting snapshot.
     */
    get value() {return cloneTasting(entries[index]);},
    /**
     * Checks whether undo applies.
     * @return {boolean} True when an earlier tasting snapshot exists.
     */
    get canUndo() {return index > 0;},
    /**
     * Checks whether redo applies.
     * @return {boolean} True when a later tasting snapshot exists.
     */
    get canRedo() {return index < entries.length - 1;},
    /**
     * Serializes record data to JSON.
     *
     * @param {*} value Value to process.
     * @return {boolean} True if a distinct snapshot was appended and the redo history was discarded.
     */
    record(value) {
      const next = cloneTasting(value);
      if (JSON.stringify(entries[index]) === JSON.stringify(next)) return false;
      entries.splice(index + 1); entries.push(next); index++; return true;
    },
    /**
     * Moves the tasting-history cursor back by one entry.
     * @return {boolean} True if an earlier tasting snapshot was selected.
     */
    undo() {if (index === 0) return false; index--; return true;},
    /**
     * Moves the tasting-history cursor forward by one entry.
     * @return {boolean} True if a later tasting snapshot was selected.
     */
    redo() {
      if (index >= entries.length - 1) return false; index++; return true;
    },
  };
}
