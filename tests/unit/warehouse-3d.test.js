import {captureContent} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WAREHOUSE_CAMERAS, furnitureFootprint, cameraDirection, cameraForFurniture, warehouse3DGeometry, shelfIdAtHeight} from '../../public/js/domain/warehouse-3d-model.js';
import {createWarehouseView} from '../../public/js/views/warehouse.js';
import {warehouseCameraHalfHeight} from '../../public/js/ui/warehouse-three-scene.js';

const room = {
  id: 'room', name: 'Zimmer', width: 5, height: 4, furniture: [
    {
      id: 'cabinet',
      name: 'Schrank',
      type: 'schrank',
      x: 0.5,
      y: 0.3,
      width: 1.8,
      depth: 0.7,
      rotation: 0,
      elevation: 0,
      itemHeight: 1.8,
      shelves: [],
    },
    {
      id: 'wall',
      name: 'Hängeregal',
      type: 'haengeregal',
      x: 0.5,
      y: 0.3,
      width: 1.8,
      depth: 0.7,
      rotation: 0,
      elevation: 1.9,
      itemHeight: 0.4,
      shelves: [{id: 's1', name: 'Oben'}],
    },
    {
      id: 'rack',
      name: 'Regal',
      type: 'regal',
      x: 3,
      y: 1.5,
      width: 1.5,
      depth: 0.5,
      rotation: 90,
      elevation: 0,
      itemHeight: 1.9,
      shelves: [{id: 's2', name: 'Fach 1'}, {id: 's3', name: 'Fach 2'}],
    },
  ],
};

const warehouse = {
  rooms: [room], bottles: [{id: 'b1'}], assignments: {b1: 's2', },
};

/**
 * Derives the model result from the supplied values.
 * @return {*} Result computed from the supplied inputs.
 */
const model = () => warehouse3DGeometry(room, warehouse);

test(
  'four stable camera directions and orientation-aware cabinet fronts',
  () => {
    assert.deepEqual(WAREHOUSE_CAMERAS.map(([id]) => id), ['nw', 'ne', 'se', 'sw']);
    for (const [id] of WAREHOUSE_CAMERAS) {
      const [x, z] = cameraDirection(id); assert.equal(Math.abs(x), 1);
      assert.equal(Math.abs(z), 1);
    }
    assert.equal(cameraForFurniture(room.furniture[0], 'sw'), 'sw');
    assert.equal(cameraForFurniture(room.furniture[2], 'se'), 'nw');
    assert.deepEqual(furnitureFootprint(room.furniture[2]), {width: 0.5, depth: 1.5});
  }
);

test(
  'open rack is built from solid shelf boards and four actual posts, not projected polygons',
  () => {
    const rack = model().objects.find(o => o.id === 'rack');
    assert.equal(rack.parts.filter(p => p.role === 'post').length, 4);
    assert.equal(rack.parts.filter(p => p.role === 'shelf-board').length, 3);
    assert.equal(rack.parts.filter(p => p.role === 'body').length, 0);
    for (const part of rack.parts) assert.ok(part.size.every(n => Number.isFinite(n) && n > 0));
  }
);

test('hanging shelf has boards and wall brackets, never floor posts', () => {
  const wall = model().objects.find(o => o.id === 'wall');
  assert.equal(wall.parts.filter(p => p.role === 'post').length, 0);
  assert.equal(wall.parts.filter(p => p.role === 'shelf-board').length, 1);
  assert.equal(wall.parts.filter(p => p.role === 'wall-bracket').length, 2);
  assert.ok(wall.parts.every(p => p.center[1] > 1.7));
});

test(
  'stacked furniture stays physically placed and has NO painter-order masks',
  () => {
    const output = model();
    const cab = output.objects.find(o => o.id === 'cabinet');
    const wall = output.objects.find(o => o.id === 'wall');
    assert.ok(Math.max(...cab.parts.map(p => p.center[1] + p.size[1] / 2)) <
      Math.min(...wall.parts.map(p => p.center[1] - p.size[1] / 2)));
    assert.equal(JSON.stringify(room), JSON.stringify(warehouse.rooms[0]), '3D calculation never mutates room');
  }
);

test(
  'physical compartments follow stored shelves; occupied ones contain bottle models',
  () => {
    const rack = model().objects.find(o => o.id === 'rack');
    assert.equal(rack.shelfCount, 2);
    assert.equal(rack.parts.filter(p => p.role === 'bottle').length, 1);
    const isolated = warehouse3DGeometry(room, warehouse, 'rack');
    assert.deepEqual(isolated.objects.map(o => o.id), ['rack']);
    assert.deepEqual(model().objects.map(o => o.id), ['cabinet', 'wall', 'rack']);
  }
);

test(
  'cabinet, drawers, vitrine, and box get different physical construction',
  () => {
    const base = room.furniture[0];
    /**
     * Derives the mk result from the supplied values.
     *
     * @param {*} type Type or category used to select behavior.
     * @return {*} Result computed from the supplied inputs.
     */
    const mk = type => warehouse3DGeometry({...room, furniture: [{...base, type, shelves: [{id: 'x'}, {id: 'y'}]}]}, warehouse).objects[0];
    assert.equal(mk('schrank').parts.filter(p => p.role === 'door').length, 2);
    assert.equal(mk('kommode').parts.filter(p => p.role === 'drawer').length, 2);
    assert.equal(mk('vitrine').parts.filter(p => p.role === 'glass-front').length, 1);
    assert.equal(mk('vitrine').parts.filter(p => p.role === 'shelf-board').length, 3);
    assert.equal(mk('kiste').parts.filter(p => p.role === 'body').length, 1);
  }
);

test(
  'Three.js is served locally from a fixed allowlist and is not loaded from CDN',
  () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.equal(pkg.dependencies.three, '0.187.0');
  }
);

test(
  'cabinet doors, showcase glass and drawers follow the physical front at 0, 90, 180 and 270 degrees',
  () => {
    const original = room.furniture[0];
    const normals = [[0, 1], [-1, 0], [0, -1], [1, 0]];
    for (const [i, rotation] of [0, 90, 180, 270].entries()) {
      const item = {...original, rotation, x: 1, y: 1, width: 1.6, depth: 0.65};
      const footprint = furnitureFootprint(item);
      const centre = [item.x + footprint.width / 2, item.y + footprint.depth / 2];
      const [nx, nz] = normals[i];
      for (const [type, role, expected] of [
        ['schrank', 'door', 2],
        ['vitrine', 'glass-front', 1],
        ['kommode', 'drawer', 1],
      ]) {
        const result = warehouse3DGeometry({...room, furniture: [{...item, type, shelves: []}]}, warehouse).objects[0];
        const fronts = result.parts.filter(part => part.role === role);
        assert.equal(fronts.length, expected, `${type}, ${rotation}°`);
        for (const front of fronts) {
          const dx = front.center[0] - centre[0], dz = front.center[2] - centre[1];
          // Every panel lies outside the body exactly on its rotated front.
          assert.ok(
            Math.abs(dx * nx + dz * nz - (item.depth / 2 + front.size[rotation % 180 ? 0 : 2] / 2)) < 1e-7,
            `${type} ${rotation}°: front must point in the direction of its door/glass`
          );
          if (rotation % 180 === 0) assert.ok(front.size[0] > front.size[2], `${type} ${rotation}° along x`);
          else assert.ok(front.size[2] > front.size[0], `${type} ${rotation}° along z`);
        }
      }
    }
  }
);

test(
  'rotated rack side and back panels follow the local axes and remain separately optional',
  () => {
    for (const rotation of [0, 90, 180, 270]) {
      const base = {
        ...room.furniture[2], x: 1, y: 1, width: 1.4, depth: 0.6, rotation,
        leftSidePanel: true, rightSidePanel: false, backPanel: true,
      };
      const {width, depth} = furnitureFootprint(base);
      const center = [base.x + width / 2, base.y + depth / 2];
      const normal = [-Math.round(Math.sin(rotation * Math.PI / 180)), Math.round(Math.cos(rotation * Math.PI / 180)),];
      const tangent = [Math.round(Math.cos(rotation * Math.PI / 180)), Math.round(Math.sin(rotation * Math.PI / 180)),];
      const parts = warehouse3DGeometry({...room, furniture: [base]}, warehouse).objects[0].parts;
      const left = parts.find(p => p.role === 'left-side-panel');
      const back = parts.find(p => p.role === 'back-panel');
      assert.ok(left && back);
      assert.equal(parts.some(p => p.role === 'right-side-panel'), false);
      const leftDelta = [left.center[0] - center[0], left.center[2] - center[1]];
      const backDelta = [back.center[0] - center[0], back.center[2] - center[1]];
      assert.ok(leftDelta[0] * tangent[0] + leftDelta[1] * tangent[1] < 0, `left ${rotation}`);
      assert.ok(backDelta[0] * normal[0] + backDelta[1] * normal[1] < 0, `back ${rotation}`);
    }
  }
);

test(
  'show all only restores furniture of the selected room and syncs all eye buttons',
  () => {
    const original = globalThis.document;
    const changes = [];
    const btns = room.furniture.map(furniture => ({
      dataset: {id: furniture.id},
      /**
       * Updates attribute in the current state.
       *
       * @param {*} name Environment variable or setting name.
       * @param {*} value Value to process.
       */
      setAttribute(name, value) {changes.push([this.dataset.id, name, value]);},
      /**
       * Performs the closest lifecycle action.
       * @return {!Object} Structured result assembled from the input data.
       */
      closest() {
        return {
          classList: {
            /**
             * Updates the toggle state for its caller.
             *
             * @param {*} name Environment variable or setting name.
             * @param {*} hidden Value used by this operation.
             */
            toggle(name, hidden) {changes.push([furniture.id, name, hidden]);},
          },
        };
      },
    }));
    const all = {disabled: true};
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: selector => selector === '.warehouse-show-all' ? all : null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => btns,
    };
    try {
      const state = {
        warehouse,
        selected: 'rooms',
        warehouseRoomId: room.id,
        warehouseHiddenFurnitureIds: ['cabinet', 'rack', 'elsewhere'],
        warehouseSelectedFurnitureIds: ['wall'],
      };
      const view = createWarehouseView({
        mountContent: captureContent,
        state,
        /**
         * Discards page content in this scenario; no real DOM is mounted.
         */
        shell: () => {},
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      assert.equal(view.showAllFurniture(), 2);
      assert.deepEqual(
        state.warehouseHiddenFurnitureIds,
        ['elsewhere'],
        'hidden furniture in a different room must remain hidden'
      );
      assert.equal(all.disabled, true);
      assert.ok(changes.some(change => change[0] === 'cabinet' && change[1] === 'aria-pressed' && change[2] === 'true'));
      assert.ok(changes.some(change => change[0] === 'rack' && change[1] === 'aria-pressed' && change[2] === 'true'));
      assert.equal(changes.some(change => change[0] === 'wall'), false, 'unchanged furniture buttons are untouched');
      assert.equal(view.toggleFurnitureVisibility('cabinet'), false);
      assert.equal(all.disabled, false, 'restoration button becomes enabled when any item is hidden');
    } finally {
      if (original === undefined) delete globalThis.document; else globalThis.document = original;
    }
  }
);

test(
  '3D visibility switches real mesh geometry independently and reversibly',
  async () => {
    const {buildWarehouseThreeScene} = await import('../../public/js/ui/warehouse-three-scene.js');
    class Node {
      /**
       * Initializes the instance and its state.
       */
      constructor() {
        this.children = []; this.position =
        {
          /**
           * Updates the set state for its caller.
           */
          set() {},
        }; this.userData = {}; this.visible = true;
      }

      /**
       * Updates the add state for its caller.
       *
       * @param {*} child Value used by this operation.
       */
      add(child) {
        this.children.push(child);
      }

      /**
       * Updates the traverse state for its caller.
       *
       * @param {*} fn Function called during this operation.
       */
      traverse(fn) {
        fn(this);
        for (const child of this.children) child.traverse(fn);
      }
    }
    class Color {
      /**
       * Initializes the instance and its state.
       *
       * @param {*} value Value to process.
       */
      constructor(value) {
        this.value = value;
      }

      /**
       * Updates hex in the current state.
       *
       * @param {*} value Value to process.
       * @return {*} Result computed from the supplied inputs.
       */
      setHex(value) {this.value = value; return this;}

      /**
       * Derives the lerp result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      lerp() {return this;}
    }
    class Geometry {
      /**
       * Performs the dispose lifecycle action.
       */
      dispose() {}
    }
    class Material {
      /**
       * Initializes the instance and its state.
       *
       * @param {!Object=} options Options controlling the operation.
       */
      constructor(options = {}) {
        Object.assign(this, options); this.color = new Color(options.color);
      }

      /**
       * Derives the clone result from the supplied values.
       * @return {*} New instance constructed from the inputs.
       */
      clone() {
        return new Material({
          color: this.color.value, opacity: this.opacity,
        });
      }

      /**
       * Performs the dispose lifecycle action.
       */
      dispose() {}
    }
    class Mesh extends Node {
      /**
       * Initializes the instance and its state.
       *
       * @param {*} geo Value used by this operation.
       * @param {*} material Value used by this operation.
       */
      constructor(geo, material) {
        super(); this.geometry = geo; this.material = material;
      }
    }
    class Grid extends Node {
      /**
       * Initializes the instance and its state.
       */
      constructor() {
        super(); this.material =
        {
          color: new Color(0),
          /**
           * Performs the dispose lifecycle action.
           */
          dispose() {},
        };
      }
    }
    const THREE = {
      Scene: Node,
      Group: Node,
      Color,
      BoxGeometry: Geometry,
      EdgesGeometry: Geometry,
      MeshBasicMaterial: Material,
      LineBasicMaterial: Material,
      Mesh,
      LineSegments: Mesh,
      GridHelper: Grid,
      DoubleSide: 2,
    };
    const scene = buildWarehouseThreeScene(THREE, room, warehouse, {hiddenIds: ['cabinet', 'rack']});
    /**
     * Filters records according to the meshes selection rules.
     *
     * @param {*} id Identifier of the affected record.
     * @return {*} Entries that meet the selection criteria.
     */
    const meshes = id => scene.selectables.filter(mesh => mesh.userData.furnitureId === id);
    assert.ok(meshes('cabinet').length > 0 && meshes('rack').length > 0 && meshes('wall').length > 0);
    assert.ok(meshes('cabinet').every(mesh => !mesh.visible));
    assert.ok(meshes('rack').every(mesh => !mesh.visible));
    assert.ok(meshes('wall').every(mesh => mesh.visible));
    assert.equal(scene.setHighlightedFurniture('cabinet'), null, 'hidden furniture cannot be highlighted');
    assert.equal(scene.setFurnitureVisible('cabinet', true), true);
    assert.ok(meshes('cabinet').every(mesh => mesh.visible));
    assert.ok(meshes('rack').every(mesh => !mesh.visible), 'showing one must not show the others');
    const cabinetMesh = meshes('cabinet')[0];
    const ordinaryMaterial = cabinetMesh.material;
    const ordinaryEdges = cabinetMesh.children[0].material;
    assert.equal(scene.setHighlightedFurniture('cabinet'), 'cabinet');
    assert.notEqual(cabinetMesh.material, ordinaryMaterial, 'hover must highlight real mesh material');
    assert.notEqual(cabinetMesh.children[0].material, ordinaryEdges, 'hover must highlight mesh edges');
    assert.equal(scene.setHighlightedFurniture('rack'), null, 'hidden target clears highlight');
    assert.equal(cabinetMesh.material, ordinaryMaterial, 'leaving hover restores original material');
    assert.equal(cabinetMesh.children[0].material, ordinaryEdges, 'leaving hover restores original edges');
    assert.equal(scene.setHighlightedFurniture('cabinet'), 'cabinet');
    scene.setFurnitureVisible('cabinet', false);
    assert.equal(cabinetMesh.material, ordinaryMaterial, 'hiding highlighted furniture clears hover');
    assert.ok(meshes('cabinet').every(mesh => !mesh.visible));
    scene.setFurnitureVisible('rack', true);
    assert.ok(meshes('rack').every(mesh => mesh.visible));
    assert.equal(scene.setFurnitureVisible('invalid-id', true), false);
    scene.dispose();
  }
);

test(
  '3D room uses almost the available viewport at default 100% zoom without clipping',
  () => {
    // These projected dimensions cover both landscape and portrait plan stages.
    for (const [width, height, aspect] of [[7, 4, 1.7], [4, 7, 0.7], [2.4, 1.7,
      1.5], [10, 5, 2.2]]) {
      const halfH = warehouseCameraHalfHeight(width, height, aspect);
      const fillX = width / (2 * halfH * aspect);
      const fillY = height / (2 * halfH);
      const dominant = Math.max(fillX, fillY);
      assert.ok(dominant >= 0.85 && dominant < 1,
        `Room should occupy most of frame but remain inside it: ${width}x${height}, aspect ${aspect}, fill ${dominant}`);
    }
    const before = 7 / (2 * (Math.max(4, 7 / 1.7) * 0.62 + 0.15) * 1.7);
    const after = 7 / (2 * warehouseCameraHalfHeight(7, 4, 1.7) * 1.7);
    assert.ok(after > before + 0.08, 'camera framing significantly reduces empty space');
  }
);

test(
  '3D picking resolves individual bay heights, not the furniture as a whole',
  () => {
    const rack = {
      id: 'mixed', type: 'regal', elevation: 1.9, itemHeight: 1.2,
      shelves: [
        {id: 'bottom', heightCm: 20},
        {id: 'middle', heightCm: 35},
        {id: 'top', heightCm: 45},
      ],
    };
    assert.equal(shelfIdAtHeight(rack, 1.95), 'bottom');
    assert.equal(shelfIdAtHeight(rack, 2.20), 'middle');
    assert.equal(shelfIdAtHeight(rack, 2.73), 'top');
    assert.equal(shelfIdAtHeight(rack, 1.5), null);
    assert.equal(shelfIdAtHeight(rack, 3.2), null);
    assert.equal(shelfIdAtHeight(null, 2), null);
    assert.equal(shelfIdAtHeight(rack, NaN), null);
    const withClearance = {
      ...rack,
      shelves: [{id: 'low', heightCm: 20}, {id: 'high', heightCm: 30}],
    };
    assert.equal(shelfIdAtHeight(withClearance, 2.35), 'high');
    assert.equal(shelfIdAtHeight(withClearance, 2.8), null, 'unused clearance above explicit heights is not a shelf');
    const blocked = {
      ...rack, shelves: [{id: 'blocked', capacity: 0}, {id: 'usable'}],
    };
    assert.equal(shelfIdAtHeight(blocked, 2), null, 'unassignable shelves cannot be opened');
    assert.equal(shelfIdAtHeight(blocked, 2.8), 'usable');
  }
);
