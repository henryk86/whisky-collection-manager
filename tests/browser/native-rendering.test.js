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
          '<section><table><tbody>{{raw:rows}}</tbody></table>' + '<svg viewBox="{{text:box}}">{{raw:path}}</svg>' +
          '<input title="{{text:value}}" {{raw:attributes}}>' +
          '<textarea>{{text:value}}</textarea></section>',
          {
            rows: composeMarkup(row, row), path, box: '0 0 2 2',
            value: input, attributes: 'checked disabled',
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
