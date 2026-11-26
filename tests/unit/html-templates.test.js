import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanRenderer, loadTemplates, parseTemplates}
  from '../../public/js/ui/templates.js';
import {renderedText, domElements} from '../helpers/rendering.js';
import {RenderPlan} from '../../public/js/ui/render-plan.js';
import {createProfileViewModel}
  from '../../public/js/features/backups/profile-model.js';

const source = `<!-- wcm-template:example -->
<p title="{{text:title}}">{{text:body}}{{content:icon}}</p>
<!-- /wcm-template -->
`;

test(
  'external fragments escape text but preserve trusted nested markup',
  () => {
    const render = createPlanRenderer(parseTemplates(source));
    assert.equal(renderedText(render('example', {
      title: '" onmouseover="alert(1)',
      body: '<img src=x>',
      icon: new RenderPlan('<svg></svg>', {}),
    })), '<p title="&quot; onmouseover=&quot;alert(1)">&lt;img src=x&gt;' + '<svg></svg></p>');
    assert.throws(() => render('missing'), /Unknown template/);
    assert.throws(() => renderedText(render('example', {})), /Missing slot/);
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
  const name = 'backups/backups.html';
  const first = await loadTemplates(name);
  assert.equal(first, await loadTemplates(name));
  assert.match(renderedText(first('remoteOption', {value: 'my_remote'})), /my_remote/);
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

test('scalar content never becomes nested HTML and attribute groups require maps', () => {
  const render = createPlanRenderer(new Map([['item', '<p{{attrs:attributes}}>{{content:body}}</p>']]));
  const plan = render('item', {
    attributes: {hidden: false, 'aria-expanded': false, title: '" < &'},
    body: '<svg onload="alert(1)"></svg>',
  });
  assert.ok(plan instanceof RenderPlan);
  const [paragraph] = domElements(plan, 'p');
  assert.deepEqual(paragraph.attributes, {'aria-expanded': 'false', title: '" < &'});
  assert.equal(paragraph.text, '<svg onload="alert(1)"></svg>');
  assert.equal(domElements(plan, 'svg').length, 0);
  assert.throws(() => renderedText(render('item', {attributes: 'hidden', body: ''})), /plain object/);
  assert.throws(() => renderedText(render('item', {attributes: {onclick: 'alert(1)'}, body: ''})), /Invalid template attribute/);
});
