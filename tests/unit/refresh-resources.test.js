import test from 'node:test';
import assert from 'node:assert/strict';
import { loadResources } from '../../public/js/ui/refresh-resources.js';

const collection = {bottlings:[{id:'new'}]};
const warehouse = {rooms:[{id:'room'}]};

test('default mutation refresh requests both collection and warehouse', async () => {
    const calls=[];
    const state={collection:{},warehouse:{}};
    await loadResources(state, async url => {
        calls.push(url);
        return url === '/api/collection' ? collection : warehouse;
    });
    assert.deepEqual(calls,['/api/collection','/api/warehouse']);
    assert.equal(state.collection,collection);
    assert.equal(state.warehouse,warehouse);
});

test('collection-only refresh leaves warehouse identity and does not fetch it', async () => {
    const previousWarehouse={rooms:[{id:'keep'}]};
    const calls=[];
    const state={collection:{},warehouse:previousWarehouse};
    await loadResources(state, async url => {calls.push(url);return collection;}, 'collection');
    assert.deepEqual(calls,['/api/collection']);
    assert.equal(state.warehouse,previousWarehouse);
    assert.equal(state.collection,collection);
});

test('scoped refresh first-load fallback still retrieves both resources', async () => {
    const calls=[];
    const state={collection:null,warehouse:null};
    await loadResources(state, async url => {
        calls.push(url);
        return url === '/api/collection' ? collection : warehouse;
    }, 'collection');
    assert.deepEqual(calls,['/api/collection','/api/warehouse']);
    assert.equal(state.warehouse,warehouse);
});

test('invalid refresh scope rejects instead of silently returning stale state', async () => {
    await assert.rejects(loadResources({}, () => {throw new Error('should not fetch');}, 'unknown'), /Unknown refresh scope/);
});

test('a failure in either request rejects the refresh instead of claiming success', async () => {
    const state={collection:{bottlings:[]},warehouse:{rooms:[]}};
    await assert.rejects(loadResources(state, async url => {
        if (url === '/api/warehouse') throw Error('warehouse unavailable');
        return collection;
    }), /warehouse unavailable/);
});
