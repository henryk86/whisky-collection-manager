import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, requestJson as api } from '../helpers/server.js';

const roomInput={name:'Whiskylager',width:5,height:4};
const furnitureInput={name:'Kombischrank',type:'schrank',x:0.5,y:0.4,width:1.6,depth:0.5,rotation:0,elevation:0,itemHeight:2.0};

test('mixed cupboard supports independent wood, open and glass fronts, heights in cm and bottom-to-top reordering', async()=>{
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',roomInput)).data;
        const furniture=(await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',furnitureInput)).data;
        const add=body=>api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',body);
        const lower=await add({name:'Unten mit Holztür',capacity:5,front:'door',heightCm:60});
        assert.equal(lower.status,201);
        const middle=await add({name:'Mitte offen',capacity:7,front:'open',heightCm:80});
        assert.equal(middle.status,201);
        const upper=await add({name:'Oben Glas',capacity:3,front:'glass',heightCm:60});
        assert.equal(upper.status,201);
        const framed=await api(ctx.base,`/api/warehouse/shelves/${upper.data.id}`,'PATCH',
            {...upper.data,doorLeaves:2,glassFrame:true});
        assert.equal(framed.status,200);
        assert.equal(framed.data.doorLeaves,2);
        assert.equal(framed.data.glassFrame,true);
        const invalidLeaves=await add({name:'Ungültige Tür',front:'door',doorLeaves:3});
        assert.equal(invalidLeaves.status,400);
        const invalidFrame=await add({name:'Ungültiger Rahmen',front:'glass',glassFrame:'true'});
        assert.equal(invalidFrame.status,400);
        const info=(await api(ctx.base,'/api/warehouse')).data;
        const shelves=info.rooms[0].furniture[0].shelves;
        assert.deepEqual(shelves.map(s=>[s.front,s.heightCm]),[['door',60],['open',80],['glass',60]]);
        const file=path.join(ctx.dir,'data/warehouse.json');
        const persisted=fs.readFileSync(file);
        const tooTall=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:'Extra',front:'open',heightCm:10});
        assert.equal(tooTall.status,409);
        assert.deepEqual(fs.readFileSync(file),persisted,'failed write must not affect persisted warehouse');
        const badFront=await add({name:'Unsicher',front:'javascript:danger'});
        assert.equal(badFront.status,400);
        assert.deepEqual(fs.readFileSync(file),persisted);
        const tooShortBulk=await api(ctx.base,'/api/warehouse/furniture/bulk','PATCH',
            {ids:[furniture.id],changes:{itemHeight:1}});
        assert.equal(tooShortBulk.status,409);
        assert.deepEqual(fs.readFileSync(file),persisted,'bulk height change cannot squeeze fixed shelves');
        const moved=await api(ctx.base,`/api/warehouse/shelves/${lower.data.id}/move`,'PATCH',{direction:'up'});
        assert.equal(moved.status,200);
        let current=(await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture[0].shelves;
        assert.deepEqual(current.map(s=>s.name),['Mitte offen','Unten mit Holztür','Oben Glas']);
        const updated=await api(ctx.base,`/api/warehouse/shelves/${upper.data.id}`,'PATCH',
            {...upper.data,front:'door',heightCm:50,doorLeaves:1,glassFrame:false});
        assert.equal(updated.status,200);
        assert.equal(updated.data.heightCm,50);
        assert.equal(updated.data.doorLeaves,1);
        const heightRaised=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}`,'PATCH',
            {...furniture,itemHeight:2.5});
        assert.equal(heightRaised.status,200);
        const copied=await api(ctx.base,`/api/warehouse/shelves/${upper.data.id}/copy`,'POST',
            {name:'Noch ein Fach'});
        assert.equal(copied.status,201);
        assert.equal(copied.data.front,'door');
        assert.equal(copied.data.heightCm,50);
        assert.equal(copied.data.doorLeaves,1);
        assert.equal(copied.data.glassFrame,false);
        const copyFurniture=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/copy`,'POST',{withShelves:true});
        assert.equal(copyFurniture.status,201);
        assert.deepEqual(copyFurniture.data.shelves.map(s=>[s.front,s.heightCm]),[
            ['open',80],['door',60],['door',50],['door',50]
        ]);
        const oldHeight=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}`,'PATCH',
            {...furniture,itemHeight:1.5});
        assert.equal(oldHeight.status,409,'cannot shrink below explicit compartment heights');
        const repaired=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}`,'PATCH',
            {...furniture,itemHeight:2.5});
        assert.equal(repaired.status,200);
        const stored=JSON.parse(fs.readFileSync(file,'utf8'));
        assert.equal(stored.rooms[0].furniture[0].shelves.length,4);
    } finally {await ctx.stop();}
});

test('legacy warehouse shelf data stays readable without front/heightCm and automatically uses furniture defaults', async()=>{
    const ctx=await startTestServer();
    try{
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',roomInput)).data;
        const furniture=(await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',furnitureInput)).data;
        const shelf=(await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:'Traditionelles Fach',capacity:4})).data;
        const file=path.join(ctx.dir,'data/warehouse.json');
        const raw=JSON.parse(fs.readFileSync(file,'utf8'));
        const oldShelf=raw.rooms[0].furniture[0].shelves[0];
        delete oldShelf.front;delete oldShelf.heightCm;
        fs.writeFileSync(file,JSON.stringify(raw));
        const result=await api(ctx.base,'/api/warehouse');
        assert.equal(result.status,200);
        assert.equal(result.data.rooms[0].furniture[0].shelves[0].front,undefined);
        const edit=await api(ctx.base,`/api/warehouse/shelves/${shelf.id}`,'PATCH',
            {name:'Traditionelles Fach',capacity:4,front:null,heightCm:null});
        assert.equal(edit.status,200);
        assert.equal(edit.data.front,null);
        assert.equal(edit.data.heightCm,null);
    }finally {await ctx.stop();}
});

test('mixed height validation reserves at least 5 cm for automatically sized shelves',async()=>{
    const ctx=await startTestServer();
    try{
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',roomInput)).data;
        const furniture=(await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {...furnitureInput,itemHeight:1})).data;
        const auto=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:'Automatisch',front:'open',heightCm:null});
        assert.equal(auto.status,201);
        const invalid=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:'Zu hoch',front:'glass',heightCm:98});
        assert.equal(invalid.status,409,'auto compartment needs at least 5 cm');
        const valid=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:'Passend',front:'glass',heightCm:95});
        assert.equal(valid.status,201);
        const saved=(await api(ctx.base,'/api/warehouse')).data;
        assert.deepEqual(saved.rooms[0].furniture[0].shelves.map(s=>s.heightCm),[null,95]);
    }finally {await ctx.stop();}
});

test('furniture door defaults persist, copy and bulk update without destroying shelf overrides',async()=>{
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',roomInput)).data;
        const furniture=(await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {...furnitureInput,doorLeaves:2,glassFrame:true})).data;
        assert.equal(furniture.doorLeaves,2);
        assert.equal(furniture.glassFrame,true);
        const shelf=(await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:'Glas',front:'glass',capacity:0,glassFrame:null,doorLeaves:null})).data;
        assert.equal(shelf.glassFrame,null);
        const changed=await api(ctx.base,'/api/warehouse/furniture/bulk','PATCH',
            {ids:[furniture.id],changes:{doorLeaves:1,glassFrame:false}});
        assert.equal(changed.status,200);
        const data=(await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture[0];
        assert.equal(data.doorLeaves,1);
        assert.equal(data.glassFrame,false);
        assert.equal(data.shelves[0].glassFrame,null);
        const copied=(await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/copy`,'POST',
            {name:'Kopie',withShelves:true})).data;
        assert.equal(copied.glassFrame,false);
        assert.equal(copied.doorLeaves,1);
        const invalid=await api(ctx.base,'/api/warehouse/furniture/bulk','PATCH',
            {ids:[furniture.id],changes:{glassFrame:'true'}});
        assert.equal(invalid.status,400);
        const invalidLeaves=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}`,'PATCH',
            {...data,doorLeaves:3});
        assert.equal(invalidLeaves.status,400);
    }finally {await ctx.stop();}
});
