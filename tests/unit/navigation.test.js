import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavigation} from '../../public/js/navigation/controller.js';
/**
 * Prepares the navigation.test state.
 *
 * @return {!Object} Structured result for the caller.
 */
function setup() {
  const calls = [];
  const state = {
    page: 'home', selected: null, modal: null,
  };
  const browser = {
    location: {
      pathname: '/', search: '',
    },
    history: {},
    /**
     * Derives the scroll to result from the supplied values.
     *
     * @param {!Array<*>} args Arguments forwarded to the operation.
     * @return {number} Calculated numeric value.
     */
    scrollTo: (...args) => calls.push(['scroll', ...args]),
    /**
     * Updates the add event listener state for its caller.
     *
     * @param {*} event Event that triggered this operation.
     * @param {function(...*): *} callback Callback invoked by the operation.
     */
    addEventListener: (event, callback) => {
      browser[event] = callback;
    },
  };
  for (const method of ['pushState', 'replaceState']) {
    browser.history[method] = (data, title, url) => {
      calls.push([method, url]);
      const parsed = new URL(url, 'http://localhost');
      browser.location = {
        pathname: parsed.pathname, search: parsed.search,
      };
    };
  }
  const controller = createNavigation({
    state, browser,
    /**
     * Derives the render result from the supplied values.
     * @return {number} Calculated numeric value.
     */
    render: () => calls.push(['render']),
    /**
     * Performs the close modal lifecycle action.
     */
    closeModal: () => {
      state.modal = null;
      calls.push(['close']);
    },
  });
  return {
    state, browser, calls, ...controller,
  };
}
test(
  'scan navigation scrolls to the page top and preserves bottle highlighting',
  () => {
    const context = setup();
    context.navigate('detail', 'bottling-a', {highlightBottleId: 'bottle-a', });
    assert.equal(context.state.highlightBottleId, 'bottle-a');
    assert.deepEqual(
      context.calls,
      [
        ['pushState', '/?bottling=bottling-a'],
        ['render'],
        ['scroll', {top: 0, left: 0, behavior: 'instant'}],
      ]
    );
  }
);
test('same route does not add duplicate history entries', () => {
  const context = setup();
  context.navigate('settings');
  context.navigate('settings');
  assert.equal(context.calls.filter(call => call[0] === 'pushState').length, 1);
});
test(
  'popstate restores the route, closes dialogs and clears old highlights',
  () => {
    const context = setup();
    context.listen();
    context.state.modal = {};
    context.state.highlightBottleId = 'bottle-a';
    context.browser.location.search = '?bottling=bottling-b';
    context.browser.popstate();
    assert.equal(context.state.page, 'detail');
    assert.equal(context.state.selected, 'bottling-b');
    assert.equal(context.state.modal, null);
    assert.equal(context.state.highlightBottleId, null);
    assert.deepEqual(context.calls, [['close'], ['render']]);
  }
);

test(
  'navigation retains bottle overview across detail visits and restores mode and page with back/forward',
  () => {
    const context = setup();
    context.state.overviewMode = 'bottles';
    context.state.pageNumber = 3;
    context.navigate('home');
    assert.equal(context.calls[0][1], '/?mode=bottles&page=3');
    context.navigate('detail', 'bottling-a', {highlightBottleId: 'bottle-a'});
    assert.equal(context.state.highlightBottleId, 'bottle-a');
    context.navigate('home');
    assert.equal(context.browser.location.search, '?mode=bottles&page=3');
    context.listen();
    context.browser.location.search = '?mode=bottles&page=2';
    context.browser.popstate();
    assert.equal(context.state.overviewMode, 'bottles');
    assert.equal(context.state.pageNumber, 2);
    context.browser.location.search = '';
    context.browser.popstate();
    assert.equal(context.state.overviewMode, 'bottlings');
    assert.equal(context.state.pageNumber, 1);
  }
);
