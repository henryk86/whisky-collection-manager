import { t } from '../i18n/index.js';
import { warehouse3DGeometry, cameraDirection } from '../domain/warehouse-3d-model.js';
import { createFurnitureActivation } from './warehouse-furniture-activation.js';

const PALETTE = {
    light: {background:0xfaf9f6, floor:0xf2efe9, frame:0x656b70, board:0xd7c5a4,
        cabinet:0xddd0b9, door:0xe1d3bb, drawer:0xe9dbc6, glass:0xb4d3d7,
        bottle:0x547080, back:0xe3ddd1, edge:0x626b72},
    dark: {background:0x142130, floor:0x243448, frame:0xc7d0d7, board:0x927c5c,
        cabinet:0x586473, door:0x738093, drawer:0x718091, glass:0x7294a4,
        bottle:0xdbc18c, back:0x495669, edge:0xc9cfd6},
};

/** Create a new real 3D scene. No SVG, painter sorting or custom depth masks. */
export function buildWarehouseThreeScene(THREE, room, warehouse, options = {}) {
    const theme = options.theme === 'dark' ? 'dark' : 'light';
    const c = PALETTE[theme];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(c.background);
    const all = new THREE.Group();
    scene.add(all);
    const {objects,roomWidth,roomDepth,maxHeight} = warehouse3DGeometry(room,warehouse,options.isolatedId);
    const selectables=[];
    const materials = new Map();
    function material(style) {
        if (!materials.has(style)) materials.set(style,new THREE.MeshBasicMaterial({
            color:c[style] || c.board,
            transparent:style==='glass', opacity:style==='glass'?0.22:1,
            side:THREE.DoubleSide, depthWrite:style!=='glass',
            polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1,
        }));
        return materials.get(style);
    }
    const edgeMaterial = new THREE.LineBasicMaterial({color:c.edge, transparent:true, opacity:0.8});
    const highlightEdgeMaterial = new THREE.LineBasicMaterial({color:0xffca58, transparent:false});
    const highlightMaterials = new Map();
    const byFurniture = new Map();
    const hiddenFurniture = new Set(options.hiddenIds || []);
    function highlightedMaterial(style) {
        if (!highlightMaterials.has(style)) {
            const mat = material(style).clone();
            mat.color.lerp(new THREE.Color(0xffcb58),0.55);
            if (style === 'glass') mat.opacity = 0.56;
            highlightMaterials.set(style,mat);
        }
        return highlightMaterials.get(style);
    }
    let highlightedId = null;
    function setHighlightedFurniture(id) {
        const next = byFurniture.has(id) && !hiddenFurniture.has(id) ? id : null;
        if (highlightedId === next) return highlightedId;
        function apply(owner, active) {
            for (const mesh of byFurniture.get(owner) || []) {
                const style = mesh.userData.style;
                mesh.material = active ? highlightedMaterial(style) : material(style);
                mesh.children[0].material = active ? highlightEdgeMaterial : edgeMaterial;
            }
        }
        if (highlightedId) apply(highlightedId,false);
        highlightedId = next;
        if (highlightedId) apply(highlightedId,true);
        return highlightedId;
    }
    function piece(part, owner) {
        const geo=new THREE.BoxGeometry(...part.size);
        const mesh=new THREE.Mesh(geo,material(part.style));
        mesh.position.set(...part.center);
        mesh.userData.furnitureId=owner;
        mesh.visible=!hiddenFurniture.has(owner);
        mesh.userData.role=part.role;
        mesh.userData.style=part.style;
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMaterial);
        mesh.add(edges);
        all.add(mesh);
        selectables.push(mesh);
        if (!byFurniture.has(owner)) byFurniture.set(owner,[]);
        byFurniture.get(owner).push(mesh);
    }
    for (const item of objects) for (const part of item.parts) piece(part,item.id);
    function setFurnitureVisible(id, visible) {
        if (!byFurniture.has(id)) return false;
        if (!visible && highlightedId === id) setHighlightedFurniture(null);
        if (visible) hiddenFurniture.delete(id); else hiddenFurniture.add(id);
        for (const mesh of byFurniture.get(id)) mesh.visible=visible;
        return true;
    }
    const floor=new THREE.Mesh(new THREE.BoxGeometry(roomWidth,0.035,roomDepth),
        new THREE.MeshBasicMaterial({color:c.floor}));
    floor.position.set(roomWidth/2,-0.045,roomDepth/2);
    all.add(floor);
    const grid=new THREE.GridHelper(Math.max(roomWidth,roomDepth),Math.max(2,Math.ceil(Math.max(roomWidth,roomDepth))),c.edge,c.edge);
    grid.position.set(roomWidth/2,-0.021,roomDepth/2);
    grid.material.opacity=0.12; grid.material.transparent=true;
    // GridHelper lines extend outside rectangular rooms; the actual floor remains bounded.
    all.add(grid);
    const setTheme=next=>{
        const palette=PALETTE[next==='dark'?'dark':'light'];
        scene.background.setHex(palette.background);
        for(const [style,mat] of materials)mat.color.setHex(palette[style]||palette.board);
        edgeMaterial.color.setHex(palette.edge);
        for (const [style,mat] of highlightMaterials) {
            mat.color.setHex(palette[style] || palette.board).lerp(new THREE.Color(0xffcb58),0.55);
        }
        floor.material.color.setHex(palette.floor);
        grid.material.color.setHex(palette.edge);
    };
    const dispose=()=>{
        all.traverse(obj=>{ if(obj.geometry) obj.geometry.dispose(); });
        for(const mat of materials.values()) mat.dispose();
        edgeMaterial.dispose(); highlightEdgeMaterial.dispose();
        for (const mat of highlightMaterials.values()) mat.dispose();
        floor.material.dispose(); grid.material.dispose();
    };
    return {scene,objects,selectables,roomWidth,roomDepth,maxHeight,setTheme,setHighlightedFurniture,setFurnitureVisible,dispose};
}

/** Orthographic framing with a small, predictable margin. The dominant
 * projected dimension uses about 92% of the available viewport at 100% zoom.
 */
export function warehouseCameraHalfHeight(projectedWidth, projectedHeight, aspect) {
    const dominant=Math.max(projectedHeight,projectedWidth/Math.max(aspect,0.2));
    return dominant*0.535+0.035;
}

/** Fit projected room bounds to the orthographic frustum, independent of zoom. */
export function frameWarehouseCamera(THREE, camera, roomWidth, roomDepth, maxHeight, corner, aspect, zoom=100) {
    const [sx,sz]=cameraDirection(corner);
    const centre=new THREE.Vector3(roomWidth/2,maxHeight/2,roomDepth/2);
    const distance=Math.max(roomWidth,roomDepth,maxHeight)*2.2+4;
    camera.position.set(centre.x+sx*distance,centre.y+distance*0.85,centre.z+sz*distance);
    camera.up.set(0,1,0);
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    const projected=[];
    for(const x of [0,roomWidth]) for(const y of [-0.1,maxHeight]) for(const z of [0,roomDepth]) {
        projected.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
    }
    const range=(axis)=>Math.max(...projected.map(p=>p[axis]))-Math.min(...projected.map(p=>p[axis]));
    const halfH=warehouseCameraHalfHeight(range('x'),range('y'),aspect);
    camera.left=-halfH*aspect; camera.right=halfH*aspect;
    camera.top=halfH; camera.bottom=-halfH;
    camera.near=0.1; camera.far=distance*10;
    camera.zoom=Math.max(0.5,Math.min(3,Number(zoom)/100));
    camera.updateProjectionMatrix();
    return centre;
}

/** Mount only when the 3D tab is visible. All imports load from local npm files. */
export async function mountWarehouseThree(viewport,{room,warehouse,corner='nw',zoom=100,hiddenIds=[],onSelect,onEdit=()=>{}}) {
    if (!viewport || !viewport.isConnected) return {dispose(){},setZoom(){return false;},setHighlightedFurniture(){}};
    const [THREE, {OrbitControls}] = await Promise.all([
        import('/vendor/three.module.js'),
        import('/vendor/three/addons/controls/OrbitControls.js'),
    ]);
    if (!viewport.isConnected) return {dispose(){},setZoom(){return false;},setHighlightedFurniture(){}};
    const canvas=document.createElement('canvas');
    canvas.className='warehouse-three-canvas';
    canvas.setAttribute('aria-label','Dreidimensionaler Raumplan');
    canvas.dataset.hiddenFurniture = hiddenIds.join(',');
    viewport.replaceChildren(canvas);
    let renderer;
    try {renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});}
    catch(error){viewport.textContent=t('warehouse.view.webglUnavailable');return {dispose(){},setZoom(){return false;},setHighlightedFurniture(){}};}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    const theme=document.documentElement.dataset.theme;
    const model=buildWarehouseThreeScene(THREE,room,warehouse,{hiddenIds,theme});
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,1000);
    const controls=new OrbitControls(camera,canvas);
    controls.enableDamping=false;
    controls.enableZoom=true;
    controls.enablePan=true;
    controls.enableRotate=true;
    controls.minPolarAngle=0.15; controls.maxPolarAngle=Math.PI*0.48;
    let cameraZoom=Number(zoom)||100;
    function render() {cameraZoom=camera.zoom*100;renderer.render(model.scene,camera);}
    function resize() {
        const width=Math.max(1,viewport.clientWidth),height=Math.max(1,viewport.clientHeight);
        renderer.setSize(width,height,false);
        const target=frameWarehouseCamera(THREE,camera,model.roomWidth,model.roomDepth,model.maxHeight,corner,width/height,cameraZoom);
        controls.target.copy(target);
        controls.update();render();
    }
    controls.addEventListener('change',render);
    const observer=typeof ResizeObserver === 'undefined'?null:new ResizeObserver(resize);
    observer?.observe(viewport);
    if(!observer)window.addEventListener('resize',resize);
    resize();
    const ray=new THREE.Raycaster();
    let down=null;
    const activation=createFurnitureActivation(onSelect,onEdit);
    function pointerDown(e){down={x:e.clientX,y:e.clientY};}
    function pointerUp(e){
        if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}
        down=null;
        const rect=canvas.getBoundingClientRect();
        const mouse=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
        ray.setFromCamera(mouse,camera);
        const hit=ray.intersectObjects(model.selectables.filter(mesh => mesh.visible),false)[0];
        if(hit?.object?.userData?.furnitureId)activation.activate(hit.object.userData.furnitureId);
    }
    canvas.addEventListener('pointerdown',pointerDown);
    canvas.addEventListener('pointerup',pointerUp);
    let disposed=false;
    const removalObserver=typeof MutationObserver==='undefined'?null:new MutationObserver(()=>{if(!viewport.isConnected)handle.dispose();});
    removalObserver?.observe(document.body,{childList:true,subtree:true});
    const themeObserver=typeof MutationObserver==='undefined'?null:new MutationObserver(()=>{
        model.setTheme(document.documentElement.dataset.theme);render();
    });
    themeObserver?.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    // The renderer must be disposed on every tab switch and DOM removal.
    const handle={
        dispose(){if(disposed)return;disposed=true;activation.cancel();removalObserver?.disconnect();themeObserver?.disconnect();observer?.disconnect();if(!observer)window.removeEventListener('resize',resize);
            controls.removeEventListener('change',render);controls.dispose();
            canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);
            model.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();},
        setFurnitureVisible(id, visible){
            if (disposed || !model.setFurnitureVisible(id,visible)) return false;
            canvas.dataset.hiddenFurniture = (room.furniture || []).filter(item => !model.selectables.some(mesh => mesh.userData.furnitureId===item.id && mesh.visible)).map(item=>item.id).join(',');
            if (!visible && canvas.dataset.highlightedFurniture === id) canvas.dataset.highlightedFurniture = '';
            render();
            return true;
        },
        setHighlightedFurniture(id){
            if (disposed) return;
            const highlighted = model.setHighlightedFurniture(id);
            canvas.dataset.highlightedFurniture = highlighted || '';
            render();
        },
        setZoom(value){
            const next=Number(value);if(![100,150,200].includes(next))return false;
            // Camera frustum stays fixed; zoom changes scene scale without stretching the canvas.
            camera.zoom=next/100;cameraZoom=next;camera.updateProjectionMatrix();controls.update();render();return true;
        },
    };
    return handle;
}
