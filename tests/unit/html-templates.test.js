import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTemplates, parseTemplates} from '../../public/js/ui/templates.js';
import {createProfileViewModel} from '../../public/js/features/backups/profile-model.js';

const source = `<!-- wcm-template:example -->
<p title="{{text:title}}">{{text:body}}{{content:icon}}</p>
<!-- /wcm-template -->
`;

test('template parsing accepts LF, CRLF and CR line endings', () => {
  const expected = parseTemplates(source);
  for (const newline of ['\r\n', '\r']) {
    assert.deepEqual(parseTemplates(source.replaceAll('\n', newline)), expected);
  }
});

test('template loader rejects paths outside the central template tree', async () => {
  for (const name of ['../index.html', '/app.html', 'https://example.com/app.html', 'backups/../app.html', 'backups%2fbackups.html', 'backups\\backups.html']) {
    await assert.rejects(loadTemplates(name), /Invalid template path/);
  }
  await assert.rejects(loadTemplates('missing.html'), {code: 'ENOENT'});
});

test('backup profile defaults fill missing nested settings', () => {
  const profile = {schedule: {hour: 5}, retention: {weekly: 3}};
  const model = createProfileViewModel(profile, [], []);
  assert.deepEqual(model.schedule, {
    frequency: 'daily', hour: 5, minute: 0, weekday: 0,
  });
  assert.deepEqual(model.retention, {daily: 7, weekly: 3, monthly: 12});
  assert.deepEqual(profile, {schedule: {hour: 5}, retention: {weekly: 3}});
});

test('legacy backup profiles get a new target and remain disabled', () => {
  const model = createProfileViewModel({
    id: 'old', format: 'restic', provider: 'local',
    targetPath: 'usb/old', enabled: true,
  });
  assert.equal(model.targetPath, 'usb/old-zip');
  assert.equal(model.enabled, false);
  assert.equal(model.targets[0].value, 'usb/old-zip');
});
