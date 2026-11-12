import test from 'node:test';
import assert from 'node:assert/strict';
import { furnitureBounds, furnitureOverlap, furnitureCollision, furnitureFitsRoom, moveFurnitureTowards } from '../../public/js/domain/warehouse-placement.js';

const furniture = (id, x, y, extra = {}) => ({id, name:id, type:'schrank', x, y, width:1, depth:1,
    rotation:0, elevation:0, itemHeight:1.8, ...extra});

test('placement compares rotated footprints and occupied vertical ranges, allowing touching faces', () => {
    const base=furniture('base',0,0);
    assert.equal(furnitureOverlap(base,furniture('side',1,0)),false,'edge-to-edge is legal');
    assert.equal(furnitureOverlap(base,furniture('stack',0,0,{elevation:1.8})),false,'touching vertical surfaces is legal');
    assert.equal(furnitureOverlap(base,furniture('suspended',0,0,{elevation:1.9,itemHeight:.4})),false);
    assert.equal(furnitureOverlap(base,furniture('intruding',0,0,{elevation:1.79,itemHeight:.4})),true);
    assert.equal(furnitureOverlap(base,furniture('upper',0,0,{elevation:0.5,itemHeight:.2})),true);
    assert.equal(furnitureOverlap(base,furniture('far',2,2,{elevation:0.5})),false);
    const rotated=furniture('rotated',1.1,0,{width:2,depth:.4,rotation:90});
    assert.deepEqual(furnitureBounds(rotated),{x:1.1,y:0,w:.4,h:2,z:0,d:1.8});
    assert.equal(furnitureOverlap(furniture('left',.7,.5,{width:.5,depth:.5}),rotated),true);
});

test('placement helper detects all furniture levels and validates the room boundary', () => {
    const base=furniture('base',0,0), upper=furniture('upper',0,0,{elevation:1.8});
    const room={width:3,height:3,furniture:[base,upper]};
    assert.equal(furnitureCollision(room,furniture('other',0,0,{elevation:2.1})).id,'upper');
    assert.equal(furnitureCollision(room,base),null,'an item does not collide with itself');
    assert.equal(furnitureFitsRoom(room,furniture('edge',2,2)),true);
    assert.equal(furnitureFitsRoom(room,furniture('outside',2.01,2)),false);
});

test('2D dragging stops at same-height obstacles even with a large pointer jump', () => {
    const obstacle=furniture('blocker',1,0);
    const item=furniture('moving',0,.2,{width:.5,depth:.5});
    const room={width:5,height:3,furniture:[item,obstacle]};
    const p=moveFurnitureTowards(room,item,0,.2,3,.2);
    assert.ok(p.x >= .46 && p.x <= .5, 'cannot tunnel through another cabinet');
    assert.equal(p.y,.2);
    assert.equal(furnitureOverlap({...item,...p},obstacle),false);
    const back=moveFurnitureTowards(room,item,p.x,p.y,0,.2);
    assert.deepEqual(back,{x:0,y:.2});
    const overhead={...item,id:'wall',elevation:1.8,itemHeight:.4};
    assert.deepEqual(moveFurnitureTowards(room,overhead,0,.2,2.5,.2),{x:2.5,y:.2},'an overhead item can pass over a cabinet');
});
