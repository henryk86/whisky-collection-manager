import { t } from '../i18n/index.js';
import { escapeHtml, query, queryAll } from './dom.js';

/**
 * A photo lightbox inside the application's existing modal system.
 * The source comes from an already rendered local <img>; do not accept arbitrary
 * URLs or open new tabs. Nested mode preserves unsaved editor form DOM nodes.
 */
export function createPhotoViewer({ state, showModal }) {
    let photos = [];
    let active = 0;

    function photoFrom(button) {
        const img = button?.querySelector('img');
        const src = img?.getAttribute('src');
        if (!src || !src.startsWith('/') || src.startsWith('//')) return null;
        return { src, alt: img.getAttribute('alt') || t("ui.photos.bottlePhoto") };
    }

    function open(button) {
        if (!button) return;
        let buttons = [button];
        const ownGallery = button.closest('[data-photo-list]');
        if (ownGallery) {
            buttons = queryAll('[data-act="open-photo"]', ownGallery);
        } else if (button.matches('.hero-photo-open')) {
            // The large cover photo belongs to a physical bottle; enable
            // gallery navigation for that bottle rather than for all bottles.
            const cover = photoFrom(button);
            const matchingThumb = cover && queryAll('.bottle-photos [data-act="open-photo"]')
                .find(candidate => photoFrom(candidate)?.src === cover.src);
            const gallery = matchingThumb?.closest('[data-photo-list]');
            if (gallery) buttons = queryAll('[data-act="open-photo"]', gallery);
        }

        const selection = buttons.map(photoFrom).filter(Boolean);
        if (!selection.length) return;
        const clicked = photoFrom(button);
        const selectedIndex = selection.findIndex(photo => photo.src === clicked?.src);
        photos = selection;
        active = selectedIndex < 0 ? 0 : selectedIndex;
        const photo = photos[active];
        const multiple = photos.length > 1;

        showModal(t("ui.photos.bottlePhoto"), `<figure class="photo-lightbox">
    <div class="photo-lightbox-stage">
    <img class="photo-lightbox-image" src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt)}">
    </div>
    <figcaption class="photo-lightbox-footer">
    <span class="photo-lightbox-caption">${escapeHtml(photo.alt)}</span>
    ${multiple ? `<span class="photo-lightbox-navigation">
    <button type="button" class="btn small" data-act="photo-prev" aria-label="${t("ui.photos.previous")}">←</button>
    <span class="photo-lightbox-count" aria-live="polite">${active + 1} / ${photos.length}</span>
    <button type="button" class="btn small" data-act="photo-next" aria-label="${t("ui.photos.next")}">→</button>
    </span>` : ''}
    </figcaption>
    </figure>`, true, Boolean(state.modal));
        query('.dialog .dialog-head [data-act="close-modal"]')?.focus();
    }

    function isOpen() {
        return Boolean(query('.photo-lightbox'));
    }

    function step(direction) {
        if (!isOpen() || photos.length < 2) return;
        active = (active + (direction < 0 ? -1 : 1) + photos.length) % photos.length;
        const photo = photos[active];
        const image = query('.photo-lightbox-image');
        const caption = query('.photo-lightbox-caption');
        const counter = query('.photo-lightbox-count');
        if (image) {
            image.src = photo.src;
            image.alt = photo.alt;
        }
        if (caption) caption.textContent = photo.alt;
        if (counter) counter.textContent = `${active + 1} / ${photos.length}`;
    }

    return { open, step, isOpen };
}
