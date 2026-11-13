import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentLocation, assignmentShelfInfo, assignmentPayload, renderWarehouseAssignment } from '../../public/js/ui/warehouse-assignment.js';

function fixture() {
    const shelf = {id:'s1',name:'Fach 1',capacity:1};
    const full = {id:'s2',name:'Voll',capacity:0};
    const warehouse = {
        rooms:[{id:'r1',name:'Whiskyzimmer',furniture:[{id:'f1',name:'Regal <1>',shelves:[shelf,full]}]}],
        assignments:{b1:'s1'}, bottles:[{id:'b1',name:'Whisky <test>',number:'100'}]
    };
    return {warehouse,shelf,full};
}

test('assignment dialog separates room, furniture and shelf with current path and safe markup', () => {
    const {warehouse,shelf} = fixture();
    const html = renderWarehouseAssignment(warehouse,warehouse.bottles[0]);
    assert.match(html,/class="warehouse-assignment-bottle"/);
    assert.match(html,/data-assignment-room/);
    assert.match(html,/data-assignment-furniture/);
    assert.match(html,/data-assignment-shelf/);
    assert.match(html,/Whiskyzimmer \/ Regal &lt;1&gt; \/ Fach 1/);
    assert.doesNotMatch(html,/<1>/);
    assert.doesNotMatch(html,/<test>/);
    assert.match(html,/value="s1" selected/);
    assert.match(html,/value="s2" disabled/);
    assert.match(html,/1 von 1 Plätzen belegt/);
    assert.deepEqual(assignmentLocation(warehouse,'s1')?.shelf,shelf);
});

test('a bottle can remain on a filled shelf but cannot choose a different full shelf', () => {
    const {warehouse,shelf,full} = fixture();
    assert.deepEqual(assignmentShelfInfo(warehouse,shelf,'b1'),{occupied:1,full:false,capacity:1});
    assert.deepEqual(assignmentShelfInfo(warehouse,shelf,'b2'),{occupied:1,full:true,capacity:1});
    assert.equal(assignmentShelfInfo(warehouse,full,'b1').full,true);
    assert.deepEqual(assignmentPayload('none','s1',warehouse),{shelfId:null});
    assert.deepEqual(assignmentPayload('shelf','s1',warehouse),{shelfId:'s1'});
    assert.throws(() => assignmentPayload('shelf','missing',warehouse),/gültiges Fach/);
});
