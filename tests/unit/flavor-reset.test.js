import test from 'node:test';
import assert from 'node:assert/strict';
import {displayFlavorProfile, readFlavorProfile, handleFlavorRange}
  from '../../public/js/ui/flavor-profile.js';
import {createTastingHistory} from '../../public/js/domain/tasting-history.js';
import {FLAVOR_AXES} from '../../shared/flavor-profile.js';

const axes = FLAVOR_AXES;
test(
  'clear radar restores true null state, not a recorded all-zero profile; \
undo works',
  () => {
    const sliders = axes.map(axis => ({value: 0, name: axis}));
    const editor = {
      dataset: {flavorSet: '1'},
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {*} query Search query or filter conditions.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector(query) {
        const axis = query.match(/name="flavor-([^"]+)"/)?.[1];
        return sliders.find(s => s.name === axis) || null;
      },
    };
    const container = {
      /**
       * Derives the matches result from the supplied values.
       * @return {boolean} Whether the operation matched or succeeded.
       */
      matches: () => false,
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {*} query Search query or filter conditions.
       * @return {!Object} Computed value, or null when the input has no match.
       */
      querySelector(query) {
        if (query === '[data-flavor-editor]') return editor;
        const index = query.match(/data-flavor-range="(\d+)"/)?.[1];
        if (index !== undefined) return sliders[Number(index)];
        if (query === '[data-flavor-polygon]') return {
          /**
           * Updates attribute in the current state.
           */
          setAttribute() {},
        };
        return null;
      },
    };
    const value = Object.fromEntries(axes.map((axis, index) => [axis, index]));
    const history = createTastingHistory({
      flavorProfile: value, tastingNotes:
        {nose: '', palate: '', finish: ''},
    });
    history.record({...history.value, flavorProfile: null});
    displayFlavorProfile(container, history.value.flavorProfile);
    assert.equal(editor.dataset.flavorSet, '');
    assert.equal(readFlavorProfile(container), null);
    assert.deepEqual(sliders.map(x => x.value), axes.map(() => '0'));
    assert.equal(history.undo(), true);
    displayFlavorProfile(container, history.value.flavorProfile);
    assert.equal(editor.dataset.flavorSet, '1');
    assert.deepEqual(readFlavorProfile(container), value);
  }
);

test(
  'editing a legacy tasting does not convert unassessed aromas into zero, \
including undo',
  () => {
    const previous = {
      woody: 8,
      cereal: 3,
      peaty: 6,
      fruity: 4,
      floral: 2,
      winey: 1,
      feinty: 7,
      sulphury: 0,
    };
    const scores = {...previous, smoky: null, medicinal: null};
    const markers = axes.map(() => ({
      /**
       * Updates attribute in the current state.
       */
      setAttribute() {},
    }));
    const outputs = axes.map(() => ({textContent: ''}));
    const editor = {
      dataset: {flavorSet: '1'},
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector input for this
       * operation.
       * @return {*} Computed value, or null when the input has no match.
       */
      querySelector(selector) {
        const axis = selector.match(/name="flavor-([^"]+)"/)?.[1];
        if (axis) return sliders.find(slider => slider.name === axis);
        if (selector === '[data-flavor-polygon]') return {
          /**
           * Updates attribute in the current state.
           */
          setAttribute() {},
        };
        const point = selector.match(/data-flavor-point="(\d+)"/)?.[1];
        if (point !== undefined) return markers[Number(point)];
        const output = selector.match(/data-flavor-value="(\d+)"/)?.[1];
        if (output !== undefined) return outputs[Number(output)];
        return null;
      },
    };
    const sliders = axes.map(axis => ({
      name: axis,
      value: '0',
      dataset: {},
      /**
       * Performs the closest lifecycle action.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      closest(selector) {
        return selector === '[data-flavor-range]' ? this :
          editor;
      },
    }));
    const container = {
      /**
       * Derives the matches result from the supplied values.
       * @return {boolean} Whether the operation matched or succeeded.
       */
      matches: () => false,
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector input for this
       * operation.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector(selector) {
        if (selector === '[data-flavor-editor]') return editor;
        const index = selector.match(/data-flavor-range="(\d+)"/)?.[1];
        return index !== undefined ? sliders[Number(index)] : null;
      },
    };
    displayFlavorProfile(container, scores);
    assert.deepEqual(
      readFlavorProfile(container),
      Object.fromEntries(axes.map(axis => [axis, scores[axis]]))
    );
    for (const axis of ['smoky', 'medicinal'])
      assert.equal(
        sliders.find(slider => slider.name === axis).dataset.flavorUnset,
        '1'
      );
    const smoky = sliders.find(slider => slider.name === 'smoky');
    smoky.value = '0';
    assert.equal(handleFlavorRange({target: smoky}), true);
    assert.equal(readFlavorProfile(container).smoky, 0);
    assert.equal(readFlavorProfile(container).medicinal, null);
    displayFlavorProfile(container, scores);
    assert.equal(
      readFlavorProfile(container).smoky,
      null,
      'undo restores missing aroma'
    );
    assert.equal(outputs[axes.indexOf('smoky')].textContent, '–');
  }
);
