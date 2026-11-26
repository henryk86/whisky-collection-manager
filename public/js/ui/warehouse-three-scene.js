import {t} from '../i18n/index.js';
import {warehouse3DGeometry, cameraDirection, shelfIdAtHeight}
  from '../domain/warehouse-3d-model.js';
import {createFurnitureActivation} from './warehouse-furniture-activation.js';

const PALETTE = {
  light: {
    background: 0xfaf9f6, floor: 0xf2efe9, frame: 0x656b70, board: 0xd7c5a4,
    cabinet: 0xddd0b9, door: 0xe1d3bb, drawer: 0xe9dbc6, glass: 0xb4d3d7,
    bottle: 0x547080, back: 0xe3ddd1, edge: 0x626b72,
  },
  dark: {
    background: 0x142130, floor: 0x243448, frame: 0xc7d0d7, board: 0x927c5c,
    cabinet: 0x586473, door: 0x738093, drawer: 0x718091, glass: 0x7294a4,
    bottle: 0xdbc18c, back: 0x495669, edge: 0xc9cfd6,
  },
};

/**
 * Create a new real 3D scene. No SVG, painter sorting or custom depth masks.
 *
 * @param {*} THREE Loaded Three.js module providing scene, mesh and material constructors.
 * @param {*} room Room model containing dimensions and furniture.
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Object=} options Optional configuration for the operation.
 * @return {!Object} Scene, furniture meshes, room bounds and material, visibility and cleanup operations.
 */
export function buildWarehouseThreeScene(THREE, room, warehouse, options = {}) {
  const theme = options.theme === 'dark' ? 'dark' : 'light';
  const c = PALETTE[theme];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(c.background);
  const all = new THREE.Group();
  scene.add(all);
  const {objects, roomWidth, roomDepth, maxHeight} = warehouse3DGeometry(room, warehouse, options.isolatedId);
  const selectables = [];
  const materials = new Map();
  /**
   * Creates or reuses the material matching a scene part's color and appearance.
   *
   * @param {*} style Visual style or rendering properties.
   * @return {*} Cached or newly created mesh material for the scene style.
   */
  function material(style) {
    if (!materials.has(style)) materials.set(
      style,
      new THREE.MeshBasicMaterial({
        color: c[style] || c.board,
        transparent: style === 'glass', opacity: style === 'glass' ? 0.22 : 1,
        side: THREE.DoubleSide, depthWrite: style !== 'glass',
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      })
    );
    return materials.get(style);
  }
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: c.edge, transparent: true, opacity: 0.8,
  });
  const highlightEdgeMaterial = new THREE.LineBasicMaterial({color: 0xffca58, transparent: false});
  const highlightMaterials = new Map();
  const byFurniture = new Map();
  const hiddenFurniture = new Set(options.hiddenIds || []);
  /**
   * Creates or reuses the material used to highlight a selected scene part.
   *
   * @param {*} style Visual style or rendering properties.
   * @return {*} Cached or newly created highlighted mesh material for the scene style.
   */
  function highlightedMaterial(style) {
    if (!highlightMaterials.has(style)) {
      const mat = material(style).clone();
      mat.color.lerp(new THREE.Color(0xffcb58), 0.55);
      if (style === 'glass') mat.opacity = 0.56;
      highlightMaterials.set(style, mat);
    }
    return highlightMaterials.get(style);
  }
  let highlightedId = null;
  /**
   * Highlights a visible furniture item and restores the previous selection's materials.
   *
   * @param {*} id Identifier of the affected record.
   * @return {*} Identifier of the highlighted item, or null when none is eligible.
   */
  function setHighlightedFurniture(id) {
    const next = byFurniture.has(id) && !hiddenFurniture.has(id) ? id : null;
    if (highlightedId === next) return highlightedId;
    /**
     * Switches the meshes and edge materials belonging to a furniture item between normal and highlighted colors.
     *
     * @param {*} owner Furniture owner identifier whose meshes should be highlighted.
     * @param {*} active Whether the owner is currently highlighted.
     */
    function apply(owner, active) {
      for (const mesh of byFurniture.get(owner) || []) {
        const style = mesh.userData.style;
        mesh.material = active ? highlightedMaterial(style) : material(style);
        mesh.children[0].material = active ? highlightEdgeMaterial : edgeMaterial;
      }
    }
    if (highlightedId) apply(highlightedId, false);
    highlightedId = next;
    if (highlightedId) apply(highlightedId, true);
    return highlightedId;
  }

  /**
   * Adds a box mesh and edge geometry, recording its furniture owner and scene role.
   *
   * @param {*} part Geometry descriptor for a single room or furniture part.
   * @param {*} owner Identifier of the furniture owning the mesh.
   */
  function piece(part, owner) {
    const geo = new THREE.BoxGeometry(...part.size);
    const mesh = new THREE.Mesh(geo, material(part.style));
    mesh.position.set(...part.center);
    mesh.userData.furnitureId = owner;
    mesh.visible = !hiddenFurniture.has(owner);
    mesh.userData.role = part.role;
    mesh.userData.style = part.style;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMaterial);
    mesh.add(edges);
    all.add(mesh);
    selectables.push(mesh);
    if (!byFurniture.has(owner)) byFurniture.set(owner, []);
    byFurniture.get(owner).push(mesh);
  }
  for (const item of objects) for (const part of item.parts) piece(part, item.id);
  /**
   * Changes a furniture item's visibility and clears its highlight when hidden.
   *
   * @param {*} id Identifier of the affected record.
   * @param {boolean} visible Whether meshes belonging to the furniture are shown.
   * @return {boolean} True if the scene contains the requested furniture item.
   */
  function setFurnitureVisible(id, visible) {
    if (!byFurniture.has(id)) return false;
    if (!visible && highlightedId === id) setHighlightedFurniture(null);
    if (visible) hiddenFurniture.delete(id); else hiddenFurniture.add(id);
    for (const mesh of byFurniture.get(id)) mesh.visible = visible;
    return true;
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.035, roomDepth), new THREE.MeshBasicMaterial({color: c.floor}));
  floor.position.set(roomWidth / 2, -0.045, roomDepth / 2);
  all.add(floor);
  const grid = new THREE.GridHelper(
    Math.max(roomWidth, roomDepth),
    Math.max(2, Math.ceil(Math.max(roomWidth, roomDepth))),
    c.edge,
    c.edge
  );
  grid.position.set(roomWidth / 2, -0.021, roomDepth / 2);
  grid.material.opacity = 0.12; grid.material.transparent = true;
  // GridHelper lines extend outside rectangular rooms; the actual floor remains
  // bounded.
  all.add(grid);
  /**
   * Updates the scene background, furniture materials, floor and grid for the selected color scheme.
   *
   * @param {*} next Next candidate state or entry.
   */
  const setTheme = next => {
    const palette = PALETTE[next === 'dark' ? 'dark' : 'light'];
    scene.background.setHex(palette.background);
    for (const [style, mat] of materials) mat.color.setHex(palette[style] || palette.board);
    edgeMaterial.color.setHex(palette.edge);
    for (const [style, mat] of highlightMaterials) {
      mat.color.setHex(palette[style] || palette.board).lerp(new THREE.Color(0xffcb58), 0.55);
    }
    floor.material.color.setHex(palette.floor);
    grid.material.color.setHex(palette.edge);
  };

  /**
   * Releases the geometries and materials allocated by the room scene.
   */
  const dispose = () => {
    all.traverse(obj => {if (obj.geometry) obj.geometry.dispose();});
    for (const mat of materials.values()) mat.dispose();
    edgeMaterial.dispose(); highlightEdgeMaterial.dispose();
    for (const mat of highlightMaterials.values()) mat.dispose();
    floor.material.dispose(); grid.material.dispose();
  };
  return {
    scene,
    objects,
    selectables,
    roomWidth,
    roomDepth,
    maxHeight,
    setTheme,
    setHighlightedFurniture,
    setFurnitureVisible,
    dispose,
  };
}

/**
 * Orthographic framing with a small, predictable margin. The dominant
 * projected dimension uses about 92% of the available viewport at 100% zoom.
 *
 * @param {number} projectedWidth Scene width projected onto the camera plane.
 * @param {number} projectedHeight Scene height projected onto the camera plane.
 * @param {number} aspect Viewport width divided by height.
 * @return {number} Required vertical half-extent of the orthographic frustum.
 */
export function warehouseCameraHalfHeight(projectedWidth, projectedHeight,
  aspect) {
  const dominant = Math.max(projectedHeight, projectedWidth / Math.max(aspect, 0.2));
  return dominant * 0.535 + 0.035;
}

/**
 * Fit projected room bounds to the orthographic frustum, independent of zoom.
 *
 * @param {*} THREE Loaded Three.js module providing vector and camera helpers.
 * @param {*} camera Orthographic camera to position and frame.
 * @param {number} roomWidth Room width in metres.
 * @param {number} roomDepth Room depth in metres.
 * @param {number} maxHeight Maximum scene height in metres.
 * @param {*} corner Corner of the furniture footprint.
 * @param {number} aspect Viewport width divided by height.
 * @param {number=} zoom Map scale used for projection.
 * @return {*} World-space center vector used as the camera target.
 */
export function frameWarehouseCamera(
  THREE,
  camera,
  roomWidth,
  roomDepth,
  maxHeight,
  corner,
  aspect,
  zoom = 100
) {
  const [sx, sz] = cameraDirection(corner);
  const centre = new THREE.Vector3(roomWidth / 2, maxHeight / 2, roomDepth / 2);
  const distance = Math.max(roomWidth, roomDepth, maxHeight) * 2.2 + 4;
  camera.position.set(centre.x + sx * distance, centre.y + distance * 0.85, centre.z + sz * distance);
  camera.up.set(0, 1, 0);
  camera.lookAt(centre);
  camera.updateMatrixWorld();
  const projected = [];
  for (const x of [0, roomWidth]) for (const y of [-0.1, maxHeight]) for (
    const z of [0, roomDepth]) {
    projected.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  }
  /**
   * Measures the projected extent along one camera-plane axis.
   *
   * @param {*} axis Coordinate axis used to determine the projected scene bounds.
   * @return {number} Difference between the maximum and minimum projected coordinates.
   */
  const range = (axis) => Math.max(...projected.map(p => p[axis])) - Math.min(...projected.map(p => p[axis]));
  const halfH = warehouseCameraHalfHeight(range('x'), range('y'), aspect);
  camera.left = -halfH * aspect; camera.right = halfH * aspect;
  camera.top = halfH; camera.bottom = -halfH;
  camera.near = 0.1; camera.far = distance * 10;
  camera.zoom = Math.max(0.5, Math.min(3, Number(zoom) / 100));
  camera.updateProjectionMatrix();
  return centre;
}

/**
 * Mount only when the 3D tab is visible. All imports load from local npm
 * files.
 *
 * @param {*} viewport DOM element that hosts the WebGL canvas.
 * @param {!Object} options2 Destructured options for this operation.
 * @return {!Promise<(!Object)>} Scene handle for disposal, zoom and highlighting, or an inactive handle if the viewport is disconnected.
 */
export async function mountWarehouseThree(
  viewport,
  {
    room,
    warehouse,
    corner = 'nw',
    zoom = 100,
    hiddenIds = [],
    onSelect,
    onOpenShelf = () => {}
  }
) {
  if (!viewport || !viewport.isConnected) return {
    /**
     * No scene resources require disposal when the viewport is not connected.
     */
    dispose() {},
    /**
     * Rejects zoom changes when no scene is mounted.
     * @return {boolean} Always false because no camera is available.
     */
    setZoom() {return false;},
    /**
     * Ignores furniture highlights when no scene is mounted.
     */
    setHighlightedFurniture() {},
  };
  const [THREE, {OrbitControls}] = await Promise.all([import('/vendor/three.module.js'), import('/vendor/three/addons/controls/OrbitControls.js'),]);
  if (!viewport.isConnected) return {
    /**
     * No scene resources require disposal when WebGL is unavailable.
     */
    dispose() {},
    /**
     * Rejects zoom changes when WebGL is unavailable.
     * @return {boolean} Always false because no camera is available.
     */
    setZoom() {return false;},
    /**
     * Ignores furniture highlights when WebGL is unavailable.
     */
    setHighlightedFurniture() {},
  };
  const canvas = document.createElement('canvas');
  canvas.className = 'warehouse-three-canvas';
  canvas.setAttribute('aria-label', 'Dreidimensionaler Raumplan');
  canvas.dataset.hiddenFurniture = hiddenIds.join(',');
  viewport.replaceChildren(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true,
      alpha: false, powerPreference: 'low-power',
    });
  }
  catch (error) {
    viewport.textContent = t('warehouse.view.webglUnavailable'); return {
      /**
       * No scene resources require disposal after renderer initialization fails.
       */
      dispose() {},
      /**
       * Rejects zoom changes after renderer initialization fails.
       * @return {boolean} Always false because no camera is available.
       */
      setZoom() {return false;},
      /**
       * Ignores furniture highlights after renderer initialization fails.
       */
      setHighlightedFurniture() {},
    };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const theme = document.documentElement.dataset.theme;
  const model = buildWarehouseThreeScene(THREE, room, warehouse, {
    hiddenIds,
    theme,
  });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI * 0.48;
  let cameraZoom = Number(zoom) || 100;
  /**
   * Renders the current room scene and records its camera zoom percentage.
   */
  function render() {
    cameraZoom = camera.zoom * 100; renderer.render(model.scene, camera);
  }

  /**
   * Resizes the renderer, reframes the orthographic camera and updates the controls.
   */
  function resize() {
    const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
    renderer.setSize(width, height, false);
    const target = frameWarehouseCamera(
      THREE,
      camera,
      model.roomWidth,
      model.roomDepth,
      model.maxHeight,
      corner,
      width / height,
      cameraZoom
    );
    controls.target.copy(target);
    controls.update(); render();
  }
  controls.addEventListener('change', render);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(viewport);
  if (!observer) window.addEventListener('resize', resize);
  resize();
  const ray = new THREE.Raycaster();
  let down = null;
  const activation = createFurnitureActivation(
    onSelect,
    (_furnitureId, shelfId) => {
      if (shelfId) onOpenShelf(shelfId);
    }
  );
  const furnitureById = new Map((room.furniture || []).map(item => [item.id, item]));
  /**
   * Records the initial pointer position for distinguishing clicks from camera gestures.
   *
   * @param {*} e Pointer-down event used to record the initial picking position.
   */
  function pointerDown(e) {down = {x: e.clientX, y: e.clientY};}

  /**
   * Raycasts a stationary pointer release into selectable furniture meshes and dispatches activation.
   *
   * @param {*} e Pointer-up event used to distinguish a click from camera movement.
   */
  function pointerUp(e) {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) {down = null; return;}
    down = null;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(model.selectables.filter(mesh => mesh.visible), false)[0];
    const furnitureId = hit?.object?.userData?.furnitureId;
    if (furnitureId) {
      const shelfId = shelfIdAtHeight(furnitureById.get(furnitureId), hit.point.y);
      // Selection stays furniture-wide; only a double-click into the
      // same physical bay can open that bay's occupied contents.
      activation.activate(furnitureId, shelfId);
    }
  }
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  let disposed = false;
  const removalObserver = typeof MutationObserver === 'undefined' ? null :
    new MutationObserver(() => {if (!viewport.isConnected) handle.dispose();});
  removalObserver?.observe(document.body, {childList: true, subtree: true});
  const themeObserver = typeof MutationObserver === 'undefined' ? null :
    new MutationObserver(() => {
      model.setTheme(document.documentElement.dataset.theme); render();
    });
  themeObserver?.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  // The renderer must be disposed on every tab switch and DOM removal.
  const handle = {
    /**
     * Releases the mounted room scene, observers, pointer listeners, controls and renderer.
     */
    dispose() {
      if (disposed) return; disposed = true; activation.cancel(); removalObserver?.disconnect();
      themeObserver?.disconnect(); observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
      controls.removeEventListener('change', render); controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      model.dispose(); renderer.dispose(); renderer.forceContextLoss();
      canvas.remove();
    },
    /**
     * Updates furniture visibility and refreshes the canvas's hidden-item metadata.
     *
     * @param {*} id Identifier of the affected record.
     * @param {boolean} visible Whether the furniture should remain visible in the scene.
     * @return {boolean} True if the requested furniture visibility was applied.
     */
    setFurnitureVisible(id, visible) {
      if (disposed || !model.setFurnitureVisible(id, visible)) return false;
      canvas.dataset.hiddenFurniture = (room.furniture || []).filter(item =>
        !model.selectables.some(mesh => mesh.userData.furnitureId === item.id && mesh.visible)).map(item => item.id).join(',');
      if (!visible && canvas.dataset.highlightedFurniture === id) canvas.dataset.highlightedFurniture = '';
      render();
      return true;
    },
    /**
     * Updates the room highlight and redraws the canvas unless disposed.
     *
     * @param {*} id Identifier of the affected record.
     */
    setHighlightedFurniture(id) {
      if (disposed) return;
      const highlighted = model.setHighlightedFurniture(id);
      canvas.dataset.highlightedFurniture = highlighted || '';
      render();
    },
    /**
     * Applies a supported zoom percentage without changing the canvas dimensions.
     *
     * @param {*} value Value to process.
     * @return {boolean} True for a supported zoom percentage.
     */
    setZoom(value) {
      const next = Number(value); if (![100, 150, 200].includes(next)) return false;
      // Camera frustum stays fixed; zoom changes scene scale without stretching
      // the canvas.
      camera.zoom = next / 100; cameraZoom = next; camera.updateProjectionMatrix(); controls.update(); render();
      return true;
    },
  };
  return handle;
}
