import {domElements, domText} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoViewer} from '../../public/js/ui/photo-viewer.js';

/**
 * Derives the thumbnail result from the supplied values.
 *
 * @param {*} src Value used by this operation.
 * @param {*} alt Value used by this operation.
 * @param {*} gallery Value used by this operation.
 * @return {!Object} Structured result assembled from the input data.
 */
function thumbnail(src, alt, gallery) {
  const image = {
    /**
     * Retrieves attribute from the available state.
     *
     * @param {*} key Key used to select or group values.
     * @return {*} Result computed from the supplied inputs.
     */
    getAttribute: key => ({src, alt})[key] || null,
  };
  return {
    /**
     * Derives the query selector result from the supplied values.
     *
     * @param {*} key Key used to select or group values.
     * @return {!Object} Result computed from the supplied inputs.
     */
    querySelector: key => key === 'img' ? image : null,
    /**
     * Performs the closest lifecycle action.
     *
     * @param {*} key Key used to select or group values.
     * @return {*} Result computed from the supplied inputs.
     */
    closest: key => key === '[data-photo-list]' ? gallery : null,
    /**
     * Simulates an element that does not match the selector.
     * @return {boolean} Always false in this selector fixture.
     */
    matches: () => false,
  };
}

/**
 * Transforms the entries used by harness.
 *
 * @param {!Object=} options Options controlling the operation.
 * @return {!Array<*>} Resulting entries in their output order.
 */
function harness({
  nested = false,
  enableHero = false,
  images = ['/images/one.png', '/images/two.png']
} = {}) {
  let opened = false;
  let html = '';
  const gallery = {
    /**
     * Derives the query selector all result from the supplied values.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    querySelectorAll: () => buttons,
  };
  const buttons = images.map((name, index) => thumbnail(name, `Foto ${index + 1}`, gallery));
  const currentImage = {src: '', alt: ''};
  const caption = {textContent: ''};
  const counter = {textContent: ''};
  const focus = {
    called: false,
    /**
     * Updates the focus state for its caller.
     */
    focus() {this.called = true;},
  };
  const original = globalThis.document;
  globalThis.document = {
    /**
     * Derives the query selector result from the supplied values.
     *
     * @param {function(...*): *} selector Selector used to obtain matching
     *     values.
     * @return {*} Computed value, or null when the input has no match.
     */
    querySelector(selector) {
      if (selector === '.dialog .dialog-head [data-act="close-modal"]')
        return focus;
      if (selector === '.photo-lightbox') return opened ? {} : null;
      if (selector === '.photo-lightbox-image') return currentImage;
      if (selector === '.photo-lightbox-caption') return caption;
      if (selector === '.photo-lightbox-count') return counter;
      return null;
    },
    /**
     * Derives the query selector all result from the supplied values.
     *
     * @param {function(...*): *} selector Selector used to obtain matching
     *     values.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    querySelectorAll(selector) {
      return enableHero && selector === '.bottle-photos [data-act="open-photo"]' ? buttons : [];
    },
  };
  const calls = [];
  const viewer = createPhotoViewer({
    state: {modal: nested ? {title: 'Bearbeiten'} : null},
    /**
     * Renders modal in the current view.
     *
     * @param {*} title Title displayed or stored by this operation.
     * @param {*} content Content to render, store or examine.
     * @param {*} wide Value used by this operation.
     * @param {*} keepParent Value used by this operation.
     */
    showModal(title, content, wide, keepParent) {
      calls.push({title, content, wide, keepParent});
      opened = true;
      html = content;
    },
  });
  return {
    viewer, buttons, calls, focus, currentImage, caption, counter,
    /**
     * Reads the html property from the current state.
     * @return {import('../../public/js/ui/render-plan.js').RenderContent} Last captured photo-viewer content.
     */
    get html() {return html;},
    /**
     * Performs the close lifecycle action.
     */
    close() {opened = false;},
    /**
     * Updates the restore state for its caller.
     */
    restore() {globalThis.document = original;},
  };
}

test(
  'photo thumbnails open in the in-app modal, preserve form when nested, and navigate within one bottle',
  async () => {
    const h = harness({nested: true});
    try {
      h.viewer.open(h.buttons[1]);
      assert.equal(h.calls.length, 1);
      assert.equal(h.calls[0].title, 'Flaschenfoto');
      assert.equal(h.calls[0].wide, true);
      assert.equal(h.calls[0].keepParent, true, 'existing editor must remain in the modal stack');
      assert.ok((await domElements(h.html, '[src="/images/two.png"]')).length > 0);
      assert.match(await domText(h.html), /2 \/ 2/);
      assert.ok((await domElements(h.html, '[data-act="photo-prev"]')).length > 0);
      assert.ok((await domElements(h.html, '[data-act="photo-zoom-in"]')).length > 0);
      assert.ok((await domElements(h.html, '[data-act="photo-zoom-out"]')).length > 0);
      assert.ok((await domElements(h.html, '[data-act="photo-zoom-reset"]')).length > 0);
      assert.equal(h.focus.called, true);
      assert.equal(h.viewer.isOpen(), true);
      h.viewer.step(-1);
      assert.equal(h.currentImage.src, '/images/one.png');
      assert.equal(h.currentImage.alt, 'Foto 1');
      assert.equal(h.counter.textContent, '1 / 2');
      h.viewer.step(-1);
      assert.equal(h.currentImage.src, '/images/two.png', 'previous wraps to last photo');
      h.close();
      assert.equal(h.viewer.isOpen(), false);
      h.viewer.step(1);
      assert.equal(h.currentImage.src, '/images/two.png', 'closed view must not change');
    } finally {h.restore();}
  }
);

test(
  'single photo needs no navigation; untrusted image URLs are ignored',
  async () => {
    const h = harness({images: ['/images/only.png']});
    try {
      h.viewer.open(h.buttons[0]);
      assert.ok((await domElements(h.html, '[src="/images/only.png"]')).length > 0);
      assert.equal((await domElements(h.html, '[data-act="photo-next"]')).length, 0);
      assert.ok((await domElements(h.html, '[data-act="photo-zoom-in"]')).length > 0, 'single photos remain zoomable');
      assert.equal(h.calls[0].keepParent, false);
      h.viewer.step(1);
      assert.equal(h.currentImage.src, '');
    } finally {h.restore();}
    const unsafe = harness({images: ['https://untrusted.invalid/image.png']});
    try {
      unsafe.viewer.open(unsafe.buttons[0]);
      assert.equal(unsafe.calls.length, 0);
    } finally {unsafe.restore();}
  }
);

test(
  'clicking the large cover image opens the matching physical bottle gallery',
  async () => {
    const h = harness({enableHero: true});
    try {
      const hero = {
        /**
         * Derives the query selector result from the supplied values.
         *
         * @param {function(...*): *} selector Selector input for this
         * operation.
         * @return {!Object} Structured result assembled from the input data.
         */
        querySelector: selector => selector === 'img' ? {
          /**
           * Retrieves attribute from the available state.
           *
           * @param {*} attr Value used by this operation.
           * @return {*} Result computed from the supplied inputs.
           */
          getAttribute: attr => attr === 'src' ? '/images/two.png' : 'Flaschenfoto',
        } : null,
        /**
         * Performs the closest lifecycle action.
         * @return {*} Result computed from the supplied inputs.
         */
        closest: () => null,
        /**
         * Derives the matches result from the supplied values.
         *
         * @param {function(...*): *} selector Selector input for this
         * operation.
         * @return {boolean} Whether the operation matched or succeeded.
         */
        matches: selector => selector === '.hero-photo-open',
      };
      h.viewer.open(hero);
      assert.equal(h.calls.length, 1);
      assert.ok((await domElements(h.html, '[src="/images/two.png"]')).length > 0);
      assert.match(await domText(h.html), /2 \/ 2/);
      h.viewer.step(1);
      assert.equal(h.currentImage.src, '/images/one.png', 'cover viewer continues within same bottle gallery');
    } finally {h.restore();}
  }
);

test('photo markup is escaped and old new-tab photo links are gone', async () => {
  const h = harness({images: ['/images/test.png']});
  try {
    h.buttons[0].querySelector = () => ({
      /**
       * Retrieves attribute from the available state.
       *
       * @param {*} key Key used to select or group values.
       * @return {*} Result computed from the supplied inputs.
       */
      getAttribute: key => key === 'src' ? '/images/test.png' : '"<script>alert(1)</script>',
    });
    h.viewer.open(h.buttons[0]);
    assert.equal((await domElements(h.html, 'script')).length, 0);
    assert.match(await domText(h.html), new RegExp("<script>"));
  } finally {h.restore();}
});

test(
  'the large physical bottle preview opens only its own sorted photo gallery',
  async () => {
    const h = harness();
    try {
      const gallery = {
        /**
         * Derives the query selector all result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        querySelectorAll: () => h.buttons,
      };
      const bottle = {
        /**
         * Derives the query selector result from the supplied values.
         *
         * @param {function(...*): *} selector Selector input for this
         * operation.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        querySelector: selector => selector === '[data-photo-list]' ? gallery : null,
      };
      const preview = {
        /**
         * Derives the query selector result from the supplied values.
         *
         * @param {function(...*): *} selector Selector input for this
         * operation.
         * @return {!Object} Structured result assembled from the input data.
         */
        querySelector: selector => selector === 'img' ? {
          /**
           * Retrieves attribute from the available state.
           *
           * @param {*} key Key used to select or group values.
           * @return {*} Result computed from the supplied inputs.
           */
          getAttribute: key => key === 'src' ? '/images/one.png' : 'Flaschenfoto',
        } : null,
        /**
         * Performs the closest lifecycle action.
         *
         * @param {function(...*): *} selector Selector input for this
         * operation.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        closest: selector => selector === '[data-bottle-entry]' || selector === '.bottle-entry' ? bottle : null,
        /**
         * Derives the matches result from the supplied values.
         *
         * @param {function(...*): *} selector Selector input for this
         * operation.
         * @return {boolean} Whether the operation matched or succeeded.
         */
        matches: selector => selector === '[data-bottle-photo-preview]',
      };
      h.viewer.open(preview);
      assert.match(await domText(h.html), /1 \/ 2/);
      h.viewer.step(1);
      assert.equal(h.currentImage.src, '/images/two.png');
    } finally {h.restore();}
  }
);
