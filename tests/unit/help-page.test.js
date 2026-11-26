import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute, routeUrl} from '../../public/js/navigation/routes.js';
import {MAIN_PAGES} from '../../public/js/navigation/pages.js';
import {HELP_TOPICS, activateHelpTopic} from '../../public/js/views/help.js';

test(
  'help route and drawer destination work on direct navigation and reload',
  () => {
    assert.deepEqual(parseRoute('?view=help'), {page: 'help', selected: null});
    assert.equal(routeUrl('help'), '/?view=help');
    assert.ok(MAIN_PAGES.some(item => item.id === 'help' && item.action === 'goto-help' && item.url === '/?view=help'));
  }
);

test(
  'selecting help topics synchronizes sidebar, selector and visible panel without navigating',
  () => {
    /**
     * Constructs button from the supplied data.
     *
     * @param {*} topic Value used by this operation.
     * @return {!Object} Result computed from the supplied inputs.
     */
    const makeButton = topic => ({
      dataset: {helpTopic: topic.id}, attrs: {},
      classList: {
        active: topic.id === 'basics',
        /**
         * Updates the toggle state for its caller.
         *
         * @param {*} name Environment variable or setting name.
         * @param {*} active Value used by this operation.
         */
        toggle(name, active) {if (name === 'active') this.active = active;},
      },
      /**
       * Updates attribute in the current state.
       *
       * @param {*} name Environment variable or setting name.
       * @param {*} value Value to process.
       */
      setAttribute(name, value) {this.attrs[name] = value;},
      /**
       * Removes or resets attribute.
       *
       * @param {*} name Environment variable or setting name.
       */
      removeAttribute(name) {delete this.attrs[name];},
    });
    const buttons = HELP_TOPICS.map(makeButton);
    const panels = HELP_TOPICS.map(topic => ({id: `help-panel-${topic.id}`, hidden: topic.id !== 'basics'}));
    const selector = {value: 'basics'};
    const container = {
      /**
       * Derives the query selector all result from the supplied values.
       *
       * @param {*} query Search query or filter conditions.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll(query) {
        return query === '.help-section' ? panels : buttons;
      },
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {*} query Search query or filter conditions.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector(query) {
        return query === '[data-section-switch="help"]' ? selector : null;
      },
    };
    assert.equal(activateHelpTopic('storage', container), true);
    assert.deepEqual(
      buttons.filter(button => button.classList.active).map(button => button.dataset.helpTopic),
      ['storage']
    );
    assert.equal(buttons.find(button => button.dataset.helpTopic === 'storage').attrs['aria-current'], 'page');
    assert.equal(buttons.find(button => button.dataset.helpTopic === 'basics').attrs['aria-current'], undefined);
    assert.equal(selector.value, 'storage');
    assert.deepEqual(panels.filter(panel => !panel.hidden).map(panel => panel.id), ['help-panel-storage']);
    assert.equal(activateHelpTopic('not-a-topic', container), false);
    assert.equal(selector.value, 'storage');
  }
);
