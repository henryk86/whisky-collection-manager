import test from 'node:test';
import assert from 'node:assert/strict';
import {session} from './support.js';

test('browser: native template bindings preserve text, SVG and table rows',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      const result = await page.evaluate(async url => {
        const {RenderPlan, composeMarkup} = await import(`${url}/js/ui/render-plan.js`);
        const {materialize} = await import(`${url}/js/ui/dom-renderer.js`);
        const input = '<img src=x onerror=alert(1)> & "';
        const row = new RenderPlan('<tr><td>{{text:value}}</td></tr>', {value: input});
        const path = new RenderPlan('<path d="{{text:path}}"/>', {path: 'M 0 0 L 2 2'});
        const plan = new RenderPlan(
          '<section><table><tbody>{{content:rows}}</tbody></table>' + '<svg viewBox="{{text:box}}">{{content:path}}</svg>' +
          '<input title="{{text:value}}" {{attrs:attributes}}>' +
          '<textarea>{{text:value}}</textarea></section>',
          {
            rows: composeMarkup(row, row), path, box: '0 0 2 2',
            value: input, attributes: {checked: true, disabled: true},
          });
        const node = materialize(plan, document).firstElementChild;
        return {
          rows: node.querySelectorAll('tbody > tr').length,
          text: node.querySelector('td').textContent,
          images: node.querySelectorAll('img').length,
          svg: node.querySelector('svg').getAttribute('viewBox'),
          path: node.querySelector('path').getAttribute('d'),
          namespace: node.querySelector('path').namespaceURI,
          title: node.querySelector('input').title,
          disabled: node.querySelector('input').disabled,
          textarea: node.querySelector('textarea').value,
        };
      }, base);
      const input = '<img src=x onerror=alert(1)> & "';
      assert.deepEqual(result, {
        rows: 2, text: input, images: 0,
        svg: '0 0 2 2', path: 'M 0 0 L 2 2',
        namespace: 'http://www.w3.org/2000/svg', title: input,
        disabled: true, textarea: input,
      });
    });
  });

test('browser: native rendering validates typed attributes and preserves literal content', async () => {
  await session(async ({page, open, base}) => {
    await open();
    const result = await page.evaluate(async url => {
      const {RenderPlan} = await import(`${url}/js/ui/render-plan.js`);
      const {materialize} = await import(`${url}/js/ui/dom-renderer.js`);
      const plan = new RenderPlan('<button{{attrs:props}}>{{content:message}}</button>', {
        props: {disabled: false, 'aria-expanded': false, title: '" < &'},
        message: '<svg onload="alert(1)"></svg>',
      });
      const native = materialize(plan, document).firstElementChild;
      const invalid = new RenderPlan('<button{{attrs:props}}></button>', {props: {onclick: 'alert(1)'}});
      let nativeRejected = false;
      try {materialize(invalid, document);} catch {nativeRejected = true;}
      return {
        nativeRejected,
        disabled: native.disabled, expanded: native.getAttribute('aria-expanded'),
        childCount: native.childElementCount, text: native.textContent,
      };
    }, base);
    assert.deepEqual(result, {
      nativeRejected: true,
      disabled: false, expanded: 'false', childCount: 0,
      text: '<svg onload="alert(1)"></svg>',
    });
  });
});
