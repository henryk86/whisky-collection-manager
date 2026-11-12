import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routeUrl, parseRoute } from '../../public/js/navigation/routes.js';
import { storagePath, createWarehouseView } from '../../public/js/views/warehouse.js';

test('warehouse routes survive reloads and links from bottle details resolve individual shelves', () => {
    const target=routeUrl('warehouse','rooms',{roomId:'room-123',furnitureId:'furniture-123'});
    assert.deepEqual(parseRoute(new URL(target,'http://example.test').search), {page:'warehouse',selected:'rooms',roomId:'room-123',furnitureId:'furniture-123'});
    assert.equal(parseRoute('?view=warehouse&section=bad').selected,'overview');
    const w={rooms:[{id:'r',name:'Room',furniture:[{id:'f',name:'Regal',shelves:[{id:'s',name:'Fach'}]}]}]};
    assert.equal(storagePath(w,'s').label,'Room / Regal / Fach');
    assert.equal(storagePath(w,'missing'),null);
});
test('warehouse view renders room plan, separate bottle assignment and responsive shelf elevation without HTML injection', () => {
    const state={warehouse:{schemaVersion:1,rooms:[{id:'r',name:'Test <Room>',width:4,height:4,furniture:[{id:'f',name:'Regal A',type:'regal',x:0,y:0,width:1,depth:.5,rotation:0,shelves:[{id:'s',name:'Fach 1',capacity:10}]}]}],assignments:{b:'s'},bottles:[{id:'b',name:'Ardbeg & Co',number:'00001',volumeType:'standard'}]},selected:'shelves',warehouseRoomId:'r',warehouseFurnitureId:'f',warehouseSearch:'',warehouseUnassigned:false,warehousePlanMode:'2d'};
    let html='';
    const view=createWarehouseView({state,shell:output=>{html=output;},navigate:()=>{},modal:{},refresh:async()=>{}});
    const originalDocument=globalThis.document;
    try {globalThis.document={querySelector:()=>null};view.render();
    assert.match(html,/Regale & Fächer/);
    assert.match(html,/warehouse-shelf/);
    state.selected='rooms'; view.render();}
    finally {if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
    assert.match(html,/class="warehouse-floor"/);
    assert.match(html,/Regal A/);
    assert.match(html,/Test &lt;Room&gt;/);
    assert.doesNotMatch(html,/<Room>/);
    assert.match(fs.readFileSync('public/js/views/detail.js','utf8'),/warehouse-assign/);
    assert.match(fs.readFileSync('public/styles/warehouse.css','utf8'),/max-width:740px/);
});


test('warehouse uses the same page header and section-tab layout as analytics on every subsection', () => {
    const state = { warehouse: { schemaVersion: 1, rooms: [], bottles: [], assignments: {} },
        selected: 'overview', warehouseSearch: '', warehouseUnassigned: false };
    let html = '';
    const view = createWarehouseView({ state, shell: output => { html = output; }, navigate: () => {}, modal: {}, refresh: async () => {} });
    const expectedTabs = { overview: 'Übersicht', rooms: 'Raumpläne', shelves: 'Regale & Fächer', find: 'Flaschen finden' };
    const previousDocument = globalThis.document;
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
    try {
    for (const [id, title] of Object.entries(expectedTabs)) {
        state.selected = id;
        view.render();
        assert.match(html, /class="analytics-page warehouse-page"/);
        assert.match(html, /<header class="analytics-header warehouse-heading"><span class="eyebrow dark">DEINE FLASCHEN IM BLICK<\/span><h2>Lagerverwaltung<span class="heading-period">\.<\/span><\/h2>/);
        assert.match(html, /class="analytics-tabs warehouse-tabs"/);
        const active = html.match(/<button[^>]*class="analytics-tab active"[^>]*>/g) || [];
        assert.equal(active.length, 1, `exactly one active warehouse tab for ${id}`);
        assert.match(active[0], new RegExp(`data-section="${id}" aria-current="page"`));
        assert.match(html, new RegExp(`data-section="${id}" aria-current="page">${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    }
    const css = fs.readFileSync('public/styles/warehouse.css', 'utf8');
    assert.doesNotMatch(css, /\.warehouse-heading\s+h2|\.warehouse-tabs\s+button|\.warehouse-page\s*\{[^}]*padding:/,
        'warehouse must not override shared analytics header or tab styles');
});

test('warehouse shelf rendering includes copy controls and thumbnails only where a physical bottle photo exists', () => {
    const state={warehouse:{schemaVersion:1,rooms:[{id:'r',name:'Whiskyzimmer',width:4,height:4,furniture:[{id:'f',name:'Regal A',type:'regal',x:0,y:0,width:1,depth:0.5,rotation:0,shelves:[{id:'s',name:'Fach 1',capacity:null}]}]}],assignments:{b1:'s',b2:'s'},bottles:[
        {id:'b1',name:'Whisky mit Foto',number:'1',photoPath:'images/b1/sample.jpg'},
        {id:'b2',name:'Whisky ohne Foto',number:'2',photoPath:null}
    ]},selected:'shelves',warehouseRoomId:'r',warehouseFurnitureId:'f'};
    let html='';
    const forms=[];
    const view=createWarehouseView({state,shell:output=>{html=output;},navigate:()=>{},modal:{showModal:(title,content)=>forms.push({title,content})},refresh:async()=>{}});
    const savedDocument=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
    try {
        view.render();
        assert.match(html,/data-act="warehouse-furniture-copy" data-id="f"/);
        assert.match(html,/data-act="warehouse-shelf-copy" data-id="s"/);
        assert.match(html,/class="warehouse-bottle-photo" src="\/images\/b1\/sample.jpg"/);
        assert.equal((html.match(/class="warehouse-bottle-photo"/g)||[]).length,1);
        assert.doesNotMatch(html, /\|\| '<span class=\"hint\">Fach ist leer/, 'no unrendered template suffixes');
        assert.equal((html.match(/class="warehouse-bottle-symbol"/g)||[]).length,2,'fallback silhouettes remain for bottles without photos');
        assert.match(html,/data-act="warehouse-bottle-preview" data-id="b1"/);
        assert.doesNotMatch(html,/data-act="warehouse-assign" data-id="b1"/);
        view.openForm('furniture-copy','f');
        assert.match(forms.at(-1).content,/name="withShelves" checked/);
        assert.match(forms.at(-1).content,/data-endpoint="\/api\/warehouse\/furniture\/f\/copy"/);
        view.openForm('shelf-copy','s');
        assert.match(forms.at(-1).content,/name="furnitureId"/);
        assert.match(forms.at(-1).content,/data-endpoint="\/api\/warehouse\/shelves\/s\/copy"/);
    } finally {
        if(savedDocument===undefined) delete globalThis.document;
        else globalThis.document=savedDocument;
    }
    const css=fs.readFileSync('public/styles/warehouse.css','utf8');
    assert.match(css,/\.warehouse-bottle-symbol\.has-photo \.warehouse-bottle-photo/);
});

test('shelf bottle opens a read-only details modal with the exact bottle link and separate relocation action', () => {
    const bottleId = 'bottle-123';
    const bottlingId = 'bottling-456';
    const state = {
        warehouse: {rooms:[{id:'room',name:'Raum',furniture:[{id:'shelf',name:'Regal',shelves:[{id:'slot',name:'Fach 1'}]}]}],
            assignments:{[bottleId]:'slot'},bottles:[{id:bottleId,bottlingId,name:'A&B <Whisky>',number:'123<&',
                volumeType:'sample',volumeMl:50,status:'open',photoPath:'images/bottle-123/photo.jpg'}]},
        collection:{bottlings:[{id:bottlingId,ageYears:12,abv:46,bottles:[{id:bottleId,purchaseDate:'2026-01-02',
            purchasePrice:45,currency:'EUR',merchant:'Shop <City>',comment:'My <comment>'}]}]},
    };
    let dialog;
    const view = createWarehouseView({state,shell:()=>{},navigate:()=>{},
        modal:{showModal:(title,html)=>{dialog={title,html};}},refresh:async()=>{}});
    view.openBottlePreview(bottleId);
    assert.equal(dialog.title,'Flaschendetails');
    assert.match(dialog.html,/A&amp;B &lt;Whisky&gt;/);
    assert.match(dialog.html,/123&lt;&amp;/);
    assert.match(dialog.html,/Raum \/ Regal \/ Fach 1/);
    assert.match(dialog.html,/50 ml/);
    assert.match(dialog.html,/46 % Vol\./);
    assert.match(dialog.html,/Shop &lt;City&gt;/);
    assert.match(dialog.html,/My &lt;comment&gt;/);
    assert.doesNotMatch(dialog.html,/<Whisky>|<City>|<comment>/);
    assert.match(dialog.html,/class="warehouse-bottle-preview-photo"/);
    assert.match(dialog.html,/data-act="warehouse-assign" data-id="bottle-123"/);
    assert.match(dialog.html,/href="\/\?bottling=bottling-456" data-act="open" data-id="bottling-456" data-bottle-id="bottle-123"/);
});

test('warehouse overview and room views show room capacity and distinguish elevated wall shelves', () => {
    const state={warehouse:{schemaVersion:1,rooms:[{id:'r',name:'Whiskyzimmer',width:4,height:3,furniture:[
        {id:'cab',name:'Schrank',type:'schrank',x:0.1,y:0.2,width:1.2,depth:0.5,rotation:0,elevation:0,itemHeight:1.8,shelves:[{id:'s1',name:'Fach 1',capacity:8}]},
        {id:'wall',name:'Hängeregal',type:'haengeregal',x:0.1,y:0.2,width:1.2,depth:0.5,rotation:0,elevation:1.9,itemHeight:0.35,shelves:[{id:'s2',name:'Fach 1',capacity:null}]}
    ]}],assignments:{b:'s2'},bottles:[{id:'b',name:'Ardbeg'}]},selected:'overview',warehouseRoomId:'r',warehouseSearch:'',warehouseUnassigned:false,warehousePlanMode:'2d'};
    let html=''; let dialog='';
    const view=createWarehouseView({state,shell:output=>{html=output;},navigate:()=>{},modal:{showModal:(_title,content)=>{dialog=content;}},refresh:async()=>{}});
    const oldDocument=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
    try {
        view.render();
        assert.match(html,/Gesamtkapazität: mind\. 8 Plätze · 1 Fach ohne Limit/);
        assert.match(html,/Belegt: 1 Flasche/);
        state.selected='rooms';
        view.render();
        assert.match(html,/id="warehouse-plan-layer"/);
        assert.match(html,/class="warehouse-drag warehouse-elevated/);
        assert.match(html,/ab 1,9 m/);
        state.warehousePlanLevel='floor';
        view.render();
        assert.match(html,/data-id="cab"/);
        assert.doesNotMatch(html,/<g[^>]*data-id="wall"/);
        state.warehousePlanLevel='elevated';
        view.render();
        assert.match(html,/data-id="wall"/);
        assert.doesNotMatch(html,/<g[^>]*data-id="cab"/);
        view.openForm('furniture','wall');
        assert.match(dialog,/Unterkante über Boden/);
        assert.match(dialog,/Möbelhöhe/);
        assert.match(dialog,/value="1.9"/);
    } finally {
        if(oldDocument===undefined) delete globalThis.document;
        else globalThis.document=oldDocument;
    }
});


test('2D room plan grid uses 0.1 m subdivisions, 0.5 m guides and 1 m major lines beneath furniture', () => {
    const state = { warehouse: { schemaVersion: 1, rooms: [{ id: 'r', name: 'Raum', width: 2, height: 1.5,
        furniture: [{ id: 'f', name: 'Regal', type: 'regal', x: 0, y: 0, width: 1, depth: .5, rotation: 0, shelves: [] }] }],
        bottles: [], assignments: {} }, selected: 'rooms', warehouseRoomId: 'r', warehousePlanMode: '2d' };
    let html = '';
    const savedDocument = globalThis.document;
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
    try { createWarehouseView({ state, shell: content => { html = content; }, navigate: () => {}, modal: {}, refresh: async () => {} }).render(); }
    finally { if (savedDocument === undefined) delete globalThis.document; else globalThis.document = savedDocument; }
    assert.match(html, /class="warehouse-plan-grid" aria-hidden="true"/);
    assert.match(html, /class="warehouse-grid-fine" x1="30" y1="0" x2="30" y2="450"/);
    assert.match(html, /class="warehouse-grid-fine" x1="60" y1="0" x2="60" y2="450"/);
    assert.match(html, /class="warehouse-grid-minor" x1="150" y1="0" x2="150" y2="450"/);
    assert.match(html, /class="warehouse-grid-major" x1="300" y1="0" x2="300" y2="450"/);
    assert.match(html, /class="warehouse-grid-major" x1="0" y1="300" x2="600" y2="300"/);
    assert.match(html, /class="warehouse-grid-fine" x1="0" y1="30" x2="600" y2="30"/);
    assert.ok(html.indexOf('warehouse-plan-grid') < html.indexOf('class="warehouse-drag'), 'grid must be under furniture');
    assert.match(fs.readFileSync('public/styles/warehouse.css', 'utf8'), /\.warehouse-plan-grid \{ pointer-events: none/);
    assert.match(fs.readFileSync('public/styles/warehouse.css', 'utf8'), /\.warehouse-grid-fine/);
});

test('room creation/edit/delete controls appear only in Raumpläne, not Regale & Fächer', () => {
    const state = { warehouse: { schemaVersion: 1, rooms: [{ id: 'raum', name: 'Raum', width: 3, height: 3,
        furniture: [] }], bottles: [], assignments: {} }, selected: 'shelves', warehouseRoomId: 'raum' };
    let html = '';
    const savedDocument = globalThis.document;
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
    try {
        const view = createWarehouseView({ state, shell: output => { html = output; }, navigate: () => {}, modal: {}, refresh: async () => {} });
        view.render();
        assert.match(html, /id="warehouse-room-select"/,'room selection remains available while editing shelves');
        for (const action of ['warehouse-room-new','warehouse-room-edit','warehouse-room-delete']) {
            assert.doesNotMatch(html, new RegExp(`data-act="${action}"`), `${action} must be absent from Regale & Fächer`);
        }
        state.selected = 'rooms';
        view.render();
        for (const action of ['warehouse-room-new','warehouse-room-edit','warehouse-room-delete']) {
            assert.match(html, new RegExp(`data-act="${action}"`), `${action} must remain in Raumpläne`);
        }
    } finally {
        if (savedDocument === undefined) delete globalThis.document;
        else globalThis.document = savedDocument;
    }
});

test('bulk furniture edit uses the same small button size as the other warehouse bulk actions', () => {
    const state = { warehouse: { schemaVersion: 1, rooms: [{ id: 'r', name: 'Raum', width: 3, height: 3,
        furniture: [{ id: 'f', name: 'Regal', type: 'regal', x: 0, y: 0, width: 1, depth: .5,
            rotation: 0, shelves: [] }] }], bottles: [], assignments: {} },
        selected: 'rooms', warehouseRoomId: 'r', warehousePlanMode: '3d', warehouseSelectedFurnitureIds: ['f'] };
    let html = '';
    const savedDocument = globalThis.document;
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
    try {
        createWarehouseView({ state, shell: output => { html = output; }, navigate: () => {}, modal: {}, refresh: async () => {} }).render();
    } finally {
        if (savedDocument === undefined) delete globalThis.document;
        else globalThis.document = savedDocument;
    }
    const actionButtons = [...html.matchAll(/<button[^>]*data-act="warehouse-bulk-(?:select-all|clear|delete|edit)"[^>]*>/g)].map(match => match[0]);
    assert.equal(actionButtons.length, 4);
    for (const button of actionButtons) assert.match(button, /class="btn small(?: |")/);
});


test('room plan shows dominant room name, metrics and a single compact tools bar', () => {
    const state={warehouse:{schemaVersion:1,rooms:[{id:'r',name:'Whiskyzimmer',width:3,height:4,furniture:[{id:'f',name:'Regal',type:'regal',x:0,y:0,width:1,depth:.5,rotation:0,shelves:[]}]}],bottles:[],assignments:{}},selected:'rooms',warehouseRoomId:'r',warehousePlanMode:'3d'};
    let html='';const previous=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
    try {createWarehouseView({state,shell:value=>{html=value;},navigate:()=>{},modal:{},refresh:async()=>{}}).render();}
    finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
    assert.match(html,/<header class="warehouse-room-summary"><div class="warehouse-room-identity"><h3(?: data-i18n-ignore)?>Whiskyzimmer<\/h3><span>3 × 4 m<\/span>/);
    assert.equal((html.match(/Gesamtkapazität:/g)||[]).length,1);
    const toolbar=html.match(/<div class="warehouse-plan-tools"[^>]*>(.*?)<\/div><\/div>/s)?.[0]||'';
    assert.match(toolbar,/data-mode="2d"/);
    assert.match(toolbar,/data-mode="3d"/);
    assert.match(toolbar,/warehouse-camera-toolbar/);
    assert.match(toolbar,/id="warehouse-plan-zoom"/);
    assert.ok(html.indexOf('warehouse-plan-tools') < html.indexOf('warehouse-three-viewport'));
    assert.doesNotMatch(html,/class="warehouse-subtitle">Whiskyzimmer/);
});

test('furniture wall switches render independently with accessible labels and preserved states', () => {
    const state={warehouse:{schemaVersion:1,rooms:[{id:'r',name:'Raum',width:4,height:4,furniture:[{id:'f',name:'Schrank',type:'schrank',x:0,y:0,width:1,depth:.5,rotation:0,leftSidePanel:true,rightSidePanel:false,backPanel:true,shelves:[]}]}],bottles:[],assignments:{}},selected:'rooms',warehouseRoomId:'r'};
    let html='';const previous=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
    try {createWarehouseView({state,shell:()=>{},navigate:()=>{},modal:{showModal:(_title,value)=>{html=value;}},refresh:async()=>{}}).openForm('furniture','f');}
    finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
    assert.match(html,/fieldset class="warehouse-wall-options"/);
    assert.equal((html.match(/class="warehouse-wall-toggle"/g)||[]).length,3);
    assert.match(html,/name="leftSidePanel" checked/);
    assert.match(html,/name="rightSidePanel" (?!checked)/);
    assert.match(html,/name="backPanel" checked/);
    const css=fs.readFileSync('public/styles/warehouse.css','utf8');
    assert.match(css,/warehouse-wall-toggle:has\(input:checked\)/);
    assert.match(css,/warehouse-bulk-panel--sidebar \.warehouse-bulk-actions \.btn \{height:48px/);
});
