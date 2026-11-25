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
