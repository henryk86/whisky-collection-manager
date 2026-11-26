import {domElements, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanRenderer, loadTemplates, parseTemplates} from '../../public/js/ui/templates.js';
import {RenderPlan} from '../../public/js/ui/render-plan.js';

const source = `<!-- wcm-template:example -->
<p title="{{text:title}}">{{text:body}}{{content:icon}}</p>
<!-- /wcm-template -->
`;

test(
  'external fragments escape text but preserve trusted nested markup',
  async () => {
    const render = createPlanRenderer(parseTemplates(source));
    const plan = render('example', {
      title: '" onmouseover="alert(1)',
      body: '<img src=x>',
      icon: new RenderPlan('<svg></svg>', {}),
    });
    await assertDom(plan, 'p', {title: '" onmouseover="alert(1)', directText: '<img src=x>'});
    await assertDom(plan, 'p > svg');
    await assertDom(plan, 'img, [onmouseover]', {}, true);
    assert.throws(() => render('missing'), /Unknown template/);
    await assert.rejects(domElements(render('example', {}), "*"), /Missing slot/);
    assert.throws(() => parseTemplates(source + source), /Duplicate template/);
    assert.throws(() => parseTemplates('invalid'), /Invalid HTML template/);
  }
);

test('external template loader reuses the loaded resource', async () => {
  const name = 'backups/backups.html';
  const first = await loadTemplates(name);
  assert.equal(first, await loadTemplates(name));
  await assertDom(first('remoteOption', {value: 'my_remote'}), "option[value=\"my_remote\"]");
});

test('scalar content never becomes nested HTML and attribute groups require maps', async () => {
  const render = createPlanRenderer(new Map([['item', '<p{{attrs:attributes}}>{{content:body}}</p>']]));
  const plan = render('item', {
    attributes: {hidden: false, 'aria-expanded': false, title: '" < &'},
    body: '<svg onload="alert(1)"></svg>',
  });
  assert.ok(plan instanceof RenderPlan);
  const [paragraph] = (await domElements(plan, 'p'));
  assert.deepEqual(paragraph.attributes, {'aria-expanded': 'false', title: '" < &'});
  assert.equal(paragraph.text, '<svg onload="alert(1)"></svg>');
  assert.equal((await domElements(plan, 'svg')).length, 0);
  await assert.rejects(domElements(render('item', {attributes: 'hidden', body: ''}), "*"), /plain object/);
  await assert.rejects(domElements(render('item', {attributes: {onclick: 'alert(1)'}, body: ''}), "*"), /Invalid template attribute/);
});
