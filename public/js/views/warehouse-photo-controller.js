

import {t} from '../i18n/index.js';

import {toast} from '../ui/notifications.js';
import {imageData} from '../features/photos.js';
import {request} from '../api.js';

import {findFurniture, shelfPanel} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse.html');

/**
 * Manages furniture photo upload, ordering, removal, and preview.
 * @param {!Object} options Controller dependencies.
 * @return {!Object} Public controller actions and presentation.
 */
export function createWarehousePhotoController({w, modal, refresh, attachBottlePhotos}) {
  /**
   * Performs the refresh furniture modal lifecycle action.
   */
  function refreshFurnitureModal() {
    const manager = document.querySelector('#modal-root .warehouse-furniture-manager');
    if (!manager) return;
    const found = findFurniture(w(), manager.dataset.furnitureId);
    if (!found) return;
    modal.updateContent(
      renderTemplate('warehouseFurnitureManager2', {
        furnitureId: String(found.furniture.id ?? ''),
        shelfPanel: shelfPanel(w(), found.room, found.furniture, {managementOnly: true}),
      }));
    attachBottlePhotos();
  }

  /**
   * Serializes upload furniture photos data to JSON.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} files Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function uploadFurniturePhotos(id, files) {
    if (!files.length) return;
    try {
      for (const file of files) await request(
        `/api/warehouse/furniture/${encodeURIComponent(id)}/photos`,
        {
          method: 'POST', body: JSON.stringify({image: await imageData(file)}),
        }
      );
      await refresh(); refreshFurnitureModal();
    } catch (error) {
      toast(error.message, true); await refresh();
      refreshFurnitureModal();
    }
  }

  /**
   * Serializes move furniture photo data to JSON.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} photoId Value used by this operation.
   * @param {*} direction Direction used for traversal or movement.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function moveFurniturePhoto(id, photoId, direction) {
    const found = findFurniture(w(), id); if (!found) return;
    const order = (found.furniture.photos || []).map(photo => photo.id);
    const index = order.indexOf(photoId), target = index + Number(direction);
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    try {
      await request(
        `/api/warehouse/furniture/${encodeURIComponent(id)}/photos/order`,
        {
          method: 'PUT', body: JSON.stringify({photoIds: order}),
        }
      );
      await refresh(); refreshFurnitureModal();
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Performs the open furniture photo lifecycle action.
   *
   * @param {*} path Path to the target resource.
   * @param {*} title Title displayed or stored by this operation.
   */
  function openFurniturePhoto(path, title) {
    if (!/^images\/[\w-]+\/furniture-[\w-]+\.(?:jpg|png|webp|gif)$/.test(path)) return;
    modal.showModal(
      title,
      renderTemplate('warehousePhotoLightbox', {
        src: String(path ?? ''),
        alt: String(title ?? ''),
      }),
      true
    );
  }

  /**
   * Removes or resets furniture photo.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} photoId Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function deleteFurniturePhoto(id, photoId) {
    if (!await modal.confirm(t('warehouse.photos.remove'), t('warehouse.photos.removeConfirm'), t('common.actions.remove'))) return;
    try {
      await request(
        `/api/warehouse/furniture/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,
        {method: 'DELETE'}
      );
      await refresh(); refreshFurnitureModal();
    } catch (error) {toast(error.message, true);}
  }

  return {refreshFurnitureModal, uploadFurniturePhotos, moveFurniturePhoto, openFurniturePhoto, deleteFurniturePhoto};
}
