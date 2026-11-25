import {t} from '../i18n/index.js';
import {escapeHtml, query, queryAll} from './dom.js';
import {createPhotoZoom} from './photo-zoom.js';
import {minusIcon, plusIcon, arrowLeftIcon, arrowRightIcon}
  from './action-icons.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/photo-viewer.html', import.meta.url));


/**
 * A photo lightbox inside the application's existing modal system. The source
 * comes from an already rendered local <img>; do not accept arbitrary URLs or
 * open new tabs. Nested mode preserves unsaved editor form DOM nodes.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createPhotoViewer({state, showModal}) {
  let photos = [];
  let active = 0;
  const photoZoom = createPhotoZoom();

  /**
   * Locates the DOM elements used by photo from.
   *
   * @param {*} button Button control involved in the interaction.
   * @return {!Object} Computed value, or null when the input has no match.
   */
  function photoFrom(button) {
    const img = button?.querySelector('img');
    const src = img?.getAttribute('src');
    if (!src || !src.startsWith('/') || src.startsWith('//')) return null;
    return {src, alt: img.getAttribute('alt') || t("ui.photos.bottlePhoto")};
  }

  /**
   * Controls the photo viewer state.
   *
   * @param {*} button Button used by this operation.
   */
  function open(button) {
    if (!button) return;
    let buttons = [button];
    const ownGallery = button.closest('[data-photo-list]');
    if (ownGallery) {
      buttons = queryAll('[data-act="open-photo"]', ownGallery);
    } else if (button.matches('[data-bottle-photo-preview]')) {
      // The preview repeats the first sorted image, not a second gallery
      // entry. Limit navigation to this exact physical bottle.
      const gallery = button.closest('.bottle-entry')?.querySelector(
        '[data-photo-list]');
      if (gallery) buttons = queryAll('[data-act="open-photo"]', gallery);
    } else if (button.matches('.hero-photo-open')) {
      // The large cover photo belongs to a physical bottle; enable
      // gallery navigation for that bottle rather than for all bottles.
      const cover = photoFrom(button);
      const matchingThumb = cover &&
        queryAll('.bottle-photos [data-act="open-photo"]')
          .find(candidate => photoFrom(candidate)?.src === cover.src);
      const gallery = matchingThumb?.closest('[data-photo-list]');
      if (gallery) buttons = queryAll('[data-act="open-photo"]', gallery);
    }

    const selection = buttons.map(photoFrom).filter(Boolean);
    if (!selection.length) return;
    const clicked = photoFrom(button);
    const selectedIndex = selection.findIndex(photo => photo.src ===
      clicked?.src);
    photos = selection;
    active = selectedIndex < 0 ? 0 : selectedIndex;
    const photo = photos[active];
    const multiple = photos.length > 1;

    showModal(t("ui.photos.bottlePhoto"), renderTemplate('photoLightbox', {
      src: photo.src,
      alt: photo.alt,
      alt2: photo.alt,
      minusIcon: minusIcon,
      plusIcon: plusIcon,
      photoPrev: multiple ? renderTemplate('photoPrev', {
        arrowLeftIcon: arrowLeftIcon,
        active: active +
          1,
        length: photos.length,
        arrowRightIcon: arrowRightIcon,
      }) : '',
    }), true, Boolean(state.modal), '', 'photo');
    photoZoom.attach();
    query('.dialog .dialog-head [data-act="close-modal"]')?.focus();
  }

  /**
   * Checks whether open applies.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  function isOpen() {
    return Boolean(query('.photo-lightbox'));
  }

  /**
   * Derives the step result from the supplied values.
   *
   * @param {*} direction Direction used for traversal or movement.
   */
  function step(direction) {
    if (!isOpen() || photos.length < 2) return;
    active = (active + (direction < 0 ? -1 : 1) + photos.length) %
      photos.length;
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
    photoZoom.reset();
  }

  return {open, step, isOpen, zoom: photoZoom.zoom};
}
