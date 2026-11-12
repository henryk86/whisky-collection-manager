import test from 'node:test';
import assert from 'node:assert/strict';
import { shelfLevels, effectiveShelfFront, totalExplicitHeightCm } from '../../public/js/domain/warehouse-compartments.js';
import { warehouse3DGeometry, furnitureFootprint } from '../../public/js/domain/warehouse-3d-model.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

const base={id:'c',name:'Gemischter Schrank',type:'schrank',x:1,y:0.5,width:1.6,depth:0.6,rotation:0,elevation:0.2,itemHeight:2,
    shelves:[{id:'low',name:'Untertür',front:'door',heightCm:60,capacity:5},
        {id:'mid',name:'Offenes Fach',front:'open',heightCm:80,capacity:7},
        {id:'top',name:'Glas oben',front:'glass',heightCm:60,capacity:5}]};
const room={id:'r',name:'Zimmer',width:5,height:4,furniture:[base]};
const warehouse={rooms:[room],assignments:{},bottles:[]};

test('specified shelf heights and fronts are measured from bottom to top without modifying data',()=>{
    const before=JSON.stringify(base);
    const levels=shelfLevels(base);
    assert.deepEqual(levels.map(x=>[x.front,x.heightCm]),[['door',60],['open',80],['glass',60]]);
    assert.deepEqual(levels.map(x=>Number(x.bottom.toFixed(2))),[0.2,0.8,1.6]);
    assert.deepEqual(levels.map(x=>Number(x.top.toFixed(2))),[0.8,1.6,2.2]);
    assert.equal(JSON.stringify(base),before);
    const mixedAuto={...base,shelves:[{id:'a',heightCm:40},{id:'b',front:'glass'}, {id:'c'}]};
    assert.deepEqual(shelfLevels(mixedAuto).map(level=>level.heightCm),[40,80,80]);
    assert.equal(totalExplicitHeightCm(base.shelves),200);
    assert.equal(effectiveShelfFront({},'schrank'),'door');
    assert.equal(effectiveShelfFront({},'vitrine'),'glass');
    assert.equal(effectiveShelfFront({},'regal'),'open');
});

test('3D mixed front geometry has open upper bays without solid cabinet body in all rotations',()=>{
    const expected=[[0,1],[-1,0],[0,-1],[1,0]];
    for (const [i,rotation] of [0,90,180,270].entries()) {
        const item={...base,rotation};
        const model=warehouse3DGeometry({...room,furniture:[item]},warehouse).objects[0];
        const groups=role=>model.parts.filter(part=>part.role===role);
        assert.equal(groups('body').length,0,'no opaque body behind open bays');
        assert.equal(groups('post').length,4);
        assert.equal(groups('shelf-board').length,4);
        assert.equal(groups('door').length,2);
        assert.equal(groups('glass-front').length,1);
        const panel=groups('glass-front')[0];
        assert.ok(Math.abs(panel.center[1]-1.9)<1e-7,'glass upper bay centre follows custom height');
        const {width,depth}=furnitureFootprint(item);
        const centre=[item.x+width/2,item.y+depth/2];
        const [nx,nz]=expected[i];
        const offset=(panel.center[0]-centre[0])*nx+(panel.center[2]-centre[1])*nz;
        assert.ok(Math.abs(offset - (item.depth/2+(rotation%180 ? panel.size[0] : panel.size[2])/2))<1e-7,
            `glass panel rotates with the furniture at ${rotation} degrees`);
    }
});

test('open above wood door and glass above door work regardless of original furniture type',()=>{
    for(const type of ['regal','schrank','vitrine','kommode','haengeregal']){
        const item={...base,type};
        const obj=warehouse3DGeometry({...room,furniture:[item]},warehouse).objects[0];
        assert.equal(obj.parts.filter(part=>part.role==='door').length,2);
        assert.equal(obj.parts.filter(part=>part.role==='glass-front').length,1);
        assert.ok(obj.parts.every(part=>part.size.every(n=>n>0)));
        assert.equal(obj.parts.filter(part=>part.role==='body').length,0);
    }
});

test('shelf edit form offers front and centimeter height and panel lists fronts top to bottom',()=>{
    let html='';let form='';
    const state={warehouse,selected:'shelves',warehouseRoomId:'r',warehouseFurnitureId:'c',warehousePlanMode:'2d'};
    const doc=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
    try{
        const view=createWarehouseView({state,shell:output=>html=output,navigate:()=>{},modal:{showModal:(_name,content)=>form=content},refresh:async()=>{}});
        view.render();
        assert.ok(html.indexOf('Glas oben')<html.indexOf('Offenes Fach'));
        assert.ok(html.indexOf('Offenes Fach')<html.indexOf('Untertür'));
        assert.match(html,/Glastür · 1-flügelig · ohne Rahmen · 60 cm/);
        assert.match(html,/Fach nach oben verschieben/);
        view.openForm('shelf','mid');
        assert.match(form,/name="heightCm"/);
        assert.match(form,/name="front"/);
        assert.match(form,/name="doorLeaves"/);
        assert.match(form,/name="glassFrame"/);
        assert.match(form,/>Holztür</);
        assert.match(form,/>Glastür</);
    } finally {if(doc===undefined)delete globalThis.document;else globalThis.document=doc;}
});


test('single/double wood and glass doors with and without glazing frames rotate with furniture',()=>{
    for(const rotation of [0,90,180,270]) for(const front of ['door','glass'])
    for(const doorLeaves of [1,2]) for(const glassFrame of [false,true]) {
        const item={...base,rotation,shelves:[{id:'s',front,doorLeaves,glassFrame,heightCm:100}]};
        const parts=warehouse3DGeometry({...room,furniture:[item]},warehouse).objects[0].parts;
        assert.equal(parts.filter(p=>p.role===(front==='glass'?'glass-front':'door')).length,doorLeaves);
        assert.equal(parts.filter(p=>p.role==='glass-frame').length,front==='glass'&&glassFrame?4*doorLeaves:0);
        assert.ok(parts.every(p=>p.size.every(n=>n>0)));
    }
});

test('furniture-level door settings act as defaults, shelf overrides win in all rotations',()=>{
    for(const rotation of [0,90,180,270]) {
        const item={...base,rotation,doorLeaves:2,glassFrame:true,shelves:[
            {id:'a',front:'glass',heightCm:70,doorLeaves:null,glassFrame:null},
            {id:'b',front:'glass',heightCm:70,doorLeaves:1,glassFrame:false},
            {id:'c',front:'door',heightCm:60,doorLeaves:null,glassFrame:null}
        ]};
        const parts=warehouse3DGeometry({...room,furniture:[item]},warehouse).objects[0].parts;
        assert.equal(parts.filter(p=>p.role==='glass-front').length,3);
        assert.equal(parts.filter(p=>p.role==='glass-frame').length,8);
        assert.equal(parts.filter(p=>p.role==='door').length,2);
    }
});

test('furniture edit and bulk edit both offer door leaf and glass frame defaults',()=>{
    const state={warehouse,selected:'shelves',warehouseRoomId:'r',warehouseFurnitureId:'c'};
    let form='';const doc=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
    try {
        const view=createWarehouseView({state,shell:()=>{},navigate:()=>{},modal:{showModal:(_title,content)=>form=content},refresh:async()=>{}});
        view.openForm('furniture','c');
        assert.match(form,/name="doorLeaves"/);
        assert.match(form,/name="glassFrame"/);
        state.warehouseSelectedFurnitureIds=['c'];
        view.openForm('furniture-bulk');
        assert.match(form,/name="doorLeaves"/);
        assert.match(form,/name="glassFrame"/);
    } finally {if(doc===undefined)delete globalThis.document;else globalThis.document=doc;}
});
