import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapSidebarViewModel} from
  '../../public/js/views/models/map.js';
import {createSettingsViewModel} from
  '../../public/js/views/models/settings.js';
import {createBackupDashboardViewModel} from
  '../../public/js/views/models/backups.js';
import {formatTemplateFile} from '../../scripts/format-html-templates.js';

test('view models filter and paginate without mutating their inputs', () => {
  const sites = [{id: 'a', bottlings: [{name: 'Alpha'}, {name: 'Beta'}]}];
  const result = createMapSidebarViewModel(sites, 'a', 'ALPHA', 99, 1);
  assert.equal(result.currentPage, 1);
  assert.deepEqual(result.subset, [{name: 'Alpha'}]);
  const state = {
    collection: {distilleries: [{name: 'Zulu'}, {name: 'Alpha'}], }, distillerySearch: ' alpha ',
  };
  const before = structuredClone(state);
  const model = createSettingsViewModel(state);
  assert.equal(model.matchCount, 1);
  assert.equal(model.distilleries[0].name, 'Alpha');
  assert.deepEqual(state, before);
});

test('backup view model groups snapshots and limits recent jobs', () => {
  const profile = {id: 'a', format: 'zip'};
  const job = {profileId: 'a', type: 'run'};
  const model = createBackupDashboardViewModel({
    profiles: [profile],
    jobs: Array(20).fill(job), snapshots: {a: Array(20).fill({id: 's'})},
  });
  assert.equal(model.jobs.length, 12);
  assert.equal(model.profileRows[0].snapshots.length, 15);
  assert.equal(model.profileRows[0].legacy, false);
  assert.equal(model.profileRows[0].last, job);
});

test('HTML formatter is idempotent and preserves inline and raw text', () => {
  const source = '<!-- wcm-template:example -->\r\n' + '<div><p>Hello <strong>{{text:name}}</strong> !</p></div>\r\n' +
    '<textarea>  unchanged\n text </textarea>\r\n' +
    '<!-- /wcm-template -->\r\n';
  const formatted = formatTemplateFile(source);
  assert.equal(formatTemplateFile(formatted), formatted);
  assert.doesNotMatch(formatted, /\r/);
  assert.match(formatted, /Hello <strong>\{\{text:name\}\}<\/strong> !/);
  assert.match(formatted, /<textarea>  unchanged\n text <\/textarea>/);
});

test('analytics chart models calculate widths and date-window totals without changing source rows', async () => {
  const {createRankBarViewModel, aggregateAnalyticsPeriods} = await import('../../public/js/views/models/analytics.js');
  const rows = [{name: '2026-01-02', count: 10}, {name: '2026-01-08', count: 5}, {name: '2026-02-01', count: 1}];
  const before = structuredClone(rows);
  const bars = createRankBarViewModel(rows, 'count', 2);
  assert.deepEqual(bars.data.map(entry => entry.width), [100, 50]);
  assert.equal(bars.hasMore, true);
  assert.deepEqual(aggregateAnalyticsPeriods(rows, {analyticsStartDate: '2026-01-03'}, 'count'), [{name: '2026-01', count: 5}, {name: '2026-02', count: 1}]);
  assert.deepEqual(rows, before);
});

test('warehouse room view model prepares room capacity and normalizes invalid plan preferences', async () => {
  const {createWarehouseRoomViewModel} = await import('../../public/js/views/models/warehouse.js');
  const warehouse = {
    rooms: [{id: 'room', furniture: [{shelves: [{id: 'shelf', capacity: 8}]}]}],
    bottles: [{id: 'bottle'}], assignments: {bottle: 'shelf'},
  };
  const state = {warehousePlanLevel: 'invalid', warehousePlanMode: 'invalid', warehousePlanCorner: 'invalid', warehousePlanZoom: 999};
  const before = structuredClone({warehouse, state});
  const model = createWarehouseRoomViewModel(warehouse, state);
  assert.deepEqual(model.rooms[0].capacity, {occupied: 1, defined: 8, unlimited: 0, shelves: 1});
  assert.deepEqual([model.level, model.planMode, model.planCorner, model.zoom], ['all', '3d', 'nw', 100]);
  assert.deepEqual({warehouse, state}, before);
});

test('tasting editor view model resolves saved records, missing routes and draft defaults', async () => {
  const {createTastingEditorViewModel} = await import('../../public/js/views/models/tastings.js');
  const record = {id: 'tasting', title: 'A tasting'};
  const state = {page: 'tasting', selected: 'bottling', tastingId: 'tasting', flightId: 'flight', collection: {bottlings: [{id: 'bottling', tastings: [record]}], tastingFlights: [{id: 'flight', tastingIds: ['tasting']}]}};
  const before = structuredClone(state);
  const model = createTastingEditorViewModel(state);
  assert.equal(model.value, record);
  assert.equal(model.backAction, 'tasting-back-flight');
  assert.deepEqual(state, before);
  assert.equal(createTastingEditorViewModel({...state, tastingId: 'new'}).draft, true);
  assert.deepEqual(createTastingEditorViewModel({...state, selected: 'missing'}).redirect, {page: 'tastings-home', selected: null});
});

test('warehouse geometry and shelf contents preserve source records and physical occupancy', async () => {
  const {createRoomDiagramModel, createShelfContentsModel} = await import('../../public/js/views/models/warehouse-details.js');
  const {createWarehouseSelectionModel} = await import('../../public/js/views/models/warehouse.js');
  const room = {id: 'r', name: 'Room', width: 3, height: 2, furniture: [{id: 'f', name: 'Cabinet', width: 1, depth: 0.5, x: 1, y: 0.5, rotation: 0, shelves: [{id: 's', name: 'Shelf', capacity: 4}]}]};
  const warehouse = {rooms: [room], bottles: [{id: 'a', name: 'Beta', number: 10, bottlingId: 'b'}, {id: 'c', name: 'Alpha', number: 2, bottlingId: 'b'}], assignments: {a: 's', c: 's'}};
  const before = structuredClone(warehouse);
  const geometry = createRoomDiagramModel(room, warehouse);
  assert.equal(geometry.vbH, 400);
  assert.equal(geometry.shapes[0].width, 198);
  assert.equal(geometry.shapes[0].assigned, 2);
  const contents = createShelfContentsModel(warehouse, 's', [{id: 'b', abv: 46}]);
  assert.equal(contents.title, 'Room / Cabinet / Shelf');
  assert.deepEqual(contents.rows.map(row => [row.bottle.id, row.abv]), [['c', 46], ['a', 46]]);
  const selection = createWarehouseSelectionModel(warehouse, {warehouseSelectedFurnitureIds: ['f'], warehouseHiddenFurnitureIds: ['f']}, room);
  assert.equal(selection.selectedCount, 1);
  assert.equal(selection.hasHidden, true);
  assert.equal(selection.items[0].occupied, 2);
  assert.deepEqual(warehouse, before);
});

test('photo drafts keep editable values independent of saved settings and other sessions', async () => {
  const {createPhotoEditorSession, createPhotoDraft, createPhotoControlsModel} = await import('../../public/js/features/photo-editor/view-model.js');
  const photo = {path: 'photos/example.png'};
  const original = structuredClone(photo);
  const session = Object.assign(createPhotoEditorSession(), createPhotoDraft(photo, 'b', 'p'));
  const second = createPhotoEditorSession();
  session.values.brightness = 17;
  session.maskStrokes.push({x: 1});
  assert.notEqual(session.values.brightness, session.savedSourceValues.original.brightness);
  assert.deepEqual(second.maskStrokes, []);
  assert.equal(createPhotoControlsModel(session, photo).hasSavedCutout, false);
  assert.deepEqual(photo, original);
});

test('collection row and rating models resolve inventory price, latest tasting and glass fills', async () => {
  const {createCollectionTableModel, createCollectionRatingModel} = await import('../../public/js/views/models/home.js');
  const bottling = {id: 'b', tastings: [{id: 't', tastedOn: '2026-11-12', rating: 87.5}], bottles: [{id: 'p', purchasePrice: 60, currency: 'EUR', updatedAt: '2026-11-13'}]};
  const before = structuredClone(bottling);
  const table = createCollectionTableModel({bottling}, bottling.bottles, 'Origin');
  assert.deepEqual(table.price, {currency: 'EUR', value: 60});
  assert.equal(table.updated, '2026-11-13');
  assert.equal(table.tasted, '2026-11-12');
  assert.deepEqual(createCollectionRatingModel(bottling), {score: 87.5, fills: [100, 100, 100, 100, 37.5]});
  assert.deepEqual(bottling, before);
});

test('composition and finance models prepare percentages and currency-specific data', async () => {
  const {createCompositionViewModel, createFinanceViewModel} = await import('../../public/js/views/models/analytics.js');
  const rows = [{name: 'a', count: 1}, {name: 'b', count: 3}, {name: 'zero', count: 0}];
  const {total, segments} = createCompositionViewModel(rows);
  assert.equal(total, 4);
  assert.deepEqual(segments.map(({from, to, percent}) => [from, to, percent]), [[0, 25, 25], [25, 100, 75]]);
  const finance = {prices: [{currency: 'EUR'}, {currency: 'USD'}], byDistillery: [{currency: 'EUR', total: 5}, {currency: 'USD', total: 8}], costMonthly: [{currency: 'USD', total: 8}]};
  const before = structuredClone(finance);
  const model = createFinanceViewModel(finance);
  assert.deepEqual(model.distilleries[0].rows, [finance.byDistillery[0]]);
  assert.deepEqual(model.timelines[0].rows, []);
  assert.deepEqual(model.timelines[1].rows, finance.costMonthly);
  assert.deepEqual(finance, before);
});

test('missing map sites are filtered and limited without mutating the source list', async () => {
  const {createMapMissingModel} = await import('../../public/js/views/models/map.js');
  const missing = Array.from({length: 20}, (_, i) => ({name: `Distillery ${i}`}));
  assert.equal(createMapMissingModel(missing, 'DISTILLERY').items.length, 18);
  assert.equal(createMapMissingModel(missing, 'DISTILLERY').more, 2);
  assert.equal(missing.length, 20);
});
