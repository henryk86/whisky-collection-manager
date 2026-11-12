import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPhotoViewer } from '../../public/js/ui/photo-viewer.js';

function thumbnail(src, alt, gallery) {
    const image = { getAttribute: key => ({ src, alt })[key] || null };
    return {
        querySelector: key => key === 'img' ? image : null,
        closest: key => key === '[data-photo-list]' ? gallery : null,
        matches: () => false,
    };
}

function harness({ nested = false, enableHero = false, images = ['/images/one.png', '/images/two.png'] } = {}) {
    let opened = false;
    let html = '';
    const gallery = { querySelectorAll: () => buttons };
    const buttons = images.map((name, index) => thumbnail(name, `Foto ${index + 1}`, gallery));
    const currentImage = { src: '', alt: '' };
    const caption = { textContent: '' };
    const counter = { textContent: '' };
    const focus = { called: false, focus() { this.called = true; } };
    const original = globalThis.document;
    globalThis.document = {
        querySelector(selector) {
            if (selector === '.dialog .dialog-head [data-act="close-modal"]') return focus;
            if (selector === '.photo-lightbox') return opened ? {} : null;
            if (selector === '.photo-lightbox-image') return currentImage;
            if (selector === '.photo-lightbox-caption') return caption;
            if (selector === '.photo-lightbox-count') return counter;
            return null;
        },
        querySelectorAll(selector) {
            return enableHero && selector === '.bottle-photos [data-act="open-photo"]' ? buttons : [];
        },
    };
    const calls = [];
    const viewer = createPhotoViewer({
        state: { modal: nested ? { title: 'Bearbeiten' } : null },
        showModal(title, content, wide, keepParent) {
            calls.push({ title, content, wide, keepParent });
            opened = true;
            html = content;
        },
    });
    return {
        viewer, buttons, calls, focus, currentImage, caption, counter,
        get html() { return html; },
        close() { opened = false; },
        restore() { globalThis.document = original; },
    };
}

test('photo thumbnails open in the in-app modal, preserve form when nested, and navigate within one bottle', () => {
    const h = harness({ nested: true });
    try {
        h.viewer.open(h.buttons[1]);
        assert.equal(h.calls.length, 1);
        assert.equal(h.calls[0].title, 'Flaschenfoto');
        assert.equal(h.calls[0].wide, true);
        assert.equal(h.calls[0].keepParent, true, 'existing editor must remain in the modal stack');
        assert.match(h.html, /src="\/images\/two\.png"/);
        assert.match(h.html, /2 \/ 2/);
        assert.match(h.html, /data-act="photo-prev"/);
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
    } finally { h.restore(); }
});

test('single photo needs no navigation; untrusted image URLs are ignored', () => {
    const h = harness({ images: ['/images/only.png'] });
    try {
        h.viewer.open(h.buttons[0]);
        assert.match(h.html, /src="\/images\/only\.png"/);
        assert.doesNotMatch(h.html, /data-act="photo-next"/);
        assert.equal(h.calls[0].keepParent, false);
        h.viewer.step(1);
        assert.equal(h.currentImage.src, '');
    } finally { h.restore(); }
    const unsafe = harness({ images: ['https://untrusted.invalid/image.png'] });
    try {
        unsafe.viewer.open(unsafe.buttons[0]);
        assert.equal(unsafe.calls.length, 0);
    } finally { unsafe.restore(); }
});


test('clicking the large cover image opens the matching physical bottle gallery', () => {
    const h = harness({ enableHero: true });
    try {
        const hero = {
            querySelector: selector => selector === 'img' ? {
                getAttribute: attr => attr === 'src' ? '/images/two.png' : 'Flaschenfoto',
            } : null,
            closest: () => null,
            matches: selector => selector === '.hero-photo-open',
        };
        h.viewer.open(hero);
        assert.equal(h.calls.length, 1);
        assert.match(h.html, /src="\/images\/two\.png"/);
        assert.match(h.html, /2 \/ 2/);
        h.viewer.step(1);
        assert.equal(h.currentImage.src, '/images/one.png', 'cover viewer continues within same bottle gallery');
    } finally { h.restore(); }
});
test('photo markup is escaped and old new-tab photo links are gone', () => {
    const h = harness({ images: ['/images/test.png'] });
    try {
        h.buttons[0].querySelector = () => ({ getAttribute: key => key === 'src' ? '/images/test.png' : '"<script>alert(1)</script>' });
        h.viewer.open(h.buttons[0]);
        assert.doesNotMatch(h.html, /<script>/);
        assert.match(h.html, /&lt;script&gt;/);
    } finally { h.restore(); }
    const detail = fs.readFileSync('public/js/views/detail.js', 'utf8');
    assert.match(detail, /class="photo-open" data-act="open-photo"/);
    assert.match(detail, /class="hero-photo hero-photo-open" data-act="open-photo"/);
    assert.doesNotMatch(detail, /href="\$\{imageUrl\(photo\.path\)\}" target="_blank"/);
    const preview = fs.readFileSync('public/js/features/whiskybase/controller.js', 'utf8');
    assert.match(preview, /class="wb-preview-photo-open" data-act="open-photo"/);
    const events = fs.readFileSync('public/js/events.js', 'utf8');
    assert.match(events, /'photo-next': \(\) => photoViewer\.step\(1\)/);
});
