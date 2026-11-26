import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {startTestServer} from '../helpers/server.js';

test(
  'static resources support ETag and Last-Modified revalidation without a response body',
  async () => {
    const server = await startTestServer();
    try {
      const first = await fetch(`${server.base}/assets/photo-placeholder.svg`);
      assert.equal(first.status, 200);
      assert.equal(first.headers.get('cache-control'), 'no-cache');
      const etag = first.headers.get('etag');
      const modified = first.headers.get('last-modified');
      assert.match(etag, /^W\/"[a-f0-9]+-[a-f0-9]+"$/);
      assert.ok(Number.isFinite(Date.parse(modified)));
      await first.arrayBuffer();
      const revalidated = await fetch(`${server.base}/assets/photo-placeholder.svg`, {headers: {'If-None-Match': etag}, });
      assert.equal(revalidated.status, 304);
      assert.equal(revalidated.headers.get('etag'), etag);
      assert.equal(await revalidated.text(), '');
      const byDate = await fetch(`${server.base}/assets/photo-placeholder.svg`, {headers: {'If-Modified-Since': modified}, });
      assert.equal(byDate.status, 304);
      const staleTag = await fetch(
        `${server.base}/assets/photo-placeholder.svg`,
        {
          headers: {
            'If-None-Match': '"unrelated"', 'If-Modified-Since': modified,
          },
        }
      );
      assert.equal(staleTag.status, 200, 'If-None-Match takes precedence');
      await staleTag.arrayBuffer();
      const html = await fetch(`${server.base}/`, {headers: {'If-None-Match': '"unrelated"', }, });
      assert.equal(html.status, 200);
      assert.match(html.headers.get('content-security-policy'), /script-src/);
      await html.arrayBuffer();
    } finally {
      await server.stop();
    }
  }
);


test('CSP hashes match browser-normalized inline script text', async () => {
  const server = await startTestServer();
  const directory = fs.mkdtempSync(path.join('public', 'csp-test-'));
  const script = '\n  window.example = true;\n';
  const expected = crypto.createHash('sha256').update(script).digest('base64');
  try {
    for (const [index, newline] of ['\n', '\r\n', '\r'].entries()) {
      const name = `fixture-${index}.html`;
      const html = `<script>${script.replaceAll('\n', newline)}</script>`;
      fs.writeFileSync(path.join(directory, name), html);
      const resource = `${path.basename(directory)}/${name}`;
      const response = await fetch(`${server.base}/${resource}`);
      assert.equal(response.status, 200);
      const csp = response.headers.get('content-security-policy');
      const scriptPolicy = csp.split(';').find(part => part.trim().startsWith('script-src'));
      assert.ok(scriptPolicy.includes(`'sha256-${expected}'`));
      assert.ok(!scriptPolicy.includes("'unsafe-inline'"));
      assert.equal(await response.text(), html);
    }
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
    await server.stop();
  }
});
