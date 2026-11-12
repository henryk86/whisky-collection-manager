import test from 'node:test';
import assert from 'node:assert/strict';
import {roomCapacity,totalCapacity,capacityLabel} from '../../public/js/domain/warehouse-capacity.js';

const sample = {
    rooms: [
        {id:'a', furniture:[{id:'cabinet',shelves:[{id:'a1',capacity:6},{id:'a2',capacity:4},{id:'a3',capacity:null}]}]},
        {id:'b', furniture:[{id:'shelf',shelves:[{id:'b1',capacity:12}]}]},
    ],
    bottles:[{id:'1'},{id:'2'},{id:'3'}],
    assignments:{'1':'a1','2':'a3','3':'b1','already-deleted':'a1'},
};

test('room capacity sums only configured shelf slots and counts existing physical bottles once', () => {
    assert.deepEqual(roomCapacity(sample.rooms[0],sample),{occupied:2,defined:10,unlimited:1,shelves:3});
    assert.deepEqual(roomCapacity(sample.rooms[1],sample),{occupied:1,defined:12,unlimited:0,shelves:1});
    assert.deepEqual(totalCapacity(sample),{occupied:3,defined:22,unlimited:1,shelves:4});
    assert.equal(capacityLabel(roomCapacity(sample.rooms[0],sample)),'mind. 10 Plätze · 1 Fach ohne Limit');
    assert.equal(capacityLabel(roomCapacity(sample.rooms[1],sample)),'12 Plätze');
    assert.equal(capacityLabel({occupied:0,defined:0,unlimited:2,shelves:2}),'2 Fächer ohne Limit');
    assert.equal(capacityLabel({occupied:0,defined:0,unlimited:0,shelves:0}),'Noch keine Fächer');
});

test('zero capacity is a configured limit, not unlimited', () => {
    const room={furniture:[{shelves:[{id:'empty',capacity:0},{id:'free',capacity:null}]}]};
    assert.deepEqual(roomCapacity(room,{bottles:[],assignments:{}}),{occupied:0,defined:0,unlimited:1,shelves:2});
});
