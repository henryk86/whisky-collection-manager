import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer,requestJson as api} from '../helpers/server.js';
import {normalizeTastingSubject} from '../../shared/tasting-subject.js';
import {parseRoute,routeUrl} from '../../public/js/navigation/routes.js';

const day='2026-11-15';
const valid = {bottling:{name:' Tasted elsewhere ',distillery:'Islay producer',bottler:'Private bottler',ageYears:12,abv:48.5,releaseYear:2018},tastedOn:day,rating:88};

test('one standalone tasting is one record; it does not create an inventory or subject object',async()=>{
    const server=await startTestServer();
    try {
        const owned=(await api(server.base,'/api/bottlings','POST',{name:'Owned Whisky'})).data.bottling;
        const ownedEndpoint=`/api/bottlings/${owned.id}/tastings`;
        assert.equal((await api(server.base,ownedEndpoint,'POST',{tastedOn:day,rating:93})).status,201);
        const first=await api(server.base,'/api/external-tastings','POST',valid);
        assert.equal(first.status,201);
        assert.equal(first.data.bottling.name,'Tasted elsewhere');
        assert.equal(first.data.bottling.abv,48.5);
        const second=await api(server.base,'/api/external-tastings','POST',{bottling:{name:'Another whisky'},tastedOn:'2026-10-01'});
        assert.equal(second.status,201);
        const firstId=first.data.id;
        assert.notEqual(firstId,second.data.id);
        assert.equal((await api(server.base,'/api/external-tastings')).data.length,2);
        assert.equal((await api(server.base,`/api/external-tastings/${firstId}`)).data.rating,88);
        assert.equal((await api(server.base,`${ownedEndpoint}/${firstId}`)).status,404);
        let data=(await api(server.base,'/api/collection')).data;
        assert.equal(data.bottlings.length,1);
        assert.equal(data.bottlings[0].tastings[0].rating,93);
        assert.equal(data.externalTastings.length,2);
        assert.equal(data.tastingBottlings,undefined);
        assert.equal(data.externalTastings[0].bottling.name,'Tasted elsewhere');
        const cleared=await api(server.base,`/api/external-tastings/${firstId}`,'PATCH',{
            rating:null, flavorProfile:null, bottling:{name:'Corrected name'}
        });
        assert.equal(cleared.status,200);
        assert.equal(cleared.data.rating,null);
        assert.equal(cleared.data.bottling.name,'Corrected name');
        assert.equal(cleared.data.bottling.ageYears,12,'partial subject edit preserves details');
        for (const bad of [
            {bottling:{name:''},tastedOn:day},
            {bottling:{name:'X',abv:120},tastedOn:day},
            {bottling:{name:'X',ageYears:'NaN'},tastedOn:day},
            {bottling:{name:'X',releaseYear:2018.5},tastedOn:day},
            {bottling:{name:'X',tastings:[]},tastedOn:day},
            {bottling:{name:'X'},tastedOn:'not-a-date'},
        ]) assert.equal((await api(server.base,'/api/external-tastings','POST',bad)).status,400);
        assert.equal((await api(server.base,'/api/tasting-bottlings','POST',{name:'Obsolete'})).status,404);
        assert.equal((await api(server.base,`/api/external-tastings/${firstId}`,'DELETE')).status,200);
        data=(await api(server.base,'/api/collection')).data;
        assert.equal(data.externalTastings.length,1);
        assert.equal(data.externalTastings[0].id,second.data.id);
        assert.equal(data.bottlings[0].tastings[0].rating,93,'deleting standalone must not affect collection');
    } finally {await server.stop();}
});

test('standalone URL is a single editor, not a second bottling or tasting overview',()=>{
    assert.equal(normalizeTastingSubject({name:'W'}).ageYears,null);
    assert.throws(()=>normalizeTastingSubject({name:'Z',bottles:[]}));
    assert.deepEqual(parseRoute('?view=tastings'),{page:'tastings-home',selected:null});
    const id='external-a';
    const editorUrl=routeUrl('external-tasting',id);
    assert.deepEqual(parseRoute(editorUrl.split('?')[1]),{page:'external-tasting',selected:id,tastingId:null});
    assert.equal(parseRoute(routeUrl('tastings','owned-b').split('?')[1]).page,'tastings');
    assert.throws(()=>routeUrl('external-tasting','not valid'));
});

test('standalone tasting can be assigned once to an existing owned bottling with no lost fields or duplicate',async()=>{
    const server=await startTestServer();
    try {
        const owned=(await api(server.base,'/api/bottlings','POST',{name:'Purchased later'})).data.bottling;
        const second=(await api(server.base,'/api/bottlings','POST',{name:'Other owned'})).data.bottling;
        const tasting={bottling:{name:'Sample before purchase',abv:55},tastedOn:'2026-10-10',title:'At a tasting',
            tastingNotes:{nose:'honey',palate:'orange',finish:'long'},flavorProfile:{woody:8,cereal:2,peaty:1,fruity:7,floral:4,winey:2,feinty:0,sulphury:0},
            whiskyColor:'butter',rating:92};
        // The full flavor profile is stored as a normalized 8-axis object.
        const created=await api(server.base,'/api/external-tastings','POST',tasting);
        assert.equal(created.status,201);
        const id=created.data.id;
        const apiPath=`/api/external-tastings/${id}/assign`;
        assert.equal((await api(server.base,apiPath,'POST',{})).status,400);
        assert.equal((await api(server.base,apiPath,'POST',{bottlingId:'missing'})).status,404);
        assert.equal((await api(server.base,apiPath,'POST',{bottlingId:owned.id,unexpected:true})).status,400);
        assert.equal((await api(server.base,'/api/collection')).data.externalTastings.length,1,'failed assigns must not consume source');
        const moved=await api(server.base,apiPath,'POST',{bottlingId:owned.id});
        assert.equal(moved.status,200);
        assert.deepEqual(moved.data,{bottlingId:owned.id,tastingId:id});
        const collection=(await api(server.base,'/api/collection')).data;
        assert.equal(collection.externalTastings.length,0);
        assert.equal(collection.bottlings.length,2,'conversion creates no new inventory item');
        const target=collection.bottlings.find(b=>b.id===owned.id);
        assert.equal(target.tastings.length,1);
        assert.equal(target.tastings[0].id,id,'preserve tasting identity');
        assert.equal(target.tastings[0].createdAt,created.data.createdAt);
        for (const key of ['tastedOn','title','rating','whiskyColor','flavorProfile','tastingNotes'])
            assert.deepEqual(target.tastings[0][key],created.data[key],`${key} must not change`);
        assert.equal(target.tastings[0].rating,92);
        assert.equal(collection.bottlings.find(b=>b.id===second.id).tastings.length,0);
        assert.equal((await api(server.base,apiPath,'POST',{bottlingId:owned.id})).status,404,'no double assignment');
        assert.equal((await api(server.base,`/api/bottlings/${owned.id}/tastings/${id}`)).status,200);
    } finally {await server.stop();}
});

test('attaching an older standalone tasting does not replace the latest owned rating',async()=>{
    const server=await startTestServer();
    try {
        const owned=(await api(server.base,'/api/bottlings','POST',{name:'Collection item'})).data.bottling;
        assert.equal((await api(server.base,`/api/bottlings/${owned.id}/tastings`,'POST',{tastedOn:'2026-11-15',rating:89})).status,201);
        const external=(await api(server.base,'/api/external-tastings','POST',{
            bottling:{name:'Whisky before acquisition'},tastedOn:'2026-02-01',rating:97
        })).data;
        const assigned=await api(server.base,`/api/external-tastings/${external.id}/assign`,'POST',{bottlingId:owned.id});
        assert.equal(assigned.status,200);
        const target=(await api(server.base,'/api/collection')).data.bottlings.find(x=>x.id===owned.id);
        assert.equal(target.tastings.length,2);
        assert.equal(target.tastings.find(t=>t.tastedOn==='2026-11-15').rating,89,'latest by tasting date is still authoritative');
    } finally {await server.stop();}
});
