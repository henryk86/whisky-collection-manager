import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, requestJson as api } from '../helpers/server.js';

test('door ranges persist, reject overlaps, survive copies and adjust when a shelf is removed',async()=>{
    const ctx=await startTestServer();
    try {
        const room=(await api(ctx.base,'/api/warehouse/rooms','POST',{name:'Raum',width:8,height:5})).data;
        const furniture=(await api(ctx.base,`/api/warehouse/rooms/${room.id}/furniture`,'POST',
            {name:'Regal',type:'regal',x:0,y:0,width:1.2,depth:0.5,rotation:0,elevation:0,itemHeight:2})).data;
        const shelves=[];
        for(let i=0;i<5;i++) shelves.push((await api(ctx.base,`/api/warehouse/furniture/${furniture.id}/shelves`,'POST',
            {name:`Fach ${i+1}`,heightCm:40,capacity:i===0?0:5,front:'open'})).data);
        const ranges=[{from:1,to:2,front:'door',doorLeaves:1,glassFrame:null},
            {from:3,to:5,front:'glass',doorLeaves:2,glassFrame:true}];
        const endpoint=`/api/warehouse/furniture/${furniture.id}`;
        const updated=await api(ctx.base,endpoint,'PATCH',{...furniture,doorRanges:ranges});
        assert.equal(updated.status,200);
        assert.deepEqual(updated.data.doorRanges,ranges);
        const invalid=await api(ctx.base,endpoint,'PATCH',{...updated.data,doorRanges:[...ranges,{from:2,to:3,front:'door'}]});
        assert.equal(invalid.status,400);
        const outOfRange=await api(ctx.base,endpoint,'PATCH',{...updated.data,doorRanges:[{from:1,to:6,front:'glass'}]});
        assert.equal(outOfRange.status,400);
        const copy=await api(ctx.base,`${endpoint}/copy`,'POST',{withShelves:true});
        assert.equal(copy.status,201);
        assert.deepEqual(copy.data.doorRanges,ranges);
        const deleteShelf=await api(ctx.base,`/api/warehouse/shelves/${shelves[1].id}`,'DELETE');
        assert.equal(deleteShelf.status,200);
        const after=(await api(ctx.base,'/api/warehouse')).data.rooms[0].furniture.find(f=>f.id===furniture.id);
        assert.deepEqual(after.doorRanges.map(r=>[r.from,r.to]),[[1,1],[2,4]]);
    } finally {await ctx.stop();}
});
