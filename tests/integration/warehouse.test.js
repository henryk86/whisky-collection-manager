import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, requestJson as api } from '../helpers/server.js';
import { inspectReadableZip } from '../../shared/backup-zip.js';

const pass = 'SicheresTestpasswort-2026-mindestens-14!';

test('warehouse is persisted independently of collection.json, assignments are per physical bottle, and backups contain warehouse.json', async () => {
    const ctx = await startTestServer();
    try {
        let w = await api(ctx.base, '/api/warehouse');
        assert.equal(w.status, 200);
        assert.deepEqual(w.data.rooms, []);
        const room = await api(ctx.base, '/api/warehouse/rooms', 'POST', {name: 'Whiskyzimmer', width: 5, height: 4});
        assert.equal(room.status, 201);
        const furniture = await api(ctx.base, `/api/warehouse/rooms/${room.data.id}/furniture`, 'POST', {name: 'Regal A', type: 'regal', x: 1, y: 1, width: 2, depth: 0.6, rotation: 0});
        assert.equal(furniture.status, 201);
        const shelf = await api(ctx.base, `/api/warehouse/furniture/${furniture.data.id}/shelves`, 'POST', {name: 'Fach 1', capacity: 1});
        assert.equal(shelf.status, 201);
        const bottling = await api(ctx.base, '/api/bottlings', 'POST', { name:'Whisky', firstBottle: {inventoryNumber:'0001', status:'closed'} });
        assert.equal(bottling.status, 201);
        const bottle2 = await api(ctx.base, '/api/bottles', 'POST', {bottlingId:bottling.data.bottling.id,inventoryNumber:'0002'});
        assert.equal(bottle2.status, 201);
        const bottleId=bottling.data.bottle.id;
        const collectionBeforeWarehouseChange = fs.readFileSync(path.join(ctx.dir, 'data/collection.json'));
        const first = await api(ctx.base, `/api/warehouse/bottles/${bottleId}`, 'PUT', {shelfId:shelf.data.id});
        assert.equal(first.status, 200);
        const second = await api(ctx.base, `/api/warehouse/bottles/${bottle2.data.id}`, 'PUT', {shelfId:shelf.data.id});
        assert.equal(second.status, 409, 'capacity prevents over-occupation');
        w = await api(ctx.base, '/api/warehouse');
        assert.equal(w.data.assignments[bottleId], shelf.data.id);
        assert.equal(w.data.bottles.length, 2);
        const deleteRoom = await api(ctx.base, `/api/warehouse/rooms/${room.data.id}`, 'DELETE');
        assert.equal(deleteRoom.status, 409, 'occupied room may not be deleted');
        const move = await api(ctx.base, `/api/warehouse/bottles/${bottleId}`, 'PUT', {shelfId:null});
        assert.equal(move.status, 200);
        const delShelf = await api(ctx.base, `/api/warehouse/shelves/${shelf.data.id}`, 'DELETE');
        assert.equal(delShelf.status, 200);
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/collection.json')), collectionBeforeWarehouseChange, 'Lageroperationen dürfen collection.json nicht ändern');
        const saved = JSON.parse(fs.readFileSync(path.join(ctx.dir, 'data/warehouse.json')));
        assert.equal(saved.rooms.length, 1);
        assert.equal(saved.rooms[0].furniture.length, 1);
        assert.deepEqual(saved.assignments, {});
        const response = await fetch(ctx.base + '/api/export/zip', {headers:{'X-Backup-Admin-Token':'a'.repeat(64)}});
        assert.equal(response.status, 200);
        const zipPath=path.join(ctx.dir,'warehouse-backup.zip');
        fs.writeFileSync(zipPath,Buffer.from(await response.arrayBuffer()));
        const extract=path.join(ctx.dir,'extracted');
        inspectReadableZip(zipPath,extract,pass);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(extract,'data/warehouse.json'))),saved);
        const exported = await fetch(ctx.base + '/api/export/json');
        const json=await exported.json();
        assert.equal(json.rooms, undefined);
        assert.equal(json.assignments, undefined);
        assert.equal(fs.existsSync(path.join(ctx.dir,'data/warehouse.json')),true);
    } finally {await ctx.stop();}
});

test('warehouse rejects out-of-bounds furniture, invalid inputs and missing bottles without corruption', async () => {
    const ctx = await startTestServer();
    try {
        const room = await api(ctx.base, '/api/warehouse/rooms', 'POST', {name:'Small room',width:2,height:2});
        assert.equal((await api(ctx.base, `/api/warehouse/rooms/${room.data.id}/furniture`, 'POST', {name:'Too big',type:'regal',x:1.5,y:1.5,width:1,depth:1,rotation:0})).status,400);
        assert.equal((await api(ctx.base, '/api/warehouse/bottles/no-such-bottle', 'PUT', {shelfId:null})).status,404);
        assert.equal((await api(ctx.base, '/api/warehouse/rooms', 'POST', {name:'  ',width:2,height:2})).status,400);
        assert.equal((await api(ctx.base, '/api/warehouse/rooms', 'POST', {name:'<script>alert(1)</script>',width:-1,height:2})).status,400);
        const f=await api(ctx.base, `/api/warehouse/rooms/${room.data.id}/furniture`, 'POST', {name:'Display',type:'vitrine',x:0,y:0,width:1.5,depth:0.5,rotation:90});
        assert.equal(f.status,201);
        const cannotShrink=await api(ctx.base, `/api/warehouse/rooms/${room.data.id}`, 'PATCH', {name:'Too small',width:1,height:1});
        assert.equal(cannotShrink.status,400);
        const saved=await api(ctx.base,'/api/warehouse');
        assert.equal(saved.data.rooms.length,1);
        assert.equal(saved.data.rooms[0].width,2);
        assert.equal(saved.data.rooms[0].furniture.length,1);
    } finally { await ctx.stop(); }
});

test('deleted physical bottles no longer appear as assigned and do not block shelf removal', async () => {
    const ctx = await startTestServer();
    try {
        const room = (await api(ctx.base, '/api/warehouse/rooms', 'POST', {name:'Zimmer',width:3,height:3})).data;
        const furniture = (await api(ctx.base, `/api/warehouse/rooms/${room.id}/furniture`, 'POST', {name:'Regal',type:'regal',x:0,y:0,width:1,depth:0.5})).data;
        const shelf = (await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/shelves`, 'POST', {name:'Fach'})).data;
        const bottling = (await api(ctx.base, '/api/bottlings', 'POST', {name:'Test Whisky',firstBottle:{inventoryNumber:'123456'}})).data;
        const bottleId = bottling.bottle.id;
        assert.equal((await api(ctx.base, `/api/warehouse/bottles/${bottleId}`, 'PUT', {shelfId:shelf.id})).status,200);
        assert.equal((await api(ctx.base, `/api/bottles/${bottleId}`, 'DELETE')).status,200);
        const after = (await api(ctx.base, '/api/warehouse')).data;
        assert.equal(after.assignments[bottleId],undefined);
        assert.equal(after.staleAssignments,1);
        assert.equal((await api(ctx.base, `/api/warehouse/shelves/${shelf.id}`, 'DELETE')).status,200);
        const warehouse = (await api(ctx.base,'/api/warehouse')).data;
        assert.equal(warehouse.rooms[0].furniture[0].shelves.length,0);
        assert.equal(warehouse.staleAssignments,0);
    } finally { await ctx.stop(); }
});

test('warehouse copies furniture with or without shelves and copies individual shelves without physical bottle assignments', async () => {
    const ctx = await startTestServer();
    try {
        const room = (await api(ctx.base, '/api/warehouse/rooms', 'POST', {name:'Lagerraum',width:5,height:4})).data;
        const room2 = (await api(ctx.base, '/api/warehouse/rooms', 'POST', {name:'Nebenraum',width:4,height:4})).data;
        const furniture = (await api(ctx.base, `/api/warehouse/rooms/${room.id}/furniture`, 'POST', {
            name:'Regal A',type:'regal',x:0,y:0,width:1.2,depth:0.5,rotation:90
        })).data;
        const shelf1 = (await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/shelves`, 'POST', {name:'Fach 1',capacity:5})).data;
        const shelf2 = (await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/shelves`, 'POST', {name:'Fach 2',capacity:null})).data;
        const bottle = (await api(ctx.base, '/api/bottlings', 'POST', {name:'Some whisky',firstBottle:{inventoryNumber:'1000'}})).data.bottle;
        const assigned = await api(ctx.base, `/api/warehouse/bottles/${bottle.id}`, 'PUT', {shelfId:shelf1.id});
        assert.equal(assigned.status,200);
        const collectionBefore = fs.readFileSync(path.join(ctx.dir,'data/collection.json'));

        const withShelves = await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/copy`, 'POST', {withShelves:true});
        assert.equal(withShelves.status,201);
        assert.notEqual(withShelves.data.id,furniture.id);
        assert.equal(withShelves.data.name,'Regal A (Kopie)');
        assert.equal(withShelves.data.shelves.length,2);
        assert.deepEqual(withShelves.data.shelves.map(s=>s.name),['Fach 1','Fach 2']);
        assert.deepEqual(withShelves.data.shelves.map(s=>s.capacity),[5,null]);
        assert.ok(withShelves.data.shelves.every(s=>s.id!==shelf1.id && s.id!==shelf2.id));
        assert.equal(withShelves.data.rotation,90);
        assert.ok(withShelves.data.x!==furniture.x || withShelves.data.y!==furniture.y);
        const blank = await api(ctx.base, `/api/warehouse/furniture/${furniture.id}/copy`, 'POST', {withShelves:false,roomId:room2.id,name:'Regal für Samples'});
        assert.equal(blank.status,201);
        assert.equal(blank.data.name,'Regal für Samples');
        assert.deepEqual(blank.data.shelves,[]);
        assert.equal(blank.data.type,'regal');
        const shelfCopy = await api(ctx.base, `/api/warehouse/shelves/${shelf1.id}/copy`, 'POST', {furnitureId:blank.data.id});
        assert.equal(shelfCopy.status,201);
        assert.notEqual(shelfCopy.data.id,shelf1.id);
        assert.equal(shelfCopy.data.capacity,5);
        assert.equal(shelfCopy.data.name,'Fach 1 (Kopie)');
        const shelfCopy2 = await api(ctx.base, `/api/warehouse/shelves/${shelf1.id}/copy`, 'POST', {});
        assert.equal(shelfCopy2.status,201);
        assert.equal(shelfCopy2.data.name,'Fach 1 (Kopie)');

        const saved = (await api(ctx.base,'/api/warehouse')).data;
        assert.equal(saved.rooms[0].furniture.length,2);
        assert.equal(saved.rooms[1].furniture.length,1);
        assert.deepEqual(saved.assignments,{[bottle.id]:shelf1.id},'copied shelves cannot inherit assignments');
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/collection.json')),collectionBefore,'collection data must not change');
        assert.equal((await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/copy`,'POST',{withShelves:'yes'})).status,400);
        assert.equal((await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/copy`,'POST',{roomId:'missing'})).status,404);
        assert.equal((await api(ctx.base,`/api/warehouse/shelves/no-such-shelf/copy`,'POST',{})).status,404);
    } finally { await ctx.stop(); }
});

test('warehouse copies reject a physically full room and include existing per-bottle photo paths for shelf thumbnails', async () => {
    const ctx = await startTestServer();
    try {
        const room = (await api(ctx.base, '/api/warehouse/rooms','POST',{name:'Small',width:1,height:1})).data;
        const furniture = (await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',{name:'Full room',type:'regal',width:1,depth:1,x:0,y:0})).data;
        const noRoom = await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/copy`,'POST',{});
        assert.equal(noRoom.status,409);
        assert.equal((await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture.length,1);
        const bottle = (await api(ctx.base,'/api/bottlings','POST',{name:'Bottle with photo'})).data.bottle;
        const before = (await api(ctx.base,'/api/warehouse')).data.bottles.find(b=>b.id===bottle.id);
        assert.equal(before.photoPath,null);
        const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
        const photo = await api(ctx.base,`/api/bottles/${bottle.id}/photos`,'POST',{image});
        assert.equal(photo.status,201);
        const after = (await api(ctx.base,'/api/warehouse')).data.bottles.find(b=>b.id===bottle.id);
        assert.equal(after.photoPath,photo.data.path);
        assert.ok(after.photoPath.startsWith(`images/${bottle.id}/`));
        const originalPhoto = await fetch(`${ctx.base}/${after.photoPath}`);
        assert.equal(originalPhoto.status,200);
    } finally { await ctx.stop(); }
});

test('elevated wall shelves may occupy the cabinet footprint and keep height values across copies and restarts', async () => {
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Whiskyraum',width:3,height:3})).data;
        const targetRoom=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Zielraum',width:1,height:1})).data;
        const cabinet=(await api(ctx.base,`/api/warehouse/rooms/${targetRoom.id}/furniture`,'POST',
            {name:'Schrank',type:'schrank',x:0,y:0,width:1,depth:1,rotation:0,elevation:0,itemHeight:1.8})).data;
        assert.equal(cabinet.elevation,0);
        const wall=await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Wandregal',type:'haengeregal',x:0,y:0,width:1,depth:1,rotation:0,elevation:1.8,itemHeight:0.4});
        assert.equal(wall.status,201);
        assert.equal(wall.data.elevation,1.8);
        assert.equal(wall.data.itemHeight,0.4);
        // In the target room the only free 2D footprint is directly above the cabinet.
        const copied=await api(ctx.base,`/api/warehouse/furniture/${wall.data.id}/copy`,'POST',
            {name:'Hängeregal über Schrank',roomId:targetRoom.id,withShelves:false});
        assert.equal(copied.status,201);
        assert.equal(copied.data.x,0);
        assert.equal(copied.data.y,0);
        assert.equal(copied.data.elevation,1.8);
        assert.equal(copied.data.itemHeight,0.4);
        const saved=JSON.parse(fs.readFileSync(path.join(ctx.dir,'data/warehouse.json'),'utf8'));
        assert.equal(saved.rooms.find(r=>r.id===targetRoom.id).furniture.length,2);
        assert.equal((await api(ctx.base,'/api/warehouse')).data.rooms.find(r=>r.id===targetRoom.id).furniture.length,2);
        assert.equal((await api(ctx.base,`/api/warehouse/furniture/${wall.data.id}`,'PATCH',
            {...wall.data,elevation:-1})).status,400);
        assert.equal((await api(ctx.base,`/api/warehouse/furniture/${wall.data.id}`,'PATCH',
            {...wall.data,itemHeight:0})).status,400);
    } finally { await ctx.stop(); }
});

test('warehouse backwards compatibility: older furniture without elevation or height remains readable', async () => {
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Altbau',width:3,height:3})).data;
        const furniture=(await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Altes Regal',type:'regal',x:0,y:0,width:1,depth:.5})).data;
        const rawPath=path.join(ctx.dir,'data/warehouse.json');
        const raw=JSON.parse(fs.readFileSync(rawPath,'utf8'));
        const old=raw.rooms[0].furniture.find(f=>f.id===furniture.id);
        delete old.elevation; delete old.itemHeight;
        fs.writeFileSync(rawPath,JSON.stringify(raw));
        const result=await api(ctx.base,'/api/warehouse');
        assert.equal(result.status,200);
        assert.equal(result.data.rooms[0].furniture[0].elevation,undefined);
        const edit=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}`,'PATCH',
            {...old,name:'Altes Regal neu'});
        assert.equal(edit.status,200);
        assert.equal(edit.data.elevation,0);
        assert.equal(edit.data.itemHeight,1.8);
    } finally { await ctx.stop(); }
});

test('bulk furniture editing is atomic: multi-rotation/elevation/height and invalid layout leave collection unchanged', async () => {
    const ctx=await startTestServer();
    try {
        const r=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Bulkroom',width:4,height:4})).data;
        const add=async (name,x)=> (await api(ctx.base,`/api/warehouse/rooms/${r.id}/furniture`,'POST',
            {name,type:'schrank',x,y:0.5,width:1.2,depth:0.5,rotation:0,elevation:0,itemHeight:1.8})).data;
        const a=await add('A',0.2),b=await add('B',2.4);
        const collectionBefore=fs.readFileSync(path.join(ctx.dir,'data/collection.json'));
        const url='/api/warehouse/furniture/bulk';
        const success=await api(ctx.base,url,'PATCH',{ids:[a.id,b.id],changes:{rotation:90,elevation:1,itemHeight:2}});
        assert.equal(success.status,200);
        assert.deepEqual(success.data.updated,[a.id,b.id]);
        assert.equal(success.data.count,2);
        const first=(await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture;
        for (const item of first){assert.equal(item.rotation,90);assert.equal(item.elevation,1);assert.equal(item.itemHeight,2);}
        const persisted=fs.readFileSync(path.join(ctx.dir,'data/warehouse.json'));
        const invalid=await api(ctx.base,url,'PATCH',{ids:[a.id,b.id],changes:{depth:2.5}});
        assert.equal(invalid.status,400,'second cabinet would leave the room');
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/warehouse.json')),persisted,'no partial updates after invalid bulk');
        for (const input of [
            {ids:[a.id,a.id],changes:{rotation:0}},
            {ids:[],changes:{rotation:0}},
            {ids:[a.id,b.id],changes:{}},
            {ids:[a.id],changes:{name:'Invalid'}},
            {ids:[a.id,'missing'],changes:{rotation:180}},
            {ids:[a.id,b.id],changes:{rotation:45}},
        ]) {
            const failed=await api(ctx.base,url,'PATCH',input);
            assert.ok(failed.status>=400,`must reject ${JSON.stringify(input)}`);
            assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/warehouse.json')),persisted);
        }
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/collection.json')),collectionBefore);
        const zero=await api(ctx.base,url,'PATCH',{ids:[a.id,b.id],changes:{elevation:0,rotation:0}});
        assert.equal(zero.status,200,'zero is an explicitly selected valid value');
        assert.deepEqual((await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture.map(f=>f.elevation),[0,0]);
    } finally {await ctx.stop();}
});

test('shelf capacity zero is persisted and rejects assignments', async () => {
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Raum',width:4,height:4})).data;
        const furniture=(await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',{name:'Regal',type:'regal',x:0,y:0,width:1,depth:0.5})).data;
        const shelf=await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',{name:'Leerfach',capacity:0});
        assert.equal(shelf.status,201);
        assert.equal(shelf.data.capacity,0);
        const bottling=(await api(ctx.base,'/api/bottlings','POST',{name:'Test',firstBottle:{inventoryNumber:'001',status:'closed'}})).data;
        const assigned=await api(ctx.base,`/api/warehouse/bottles/${bottling.bottle.id}`,'PUT',{shelfId:shelf.data.id});
        assert.equal(assigned.status,409);
        const saved=(await api(ctx.base,'/api/warehouse')).data;
        assert.equal(saved.rooms[0].furniture[0].shelves[0].capacity,0);
    } finally {await ctx.stop();}
});

test('multi-delete is atomic for occupied shelves and optional wall settings survive edits, copies and bulk updates', async () => {
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Wall room',width:6,height:5})).data;
        const create=async (name,x)=> (await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name,type:'regal',x,y:1,width:1,depth:0.5,rotation:90,leftSidePanel:true,rightSidePanel:false,backPanel:true})).data;
        const a=await create('A',0.5),b=await create('B',2),c=await create('C',3.5);
        assert.equal(a.leftSidePanel,true);
        assert.equal(a.backPanel,true);
        const shelf=(await api(ctx.base,`/api/warehouse/furniture/${a.id}/shelves`,'POST',{name:'Fach',capacity:2})).data;
        const bottled=(await api(ctx.base,'/api/bottlings','POST',{name:'Test Whisky',firstBottle:{inventoryNumber:'WALL-1',status:'closed'}})).data;
        assert.equal((await api(ctx.base,`/api/warehouse/bottles/${bottled.bottle.id}`,'PUT',{shelfId:shelf.id})).status,200);
        const before=fs.readFileSync(path.join(ctx.dir,'data/warehouse.json'));
        const url='/api/warehouse/furniture/bulk';
        const deleteUrl=url+'/delete';
        const blocked=await api(ctx.base,deleteUrl,'POST',{ids:[a.id,b.id]});
        assert.equal(blocked.status,409);
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/warehouse.json')),before);
        const invalid=await api(ctx.base,deleteUrl,'POST',{ids:[b.id,'unknown']});
        assert.equal(invalid.status,404);
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/warehouse.json')),before);
        const changed=await api(ctx.base,url,'PATCH',{ids:[b.id,c.id],changes:{leftSidePanel:false,rightSidePanel:true,backPanel:false}});
        assert.equal(changed.status,200);
        const changedRoom=(await api(ctx.base,'/api/warehouse')).data.rooms[0];
        for (const item of changedRoom.furniture.filter(f=>[b.id,c.id].includes(f.id))) {
            assert.equal(item.leftSidePanel,false);assert.equal(item.rightSidePanel,true);assert.equal(item.backPanel,false);
        }
        const copied=await api(ctx.base,`/api/warehouse/furniture/${b.id}/copy`,'POST',{name:'Kopie'});
        assert.equal(copied.status,201);
        assert.equal(copied.data.rightSidePanel,true);
        assert.equal((await api(ctx.base,deleteUrl,'POST',{ids:[b.id,c.id]})).data.count,2);
        assert.deepEqual((await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture.map(f=>f.id).sort(),[a.id,copied.data.id].sort());
        assert.equal((await api(ctx.base,`/api/warehouse/bottles/${bottled.bottle.id}`,'PUT',{shelfId:null})).status,200);
        assert.equal((await api(ctx.base,deleteUrl,'POST',{ids:[a.id,copied.data.id]})).status,200);
        assert.equal((await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture.length,0);
    } finally {await ctx.stop();}
});
