import test from 'node:test';
import assert from 'node:assert/strict';
import { FURNITURE_TYPES, SHELF_FRONTS } from '../../public/js/domain/warehouse-compartments.js';
import { name, capacity, shelfFront, ensureShelfHeights, layout } from '../../server/domain/warehouse-fields.js';
import { validateWarehouse } from '../../server/storage/warehouse-store.js';

const room = {id:'room-1', name:'Test', width:4, height:3, furniture:[]};

test('shared furniture type definitions remain compatible with server validation and normalization', () => {
    assert.deepEqual(FURNITURE_TYPES, ['regal','vitrine','schrank','kommode','kiste','haengeregal','sonstiges']);
    assert.deepEqual(SHELF_FRONTS, ['open','door','glass','drawer']);
    for (const type of FURNITURE_TYPES) {
        const item = {id:`item-${type}`, shelves:[], ...layout({name:'Möbel',type,x:0,y:0},room)};
        assert.equal(item.type,type);
        assert.doesNotThrow(() => validateWarehouse({schemaVersion:1,rooms:[{...room,furniture:[item]}],assignments:{}}));
    }
    assert.equal(layout({name:'Sonstiges',type:'unknown'},room).type,'sonstiges');
});

test('extracted warehouse field validation retains null capacity, zero capacity, labels and bounds', () => {
    assert.equal(capacity(''),null);
    assert.equal(capacity(0),0);
    assert.equal(capacity('7'),7);
    assert.throws(() => capacity(-1),/Kapazität/);
    assert.equal(shelfFront(null),null);
    assert.equal(shelfFront('glass'),'glass');
    assert.throws(() => shelfFront('unsupported'),/Fachfront/);
    assert.equal(name('  Regal  '),'Regal');
    assert.throws(() => name('  '),/Name/);
    assert.throws(() => layout({name:'Grenze',x:3.8,width:1},room),/Raumgrenzen/);
});

test('shelf height and door-area checks remain independent of persistence', () => {
    const furniture = {type:'schrank',itemHeight:1.8,shelves:[{heightCm:60},{heightCm:120}]};
    assert.doesNotThrow(() => ensureShelfHeights(furniture));
    assert.throws(() => ensureShelfHeights({...furniture,shelves:[{heightCm:180},{heightCm:null}]}),/5 cm/);
    assert.throws(() => layout({name:'Schrank',type:'schrank',doorRanges:[{from:1,to:2,front:'glass'},{from:2,to:3,front:'door'}],shelves:[{}, {}, {}]},room),/überlappen/);
});
