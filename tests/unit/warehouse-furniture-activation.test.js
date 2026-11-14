import test from 'node:test';
import assert from 'node:assert/strict';
import {createFurnitureActivation} from '../../public/js/ui/warehouse-furniture-activation.js';

const pause=duration=>new Promise(resolve=>setTimeout(resolve,duration));

test('single click selects furniture only after double-click window', async()=>{
    const calls=[];
    const handler=createFurnitureActivation(id=>calls.push('select:'+id),id=>calls.push('edit:'+id),20);
    handler.activate('r1');
    assert.deepEqual(calls,[]);
    await pause(35);
    assert.deepEqual(calls,['select:r1']);
    handler.cancel();
});

test('double click opens editor without selecting or rerendering plan', async()=>{
    const calls=[];
    const handler=createFurnitureActivation(id=>calls.push('select:'+id),id=>calls.push('edit:'+id),25);
    handler.activate('r1'); handler.activate('r1');
    assert.deepEqual(calls,['edit:r1']);
    await pause(40);
    assert.deepEqual(calls,['edit:r1']);
});

test('cancelled activation and switching objects do not trigger stale clicks', async()=>{
    const calls=[];
    const handler=createFurnitureActivation(id=>calls.push('select:'+id),id=>calls.push('edit:'+id),20);
    handler.activate('r1');handler.activate('r2');
    await pause(35);
    assert.deepEqual(calls,['select:r2']);
    handler.activate('r1');handler.cancel();await pause(35);
    assert.deepEqual(calls,['select:r2']);
});

test('3D double-clicks target a specific bay and never open a neighbouring bay', async()=>{
    const calls=[];
    const handler=createFurnitureActivation(id=>calls.push(['select',id]),(id,shelfId)=>calls.push(['open',id,shelfId]),20);
    handler.activate('rack','upper');handler.activate('rack','upper');
    assert.deepEqual(calls,[['open','rack','upper']]);
    handler.activate('rack','lower');handler.activate('rack','upper');
    await pause(35);
    assert.deepEqual(calls,[['open','rack','upper'],['select','rack']], 'different compartments do not count as the same double-click');
    handler.cancel();
});

test('3D double-click of an unassigned height does not become a furniture edit',()=>{
    const calls=[];
    const handler=createFurnitureActivation(()=>{},(_id,shelfId)=>{if(shelfId) calls.push(shelfId);},20);
    handler.activate('rack',null);handler.activate('rack',null);
    assert.deepEqual(calls,[]);
    handler.cancel();
});
