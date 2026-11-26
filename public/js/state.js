import {getPageSizePreference} from './domain/page-size-preference.js';
import {getCollectionViewPreference}
  from './domain/collection-view-preference.js';

/**
 * UI state only. Persistent data is replaced by GET /api/collection after
 * mutations.
 *
 * @param {*} route Parsed initial navigation route, including selected records and filter state.
 * @return {!Object} Structured result for the caller.
 */
export function createState(route) {
  return {
    collection: null,
    warehouse: null,
    warehouseRoomId: route.roomId || null,
    warehouseFurnitureId: route.furnitureId || null,
    warehouseSearch: '',
    warehouseFinderPage: 1,
    warehouseFinderPlacement: 'all',
    warehouseFindReturn: false,
    warehouseFindFocusBottleId: null,
    warehouseFindReturnBottlingId: null,
    warehouseFindReturnFlightId: null,
    warehouseSelectedFurnitureIds: [],
    warehouseHiddenFurnitureIds: [],
    warehouseUnassigned: false,
    warehousePlanMode: '3d',
    warehousePlanCorner: 'nw',
    warehousePlanZoom: 100,
    version: '',
    auth: {required: false, user: null, canManageUsers: false},
    authUsers: null,
    page: route.page,
    selected: route.selected,
    tastingId: route.tastingId || null,
    flightId: route.flightId || null,
    search: '',
    status: 'all',
    distillery: 'all',
    volumeType: 'all',
    rating: 'all',
    flavorCriteria: [],
    profileMissing: false,
    profilePresent: false,
    activeSavedViewId: null,
    flightCandidateIds: null,
    completion: 'all',
    view: getCollectionViewPreference(),
    overviewMode: 'bottlings',
    sort: 'name',
    pageNumber: 1,
    pageSize: getPageSizePreference(),
    analyticsFilters: route.filters || {distillery: 'all', country: 'all', status: 'all', volumeType: 'all'},
    analyticsPeriod: 'month',
    analyticsStartDate: '',
    analyticsEndDate: '',
    distillerySearch: '',
    modal: null,
    backupUnlocked: false,
    backupDashboard: null,
    backupError: '',
    scanner: null,
    scanReturn: null,
    highlightBottleId: null,
  };
}
