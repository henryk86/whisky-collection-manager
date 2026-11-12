import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, requestJson as api } from '../helpers/server.js';

const furniture = (name, x, y, extra={}) => ({name,type:'schrank',x,y,width:1,depth:1,rotation:0,elevation:0,itemHeight:1.8,...extra});

test('create/update collision checks enforce 3D volumes but allow stacked and touching furniture',async()=>{
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Room',width:5,height:4})).data;
        const post=input=>api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',input);
        const lower=(await post(furniture('Floor',0,0))).data;
        assert.equal((await post(furniture('Collision',.5,.5))).status,409);
        const exact=(await post(furniture('Atop',0,0,{elevation:1.8,itemHeight:.4}))).data;
        assert.equal(exact.elevation,1.8);
        assert.equal((await post(furniture('Overlapping vertical',.5,0,{elevation:1.79,itemHeight:.4}))).status,409);
        assert.equal((await post(furniture('Alongside',1,0))).status,201);
        const far=(await post(furniture('Far',3,0))).data;
        const persisted=fs.readFileSync(path.join(ctx.dir,'data/warehouse.json'));
        assert.equal((await api(ctx.base,`/api/warehouse/furniture/${far.id}`,'PATCH',{...far,x:.5})).status,409);
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/warehouse.json')),persisted);
        assert.equal((await api(ctx.base,`/api/warehouse/furniture/${far.id}`,'PATCH',{...far,x:.5,elevation:1.8,itemHeight:.4})).status,409,
            'upper shelf at this position intersects the existing upper shelf');
        const success=await api(ctx.base,`/api/warehouse/furniture/${far.id}`,'PATCH',{...far,x:0,y:0,elevation:2.2,itemHeight:.4});
        assert.equal(success.status,200);
        assert.equal(success.data.elevation,2.2);
        const rotated=(await post(furniture('Rotated',2,2,{width:1.5,depth:.5,rotation:90}))).data;
        assert.equal((await post(furniture('Hits rotated',2.2,2.8,{width:.5,depth:.5}))).status,409);
        assert.equal((await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture.length,5);
        assert.ok(rotated.id && lower.id);
    } finally {await ctx.stop();}
});

test('bulk edits detect collision with unmoved furniture and between selected furniture atomically',async()=>{
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Room',width:6,height:4})).data;
        const post=async x=> (await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',furniture(`Cabinet ${x}`,x,0,{width:.8,depth:1,elevation:x===0?0:2}))).data;
        const a=await post(0),b=await post(1),c=await post(2);
        const url='/api/warehouse/furniture/bulk';
        const before=fs.readFileSync(path.join(ctx.dir,'data/warehouse.json'));
        assert.equal((await api(ctx.base,url,'PATCH',{ids:[b.id,c.id],changes:{elevation:0,width:1.4}})).status,409,
            'two updated furniture items would collide with each other and the floor item');
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/warehouse.json')),before);
        assert.equal((await api(ctx.base,url,'PATCH',{ids:[b.id,c.id],changes:{elevation:0}})).status,200,
            'adjacent furniture can share an elevation without overlapping');
        const after=fs.readFileSync(path.join(ctx.dir,'data/warehouse.json'));
        assert.equal((await api(ctx.base,url,'PATCH',{ids:[b.id,c.id],changes:{width:1.5}})).status,409,
            'expanded furniture would collide with a different selected item');
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,'data/warehouse.json')),after);
        assert.ok(a.id);
    } finally {await ctx.stop();}
});
