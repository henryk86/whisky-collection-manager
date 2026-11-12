import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WAREHOUSE_CAMERAS, furnitureFootprint, cameraDirection, cameraForFurniture, warehouse3DGeometry } from '../../public/js/domain/warehouse-3d-model.js';
import { createWarehouseView } from '../../public/js/views/warehouse.js';
import { warehouseCameraHalfHeight } from '../../public/js/ui/warehouse-three-scene.js';

const room={id:'room',name:'Zimmer',width:5,height:4,furniture:[
    {id:'cabinet',name:'Schrank',type:'schrank',x:0.5,y:0.3,width:1.8,depth:0.7,rotation:0,elevation:0,itemHeight:1.8,shelves:[]},
    {id:'wall',name:'Hängeregal',type:'haengeregal',x:0.5,y:0.3,width:1.8,depth:0.7,rotation:0,elevation:1.9,itemHeight:0.4,shelves:[{id:'s1',name:'Oben'}]},
    {id:'rack',name:'Regal',type:'regal',x:3,y:1.5,width:1.5,depth:0.5,rotation:90,elevation:0,itemHeight:1.9,shelves:[{id:'s2',name:'Fach 1'},{id:'s3',name:'Fach 2'}]},
]};
const warehouse={rooms:[room],bottles:[{id:'b1'}],assignments:{b1:'s2'}};
const model=()=>warehouse3DGeometry(room,warehouse);

test('four stable camera directions and orientation-aware cabinet fronts',()=>{
    assert.deepEqual(WAREHOUSE_CAMERAS.map(([id])=>id),['nw','ne','se','sw']);
    for(const [id] of WAREHOUSE_CAMERAS){
        const [x,z]=cameraDirection(id);assert.equal(Math.abs(x),1);assert.equal(Math.abs(z),1);
    }
    assert.equal(cameraForFurniture(room.furniture[0],'sw'),'sw');
    assert.equal(cameraForFurniture(room.furniture[2],'se'),'nw');
    assert.deepEqual(furnitureFootprint(room.furniture[2]),{width:0.5,depth:1.5});
});

test('open rack is built from solid shelf boards and four actual posts, not projected polygons',()=>{
    const rack=model().objects.find(o=>o.id==='rack');
    assert.equal(rack.parts.filter(p=>p.role==='post').length,4);
    assert.equal(rack.parts.filter(p=>p.role==='shelf-board').length,3);
    assert.equal(rack.parts.filter(p=>p.role==='body').length,0);
    for(const part of rack.parts) assert.ok(part.size.every(n=>Number.isFinite(n)&&n>0));
});

test('hanging shelf has boards and wall brackets, never floor posts',()=>{
    const wall=model().objects.find(o=>o.id==='wall');
    assert.equal(wall.parts.filter(p=>p.role==='post').length,0);
    assert.equal(wall.parts.filter(p=>p.role==='shelf-board').length,1);
    assert.equal(wall.parts.filter(p=>p.role==='wall-bracket').length,2);
    assert.ok(wall.parts.every(p=>p.center[1]>1.7));
});

test('stacked furniture stays physically placed and has NO painter-order masks',()=>{
    const output=model();
    const cab=output.objects.find(o=>o.id==='cabinet');
    const wall=output.objects.find(o=>o.id==='wall');
    assert.ok(Math.max(...cab.parts.map(p=>p.center[1]+p.size[1]/2))<
        Math.min(...wall.parts.map(p=>p.center[1]-p.size[1]/2)));
    const renderer=fs.readFileSync('public/js/ui/warehouse-three-scene.js','utf8');
    assert.match(renderer,/WebGLRenderer/);
    assert.match(renderer,/EdgesGeometry/);
    assert.doesNotMatch(renderer,/<mask|maskDefinitions|silhouette/);
    assert.equal(JSON.stringify(room),JSON.stringify(warehouse.rooms[0]),'3D calculation never mutates room');
});

test('physical compartments follow stored shelves; occupied ones contain bottle models',()=>{
    const rack=model().objects.find(o=>o.id==='rack');
    assert.equal(rack.shelfCount,2);
    assert.equal(rack.parts.filter(p=>p.role==='bottle').length,1);
    const isolated=warehouse3DGeometry(room,warehouse,'rack');
    assert.deepEqual(isolated.objects.map(o=>o.id),['rack']);
    assert.deepEqual(model().objects.map(o=>o.id),['cabinet','wall','rack']);
});

test('cabinet, drawers, vitrine, and box get different physical construction',()=>{
    const base=room.furniture[0];
    const mk=type=>warehouse3DGeometry({...room,furniture:[{...base,type,shelves:[{id:'x'},{id:'y'}]}]},warehouse).objects[0];
    assert.equal(mk('schrank').parts.filter(p=>p.role==='door').length,2);
    assert.equal(mk('kommode').parts.filter(p=>p.role==='drawer').length,2);
    assert.equal(mk('vitrine').parts.filter(p=>p.role==='glass-front').length,1);
    assert.equal(mk('vitrine').parts.filter(p=>p.role==='shelf-board').length,3);
    assert.equal(mk('kiste').parts.filter(p=>p.role==='body').length,1);
});

test('3D is mounted lazily in the warehouse page, with no SVG/2D regression',()=>{
    let html='';const state={warehouse,selected:'rooms',warehouseRoomId:room.id,warehousePlanMode:'2d'};
    const old=globalThis.document;
    globalThis.document={querySelector:()=>null};
    try{
        const view=createWarehouseView({state,shell:value=>{html=value;},navigate:()=>{},modal:{},refresh:async()=>{}});
        view.render();assert.match(html,/class="warehouse-floor"/);
        state.warehousePlanMode='3d';view.render();assert.match(html,/class="warehouse-three-viewport"/);
        assert.doesNotMatch(html,/class="warehouse-isometric"/);
        assert.equal((html.match(/data-act="warehouse-camera"/g)||[]).length,4);
        assert.equal((html.match(/data-act="warehouse-visibility-toggle"/g)||[]).length,3);
        assert.equal((html.match(/class="warehouse-bulk-item/g)||[]).length,3,'only one furniture list');
        assert.doesNotMatch(html,/warehouse-iso-number|warehouse-iso-legend-items/);
        assert.equal(view.update3DZoom(150),false);
    }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('Three.js is served locally from a fixed allowlist and is not loaded from CDN',()=>{
    const staticServer=fs.readFileSync('server/http/static-files.js','utf8');
    const index=fs.readFileSync('public/index.html','utf8');
    const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
    assert.equal(pkg.dependencies.three,'0.187.0');
    assert.match(staticServer,/\/vendor\/three\.module\.js/);
    assert.match(staticServer,/\/vendor\/three\.core\.js/);
    assert.match(staticServer,/OrbitControls\.js/);
    assert.match(index,/type="importmap"/);
    assert.doesNotMatch(index,/unpkg|jsdelivr/);
});

test('cabinet doors, showcase glass and drawers follow the physical front at 0, 90, 180 and 270 degrees', () => {
    const original = room.furniture[0];
    const normals = [[0,1],[-1,0],[0,-1],[1,0]];
    for (const [i,rotation] of [0,90,180,270].entries()) {
        const item={...original,rotation,x:1,y:1,width:1.6,depth:0.65};
        const footprint=furnitureFootprint(item);
        const centre=[item.x+footprint.width/2,item.y+footprint.depth/2];
        const [nx,nz]=normals[i];
        for (const [type,role,expected] of [['schrank','door',2],['vitrine','glass-front',1],['kommode','drawer',1]]) {
            const result=warehouse3DGeometry({...room,furniture:[{...item,type,shelves:[]}]},warehouse).objects[0];
            const fronts=result.parts.filter(part=>part.role===role);
            assert.equal(fronts.length,expected,`${type}, ${rotation}°`);
            for(const front of fronts){
                const dx=front.center[0]-centre[0],dz=front.center[2]-centre[1];
                // Every panel lies outside the body exactly on its rotated front.
                assert.ok(Math.abs(dx*nx+dz*nz - (item.depth/2+front.size[rotation%180 ? 0 : 2]/2))<1e-7,
                    `${type} ${rotation}°: front must point in the direction of its door/glass`);
                if(rotation%180===0) assert.ok(front.size[0]>front.size[2],`${type} ${rotation}° along x`);
                else assert.ok(front.size[2]>front.size[0],`${type} ${rotation}° along z`);
            }
        }
    }
});

test('warehouse multi-edit selection panel and optional properties are wired for the current room', () => {
    let html='';let form='';const state={warehouse,selected:'rooms',warehouseRoomId:room.id,warehousePlanMode:'2d',warehouseSelectedFurnitureIds:[]};
    const before=JSON.stringify(warehouse);
    const previous=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
    try {
        const view=createWarehouseView({state,shell:output=>html=output,navigate:()=>{},modal:{showModal:(_title,content)=>form=content},refresh:async()=>{}});
        view.render();
        assert.equal((html.match(/class="warehouse-bulk-check"/g)||[]).length,3);
        assert.match(html,/data-act="warehouse-bulk-edit" disabled/);
        assert.match(html,/data-act="warehouse-bulk-delete" disabled/);
        view.toggleFurnitureSelection('cabinet',true);
        view.toggleFurnitureSelection('rack',true);
        view.render();
        assert.match(html,/2 von 3 ausgewählt/);
        assert.match(html,/data-act="warehouse-bulk-delete"/);
        view.askBulkDelete();
        assert.match(form,/2 Lagermöbel wirklich löschen/);
        view.openForm('furniture-bulk');
        assert.match(form,/data-endpoint="\/api\/warehouse\/furniture\/bulk"/);
        for (const name of ['rotation','elevation','itemHeight','width','depth','leftSidePanel','rightSidePanel','backPanel']) assert.match(form,new RegExp(`name="${name}"`));
        assert.doesNotMatch(form,/name="apply-/);
        assert.match(form,/Leere Felder bleiben unverändert/);
        view.clearFurnitureSelection();
        assert.deepEqual(state.warehouseSelectedFurnitureIds,[]);
        view.selectAllFurniture();
        assert.equal(state.warehouseSelectedFurnitureIds.length,3);
        state.selected='shelves';view.render();
        assert.equal((html.match(/class="warehouse-bulk-check"/g)||[]).length,3);
    } finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
    assert.equal(JSON.stringify(warehouse),before,'selection must not edit the warehouse until a save action');
});

test('rotated rack side and back panels follow the local axes and remain separately optional', () => {
    for (const rotation of [0,90,180,270]) {
        const base={...room.furniture[2],x:1,y:1,width:1.4,depth:0.6,rotation,
            leftSidePanel:true,rightSidePanel:false,backPanel:true};
        const {width,depth}=furnitureFootprint(base);
        const center=[base.x+width/2,base.y+depth/2];
        const normal=[-Math.round(Math.sin(rotation*Math.PI/180)),Math.round(Math.cos(rotation*Math.PI/180))];
        const tangent=[Math.round(Math.cos(rotation*Math.PI/180)),Math.round(Math.sin(rotation*Math.PI/180))];
        const parts=warehouse3DGeometry({...room,furniture:[base]},warehouse).objects[0].parts;
        const left=parts.find(p=>p.role==='left-side-panel');
        const back=parts.find(p=>p.role==='back-panel');
        assert.ok(left && back);
        assert.equal(parts.some(p=>p.role==='right-side-panel'),false);
        const leftDelta=[left.center[0]-center[0],left.center[2]-center[1]];
        const backDelta=[back.center[0]-center[0],back.center[2]-center[1]];
        assert.ok(leftDelta[0]*tangent[0]+leftDelta[1]*tangent[1]<0,`left ${rotation}`);
        assert.ok(backDelta[0]*normal[0]+backDelta[1]*normal[1]<0,`back ${rotation}`);
    }
});


test('furniture selection stays in the room plan, updates the URL and scrolls to its shelves', () => {
    const originalDocument=globalThis.document, originalWindow=globalThis.window;
    let html='', scrolls=0, navigations=0, replaced='';
    globalThis.document={querySelector:selector=>selector==='.warehouse-furniture-panel'?{scrollIntoView:options=>{assert.equal(options.block,'start');assert.equal(options.behavior,'instant');scrolls++;}}:null,querySelectorAll:()=>[]};
    globalThis.window={history:{replaceState:(_state,_title,url)=>{replaced=url;}}};
    const state={warehouse,selected:'rooms',warehouseRoomId:room.id,warehousePlanMode:'2d'};
    try{
        const view=createWarehouseView({state,shell:value=>{html=value;},navigate:()=>{navigations++;},modal:{},refresh:async()=>{}});
        view.selectFurniture('rack');
        assert.equal(state.warehouseFurnitureId,'rack');
        assert.equal(state.selected,'rooms');
        assert.equal(navigations,0);
        assert.equal(scrolls,1);
        assert.match(replaced,/section=rooms.*furniture=rack/);
        assert.match(html,/Test|Fach 1/);
        assert.equal((html.match(/class="warehouse-bulk-item/g)||[]).length,3);
        assert.doesNotMatch(html,/warehouse-room-card/);
    }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
        if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});


test('room plans default to 3D while a deliberate 2D selection keeps the floor plan', () => {
    let html = '';
    const original = globalThis.document;
    globalThis.document = {querySelector:()=>null,querySelectorAll:()=>[]};
    try {
        const state={warehouse,selected:'rooms',warehouseRoomId:room.id};
        const view=createWarehouseView({state,shell:markup=>{html=markup;},navigate:()=>{},modal:{},refresh:async()=>{}});
        view.render();
        assert.match(html,/class="warehouse-three-viewport"/);
        assert.match(html,/data-mode="3d" class="btn small primary" aria-pressed="true"/);
        assert.equal((html.match(/class="warehouse-eye-icon"/g)||[]).length,room.furniture.length);
        assert.equal((html.match(/data-act="warehouse-visibility-toggle"/g)||[]).length,room.furniture.length);
        assert.doesNotMatch(html,/data-act="warehouse-iso-clear"|>Freistellen<|>Alle zeigen</);
        assert.match(html,/aria-pressed="true" title="Schrank ausblenden" aria-label="Schrank ausblenden"/);
        const selectedId = state.warehouseFurnitureId;
        assert.equal(view.toggleFurnitureVisibility('cabinet'), false);
        assert.deepEqual(state.warehouseHiddenFurnitureIds,['cabinet']);
        assert.equal(state.warehouseFurnitureId,selectedId,'toggle must not select furniture');
        view.render();
        assert.match(html,/aria-pressed="false" title="Schrank einblenden" aria-label="Schrank einblenden"/);
        assert.match(html,/aria-pressed="true" title="Regal ausblenden"/);
        assert.equal(view.toggleFurnitureVisibility('wall'),false);
        assert.deepEqual(state.warehouseHiddenFurnitureIds,['cabinet','wall'],'multiple pieces can be hidden independently');
        assert.equal(view.toggleFurnitureVisibility('cabinet'),true);
        assert.deepEqual(state.warehouseHiddenFurnitureIds,['wall']);
        state.warehousePlanMode='2d';view.render();
        assert.match(html,/class="warehouse-floor"/);
        assert.doesNotMatch(html,/data-act="warehouse-visibility-toggle"/);
    } finally { if(original===undefined)delete globalThis.document;else globalThis.document=original; }
});

test('3D furniture controls share a compact workspace with the room and provide one show-all action', () => {
    let html='';
    const original=globalThis.document;
    globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
    try {
        const state={warehouse,selected:'rooms',warehouseRoomId:room.id,warehouseHiddenFurnitureIds:['cabinet','rack']};
        const view=createWarehouseView({state,shell:markup=>{html=markup;},navigate:()=>{},modal:{},refresh:async()=>{}});
        view.render();
        assert.match(html,/class="warehouse-plan-workspace"/);
        assert.match(html,/class="warehouse-plan-stage"/);
        assert.match(html,/class="warehouse-bulk-panel warehouse-bulk-panel--sidebar"/);
        assert.match(html,/data-act="warehouse-show-all"/);
        assert.equal((html.match(/data-act="warehouse-show-all"/g)||[]).length,1);
        assert.match(html,/class="btn small warehouse-show-all" data-act="warehouse-show-all" >Alle einblenden/);
        assert.ok(html.indexOf('warehouse-plan-stage') < html.indexOf('warehouse-bulk-panel--sidebar'));
        assert.equal((html.match(/class="warehouse-bulk-item/g)||[]).length,3);
        const previousSelection=state.warehouseFurnitureId;
        const selectedIds=state.warehouseSelectedFurnitureIds=['wall'];
        assert.equal(view.showAllFurniture(),2);
        assert.deepEqual(state.warehouseHiddenFurnitureIds,[]);
        assert.equal(state.warehouseFurnitureId,previousSelection);
        assert.deepEqual(state.warehouseSelectedFurnitureIds,selectedIds);
        assert.equal(view.showAllFurniture(),0,'show all is idempotent');
        view.render();
        assert.match(html,/class="btn small warehouse-show-all" data-act="warehouse-show-all" disabled>Alle einblenden/);
        state.warehousePlanMode='2d';view.render();
        assert.doesNotMatch(html,/warehouse-plan-workspace|warehouse-show-all/);
    }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

test('show all only restores furniture of the selected room and syncs all eye buttons', () => {
    const original=globalThis.document;
    const changes=[];
    const btns=room.furniture.map(furniture=>({dataset:{id:furniture.id},setAttribute(name,value){changes.push([this.dataset.id,name,value]);},closest(){return {classList:{toggle(name,hidden){changes.push([furniture.id,name,hidden]);}}};}}));
    const all={disabled:true};
    globalThis.document={querySelector:selector=>selector==='.warehouse-show-all'?all:null,querySelectorAll:()=>btns};
    try{
        const state={warehouse,selected:'rooms',warehouseRoomId:room.id,warehouseHiddenFurnitureIds:['cabinet','rack','elsewhere'],warehouseSelectedFurnitureIds:['wall']};
        const view=createWarehouseView({state,shell:()=>{},navigate:()=>{},modal:{},refresh:async()=>{}});
        assert.equal(view.showAllFurniture(),2);
        assert.deepEqual(state.warehouseHiddenFurnitureIds,['elsewhere'],'hidden furniture in a different room must remain hidden');
        assert.equal(all.disabled,true);
        assert.ok(changes.some(change=>change[0]==='cabinet'&&change[1]==='aria-pressed'&&change[2]==='true'));
        assert.ok(changes.some(change=>change[0]==='rack'&&change[1]==='aria-pressed'&&change[2]==='true'));
        assert.equal(changes.some(change=>change[0]==='wall'),false,'unchanged furniture buttons are untouched');
        assert.equal(view.toggleFurnitureVisibility('cabinet'),false);
        assert.equal(all.disabled,false,'restoration button becomes enabled when any item is hidden');
    }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

test('hover highlighting is implemented on individual Three.js furniture meshes and restores existing materials', () => {
    const scene=fs.readFileSync('public/js/ui/warehouse-three-scene.js','utf8');
    const view=fs.readFileSync('public/js/views/warehouse.js','utf8');
    assert.match(scene,/byFurniture\.get\(owner\)\.push\(mesh\)/);
    assert.match(scene,/mesh\.material = active \? highlightedMaterial\(style\) : material\(style\)/);
    assert.match(scene,/setHighlightedFurniture\(id\)/);
    assert.match(view,/tile\.addEventListener\('pointerenter'/);
    assert.match(view,/tile\.addEventListener\('pointerleave'/);
    assert.doesNotMatch(view,/setHighlightedFurniture[^;]*render\(\)/);
});


test('3D visibility switches real mesh geometry independently and reversibly', async () => {
    const {buildWarehouseThreeScene} = await import('../../public/js/ui/warehouse-three-scene.js');
    class Node { constructor(){this.children=[];this.position={set(){}};this.userData={};this.visible=true;}
        add(child){this.children.push(child);} traverse(fn){fn(this);for(const child of this.children)child.traverse(fn);}}
    class Color {constructor(value){this.value=value;}setHex(value){this.value=value;return this;}lerp(){return this;}}
    class Geometry {dispose(){}}
    class Material {constructor(options={}){Object.assign(this,options);this.color=new Color(options.color);}
        clone(){return new Material({color:this.color.value,opacity:this.opacity});}dispose(){}}
    class Mesh extends Node {constructor(geo,material){super();this.geometry=geo;this.material=material;}}
    class Grid extends Node {constructor(){super();this.material={color:new Color(0),dispose(){}};}}
    const THREE={Scene:Node,Group:Node,Color,BoxGeometry:Geometry,EdgesGeometry:Geometry,
        MeshBasicMaterial:Material,LineBasicMaterial:Material,Mesh,LineSegments:Mesh,GridHelper:Grid,DoubleSide:2};
    const scene=buildWarehouseThreeScene(THREE,room,warehouse,{hiddenIds:['cabinet','rack']});
    const meshes=id=>scene.selectables.filter(mesh=>mesh.userData.furnitureId===id);
    assert.ok(meshes('cabinet').length>0 && meshes('rack').length>0 && meshes('wall').length>0);
    assert.ok(meshes('cabinet').every(mesh=>!mesh.visible));
    assert.ok(meshes('rack').every(mesh=>!mesh.visible));
    assert.ok(meshes('wall').every(mesh=>mesh.visible));
    assert.equal(scene.setFurnitureVisible('cabinet',true),true);
    assert.ok(meshes('cabinet').every(mesh=>mesh.visible));
    assert.ok(meshes('rack').every(mesh=>!mesh.visible),'showing one must not show the others');
    scene.setHighlightedFurniture('cabinet');
    scene.setFurnitureVisible('cabinet',false);
    assert.ok(meshes('cabinet').every(mesh=>!mesh.visible));
    scene.setFurnitureVisible('rack',true);
    assert.ok(meshes('rack').every(mesh=>mesh.visible));
    assert.equal(scene.setFurnitureVisible('invalid-id',true),false);
    scene.dispose();
});


test('3D room uses almost the available viewport at default 100% zoom without clipping', () => {
    // These projected dimensions cover both landscape and portrait plan stages.
    for (const [width,height,aspect] of [[7,4,1.7],[4,7,0.7],[2.4,1.7,1.5],[10,5,2.2]]) {
        const halfH=warehouseCameraHalfHeight(width,height,aspect);
        const fillX=width/(2*halfH*aspect);
        const fillY=height/(2*halfH);
        const dominant=Math.max(fillX,fillY);
        assert.ok(dominant>=0.85 && dominant<1,
            `Room should occupy most of frame but remain inside it: ${width}x${height}, aspect ${aspect}, fill ${dominant}`);
    }
    const before=7/(2*(Math.max(4,7/1.7)*0.62+0.15)*1.7);
    const after=7/(2*warehouseCameraHalfHeight(7,4,1.7)*1.7);
    assert.ok(after>before+0.08,'camera framing significantly reduces empty space');
});
