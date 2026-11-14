import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomExport, planRoomImport } from '../../server/services/room-transfer.js';

const room={id:'r',name:'Room A',width:5,height:4,furniture:[{id:'f',name:'Cabinet',type:'regal',x:0,y:0,width:.5,depth:.5,rotation:0,itemHeight:1.2,
    shelves:[{id:'s',name:'Shelf A',capacity:1}]}]};
const warehouse=()=>({rooms:[structuredClone(room)],assignments:{src:'s'},bottles:[{id:'src',name:'Whisky',number:'ABC'}]});

test('room transfer plans preserve all furniture fields but reassign unique IDs and do not overwrite bottle positions', () => {
    const exported=createRoomExport(warehouse(),['r'],true);
    const target={rooms:[],bottles:[{id:'target',number:'ABC'}],assignments:{}};
    const plan=planRoomImport(target,exported);
    assert.equal(plan.summary.createdRooms,1);
    assert.equal(plan.summary.assigned,1);
    assert.notEqual(plan.toAdd[0].id,'r');
    assert.equal(plan.toAdd[0].furniture[0].width,.5);
    assert.equal(plan.toAdd[0].furniture[0].shelves[0].capacity,1);
    assert.deepEqual(plan.transfers,[['target',plan.toAdd[0].furniture[0].shelves[0].id]]);
    const alreadyOccupied=planRoomImport({...target,assignments:{target:'other'}},exported);
    assert.equal(alreadyOccupied.summary.alreadyAssigned,1);
    assert.equal(alreadyOccupied.transfers.length,0);
});

test('ambiguous inventory number and insufficient source capacity are never guessed into assignments', () => {
    const exported=createRoomExport(warehouse(),['r'],true);
    const target={rooms:[],bottles:[{id:'one',number:'ABC'},{id:'two',number:'ABC'}],assignments:{}};
    const ambiguous=planRoomImport(target,exported);
    assert.equal(ambiguous.summary.ambiguous,1);
    assert.equal(ambiguous.summary.assigned,0);
    exported.rooms[0].furniture[0].shelves[0].capacity=0;
    const zero=planRoomImport({rooms:[],bottles:[{id:'unique',number:'ABC'}],assignments:{}},exported);
    assert.equal(zero.summary.capacityExceeded,1);
    assert.equal(zero.transfers.length,0);
});

test('replacing empty matching rooms requires explicit replace but is denied if room has assignments', () => {
    const doc=createRoomExport(warehouse(),['r'],false);
    const existing=structuredClone(room);
    const target={rooms:[existing],bottles:[],assignments:{}};
    assert.equal(planRoomImport(target,doc).summary.skippedRooms,1);
    const replacement=planRoomImport(target,doc,{conflictPolicy:'replace'});
    assert.equal(replacement.summary.replacedRooms,1);
    assert.equal(replacement.toReplace[0].id,'r');
    assert.notEqual(replacement.toReplace[0].furniture[0].id,'f');
    assert.equal(planRoomImport({...target,assignments:{bottle:'s'}},doc,{conflictPolicy:'replace'}).summary.blockedRooms,1);
});
