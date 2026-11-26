/**
 * Browser-delivered third-party entry points. These URLs do not resolve as
 * npm module specifiers. Declare only the API surface used by WCM, not a
 * substitute for the libraries' complete public typings. Keep these contracts
 * in sync with the pinned three, html5-qrcode and ONNX Runtime versions.
 * This file is used only by check-js-types.js and is not served to clients.
 */
declare module '*/ai/vendor/ort.wasm.min.mjs' {
  export const env: {wasm: {wasmPaths: string; numThreads: number; proxy: boolean}};
  export class Tensor {
    constructor(type: 'float32', data: Float32Array, dims: readonly number[]);
    readonly data: Float32Array;
    dispose(): void;
  }
  export class InferenceSession {
    static create(path: string, options: {
      executionProviders: ['wasm']; graphOptimizationLevel: 'all';
    }): Promise<InferenceSession>;
    readonly inputNames: readonly string[];
    readonly outputNames: readonly string[];
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
  }
}

/** Numeric formats and decoder options supplied by the pinned UMD scanner. */
interface WcmScannerFormats { [name: string]: number }
interface WcmScannerResult { result: {format?: {formatName: string}} }
interface WcmScannerEngine {
  start(camera: MediaTrackConstraints, config: {
    fps: number;
    qrbox: (width: number, height: number) => {width: number; height: number};
  }, decoded: (value: string, result: WcmScannerResult) => void,
  onDecodeError: (message: string) => void): Promise<void>;
  stop(): Promise<void>;
  clear(): void;
  scanFile(file: File, showImage: boolean): Promise<string>;
}
interface Window {
  Html5Qrcode?: new (elementId: string, config: {
    formatsToSupport: number[];
    useBarCodeDetectorIfSupported: boolean;
    verbose?: boolean;
  }, verbose?: boolean) => WcmScannerEngine;
  Html5QrcodeSupportedFormats?: WcmScannerFormats;
}

declare module '*/vendor/three.module.js' {
  export const DoubleSide: 2;
  export class Matrix4 { readonly elements: number[] }
  export class Vector2 { constructor(x?: number, y?: number); x: number; y: number }
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number; y: number; z: number;
    set(x: number, y: number, z: number): this;
    copy(other: Vector3): this;
    applyMatrix4(matrix: Matrix4): this;
  }
  export class Color {
    constructor(hex: number);
    setHex(hex: number): this;
    lerp(other: Color, alpha: number): this;
  }
  export class Object3D {
    readonly position: Vector3;
    readonly children: Object3D[];
    visible: boolean;
    userData: Record<string, unknown>;
    add(...children: Object3D[]): this;
    traverse(callback: (object: Object3D) => void): void;
  }
  export class Scene extends Object3D { background: Color|null }
  export class Group extends Object3D {}
  export class OrthographicCamera extends Object3D {
    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number);
    left: number; right: number; top: number; bottom: number;
    near: number; far: number; zoom: number; up: Vector3;
    readonly matrixWorldInverse: Matrix4;
    lookAt(target: Vector3): void;
    updateMatrixWorld(force?: boolean): void;
    updateProjectionMatrix(): void;
  }
  export class BufferGeometry { dispose(): void }
  export class BoxGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }
  export class EdgesGeometry extends BufferGeometry { constructor(geometry: BufferGeometry) }
  interface MaterialParameters {
    color?: number; transparent?: boolean; opacity?: number; side?: number;
    depthWrite?: boolean; polygonOffset?: boolean;
    polygonOffsetFactor?: number; polygonOffsetUnits?: number;
  }
  export class Material {
    opacity: number; transparent: boolean;
    clone(): this;
    dispose(): void;
  }
  export class MeshBasicMaterial extends Material {
    constructor(parameters?: MaterialParameters);
    readonly color: Color;
  }
  export class LineBasicMaterial extends Material {
    constructor(parameters?: MaterialParameters);
    readonly color: Color;
  }
  export class Mesh<G extends BufferGeometry = BufferGeometry, M extends Material = Material> extends Object3D {
    constructor(geometry: G, material: M);
    geometry: G; material: M;
  }
  export class LineSegments extends Object3D {
    constructor(geometry: BufferGeometry, material: LineBasicMaterial);
    geometry: BufferGeometry; material: LineBasicMaterial;
  }
  export class GridHelper extends LineSegments {
    constructor(size: number, divisions: number, colorCenterLine: number, colorGrid: number);
  }
  export class Raycaster {
    setFromCamera(pointer: Vector2, camera: OrthographicCamera): void;
    intersectObjects<T extends Object3D>(objects: T[], recursive?: boolean): Array<{object: T; point: Vector3}>;
  }
  export class WebGLRenderer {
    constructor(options: {canvas: HTMLCanvasElement; antialias?: boolean; alpha?: boolean;
      preserveDrawingBuffer?: boolean; powerPreference?: WebGLPowerPreference});
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: OrthographicCamera): void;
    dispose(): void;
    forceContextLoss(): void;
  }
}

declare module '*/vendor/three/addons/controls/OrbitControls.js' {
  type OrthographicCamera = import('/vendor/three.module.js').OrthographicCamera;
  type Vector3 = import('/vendor/three.module.js').Vector3;
  export class OrbitControls {
    constructor(camera: OrthographicCamera, element: HTMLElement);
    enableDamping: boolean; enableZoom: boolean; enablePan: boolean; enableRotate: boolean;
    minPolarAngle: number; maxPolarAngle: number;
    readonly target: Vector3;
    addEventListener(type: 'change', listener: () => void): void;
    removeEventListener(type: 'change', listener: () => void): void;
    update(): boolean;
    dispose(): void;
  }
}
