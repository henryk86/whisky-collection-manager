import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer,requestJson as api} from '../helpers/server.js';

const day='2026-11-15';
const createFlight=(base,name='Flight')=>api(base,'/api/tasting-flights','POST',{name,date:day,notes:''});

// Existing owned and external records are referenced by ID, not copied.
test('flight membership is ordered, exclusive, and preserves independent tastings',async()=>{
    const server=await startTestServer();
    try {
        const base=server.base;
        const owned=(await api(base,'/api/bottlings','POST',{name:'Collection release'})).data.bottling;
        const note=(await api(base,`/api/bottlings/${owned.id}/tastings`,'POST',{tastedOn:day,rating:88})).data;
        const external=(await api(base,'/api/external-tastings','POST',{bottling:{name:'Tasted elsewhere'},tastedOn:day,rating:92})).data;
        const flight=(await createFlight(base,'Islay comparison')).data;
        const other=(await createFlight(base,'Other session')).data;
        const endpoint=`/api/tasting-flights/${flight.id}/tastings`;
        assert.equal((await api(base,endpoint,'PUT',{tastingIds:[external.id,note.id]})).status,200);
        assert.deepEqual((await api(base,`/api/tasting-flights/${flight.id}`)).data.tastingIds,[external.id,note.id]);
        assert.equal((await api(base,`/api/tasting-flights/${other.id}/tastings`,'PUT',{tastingIds:[note.id]})).status,409);
        assert.equal((await api(base,endpoint,'PUT',{tastingIds:[note.id,note.id]})).status,400);
        assert.equal((await api(base,endpoint,'PUT',{tastingIds:[note.id,'missing']})).status,400);
        assert.deepEqual((await api(base,`/api/tasting-flights/${other.id}`)).data.tastingIds,[]);
        assert.equal((await api(base,endpoint,'PUT',{tastingIds:[note.id,external.id]})).status,200);
        const moved=await api(base,`/api/external-tastings/${external.id}/assign`,'POST',{bottlingId:owned.id});
        assert.equal(moved.status,200);
        const after=(await api(base,'/api/collection')).data;
        assert.deepEqual(after.tastingFlights.find(f=>f.id===flight.id).tastingIds,[note.id,external.id],
            'acquiring an unowned whisky does not change the tasting identity or order');
        assert.equal(after.bottlings[0].tastings.length,2);
        assert.equal(after.bottlings[0].tastings.find(t=>t.id===external.id).rating,92);
        assert.equal(after.bottlings[0].rating,undefined,'no derived summary is persisted');
        assert.equal(after.externalTastings.length,0);
        assert.equal((await api(base,`/api/bottlings/${owned.id}/tastings/${note.id}`,'DELETE')).status,200);
        assert.deepEqual((await api(base,`/api/tasting-flights/${flight.id}`)).data.tastingIds,[external.id]);
    } finally {await server.stop();}
});

test('flight creates new owned and external tasting atomically, never creating inventory for external',async()=>{
    const server=await startTestServer();
    try {
        const base=server.base;
        const owned=(await api(base,'/api/bottlings','POST',{name:'Owned'})).data.bottling;
        const flight=(await createFlight(base)).data;
        const path=`/api/tasting-flights/${flight.id}/tastings`;
        const first=await api(base,path,'POST',{bottlingId:owned.id,tastedOn:day,rating:75,title:'One'});
        assert.equal(first.status,201);
        assert.equal(first.data.bottlingId,owned.id);
        const external=await api(base,path,'POST',{bottling:{name:'Bar whisky',abv:46},tastedOn:day,rating:87});
        assert.equal(external.status,201);
        assert.equal(external.data.bottlingId,null);
        assert.equal((await api(base,path,'POST',{bottlingId:'unknown',tastedOn:day})).status,404);
        assert.equal((await api(base,path,'POST',{bottling:{name:''},tastedOn:day})).status,400);
        const data=(await api(base,'/api/collection')).data;
        assert.equal(data.bottlings.length,1);
        assert.equal(data.externalTastings.length,1);
        assert.equal(data.bottlings[0].tastings[0].id,first.data.record.id);
        assert.deepEqual(data.tastingFlights[0].tastingIds,[first.data.record.id,external.data.record.id]);
        assert.equal((await api(base,`/api/external-tastings/${external.data.record.id}`,'DELETE')).status,200);
        assert.deepEqual((await api(base,`/api/tasting-flights/${flight.id}`)).data.tastingIds,[first.data.record.id]);
    } finally {await server.stop();}
});

test('deleting a flight only dissolves the grouping; editing data is validated',async()=>{
    const server=await startTestServer();
    try {
        const base=server.base;
        const external=(await api(base,'/api/external-tastings','POST',{bottling:{name:'Whisky'},tastedOn:day,rating:80})).data;
        assert.equal((await createFlight(base,'')).status,400);
        assert.equal((await api(base,'/api/tasting-flights','POST',{name:'No date'})).status,400);
        const flight=(await createFlight(base)).data;
        const endpoint=`/api/tasting-flights/${flight.id}`;
        assert.equal((await api(base,endpoint,'PATCH',{name:'Revised',date:day,notes:'Second whisky felt sweeter'})).status,200);
        assert.equal((await api(base,endpoint+'/tastings','PUT',{tastingIds:[external.id]})).status,200);
        assert.equal((await api(base,endpoint,'PATCH',{notes:7})).status,400);
        assert.equal((await api(base,endpoint,'DELETE')).status,200);
        assert.equal((await api(base,endpoint)).status,404);
        assert.equal((await api(base,`/api/external-tastings/${external.id}`)).data.rating,80);
        const fresh=(await createFlight(base)).data;
        assert.equal((await api(base,`/api/tasting-flights/${fresh.id}/tastings`,'PUT',{tastingIds:[external.id]})).status,200);
    } finally {await server.stop();}
});
