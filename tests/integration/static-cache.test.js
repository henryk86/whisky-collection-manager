import test from 'node:test';
import assert from 'node:assert/strict';
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
      const revalidated = await fetch(
        `${server.base}/assets/photo-placeholder.svg`,
        {
          headers: {'If-None-Match': etag},
        }
      );
      assert.equal(revalidated.status, 304);
      assert.equal(revalidated.headers.get('etag'), etag);
      assert.equal(await revalidated.text(), '');
      const byDate = await fetch(
        `${server.base}/assets/photo-placeholder.svg`,
        {
          headers: {'If-Modified-Since': modified},
        }
      );
      assert.equal(byDate.status, 304);
      const staleTag = await fetch(
        `${server.base}/assets/photo-placeholder.svg`,
        {
          headers: {'If-None-Match': '"unrelated"', 'If-Modified-Since': modified},
        }
      );
      assert.equal(staleTag.status, 200, 'If-None-Match takes precedence');
      await staleTag.arrayBuffer();
      const html = await fetch(`${server.base}/`, {headers: {'If-None-Match': '"unrelated"'}});
      assert.equal(html.status, 200);
      assert.match(html.headers.get('content-security-policy'), /script-src/);
      await html.arrayBuffer();
    } finally {
      await server.stop();
    }
  }
);
