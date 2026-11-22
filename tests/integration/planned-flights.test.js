import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer,requestJson as api} from '../helpers/server.js';
const date='2026-11-22';
test('planned flights are persistent but never create tastings until started',async()=>{
    const server=await startTestServer();
    try {
        const base=server.base;
        const created=await api(base,'/api/bottlings','POST',{name:'Flight whisky',firstBottle:{status:'open',inventoryNumber:'000101'}});
        assert.equal(created.status,201);
        const {bottling,bottle}=created.data;
        const unplanned=(await api(base,'/api/bottlings','POST',{
            name:'Another whisky',firstBottle:{status:'open',inventoryNumber:'000102'}
        })).data;
        const body={name:'Future session',date,notes:'Plan only',phase:'planned',planItems:[{bottlingId:bottling.id,bottleId:bottle.id,reason:'manual'}]};
        const fresh=await api(base,'/api/tasting-flights','POST',body);
        assert.equal(fresh.status,201,JSON.stringify(fresh.data));
        const id=fresh.data.id;
        assert.equal(fresh.data.phase,'planned');
        assert.deepEqual(fresh.data.tastingIds,[]);
        assert.equal((await api(base,`/api/tasting-flights/${id}/tastings`,'POST',{bottlingId:bottling.id,tastedOn:date})).status,400);
        assert.equal((await api(base,`/api/tasting-flights/${id}`,'PATCH',{planItems:[body.planItems[0],body.planItems[0]]})).status,400);
        assert.equal((await api(base,'/api/collection')).data.bottlings[0].tastings.length,0);
        assert.equal((await api(base,`/api/tasting-flights/${id}`,'PATCH',{phase:'completed'})).status,400);
        assert.equal((await api(base,`/api/tasting-flights/${id}`,'PATCH',{phase:'inProgress'})).status,200);
        assert.equal((await api(base,`/api/tasting-flights/${id}/tastings`,'POST',{
            bottlingId:unplanned.bottling.id,tastedOn:date
        })).status,400,'planned flights reject a tasting of a different bottling');
        const note=await api(base,`/api/tasting-flights/${id}/tastings`,'POST',{bottlingId:bottling.id,tastedOn:date,rating:85});
        assert.equal(note.status,201,JSON.stringify(note.data));
        assert.equal((await api(base,`/api/tasting-flights/${id}/tastings`,'POST',{
            bottlingId:bottling.id,tastedOn:date
        })).status,400,'planned member can only be recorded once');
        assert.equal((await api(base,`/api/tasting-flights/${id}`,'PATCH',{phase:'completed'})).status,200);
        assert.equal((await api(base,`/api/tasting-flights/${id}/tastings`,'POST',{bottlingId:bottling.id,tastedOn:date})).status,400);
        const persisted=(await api(base,'/api/collection')).data;
        assert.equal(persisted.tastingFlights[0].planItems[0].bottleId,bottle.id);
        assert.deepEqual(persisted.tastingFlights[0].tastingIds,[note.data.record.id]);
        assert.equal(persisted.bottlings.find(b=>b.id===bottling.id).tastings.length,1);
        // Deleting a real tasting later must not invalidate the saved historical plan.
        assert.equal((await api(base,`/api/bottlings/${bottling.id}/tastings/${note.data.record.id}`,'DELETE')).status,200);
        const afterDelete=(await api(base,'/api/collection')).data;
        assert.equal(afterDelete.tastingFlights[0].phase,'completed');
        assert.deepEqual(afterDelete.tastingFlights[0].tastingIds,[]);
        assert.equal(afterDelete.tastingFlights[0].planItems[0].bottleId,bottle.id);
    } finally {await server.stop();}
});
test('saved collection views persist through collection API and reject unsafe payloads atomically',async()=>{
    const server=await startTestServer();
    try {
        const base=server.base;
        const view={id:'view-1',name:'Rauchig',filters:{search:'',status:'open',completion:'all',distillery:'all',rating:'all',volumeType:'all',flavorCriteria:[{axis:'smoky',min:7,max:10}],profileMissing:false},
            display:{sort:'name',view:'table',mode:'bottlings',columns:{bottlings:['name','rating'],bottles:['name','inventory']}}};
        assert.equal((await api(base,'/api/settings/saved-views','PUT',{views:[view]})).status,200);
        assert.deepEqual((await api(base,'/api/collection')).data.settings.savedViews,[view]);
        assert.equal((await api(base,'/api/settings/saved-views','PUT',{views:[{...view,id:'view-2',filters:{...view.filters,flavorCriteria:[{axis:'smoky',min:11,max:11}]}}]})).status,400);
        assert.deepEqual((await api(base,'/api/collection')).data.settings.savedViews,[view]);
        assert.equal((await api(base,'/api/settings','PATCH',{establishedYear:2015})).status,200);
        assert.deepEqual((await api(base,'/api/collection')).data.settings.savedViews,[view]);
    } finally {await server.stop();}
});
