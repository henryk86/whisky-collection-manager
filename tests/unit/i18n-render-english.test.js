import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeLanguage, currentLanguage } from '../../public/js/i18n/index.js';
import { createAnalyticsView } from '../../public/js/views/analytics.js';
import { createHomeView } from '../../public/js/views/home.js';
import { createWarehouseView } from '../../public/js/views/warehouse.js';

const locale = name => JSON.parse(fs.readFileSync(new URL(`../../public/locales/${name}`, import.meta.url), 'utf8'));
const fetchLocale = async url => ({ok:true,json:async()=>locale(url.split('/').at(-1))});
const room = { id:'room-1', name:'Whiskyzimmer', width:4, height:3, furniture:[{id:'f1',name:'Mein Regal',type:'regal',x:0,y:0,width:1,depth:.5,rotation:0,shelves:[{id:'s1',name:'Fach 1',capacity:10}]}]};
const collection = {schemaVersion:4,settings:{},distilleries:[{id:'d1',name:'Ardbeg',country:'Schottland'}],bottlings:[{id:'b1',name:'Custom Islay',distilleryIds:['d1'],completionStatus:'complete',bottles:[{id:'p1',status:'closed',volumeType:'standard',volumeMl:700,inventoryNumber:'000001'}]}]};
const selectors = {allBottles:()=>collection.bottlings[0].bottles,bottles:()=>collection.bottlings[0].bottles,coverPhoto:()=>null,distilleryNames:()=> 'Ardbeg'};

test('English renders actual collection, analytics and warehouse controls, not German literals', async () => {
    const previous = {location:globalThis.location,document:globalThis.document,history:globalThis.history};
    const field = {addEventListener(){}};
    try {
        globalThis.location = {search:'?lang=en',pathname:'/'};
        globalThis.document = {documentElement:{lang:'de'},title:'',querySelector:()=>field,querySelectorAll:()=>[],getElementById:()=>null};
        globalThis.history = {replaceState(){}};
        assert.equal(await initializeLanguage(fetchLocale),'en');
        assert.equal(currentLanguage(),'en');
        const state = {collection,overviewMode:'bottlings',view:'cards',search:'',status:'all',completion:'all',distillery:'all',volumeType:'all',sort:'name',pageNumber:1,pageSize:24};
        let home = '';
        createHomeView({state,selectors,shell:html=>{home=html}})();
        assert.match(home,/toggle-view[^>]*>[^<]*Table</);
        state.view='table';
        createHomeView({state,selectors,shell:html=>{home=html}})();
        assert.match(home,/toggle-view[^>]*>[^<]*Cards</);
        assert.match(home,/All distilleries/);
        assert.match(home,/All statuses/);
        assert.doesNotMatch(home,/>Tabelle<|>Kacheln<|>Alle Destillerien<|>Alle Status</);
        assert.match(home,/Custom Islay/);
        let analytics = '';
        createAnalyticsView({state:{collection,selected:'overview',analyticsFilters:{}},shell:html=>{analytics=html}})();
        for (const label of ['All distilleries','All countries','All bottle types','All statuses']) assert.match(analytics,new RegExp(label));
        assert.doesNotMatch(analytics,/Alle Destillerien|Alle L\u00e4nder|Alle Flaschentypen|Alle Status/);
        let warehouse = '';
        const warehouseState={warehouse:{rooms:[room],bottles:[],assignments:{}},selected:'rooms',warehouseRoomId:'room-1',warehousePlanMode:'2d'};
        createWarehouseView({state:warehouseState,shell:html=>{warehouse=html},navigate:()=>{},modal:{},refresh:async()=>{}}).render();
        assert.match(warehouse,/Storage management/);
        assert.match(warehouse,/Whiskyzimmer/);
        assert.match(warehouse,/Mein Regal/);
        assert.doesNotMatch(warehouse,/>Lagerverwaltung</);
        let furnitureForm = '';
        createWarehouseView({state:warehouseState,shell:()=>{},navigate:()=>{},modal:{showModal:(_title,body)=>{furnitureForm=body;}},refresh:async()=>{}}).openForm('furniture','f1');
        for (const label of ['Left side panel','Right side panel','Back panel','Door leaves']) assert.match(furnitureForm,new RegExp(label));
        assert.doesNotMatch(furnitureForm,/Linke Seitenwand|Rechte Seitenwand|R\u00fcckwand|T\u00fcrfl\u00fcgel/);
    } finally {
        for (const [name,value] of Object.entries(previous)) if (value === undefined) delete globalThis[name]; else globalThis[name]=value;
        await initializeLanguage(async url => url.endsWith('index.json') ? {ok:true,json:async()=>locale('index.json')} : {ok:false});
    }
});
