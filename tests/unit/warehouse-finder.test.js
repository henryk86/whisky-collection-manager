import test from 'node:test';
import assert from 'node:assert/strict';
import { findWarehouseBottles } from '../../public/js/domain/warehouse-finder.js';
import { renderWarehouseFinder, renderWarehouseFinderResults } from '../../public/js/views/warehouse-finder.js';
import { renderWarehouseRoomWall } from '../../public/js/views/warehouse-room-wall.js';
import { createWarehouseView } from '../../public/js/views/warehouse.js';

const bottles = Array.from({length:9},(_,i) => ({
    id:`b${i+1}`,name:i===8?'Islay <strong>':`Glenfarclas ${i+1}`,number:String(100+i),
    volumeMl:700,status:'closed',bottlingId:`release-${i+1}`
}));
const warehouse = {
    rooms:[{id:'r',name:'Whiskyzimmer',width:5,height:3,furniture:[{
        id:'f',name:'Vitrine links',type:'vitrine',x:0,y:0,width:1,depth:.4,itemHeight:2,
        rotation:0,elevation:0,shelves:[{id:'s',name:'Fach 2',capacity:15}]
    }]}],
    bottles,assignments:Object.fromEntries(bottles.slice(0,8).map(b => [b.id,'s']))
};

test('finder matches inventory numbers, accented names, locations and multiple terms without grouping physical bottles', () => {
    assert.equal(findWarehouseBottles(warehouse,{query:'glenfarclas'}).total,8);
    assert.equal(findWarehouseBottles(warehouse,{query:'#104'}).items[0].bottle.id,'b5');
    assert.equal(findWarehouseBottles(warehouse,{query:'vitrine Fach 2'}).total,8);
    assert.equal(findWarehouseBottles(warehouse,{query:'glenfarclas Fach 2'}).total,8);
    assert.equal(findWarehouseBottles(warehouse,{query:'glenfarclas',placement:'unassigned'}).total,0);
    assert.equal(findWarehouseBottles(warehouse,{placement:'unassigned'}).items[0].bottle.id,'b9');
    assert.equal(findWarehouseBottles(warehouse,{placement:'assigned'}).total,8);
    assert.equal(findWarehouseBottles(warehouse,{placement:'invalid'}).total,9);
});

test('finder pagination returns bounded pages and stable counts', () => {
    const page = findWarehouseBottles(warehouse,{page:3,pageSize:3});
    assert.equal(page.total,9);
    assert.equal(page.pages,3);
    assert.equal(page.page,3);
    assert.equal(page.items.length,3);
    assert.equal(findWarehouseBottles(warehouse,{page:99,pageSize:3}).page,3);
    assert.equal(findWarehouseBottles(warehouse,{query:'absent'}).total,0);
});

test('finder cards show location action only when assigned and safely escape display data', () => {
    const html=renderWarehouseFinder({query:'<script>',placement:'all',results:findWarehouseBottles(warehouse)});
    assert.match(html,/value="&lt;script&gt;"/);
    assert.equal((html.match(/data-act="warehouse-find-location"/g)||[]).length,8);
    assert.equal((html.match(/data-act="warehouse-assign"/g)||[]).length,9);
    assert.match(html,/Islay &lt;strong&gt;/);
    assert.match(html,/Lagerort zuweisen/);
    assert.match(html,/Whiskyzimmer \/ Vitrine links \/ Fach 2/);
    const paged=renderWarehouseFinderResults(findWarehouseBottles(warehouse,{page:1,pageSize:3}));
    assert.match(paged,/warehouse-find-next/);
    assert.match(paged,/9 Flaschen gefunden/);
});

test('a bottle beyond the wall preview limit is visible and individually highlighted when found', () => {
    const ordinary=renderWarehouseRoomWall(warehouse.rooms[0],warehouse,[]);
    assert.doesNotMatch(ordinary,/data-id="b8"/);
    const focused=renderWarehouseRoomWall(warehouse.rooms[0],warehouse,[],{focusBottleId:'b8'});
    assert.match(focused,/class="warehouse-wall-bottle is-find-focus"/);
    assert.match(focused,/class="warehouse-wall-bottle is-find-dimmed"/);
    assert.match(focused,/data-id="b8"/);
    assert.match(focused,/warehouse-wall-bay is-find-focus/);
    assert.equal((focused.match(/class="warehouse-wall-bottle/g)||[]).length,
        (ordinary.match(/class="warehouse-wall-bottle/g)||[]).length);
});

test('finder navigation preserves query, filter and pagination when returning from focused shelf', () => {
    const extended = {...warehouse, bottles:[...warehouse.bottles,
        ...Array.from({length:28},(_,i)=>({id:`extra-${i}`,name:`Glenfarclas Extra ${i}`,number:String(300+i)}))],
        assignments:{...warehouse.assignments,...Object.fromEntries(Array.from({length:28},(_,i)=>[`extra-${i}`,'s']))}};
    const state={warehouse:extended, page:'warehouse',selected:'find',warehouseSearch:'glenfarclas',warehouseFinderPlacement:'assigned',
        warehouseFinderPage:2,warehouseRoomId:null,warehouseFurnitureId:null,warehouseSelectedBottleIds:[]};
    let html='';
    let view;
    const originalDocument=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null};
    try {
        view=createWarehouseView({state,shell:content=>{html=content;},navigate:(page,selected)=>{
            state.page=page;state.selected=selected;view.render();
        },modal:{},refresh:async()=>{}});
        view.showBottleLocation('b8');
        assert.equal(state.selected,'shelves');
        assert.equal(state.warehouseRoomId,'r');
        assert.equal(state.warehouseFurnitureId,'f');
        assert.match(html,/class="warehouse-wall-bottle is-find-focus"/);
        assert.match(html,/class="warehouse-wall-bottle is-find-dimmed"/);
        assert.match(html,/data-act="warehouse-return-find"/);
        assert.match(html,/data-act="warehouse-find-clear"/);
        view.returnToFinder();
        assert.equal(state.selected,'find');
        assert.equal(state.warehouseSearch,'glenfarclas');
        assert.equal(state.warehouseFinderPlacement,'assigned');
        assert.equal(state.warehouseFinderPage,2);
        assert.doesNotMatch(html,/warehouse-bottle-check/);
        assert.doesNotMatch(html,/data-act="warehouse-return-find"/);
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document=originalDocument;
    }
});

test('detail-page storage link highlights the same shelf and bottle and returns to its bottling', () => {
    const state = {warehouse, page:'detail', selected:'release-8', warehouseSelectedBottleIds:[],
        warehouseFindReturn:false, warehouseFindFocusBottleId:null,warehouseFindReturnBottlingId:null};
    let html = '';
    const navigation = [];
    let view;
    const previousDocument = globalThis.document;
    globalThis.document = {querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null};
    try {
        view = createWarehouseView({state,shell:content=>{html=content;},navigate:(page,selected,options)=>{
            navigation.push({page,selected,options});
            state.page=page;state.selected=selected;
            if (page === 'warehouse') view.render();
        },modal:{},refresh:async()=>{}});
        view.showBottleLocation('b8',{returnToBottlingId:'release-8'});
        assert.deepEqual(navigation.at(-1),{page:'warehouse',selected:'shelves',options:undefined});
        assert.equal(state.warehouseRoomId,'r');
        assert.equal(state.warehouseFurnitureId,'f');
        assert.equal(state.warehouseFindFocusBottleId,'b8');
        assert.match(html,/warehouse-wall-bay is-find-focus/);
        assert.match(html,/class="warehouse-wall-bottle is-find-focus"/);
        assert.match(html,/class="warehouse-wall-bottle is-find-dimmed"/);
        assert.match(html,/Zurück zur Abfüllung/);
        assert.match(html,/data-act="warehouse-find-clear"/);
        view.returnToFinder();
        assert.deepEqual(navigation.at(-1),{page:'detail',selected:'release-8',options:{highlightBottleId:'b8'}});
        assert.equal(state.warehouseFindReturn,false);
        assert.equal(state.warehouseFindFocusBottleId,null);
        assert.equal(state.warehouseFindReturnBottlingId,null);
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document=previousDocument;
    }
});

test('closing the finder banner removes both shelf and bottle highlights without navigation', () => {
    const state = {warehouse, page:'warehouse', selected:'find', warehouseSearch:'glenfarclas',
        warehouseFinderPlacement:'assigned', warehouseFinderPage:1, warehouseSelectedBottleIds:[]};
    let html = '';
    let view;
    const removedClasses = [];
    const banner = {remove() {this.removed = true;}};
    const wall = {classList:{remove(...names) {removedClasses.push(['wall',...names]);}}};
    const bay = {classList:{remove(...names) {removedClasses.push(['bay',...names]);}}};
    const focused = {classList:{remove(...names) {removedClasses.push(['bottle',...names]);}}};
    const dimmed = {classList:{remove(...names) {removedClasses.push(['dimmed',...names]);}}};
    const originalDocument = globalThis.document;
    globalThis.document = {
        querySelector(selector) {
            if (selector === '.warehouse-find-return') return banner;
            if (selector === '.warehouse-room-wall.has-find-focus') return wall;
            return null;
        },
        querySelectorAll(selector) {
            if (selector.includes('.warehouse-wall-bay.is-find-focus')) return [bay,focused,dimmed];
            return [];
        }
    };
    try {
        view = createWarehouseView({state,shell:content => {html = content;},
            navigate:(page,selected) => {state.page = page;state.selected = selected;view.render();},
            modal:{},refresh:async()=>{}});
        view.showBottleLocation('b1');
        assert.equal(state.selected,'shelves');
        assert.match(html,/data-act="warehouse-find-clear"/);
        view.clearFindFocus();
        assert.equal(state.selected,'shelves', 'the shelf view stays open');
        assert.equal(state.warehouseFindReturn,false);
        assert.equal(state.warehouseFindFocusBottleId,null);
        assert.equal(banner.removed,true);
        assert.ok(removedClasses.some(([which,name]) => which === 'wall' && name === 'has-find-focus'));
        assert.ok(removedClasses.some(([which,name]) => which === 'bay' && name === 'is-find-focus'));
        assert.ok(removedClasses.some(([which,,name]) => which === 'dimmed' && name === 'is-find-dimmed'));
        assert.equal(state.warehouseSearch,'glenfarclas');
        assert.equal(state.warehouseFinderPlacement,'assigned');
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
});

test('narrow shelves reserve a separate overflow slot and keep the focused bottle visible', () => {
    const narrow = structuredClone(warehouse);
    narrow.rooms[0].furniture[0].width = 0.7;
    narrow.rooms[0].furniture[0].itemHeight = 0.48;
    const html = renderWarehouseRoomWall(narrow.rooms[0], narrow, [], {focusBottleId:'b8'});
    // Every bottle slot plus the +N badge must fit within the physical bay.
    const preview = html.match(/data-shelf-id="s"[\s\S]*?<div class="warehouse-bottle-silhouettes">([\s\S]*?)<\/div>/)?.[1] || '';
    const visibleIds = [...preview.matchAll(/data-act="warehouse-bottle-select" data-id="(b\d+)"/g)].map(match => match[1]);
    const slotWidth = Number(html.match(/--wall-bottle-width:([\d.]+)px/)?.[1]);
    assert.ok(visibleIds.length > 0 && visibleIds.length < 5);
    assert.ok(visibleIds.length * (slotWidth + 2) + 27 <= 0.7 * 230 - 22);
    assert.ok(visibleIds.includes('b8'), 'a bottle beyond the preview limit remains the focus');
    assert.match(html, new RegExp(`warehouse-shelf-overflow[^>]*>\\+${8 - visibleIds.length}<\\/span>`));
    assert.doesNotMatch(html, /warehouse-find-bottle-badge/);
    assert.match(html, /class="warehouse-room-wall has-find-focus"/);
    // 0.48m shelf -> 110.4px. The preview height must not consume its title + rail.
    const height = Number(html.match(/--wall-bottle-height:([\d.]+)px/)?.[1]);
    assert.ok(height > 0 && height < 74, 'photo height fits the label and shelf frame');
});
