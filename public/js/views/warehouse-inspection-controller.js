import {t} from '../i18n/index.js';
import {toast} from '../ui/notifications.js';
import {bottlePreview, findFurniture, shelfPanel} from './warehouse-presentation.js';
import {shelfContents} from './warehouse-shelf-details.js';
import {renderWarehouseSelectionPanel} from './warehouse-selection-panel.js';
import {createWarehouseSelectionModel} from './models/warehouse.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse.html');

/**
 * Coordinates inspection and management dialogs without mounting the workspace.
 * @param {!Object} options Warehouse state, navigation context and modal services.
 * @return {!Object} Inspection dialog actions.
 */
export function createWarehouseInspectionController({w, state, currentRoom, modal, attachBottlePhotos}) {
  /**
 * The single-furniture dialog deliberately has no navigation or bulk
 * selection.
 *
 * @param {string=} id Identifier used to select the relevant record.
 * @return {boolean} Whether the condition is satisfied.
 */
  function openFurnitureManager(id = state.warehouseFurnitureId) {
    const data = w();
    const found = id ? findFurniture(data, id) : null;
    if (!found) return false;
    state.warehouseRoomId = found.room.id;
    state.warehouseFurnitureId = found.furniture.id;
    modal.showModal(
      found.furniture.name,
      renderTemplate('warehouseFurnitureManager', {
        furnitureId: String(found.furniture.id ?? ''),
        shelfPanel: shelfPanel(data, found.room, found.furniture, {managementOnly: true}),
      }),
      true
    );
    attachBottlePhotos();
    return true;
  }

  /**
 * Batch changes are a separate workflow, never part of the shelf editor.
 *
 * @return {boolean} Whether the condition is satisfied.
 */
  function openFurnitureBulkManager() {
    const room = currentRoom();
    if (!room) return false;
    modal.showModal(
      t('warehouse.bulk.manageAction'),
      renderTemplate('warehouseFurnitureBulkManager', {selectionPanel: renderWarehouseSelectionPanel(createWarehouseSelectionModel(w(), state, room)), }),
      true
    );
    return true;
  }

  /**
   * Performs the open shelf details lifecycle action.
   *
   * @param {*} id Identifier of the affected record.
   * @return {*} Whether the required condition is satisfied.
   */
  function openShelfDetails(id) {
    const contents = shelfContents(w(), id, state.collection?.bottlings);
    if (!contents) return toast(t('warehouse.shelves.notFound'), true);
    if (contents.unavailable) return false;
    modal.showModal(contents.title, contents.html, true, true);
    attachBottlePhotos();
    return true;
  }

  /**
 * In the 3D room plan, only occupied bays open the existing shelf modal. In
 * particular, this must neither navigate nor open furniture editing.
 *
 * @param {string} id Identifier used to select the relevant record.
 * @return {(boolean|void)} Result of the open occupied shelf details
 * operation.
 */
  function openOccupiedShelfDetails(id) {
    const contents = shelfContents(w(), id, state.collection?.bottlings);
    if (!contents || contents.unavailable || contents.count === 0) return false;
    return openShelfDetails(id);
  }

  /**
   * Performs the open bottle preview lifecycle action.
   *
   * @param {*} id Identifier of the affected record.
      * @return {*} Result of this expression.
*/
  function openBottlePreview(id) {
    const bottle = w()?.bottles.find(entry => entry.id === id);
    if (!bottle) return toast(t('features.errors.bottleNotFound'), true);
    const bottling = state.collection?.bottlings.find(entry => entry.id === bottle.bottlingId);
    const physicalBottle = bottling?.bottles.find(entry => entry.id === bottle.id);
    modal.showModal(t('warehouse.bottles.detailsTitle'), bottlePreview(w(), bottle, bottling, physicalBottle));
  }

  return {openFurnitureManager, openFurnitureBulkManager, openShelfDetails, openOccupiedShelfDetails, openBottlePreview};
}
