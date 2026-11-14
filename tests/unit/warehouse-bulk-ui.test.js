import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

test('physical bottle multi-selection works in the inventory list and in the full-height virtual wall', () => {
    const warehouse={rooms:[{id:'room',name:'Raum',width:5,height:4,furniture:[
        {id:'f',name:'Regal 1',type:'regal',width:1,itemHeight:2,elevation:0,shelves:[
            {id:'s',name:'Fach 1',capacity:3}]}]}],
        bottles:[{id:'b1',name:'Whisky 1'},{id:'b2',name:'Whisky 2'}],assignments:{b1:'s',b2:'s'}};
    const state={warehouse,selected:'find',warehouseUnassigned:false,warehouseSearch:'',
        warehouseRoomId:'room',warehousePlanMode:'wall',warehouseSelectedBottleIds:['b1','b2']};
    let html='', dialog='';
    const view=createWarehouseView({state,shell:source=>{html=source;},navigate:()=>{},
        modal:{showModal:(_title,content)=>{dialog=content;}},refresh:async()=>{}});
    const oldDocument=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null};
    try {
        view.render();
        assert.equal((html.match(/class="warehouse-bottle-check"/g)||[]).length,2);
        assert.match(html,/2 Flaschen ausgewählt/);
        assert.match(html,/data-act="warehouse-bottles-assign-selected"/);
        view.assignSelectedBottles();
        assert.match(dialog,/data-endpoint="\/api\/warehouse\/bottles\/bulk"/);
        assert.match(dialog,/data-bottle-bulk="true"/);
        state.selected='shelves';
        view.render();
        assert.match(html,/class="warehouse-room-wall"/);
        assert.equal((html.match(/class="warehouse-wall-bottle is-selected"/g)||[]).length,2);
        assert.match(html,/warehouse-bottle-bulk-tools/);
    } finally {
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document=oldDocument;
    }
});

test('wall bottle selection toggles a pressed, highlighted bottle without checkboxes', () => {
    const warehouse={rooms:[],bottles:[{id:'b1',name:'Bottle 1'},{id:'b2',name:'Bottle 2'}],assignments:{}};
    const state={warehouse,warehouseSelectedBottleIds:[]};
    const marked=new Set();
    const attributes=new Map();
    const button={dataset:{id:'b1',selectLabel:'Select bottle',deselectLabel:'Remove bottle'},
        setAttribute:(key,value)=>attributes.set(key,value),
        closest:selector=>selector==='.warehouse-wall-bottle' ? {
            classList:{toggle:(name,enabled)=>enabled ? marked.add(name) : marked.delete(name)}
        } : null};
    const clear={disabled:true};
    const assign={disabled:true};
    const preview={disabled:true};
    const label={textContent:''};
    const original=globalThis.document;
    globalThis.document={querySelectorAll:selector=>({
        '.warehouse-bottle-check':[],
        '.warehouse-wall-bottle .warehouse-bottle-symbol':[button],
        '.warehouse-bottles-preview-selected':[preview],
        '.warehouse-bottle-selection-count':[label],
        '.warehouse-bottles-select-clear,.warehouse-bottles-assign-selected':[clear,assign],
    }[selector] || [])};
    try {
        const view=createWarehouseView({state});
        view.toggleWallBottleSelection('b1');
        assert.deepEqual(state.warehouseSelectedBottleIds,['b1']);
        assert.equal(attributes.get('aria-pressed'),'true');
        assert.equal(attributes.get('aria-label'),'Remove bottle');
        assert.equal(marked.has('is-selected'),true);
        assert.equal(clear.disabled,false);
        assert.equal(assign.disabled,false);
        assert.equal(preview.disabled,false);
        view.toggleWallBottleSelection('b2');
        assert.deepEqual(state.warehouseSelectedBottleIds,['b1','b2']);
        assert.equal(preview.disabled,true);
        view.toggleWallBottleSelection('b1');
        assert.deepEqual(state.warehouseSelectedBottleIds,['b2']);
        assert.equal(attributes.get('aria-pressed'),'false');
        assert.equal(marked.has('is-selected'),false);
        view.clearBottleSelection();
        assert.deepEqual(state.warehouseSelectedBottleIds,[]);
        assert.equal(clear.disabled,true);
        assert.equal(assign.disabled,true);
    } finally {
        if (original===undefined) delete globalThis.document;
        else globalThis.document=original;
    }
});
