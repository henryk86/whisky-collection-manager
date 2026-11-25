import {escapeHtml, query, queryAll} from './ui/dom.js';
import {destructiveFooter} from './ui/modal-layout.js';
import {chooseLanguage, t} from './i18n/index.js';
import {request} from './api.js';
import {toast} from './ui/notifications.js';
import {movePhoto} from './features/photo-order.js';
import {bindFlightSorting} from './features/flight-order.js';
import {routeUrl} from './navigation/routes.js';
import {readAnalyticsDate} from './domain/analytics-period.js';
import {saveCollectionViewPreference}
  from './domain/collection-view-preference.js';
import {activateHelpTopic} from './views/help.js';
import {activateSettingsSection} from './views/settings.js';
import {handleFlavorRange, setFlavorFromPointer} from './ui/flavor-profile.js';
import {loadTemplates} from './ui/templates.js';

const renderTemplate = await loadTemplates('dialogs/events.html');

/**
 * One delegated click handler; HTML data-act values are the UI action names.
 *
 * @param {!Element} root Root element or directory.
 * @param {!Object} options2 Destructured options for this operation.
 */
export function bindEvents(
  root,
  {
    state,
    render,
    action,
    navigate,
    editors,
    settings,
    backup,
    scanner,
    externalImport,
    modal,
    photoViewer,
    photoEditor,
    filePreview,
    theme,
    resolveCode,
    warehouseView,
    detail,
    tastingsView,
    home,
    mapView,
    auth
  }
) {
  /**
   * Coordinates asynchronous work for suggest number.
   *
   * @param {*} fieldName Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  const suggestNumber = async (fieldName) => {
    const result = await request('/api/suggest-number');
    const field = query(`[name=${fieldName}]`);
    if (field) {
      field.value = result.number;
    }
  };
  let pendingConfirmation = null;
  let confirmationBusy = false;
  /**
   * Builds the localized confirm in modal text for the current language.
   *
   * @param {*} title Title displayed or stored by this operation.
   * @param {*} message Message to display or use for diagnostics.
   * @param {*} task Task to execute or examine.
   * @param {string=} buttonLabel Value used by this operation.
   */
  function confirmInModal(title, message, task, buttonLabel =
    'Endgültig löschen') {
    pendingConfirmation = task;
    modal.showModal(
      title,
      renderTemplate('confirmInModalP', {
        message: message,
        destructiveFooter: destructiveFooter({
          cancelLabel: t('common.actions.cancel'),
          acceptLabel: buttonLabel,
          acceptAction: 'confirm-action',
        }),
      })
    );
  }

  /**
   * Updates menu in the current state.
   *
   * @param {*} open Value used by this operation.
   */
  function setMenu(open) {
    const drawer = document.getElementById('site-drawer');
    const backdrop = document.querySelector('.site-drawer-backdrop');
    const button = document.getElementById('menu-button');
    if (!drawer || !backdrop || !button) return;
    drawer.hidden = !open;
    backdrop.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) drawer.querySelector('[data-act="close-menu"]')?.focus();
    else button.focus();
  }
  const handlers = {
    /**
     * Handles the toggle menu interaction.
          * @return {*} Result of this expression.
*/
    'toggle-menu': () =>
      setMenu(document.getElementById('site-drawer')?.hidden !== false),
    /**
     * Handles the close menu interaction.
          * @return {*} Result of this expression.
*/
    'close-menu': () => setMenu(false),
    /**
     * Handles the goto home interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'goto-home': () => navigate('home'),
    /**
     * Handles the goto tastings home interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'goto-tastings-home': () => navigate('tastings-home'),
    /**
     * Handles the goto map interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'goto-map': () => navigate('map'),
    /**
     * Handles the goto help interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'goto-help': () => navigate('help'),
    /**
     * Handles the help tab interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {boolean} Whether the operation matched or succeeded.
     */
    'help-tab': button => activateHelpTopic(button.dataset.helpTopic, button.closest('.help-page')),
    /**
     * Handles the bottling map interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'bottling-map': () => navigate('map', state.selected),
    /**
     * Handles the goto analysis interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'goto-analysis': () => navigate('analytics', 'overview'),
    /**
     * Handles the goto warehouse interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'goto-warehouse': () => navigate('warehouse', 'overview'),
    /**
     * Handles the warehouse section interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-section': button => navigate('warehouse', button.dataset.section),
    /**
     * Handles the settings section interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    'settings-section': async button => {
      if (activateSettingsSection(button.dataset.settingsSection, button.closest('.settings-page'))) {
        state.settingsSection = button.dataset.settingsSection;
        if (state.settingsSection === 'users') await auth.loadUsers();
      }
    },
    /**
     * Handles the warehouse plan mode interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    'warehouse-plan-mode': button => {
      state.warehousePlanMode = ['2d', '3d'].includes(button.dataset.mode) ? button.dataset.mode : '2d'; render();
    },
    /**
     * Handles the warehouse camera interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    'warehouse-camera': button => {
      if (['nw', 'ne', 'se', 'sw'].includes(button.dataset.corner)) {
        state.warehousePlanCorner = button.dataset.corner; render();
      }
    },
    /**
     * Handles the warehouse visibility toggle interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-visibility-toggle': button =>
      warehouseView.toggleFurnitureVisibility(button.dataset.id),
    /**
     * Handles the warehouse show all interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-show-all': () => warehouseView.showAllFurniture(),
    /**
     * Handles the warehouse find interaction.
     */
    'warehouse-find': () => {
      state.warehouseFinderPlacement = 'unassigned'; state.warehouseFinderPage = 1; navigate('warehouse', 'find');
    },
    /**
     * Handles the warehouse find location interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-find-location': button =>
      warehouseView.showBottleLocation(button.dataset.id),
    /**
     * Handles the warehouse return find interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-return-find': () => warehouseView.returnToFinder(),
    /**
     * Handles the warehouse find clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-find-clear': () => warehouseView.clearFindFocus(),
    /**
     * Handles the warehouse find prev interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-find-prev': () => warehouseView.stepFinderPage(-1),
    /**
     * Handles the warehouse find next interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-find-next': () => warehouseView.stepFinderPage(1),
    /**
     * Handles the warehouse open shelves interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-open-shelves': () => navigate('warehouse', 'shelves'),
    /**
     * Handles the warehouse room new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-room-new': () => warehouseView.openForm('room'),
    /**
     * Handles the warehouse rooms transfer interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-rooms-transfer': () => warehouseView.openRoomTransfer(),
    /**
     * Handles the warehouse room edit interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-room-edit': button =>
      warehouseView.openForm('room', button.dataset.id),
    /**
     * Handles the warehouse room delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-room-delete': button =>
      warehouseView.askDelete('room', button.dataset.id),
    /**
     * Handles the warehouse select room interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-select-room': button =>
      warehouseView.selectRoom(button.dataset.id),
    /**
     * Handles the warehouse furniture new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-new': () => warehouseView.openForm('furniture'),
    /**
     * Handles the warehouse furniture manage interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-manage': button =>
      warehouseView.openFurnitureManager(button.dataset.id),
    /**
     * Handles the warehouse furniture bulk interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-bulk': () => warehouseView.openFurnitureBulkManager(),
    /**
     * Handles the warehouse toggle furniture interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-toggle-furniture': button =>
      warehouseView.toggleFurnitureBulkSelection(button.dataset.id),
    /**
     * Handles the warehouse bulk select all interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bulk-select-all': () => warehouseView.selectAllFurniture(),
    /**
     * Handles the warehouse bulk clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bulk-clear': () => warehouseView.clearFurnitureSelection(),
    /**
     * Handles the warehouse bulk edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bulk-edit': () => warehouseView.openForm('furniture-bulk'),
    /**
     * Handles the warehouse bulk delete interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bulk-delete': () => warehouseView.askBulkDelete(),
    /**
     * Handles the warehouse furniture edit interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-edit': button =>
      warehouseView.openForm('furniture', button.dataset.id),
    /**
     * Handles the warehouse furniture copy interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-copy': button =>
      warehouseView.openForm('furniture-copy', button.dataset.id),
    /**
     * Handles the warehouse furniture delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-furniture-delete': button =>
      warehouseView.askDelete('furniture', button.dataset.id),
    /**
     * Handles the warehouse select furniture interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-select-furniture': button =>
      warehouseView.selectFurniture(button.dataset.id),
    /**
     * Handles the warehouse shelf new interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-new': button =>
      warehouseView.openForm('shelf', button.dataset.id),
    /**
     * Handles the warehouse shelf view interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-view': button =>
      warehouseView.openShelfDetails(button.dataset.shelfId || button.dataset.id),
    /**
     * Handles the warehouse shelf up interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-up': button => warehouseView.moveShelf(button.dataset.id, 'up'),
    /**
     * Handles the warehouse shelf down interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-down': button => warehouseView.moveShelf(button.dataset.id, 'down'),
    /**
     * Handles the warehouse shelf edit interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-edit': button =>
      warehouseView.openForm('shelf', button.dataset.id),
    /**
     * Handles the warehouse shelf switch interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-switch': button =>
      warehouseView.switchShelf(button.dataset.target),
    /**
     * Handles the warehouse photo move interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-photo-move': button => warehouseView.moveFurniturePhoto(button.dataset.id, button.dataset.photoId, button.dataset.direction),
    /**
     * Handles the warehouse photo delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-photo-delete': button => warehouseView.deleteFurniturePhoto(button.dataset.id, button.dataset.photoId),
    /**
     * Handles the warehouse photo open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-photo-open': button => warehouseView.openFurniturePhoto(button.dataset.path, button.dataset.title),
    /**
     * Handles the flavor detail undo interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flavor-detail-undo': () => tastingsView.undoFlavor(),
    /**
     * Handles the flavor detail redo interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flavor-detail-redo': () => tastingsView.redoFlavor(),
    /**
     * Handles the tasting flavor clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flavor-clear': () => tastingsView.clearFlavor(),
    /**
     * Handles the tasting rating interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-rating': button =>
      tastingsView.chooseRating(Number(button.dataset.ratingPoints)),
    /**
     * Handles the tasting rating clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-rating-clear': () => tastingsView.chooseRating(null),
    /**
     * Handles the tasting color interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-color': button => tastingsView.chooseColor(button.dataset.colorKey),
    /**
     * Handles the tasting color clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-color-clear': () => tastingsView.chooseColor(null),
    /**
     * Handles the tasting flight back interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-back': () => navigate('tastings-home'),
    /**
     * Handles the tasting back flight interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-back-flight': () => state.flightId && navigate('tasting-flight', state.flightId),
    /**
     * Handles the tasting open flight interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-open-flight': button =>
      navigate('tasting-flight', button.dataset.flightId),
    /**
     * Handles the tasting flight open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-open': button =>
      navigate('tasting-flight', button.dataset.flightId),
    /**
     * Handles the collection view save interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-save': () => home.openSaveView(),
    /**
     * Handles the collection view save confirm interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-save-confirm': () => home.saveCurrentView(),
    /**
     * Handles the collection view update interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-update': () => home.updateCurrentView(),
    /**
     * Handles the collection view rename interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-rename': () => home.renameCurrentView(),
    /**
     * Handles the collection view rename confirm interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-rename-confirm': () => home.confirmRenameView(),
    /**
     * Handles the collection view delete interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-delete': () => home.deleteCurrentView(),
    /**
     * Handles the collection flavor open interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-open': () => home.openFlavorFilter(),
    /**
     * Handles the collection flavor close interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-close': () => home.closeFlavorFilter(),
    /**
     * Handles the collection flavor reset interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-reset': () => home.resetFlavorDraft(),
    /**
     * Handles the collection flavor apply interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-apply': () => home.applyFlavorDraft(),
    /**
     * Handles the collection view apply interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-view-apply': button => home.applySavedView(button.dataset.id),
    /**
     * Handles the collection flavor add interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-add': () => home.addFlavorCriterion(),
    /**
     * Handles the collection flavor remove interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'collection-flavor-remove': button =>
      home.removeFlavorCriterion(button.dataset.axis),
    /**
     * Handles the collection flight plan interaction.
     */
    'collection-flight-plan': () => {
      home.planFromSelection();
      tastingsView.startPlannedFlight();
    },
    /**
     * Handles the flight plan new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-new': () => tastingsView.startPlannedFlight(),
    /**
     * Handles the flight plan help interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-help': () => tastingsView.showFlightPlanningHelp(),
    /**
     * Clears only the planner's cask preferences.
     */
    'flight-plan-cask-reset': () => {tastingsView.resetFlightCaskSelection();},
    /**
     * Handles the flight plan generate interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-generate': () => tastingsView.generateFlightPlan(),
    /**
     * Handles the flight plan create interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-create': () => tastingsView.createPlannedFlight(),
    /**
     * Handles the flight plan add interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-add': () => tastingsView.changePlannedMember(-1, 'add'),
    /**
     * Handles the flight plan move interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-move': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'move', Number(button.dataset.step)),
    /**
     * Handles the flight plan remove interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-remove': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'remove'),
    /**
     * Handles the flight plan replace interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-replace': button => tastingsView.changePlannedMember(Number(button.dataset.index), 'replace'),
    /**
     * Handles the flight plan start interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-start': () =>
      tastingsView.transitionPlannedFlight('inProgress'),
    /**
     * Handles the flight plan finish interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-finish': () =>
      tastingsView.transitionPlannedFlight('completed'),
    /**
     * Handles the flight plan record interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-record': button => navigate('tasting', button.dataset.bottlingId, {tastingId: 'new', flightId: state.selected}),
    /**
     * Handles the flight plan open bottling interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-open-bottling': button => navigate('detail', button.dataset.bottlingId),
    /**
     * Handles the flight plan location interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'flight-plan-location': button => warehouseView.showBottleLocation(button.dataset.bottleId, {returnToFlightId: state.selected}),
    /**
     * Handles the tasting flight new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-new': () => tastingsView.startFlight(),
    /**
     * Handles the tasting flight create confirm interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-create-confirm': () => tastingsView.createFlight(),
    /**
     * Handles the tasting flight edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-edit': () => tastingsView.toggleFlightEdit(true),
    /**
     * Handles the tasting flight cancel edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-cancel-edit': () => tastingsView.toggleFlightEdit(false),
    /**
     * Handles the tasting flight save interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-save': () => tastingsView.saveFlight(),
    /**
     * Handles the tasting flight delete interaction.
          * @return {*} Result of this expression.
*/
    'tasting-flight-delete': () => confirmInModal(
      t('tastingFlights.plural'),
      t('tastingFlights.deleteConfirm'),
      () => tastingsView.deleteFlight(),
      t('common.actions.delete')
    ),
    /**
     * Handles the tasting flight toggle add interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-toggle-add': () => tastingsView.toggleFlightAdd(),
    /**
     * Handles the tasting flight attach interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-attach': () => tastingsView.attachFlightMember(),
    /**
     * Handles the tasting flight remove note interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-remove-note': button =>
      tastingsView.detachFlightMember(button.dataset.tastingId),
    /**
     * Handles the tasting flight move interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-move': button => tastingsView.moveFlightMember(Number(button.dataset.index), Number(button.dataset.direction)),
    /**
     * Handles the tasting flight note open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-note-open': button => button.dataset.external === '1'
      ? navigate('external-tasting', button.dataset.bottlingId, {flightId: state.selected})
      : navigate('tasting', button.dataset.bottlingId, {tastingId: button.dataset.tastingId, flightId: state.selected}),
    /**
     * Handles the tasting flight new owned interaction.
     */
    'tasting-flight-new-owned': () => {
      const id = document.querySelector('[data-flight-owned-bottling]')?.value;
      if (id && state.collection.bottlings.some(b => b.id === id)) navigate('tasting', id, {tastingId: 'new', flightId: state.selected});
    },
    /**
     * Handles the tasting flight new external interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-flight-new-external': () =>
      navigate('external-tasting', 'new', {flightId: state.selected}),
    /**
     * Handles the tastings back detail interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-back-detail': () => navigate('detail', state.selected),
    /**
     * Handles the tastings back home interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-back-home': () => navigate('tastings-home'),
    /**
     * Handles the tastings back list interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-back-list': () => navigate('tastings', state.selected),
    /**
     * Handles the tastings open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-open': button => button.dataset.tastingId
      ? navigate('tasting', state.selected, {tastingId: button.dataset.tastingId})
      : navigate('tastings', state.selected),
    /**
     * Handles the tastings new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-new': () =>
      navigate('tasting', state.selected, {tastingId: 'new'}),
    /**
     * Handles the tastings start choice interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-start-choice': () => tastingsView.toggleCreateChoice(),
    /**
     * Handles the tastings start owned interaction.
     */
    'tastings-start-owned': () => {
      const id = document.querySelector('[data-owned-tasting-bottling]')?.value;
      if (id && state.collection.bottlings.some(b => b.id === id)) navigate('tasting', id, {tastingId: 'new'});
    },
    /**
     * Handles the tastings start external interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-start-external': () => navigate('external-tasting', 'new'),
    /**
     * Handles the tastings home open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tastings-home-open': button => button.dataset.external === '1'
      ? navigate('external-tasting', button.dataset.bottlingId)
      : navigate('tasting', button.dataset.bottlingId, {tastingId: button.dataset.tastingId}),
    /**
     * Handles the tasting create interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-create': () => tastingsView.saveDraft(),
    /**
     * Handles the tasting edit start interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-edit-start': () => tastingsView.startEditing(),
    /**
     * Handles the tasting edit done interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-edit-done': () => tastingsView.finishEditing(),
    /**
     * Handles the tasting open bottling interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-open-bottling': () => navigate('detail', state.selected),
    /**
     * Handles the tasting external edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-edit': () => tastingsView.startExternalEdit(),
    /**
     * Handles the tasting external cancel interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-cancel': () => tastingsView.cancelExternalEdit(),
    /**
     * Handles the tasting external save interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-save': () => tastingsView.persistExternalDetails(),
    /**
     * Handles the tasting external assign interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-assign': () => tastingsView.showAssignDialog(),
    /**
     * Handles the tasting external assign confirm interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'tasting-external-assign-confirm': () =>
      tastingsView.assignExternalToBottling(),
    /**
     * Handles the tasting delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
          * @return {*} Result of this expression.
*/
    'tasting-delete': button => confirmInModal(
      t('tastings.delete'),
      t('tastings.deleteConfirm'),
      async () => {
        const id = button.dataset.tastingId;
        const external = state.page === 'external-tasting';
        const result = await action(
          () => request(
            external ? `/api/external-tastings/${encodeURIComponent(id)}` :
              `/api/bottlings/${encodeURIComponent(state.selected)}/tastings/${encodeURIComponent(id)}`,
            {method: 'DELETE'}
          ),
          {scope: 'collection'}
        );
        if (!result.ok) return result;
        navigate(external ? 'tastings-home' : 'tastings', external ? null : state.selected, {replace: true});
        return result;
      },
      t('common.actions.delete')
    ),
    /**
     * Handles the warehouse shelf copy interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-copy': button =>
      warehouseView.openForm('shelf-copy', button.dataset.id),
    /**
     * Handles the warehouse shelf delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-shelf-delete': button =>
      warehouseView.askDelete('shelf', button.dataset.id),
    /**
     * Handles the warehouse assign interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-assign': button =>
      warehouseView.openForm('assign', button.dataset.id),
    /**
     * Handles the warehouse bottles assign selected interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottles-assign-selected': () =>
      warehouseView.assignSelectedBottles(),
    /**
     * Handles the warehouse bottles select clear interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottles-select-clear': () =>
      warehouseView.clearBottleSelection(),
    /**
     * Handles the warehouse bottles select all interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottles-select-all': () => warehouseView.selectAllBottles(),
    /**
     * Handles the warehouse bottle preview interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottle-preview': button =>
      warehouseView.openBottlePreview(button.dataset.id),
    /**
     * Handles the warehouse bottle select interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottle-select': button =>
      warehouseView.toggleWallBottleSelection(button.dataset.id),
    /**
     * Handles the warehouse bottles preview selected interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-bottles-preview-selected': () =>
      warehouseView.previewSelectedBottle(),
    /**
     * Handles the warehouse unassigned prev interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-unassigned-prev': () => warehouseView.stepUnassignedWallPage(-1),
    /**
     * Handles the warehouse unassigned next interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-unassigned-next': () => warehouseView.stepUnassignedWallPage(1),
    /**
     * Handles the warehouse focus interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Whether the requested condition is met.
     */
    'warehouse-focus': button => {
      // A location link belongs to a physical bottle, not just a shelf.
      // Reuse the finder focus so the exact bottle is visible and marked.
      if (button.dataset.bottleId) {
        warehouseView.showBottleLocation(button.dataset.bottleId, {returnToBottlingId: state.selected});
        return;
      }
      // Existing shelf-only links still open the shelf without a bottle focus.
      const place = state.warehouse?.rooms.find(r => r.furniture.some(f => f.shelves.some(s => s.id === button.dataset.id)));
      if (!place) return navigate('warehouse', 'find');
      state.warehouseRoomId = place.id;
      state.warehouseFurnitureId = place.furniture.find(f => f.shelves.some(s => s.id === button.dataset.id)).id;
      navigate('warehouse', 'shelves');
    },
    /**
     * Handles the warehouse confirm delete interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-confirm-delete': () => warehouseView.deleteConfirmed(),
    /**
     * Handles the warehouse confirm delete unassign interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'warehouse-confirm-delete-unassign': () =>
      warehouseView.deleteConfirmed(true),
    /**
     * Handles the analytics section interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'analytics-section': button => navigate('analytics', button.dataset.section),
    /**
     * Handles the analytics reset interaction.
     */
    'analytics-reset': () => {
      state.analyticsFilters = {distillery: 'all', country: 'all', volumeType: 'all', status: 'all'};
      state.analyticsPeriod = 'month'; state.analyticsStartDate = ''; state.analyticsEndDate = '';
      history.replaceState({whiskyRoute: true}, '', routeUrl('analytics', state.selected));
      render();
    },
    /**
     * Handles the analytics distillery interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    'analytics-distillery': button => {
      state.distillery = button.dataset.id; state.pageNumber = 1; navigate('home');
    },
    /**
     * Handles the analytics drill filter interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    'analytics-drill-filter': button => {
      if (button.dataset.kind === 'country') {
        state.analyticsFilters.country = button.dataset.value;
        history.replaceState({whiskyRoute: true}, '', routeUrl('analytics', state.selected, state.analyticsFilters));
        render(); return;
      }
      if (button.dataset.kind === 'status' && ['closed', 'open', 'empty'].includes(button.dataset.value)) state.status = button.dataset.value;
      else if (button.dataset.kind === 'volumeType' && ['standard', 'sample'].includes(button.dataset.value)) state.volumeType = button.dataset.value;
      state.pageNumber = 1; navigate('home');
    },
    /**
     * Handles the goto settings menu interaction.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    'goto-settings-menu': async () => {
      navigate('settings');
      if (state.backupUnlocked) await backup.refresh(true);
    },
    /**
     * Handles the find distillery location interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'find-distillery-location': () => settings.findDistilleryLocation(),
    /**
     * Handles the apply distillery location interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'apply-distillery-location': button =>
      settings.applyDistilleryLocation(button),
    /**
     * Handles the toggle theme interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'toggle-theme': () => theme.toggleTheme(),
    /**
     * Handles the backup refresh interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-refresh': () => backup.refresh(),
    /**
     * Handles the backup manual download interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-manual-download': () => backup.downloadManual(),
    /**
     * Handles the backup lock interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-lock': () => backup.lock(),
    /**
     * Handles the backup new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-new': () => backup.edit(),
    /**
     * Handles the backup edit interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-edit': button => backup.edit(button.dataset.id),
    /**
     * Handles the backup run interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-run': button => backup.job(button.dataset.id, 'run'),
    /**
     * Handles the backup test interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-test': button => backup.job(button.dataset.id, 'test'),
    /**
     * Handles the backup check interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-check': button => backup.job(button.dataset.id, 'check'),
    /**
     * Handles the backup snapshots interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-snapshots': button => backup.job(button.dataset.id, 'snapshots'),
    /**
     * Handles the backup restore interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-restore': button => backup.restore(button.dataset.id),
    /**
     * Handles the backup prepare interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-prepare': button => backup.job(button.dataset.id, 'prepare', {snapshotId: button.dataset.file}),
    /**
     * Handles the backup download prepared interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-download-prepared': button =>
      backup.downloadPrepared(button.dataset.id),
    /**
     * Handles the backup download interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-download': button => backup.download(button.dataset.id, button.dataset.file),
    /**
     * Handles the backup delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-delete': button => backup.remove(button.dataset.id),
    /**
     * Handles the backup confirm delete interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'backup-confirm-delete': button => backup.confirmDelete(button.dataset.id),
    /**
     * Handles the suggest first interaction.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    'suggest-first': () => suggestNumber('firstInventoryNumber'),
    /**
     * Handles the suggest bottle interaction.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    'suggest-bottle': () => suggestNumber('inventoryNumber'),
    /**
     * Handles the import apply interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-apply': () => externalImport.applyImport(),
    /**
     * Handles the import continue interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-continue': () => externalImport.confirmPendingImport(),
    /**
     * Handles the import existing bottle interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-existing-bottle': () => editors.newBottle(true),
    /**
     * Handles the import existing photo interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-existing-photo': () => externalImport.attachToExistingBottle(),
    /**
     * Handles the import existing edit interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'import-existing-edit': () => externalImport.editExisting(),
    /**
     * Handles the new interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    new: () => editors.newBottling(),
    /**
     * Handles the new bottling direct interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'new-bottling-direct': () => editors.createBottling(),
    /**
     * Handles the back interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    back: () => navigate('home'),
    /**
     * Handles the open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    open: button => {
      const bottleId = button.dataset.bottleId || null;
      navigate('detail', button.dataset.id, {highlightBottleId: bottleId});
      // In bottle mode show the chosen physical bottle, not only its parent
      // bottling.
      if (bottleId) document.getElementById(`bottle-${bottleId}`)?.scrollIntoView({block: 'center', behavior: 'auto'});
    },
    /**
     * Handles the toggle view interaction.
     */
    'toggle-view': () => {
      state.view = state.view === 'cards' ? 'table' : 'cards';
      saveCollectionViewPreference(state.view);
      render();
    },
    /**
     * Handles the edit bottling interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'edit-bottling': () => editors.editBottling(),
    /**
     * Handles the add bottle interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'add-bottle': () => editors.newBottle(),
    /**
     * Handles the edit bottle interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'edit-bottle': button => editors.editBottle(button.dataset.id),
    /**
     * Handles the close modal interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'close-modal': () => modal.closeModal(),
    /**
     * Handles the modal confirm accept interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'modal-confirm-accept': () => modal.acceptConfirmation(),
    /**
     * Handles the modal choice interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'modal-choice': button => modal.acceptChoice(button.dataset.choice),
    /**
     * Handles the add distillery interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'add-distillery': () => settings.promptDistillery(),
    /**
     * Handles the rename distillery interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'rename-distillery': button => settings.promptDistillery(button.dataset.id),
    /**
     * Handles the scan interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    scan: () => scanner.scanCode(),
    /**
     * Handles the scan into bottle interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'scan-into-bottle': () => scanner.scanCode(true),
    /**
     * Handles the submit code interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'submit-code': button => resolveCode(query('[name=manualCode]').value, button.dataset.assign === '1'),
    /**
     * Handles the confirm action interaction.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    'confirm-action': async () => {
      const task = pendingConfirmation;
      if (!task || confirmationBusy) return;
      confirmationBusy = true;
      const confirmation = state.modal;
      try {
        const result = await task();
        if (result?.ok === false || result === false) return;
        pendingConfirmation = null;
        // A successful task may have navigated or closed this modal itself.
        if (state.modal === confirmation) modal.closeModal(true);
      } finally {
        confirmationBusy = false;
      }
    },
    /**
     * Handles the confirm import interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'confirm-import': () => settings.confirmImport(),
    /**
     * Handles the delete file interaction.
     *
     * @param {*} button Button control involved in the interaction.
          * @return {*} Result of this expression.
*/
    'delete-file': button => confirmInModal(
      t("ui.confirmations.deleteAttachment"),
      t("ui.confirmations.deleteAttachmentQuestion"),
      async () => {
        const result = await action(
          () => request(
            `/api/bottles/${encodeURIComponent(button.dataset.id)}/files/${encodeURIComponent(button.dataset.fileId)}`,
            {method: 'DELETE'}
          ),
          {scope: 'collection'}
        );
        if (result.ok) toast(t("ui.confirmations.attachmentDeleted"));
        return result;
      }
    ),
    /**
     * Handles the preview file interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'preview-file': button => filePreview.open(button),
    /**
     * Handles the open photo interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'open-photo': button => photoViewer.open(button),
    /**
     * Handles the photo editor open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-open': button => photoEditor.open(button),
    /**
     * Handles the photo editor tab interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-tab': button => photoEditor.selectTab(button.dataset.photoEditorTab),
    /**
     * Handles the photo editor before interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-before': () => photoEditor.before(),
    /**
     * Handles the photo editor auto interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-auto': () => photoEditor.auto(),
    /**
     * Handles the photo editor reset interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-reset': () => photoEditor.reset(),
    /**
     * Handles the photo editor reset group interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-reset-group': button =>
      photoEditor.resetGroup(button.dataset.photoGroup),
    /**
     * Handles the photo editor pick white interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-pick-white': () => photoEditor.toggleWhitePicker(),
    /**
     * Handles the photo editor brush mode interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-brush-mode': button =>
      photoEditor.toggleBrush(button.dataset.photoBrushMode),
    /**
     * Handles the photo editor brush undo interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-brush-undo': () => photoEditor.undoBrush(),
    /**
     * Handles the photo editor zoom in interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-zoom-in': () => photoEditor.zoom(1.5),
    /**
     * Handles the photo editor zoom out interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-zoom-out': () => photoEditor.zoom(1 / 1.5),
    /**
     * Handles the photo editor zoom reset interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-zoom-reset': () => photoEditor.zoom(0),
    /**
     * Handles the photo editor save interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-save': () => photoEditor.save(),
    /**
     * Handles the photo editor cutout interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-cutout': () => photoEditor.cutout(),
    /**
     * Handles the photo editor toggle cutout interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-toggle-cutout': () => photoEditor.toggleCutout(),
    /**
     * Handles the photo editor remove cutout interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-editor-remove-cutout': () => photoEditor.removeCutout(),
    /**
     * Handles the photo zoom in interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-zoom-in': () => photoViewer.zoom(1.25),
    /**
     * Handles the photo zoom out interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-zoom-out': () => photoViewer.zoom(1 / 1.25),
    /**
     * Handles the photo zoom reset interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-zoom-reset': () => photoViewer.zoom(0),
    /**
     * Handles the photo prev interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-prev': () => photoViewer.step(-1),
    /**
     * Handles the photo next interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    'photo-next': () => photoViewer.step(1),
    /**
     * Handles the move photo interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    'move-photo': button => movePhoto(button.dataset.id, button.dataset.photoId, Number(button.dataset.dir), action),
    /**
     * Handles the delete photo interaction.
     *
     * @param {*} button Button control involved in the interaction.
          * @return {*} Result of this expression.
*/
    'delete-photo': button => confirmInModal(
      t("ui.confirmations.deletePhoto"),
      t("ui.confirmations.deletePhotoQuestion"),
      async () => {
        const result = await action(
          () => request(
            `/api/bottles/${encodeURIComponent(button.dataset.id)}/photos/${encodeURIComponent(button.dataset.photoId)}`,
            {method: 'DELETE'}
          ),
          {scope: 'collection'}
        );
        if (result.ok) toast(t("ui.confirmations.photoDeleted"));
        return result;
      }
    ),
    /**
     * Handles the delete bottle interaction.
     *
     * @param {*} button Button control involved in the interaction.
          * @return {*} Result of this expression.
*/
    'delete-bottle': button => confirmInModal(
      t("ui.confirmations.deleteBottle"),
      t("ui.confirmations.deleteBottleQuestion"),
      async () => {
        const result = await action(() => request(`/api/bottles/${encodeURIComponent(button.dataset.id)}`, {method: 'DELETE'}));
        if (result.ok) toast(t("ui.confirmations.bottleDeleted"));
        return result;
      }
    ),
    /**
     * Handles the delete bottling interaction.
          * @return {*} Result of this expression.
*/
    'delete-bottling': () => confirmInModal(
      t("ui.confirmations.deleteBottling"),
      t("ui.confirmations.deleteBottlingQuestion"),
      async () => {
        const result = await action(() => request(`/api/bottlings/${encodeURIComponent(state.selected)}`, {method: 'DELETE'}));
        if (result.ok) {
          navigate('home', null, {replace: true});
          toast(t("ui.confirmations.bottlingDeleted"));
        }
        return result;
      }
    ),
    /**
     * Handles the import interaction.
     * @return {*} Result computed from the supplied inputs.
     */
    import: () => settings.importJSON(),
  };
  bindFlightSorting(root, (from, to, after) => tastingsView.reorderFlightMember(from, to, after));
  root.addEventListener('click', async (event) => {
    // Treat the flavor and saved-view pickers like anchored menus: clicking
    // elsewhere closes them without affecting the document layout.
    for (const picker of root.querySelectorAll('.collection-saved-menu[open], .collection-flavor-picker[open]')) {
      if (!picker.contains(event.target)) picker.open = false;
    }
    const mapButton = event.target.closest?.('[data-map-focus], [data-map-page], [data-map-bottling], [data-map-edit]');
    if (state.page === 'map' && mapButton) {mapView.handleClick(mapButton); return;}
    const overviewButton = event.target.closest?.(
      '[data-collection-mode], [data-page-to], [data-act="toggle-collection-filters"], [data-act="collection-sort-column"], [data-act="collection-columns-default"], [data-reset-collection-filter], [data-reset-collection-flavor-axis]');
    if (overviewButton && state.page === 'home') {home.handleClick(overviewButton); return;}
    const button = event.target.closest('[data-act]');
    if (!button || button.disabled) {
      return;
    }
    // Opening a whole wall compartment requires a double-click. Keep
    // the single click available for bottle selection and drag gestures.
    // Flaschen im Moebelmanager besitzen einen eigenen Einzel-Detail-Button;
    // nur Doppelklick auf die Fachflaeche oeffnet den Fachinhalt.
    if (button.dataset.act === 'warehouse-shelf-view' && button.classList?.contains('warehouse-wall-bay')) return;
    if (button.tagName === 'A') {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
    }
    try {
      if (button.dataset.act.startsWith('auth-')) {await auth.handleAction(button); return;}
      await handlers[button.dataset.act]?.(button);
    }
    catch (error) {
      toast(error.message, true);
    }
  });
  root.addEventListener('dblclick', event => {
    // A bottle in the room-wide rack opens its own details on double-click.
    // Single clicks still toggle bulk selection; the surrounding bay must
    // never interpret this as a compartment double-click.
    const bottle = event.target.closest?.('.warehouse-room-wall .warehouse-bottle-symbol[data-act="warehouse-bottle-select"]');
    if (bottle?.dataset?.id) {
      try {warehouseView.openBottlePreview(bottle.dataset.id);}
      catch (error) {toast(error.message, true);}
      return;
    }
    const shelf = event.target.closest?.(
      '.warehouse-wall-bay[data-shelf-id], .warehouse-furniture-manager .warehouse-shelf[data-shelf-id]');
    if (!shelf || shelf.dataset?.capacity === '0') return;
    // A bottle is independently selectable and draggable. Double-clicks
    // on bottle symbols or explicit buttons must not also open the shelf.
    const action = event.target.closest?.('[data-act]');
    if (action && action !== shelf) return;
    if (event.target.closest?.('button, a, input, select, textarea')) return;
    try {warehouseView.openShelfDetails(shelf.dataset.shelfId);}
    catch (error) {toast(error.message, true);}
  });
  root.addEventListener('keydown', event => {
    if (event.target.matches?.('[data-whisky-picker-area]') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      tastingsView?.commitCustomPreview?.();
      return;
    }
    if (tastingsView?.nudgeCustomColor?.(event)) return;
    if (!['Enter', ' '].includes(event.key)) return;
    const bay = event.target.closest?.('.warehouse-wall-bay[data-act="warehouse-shelf-view"]');
    if (bay && bay.dataset?.capacity !== '0' && event.target === bay) {
      event.preventDefault();
      warehouseView.openShelfDetails(bay.dataset.shelfId);
    }
  });
  root.addEventListener('input', event => {
    handleFlavorRange(event);
    if (event.target.matches?.('[data-flavor-detail] [data-tasting-score]'))
      tastingsView.previewRating();
  });
  root.addEventListener('change', event => {
    if (event.target.matches?.(
      '[data-flavor-detail] [data-flavor-range], [data-flavor-detail] [data-tasting-note], [data-flavor-detail] [data-tasting-score], [data-flavor-detail] [data-tasting-rating-comment]')) tastingsView.commitFlavor();
    if (event.target.matches?.('[data-flavor-detail] [data-tasting-date], [data-flavor-detail] [data-tasting-title]')) void tastingsView.persistMeta();
  });
  let flavorPointer = null;
  let customColorPointer = null;
  root.addEventListener('pointerdown', event => {
    const picker = event.target?.closest?.('[data-whisky-picker-area]');
    if (picker) {
      customColorPointer = event.pointerId;
      picker.setPointerCapture?.(event.pointerId);
      tastingsView.previewCustomFromPointer(event);
      return;
    }
    const hit = event.target?.closest?.('[data-flavor-hit]');
    if (!hit) return;
    flavorPointer = event.pointerId; hit.setPointerCapture?.(event.pointerId);
    setFlavorFromPointer(event);
  });
  root.addEventListener('pointermove', event => {
    if (customColorPointer === event.pointerId) tastingsView.previewCustomFromPointer(event);
    if (flavorPointer === event.pointerId) setFlavorFromPointer(event);
  });
  root.addEventListener('pointerup', event => {
    if (customColorPointer === event.pointerId) {
      customColorPointer = null;
      tastingsView.previewCustomFromPointer(event);
      tastingsView?.commitCustomPreview?.();
      return;
    }
    if (flavorPointer === event.pointerId) {
      flavorPointer = null; if (event.target.closest?.('[data-flavor-detail]')) tastingsView.commitFlavor();
    }
  });
  root.addEventListener('pointercancel', event => {
    if (customColorPointer === event.pointerId) {
      customColorPointer = null; tastingsView.resetCustomPreview();
    }
    if (flavorPointer === event.pointerId) flavorPointer = null;
  });
  root.addEventListener('keyup', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && event.target.matches?.('[data-whisky-picker-area]'))
      tastingsView.commitCustomPreview();
  });
  root.addEventListener('submit', event => {
    if (auth.handleSubmit(event)) return;
    if (event.target.id === 'new-bottle-choice-form') {
      event.preventDefault();
      try {
        editors.chooseExistingBottling(event.target.elements.bottlingId.value);
      }
      catch (error) {toast(error.message, true);}
      return;
    }
    if (event.target.id === 'warehouse-form') {
      warehouseView.submit(event);
      return;
    } else if (event.target.id === 'backup-password-form') {
      backup.setPassword(event).catch(error => toast(error.message, true));
    } else if (event.target.id === 'backup-unlock-zip-form') {
      backup.unlockPrepared(event).catch(error => toast(error.message, true));
    } else if (event.target.id === 'backup-import-zip-form') {
      backup.uploadZip(event).catch(error => toast(error.message, true));
    } else if (event.target.id === 'backup-apply-zip-form') {
      backup.applyZip(event).catch(error => toast(error.message, true));
    } else if (event.target.id === 'backup-unlock-form') {
      backup.unlock(event).catch(error => toast(error.message, true));
    } else if (event.target.id === 'backup-profile-form') {
      backup.save(event).catch(error => toast(error.message, true));
    } else if (event.target.id === 'backup-restore-form') {
      backup.submitRestore(event).catch(error => toast(error.message, true));
    } else if (event.target.id === 'collection-settings-form') {
      settings.saveCollectionSettings(event).catch(error => toast(error.message, true));
    } else if (event.target.id === 'distillery-form') {
      settings.saveDistillery(event).catch(error => toast(error.message, true));
    } else {
      editors.handleForm(event).catch(error => toast(error.message, true));
    }
  });
  root.addEventListener('change', event => {
    if (state.page === 'map' && event.target.matches?.('#map-site-select, #map-all-distilleries')) {
      mapView.handleChange(event.target); return;
    }
    if (state.page === 'home' && event.target.matches?.(
      '#pagination-size, [id^=filter-], [data-collection-column], #collection-add-flavor-axis, [data-flavor-profile-status], [data-flavor-axis]')) {home.handleChange(event.target); return;}
    if (event.target.matches?.('input[data-bottle-files], input[data-bottle-photos]')) {
      void detail.handleUploadChange(event); return;
    }
    if (event.target.matches?.('input[data-furniture-photos]')) {
      warehouseView.uploadFurniturePhotos(event.target.dataset.furniturePhotos, [...event.target.files]); return;
    }
    if (event.target.matches?.([
      '[data-flight-plan-style]', '[data-flight-plan-count]',
      '[data-flight-plan-availability]', '[data-flight-plan-focus]',
      '[name="flight-plan-unfamiliar"]', '[data-flight-plan-cask-mode]',
      '[name^="flight-cask-"]', '[data-flight-plan-cask-phase]',
      '[data-flight-plan-age-mode]', '[data-flight-plan-age-min]',
      '[data-flight-plan-age-max]', '[name="flight-plan-strict"]',
    ].join(', '))) {
      tastingsView.invalidateFlightPlan(); return;
    }
    if (event.target.id === 'ui-language') {
      chooseLanguage(event.target.value); return;
    }
    if (event.target.dataset.sectionSwitch === 'analytics') {
      navigate('analytics', event.target.value);
      return;
    }
    if (event.target.dataset.sectionSwitch === 'warehouse') {
      navigate('warehouse', event.target.value);
      return;
    }
    if (event.target.dataset.sectionSwitch === 'settings') {
      if (activateSettingsSection(event.target.value, event.target.closest('.settings-page'))) state.settingsSection = event.target.value;
      return;
    }
    if (event.target.dataset.sectionSwitch === 'help') {
      activateHelpTopic(event.target.value, event.target.closest('.help-page'));
      return;
    }
    if (event.target.name === 'type' && event.target.closest?.('#warehouse-form')?.dataset.newFurniture === 'true') {
      const form = event.target.closest('#warehouse-form');
      const bottom = form.querySelector('[name="elevation"]');
      const height = form.querySelector('[name="itemHeight"]');
      if (bottom && height) {
        if (event.target.value === 'haengeregal' && Number(bottom.value) === 0 && Number(height.value) === 1.8) {
          bottom.value = '1.9'; height.value = '0.4';
        } else if (event.target.value !== 'haengeregal' && Number(bottom.value) === 1.9 && Number(height.value) === 0.4) {
          bottom.value = '0'; height.value = '1.8';
        }
      }
      return;
    }
    if (event.target.matches('.warehouse-bottle-check')) {
      warehouseView.toggleBottleSelection(event.target.dataset.id, event.target.checked); return;
    }
    if (event.target.id === 'warehouse-room-select') {
      warehouseView.selectRoom(event.target.value, state.selected === 'shelves' ? 'shelves' : 'rooms'); return;
    }
    if (event.target.id === 'warehouse-plan-layer') {
      state.warehousePlanLevel = event.target.value; render(); return;
    }
    if (event.target.id === 'warehouse-plan-zoom') {
      state.warehousePlanZoom = [100, 150, 200].includes(Number(event.target.value)) ? Number(event.target.value) : 100; warehouseView.update3DZoom(state.warehousePlanZoom);
      return;
    }
    if (event.target.name === 'warehouse-find-placement') {
      warehouseView.setFinderPlacement(event.target.value); return;
    }
    const filter = event.target.dataset.analyticsFilter;
    if (filter && ['distillery', 'country', 'volumeType', 'status'].includes(filter)) {
      state.analyticsFilters[filter] = event.target.value;
      history.replaceState({whiskyRoute: true}, '', routeUrl('analytics', state.selected, state.analyticsFilters));
      render();
      return;
    }
    if (event.target.id === 'analytics-period') {
      state.analyticsPeriod = event.target.value === 'year' ? 'year' : 'month'; render(); return;
    }
    if (event.target.dataset.analyticsBoundary) {
      const boundary = event.target.dataset.analyticsBoundary;
      if (boundary === 'start' || boundary === 'end') {
        const key = boundary === 'start' ? 'analyticsStartDate' : 'analyticsEndDate';
        state[key] = readAnalyticsDate(event.target.value);
        render();
        return;
      }
    }
    if (event.target.matches('#backup-profile-form [name=provider]')) backup.toggleFields(event.target.form);
    if (event.target.id === 'scan-file') {
      scanner.scanImage(event.target.files?.[0]);
    }
  });
  root.addEventListener('input', event => {
    if (state.page === 'map' && event.target.matches?.('#map-bottling-search, #map-missing-search')) {
      mapView.handleInput(event.target); return;
    }
    if (state.page === 'home' && event.target.id === 'search') {home.handleInput(event.target); return;}
    if (event.target.id === 'warehouse-unassigned-wall-search') {
      warehouseView.setUnassignedWallSearch(event.target.value); return;
    }
    if (event.target.id === 'warehouse-search') {
      warehouseView.setFinderQuery(event.target.value); return;
    }
    if (event.target.id === 'bottling-choice-search') {
      editors.filterExistingBottlings(event.target.value);
    }
    if (event.target.id === 'distillery-search') {
      state.distillerySearch = event.target.value;
      const term = state.distillerySearch.trim().toLocaleLowerCase('de');
      const list = query('.distillery-list');
      if (!list) return;
      let count = 0;
      const rows = queryAll('.distillery-row', list);
      for (const row of rows) {
        const match = row.querySelector('strong').textContent.toLocaleLowerCase('de').includes(term);
        row.hidden = !match;
        if (match) count++;
      }
      const counter = query('#distillery-count');
      if (counter) counter.textContent = `${count} von ${rows.length}`;
      const empty = query('.distillery-no-results', list);
      if (empty) empty.hidden = count > 0;
      list.scrollTop = 0;
    }
    if (event.target.matches('.distillery-filter')) {
      const term = event.target.value.trim().toLocaleLowerCase('de');
      const panel = event.target.parentElement;
      queryAll('.distillery-option', panel).forEach(label => {
        const checked = label.querySelector('input').checked;
        label.hidden = !checked && !label.textContent.toLocaleLowerCase('de').includes(term);
      });
    }
  });
  document.addEventListener('keydown', event => {
    // Sidebar buttons are native buttons: Tab and Enter/Space work without
    // special handling. ArrowUp/Down and Home/End offer fast navigation.
    if (event.target.matches?.('.section-nav-desktop .section-nav-item')) {
      const items = [...event.target.closest('.section-nav-desktop').querySelectorAll('.section-nav-item')];
      const current = items.indexOf(event.target);
      let next = current;
      if (event.key === 'ArrowDown') next = (current + 1) % items.length;
      else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      if (next !== current) {
        event.preventDefault();
        items[next].click();
        document.querySelector(`.section-nav-desktop .section-nav-item:nth-child(${next + 1})`)?.focus();
        return;
      }
    }
    if (event.key === 'Escape' && state.page === 'home' && !state.modal) {
      const openPicker = document.querySelector('.collection-flavor-picker[open], .collection-saved-menu[open]');
      if (openPicker) {
        openPicker.open = false; openPicker.querySelector('summary')?.focus(); return;
      }
    }
    if (event.key === 'Escape' && state.modal) {
      modal.closeModal();
    } else if (event.key === 'Escape' && document.getElementById('site-drawer')?.hidden === false) {
      setMenu(false);
    }
    if (photoViewer.isOpen() && event.key === 'ArrowLeft') {
      event.preventDefault();
      photoViewer.step(-1);
    } else if (photoViewer.isOpen() && event.key === 'ArrowRight') {
      event.preventDefault();
      photoViewer.step(1);
    }
    // Non-button cards/brand elements also support keyboard activation.
    if (['Enter', ' '].includes(event.key) && event.target.matches('.whisky-card, .brand, tr.clickable[data-act], .warehouse-iso-object')
    ) {
      event.preventDefault();
      event.target.click();
    }
  });
}
