import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeUrl } from '../../public/js/navigation/routes.js';
test('routing: home, settings, and detail URLs are reversible', () => {
    for (const [page, id] of [['home', null], ['settings', null], ['detail', 'bottle-123-abcd']]) {
        const url = routeUrl(page, id);
        assert.deepEqual(parseRoute(new URL(url, 'http://localhost:3100').search), {
            page, selected: id
        });
    }
});
test('routing: invalid or unrelated query strings do not crash navigation', () => {
    assert.deepEqual(parseRoute('?bottling=%2F..%2Fsecret'), {
        page: 'home', selected: null
    });
    assert.deepEqual(parseRoute('?xyz=1'), {
        page: 'home', selected: null
    });
    assert.throws(() => routeUrl('detail', '../foo'));
});
test('routing: detail URL is stable across repeated navigation (no extra history entry needed)', () => {
    const url = routeUrl('detail', 'abc-123');
    assert.equal(url, routeUrl(parseRoute(new URL(url, 'http://localhost').search).page, 'abc-123'));
});
