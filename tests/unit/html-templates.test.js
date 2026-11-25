import test from 'node:test';
import assert from 'node:assert/strict';
import {createTemplateRenderer, loadTemplates, parseTemplates}
  from '../../public/js/ui/templates.js';
import {createProfileViewModel}
  from '../../public/js/features/backups/profile-model.js';

const source = `<!-- wcm-template:example -->
<p title="{{text:title}}">{{text:body}}{{raw:icon}}</p>
<!-- /wcm-template -->
`;

test(
  'external fragments escape text but preserve trusted nested markup',
  () => {
    const render = createTemplateRenderer(parseTemplates(source));
    assert.equal(render('example', {
      title: '" onmouseover="alert(1)',
      body: '<img src=x>',
      icon: '<svg></svg>',
    }), '<p title="&quot; onmouseover=&quot;alert(1)">&lt;img src=x&gt;' + '<svg></svg></p>');
    assert.throws(() => render('missing'), /Unknown template/);
    assert.throws(() => render('example', {}), /Missing slot/);
    assert.throws(() => parseTemplates(source + source), /Duplicate template/);
    assert.throws(() => parseTemplates('invalid'), /Invalid HTML template/);
  }
);

test('template parsing accepts LF, CRLF and CR line endings', () => {
  const expected = parseTemplates(source);
  for (const newline of ['\r\n', '\r']) {
    assert.deepEqual(parseTemplates(source.replaceAll('\n', newline)), expected);
  }
});

test('external template loader reuses the loaded resource', async () => {
  const url = new URL('../../public/js/views/templates/backups.html', import.meta.url);
  const first = await loadTemplates(url);
  assert.equal(first, await loadTemplates(url));
  assert.match(first('remoteOption', {value: 'my_remote'}), /my_remote/);
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
