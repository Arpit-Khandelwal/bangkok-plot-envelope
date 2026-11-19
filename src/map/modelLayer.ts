import { MercatorCoordinate } from 'maplibre-gl';
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';
import type { LngLat, Mesh } from '../core/types';

/** How one mesh is drawn. `glass` is for envelopes, `solid` for building floors. */
export interface ModelPart {
  readonly key: string;
  readonly mesh: Mesh;
  readonly look: 'glass' | 'ghost' | 'solid';
  /** CSS colour. */
  readonly color: string;
}

export interface ModelContent {
  /** Lng/lat of the local frame origin that the mesh coordinates are relative to. */
  readonly origin: LngLat;
  readonly parts: readonly ModelPart[];
}

export const MODEL_LAYER_ID = 'plot-model';

/** Faces meeting at more than this angle get a drawn edge, so floor plates read as lines. */
const EDGE_ANGLE_DEGREES = 20;
const INK = '#12303a';

/**
 * How each look is drawn. `faceOpacity: null` means no faces at all; `xray` is the opacity of a
 * second pass of the edges with the depth test off, so a part hidden behind a neighbour still
 * shows as a faint outline through it.
 */
interface LookStyle {
  readonly faceOpacity: number | null;
  readonly edgeOpacity: number;
  readonly xrayOpacity: number | null;
}

const LOOKS: Readonly<Record<ModelPart['look'], LookStyle>> = {
  // Solid faces are opaque; the face opacity here is unused.
  solid: { faceOpacity: 1, edgeOpacity: 0.75, xrayOpacity: 0.22 },
  glass: { faceOpacity: 0.1, edgeOpacity: 0.85, xrayOpacity: 0.12 },
  ghost: { faceOpacity: null, edgeOpacity: 0.3, xrayOpacity: null },
};

/**
 * Draw order inside the layer: opaque solids first, then glass faces (which never write depth),
 * then edges, then the see-through outlines last so nothing paints over them.
 */
const ORDER = { solid: 1, glass: 2, edges: 3, xray: 4 } as const;

/**
 * Lights for a white card model. Lambert shading in three.js gives
 * albedo * (ambient + sun * max(0, n.l)) / pi in linear light. With these values a roof
 * (n.l = 0.81) is just under full white, sunlit walls sit around 0.9 in sRGB and walls facing
 * away from the sun around 0.75, and even the darkest use colour (parking) stays near mid grey.
 */
const AMBIENT_INTENSITY = 1.6;
const SUN_INTENSITY = 1.8;
/** Sun from the south-south-west, high: walls facing different ways get clearly different shades. */
const SUN_POSITION = new THREE.Vector3(-0.6, -0.8, 1.4);

function toGeometry(mesh: Mesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geometry;
}

function surfaceMaterial(part: ModelPart, style: LookStyle): THREE.Material {
  if (part.look === 'solid') {
    return new THREE.MeshLambertMaterial({
      color: part.color,
      flatShading: true,
      side: THREE.DoubleSide,
      // Push faces back a little so the edge lines lying on them always win the depth test.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
  }
  return new THREE.MeshBasicMaterial({
    color: part.color,
    transparent: true,
    opacity: style.faceOpacity ?? 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function edgeLines(edges: THREE.EdgesGeometry, color: string, opacity: number, depthTest: boolean): THREE.LineSegments {
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest });
  return new THREE.LineSegments(edges, material);
}

export function buildPart(part: ModelPart): THREE.Group {
  const group = new THREE.Group();
  group.name = part.key;
  const style = LOOKS[part.look];
  const geometry = toGeometry(part.mesh);
  const isSolid = part.look === 'solid';

  if (style.faceOpacity !== null) {
    const body = new THREE.Mesh(geometry, surfaceMaterial(part, style));
    body.renderOrder = isSolid ? ORDER.solid : ORDER.glass;
    group.add(body);
  }

  const edges = new THREE.EdgesGeometry(geometry, EDGE_ANGLE_DEGREES);
  if (style.faceOpacity === null) geometry.dispose();
  const lineColor = isSolid ? INK : part.color;
  const visible = edgeLines(edges, lineColor, style.edgeOpacity, true);
  visible.renderOrder = ORDER.edges;
  group.add(visible);

  if (style.xrayOpacity !== null) {
    // Shares the edge geometry; `disposeGroup` tolerates disposing it twice.
    const xray = edgeLines(edges, lineColor, style.xrayOpacity, false);
    xray.renderOrder = ORDER.xray;
    group.add(xray);
  }
  return group;
}

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material: THREE.Material) => material.dispose());
    }
  });
}

/**
 * A three.js scene drawn inside the MapLibre canvas, sharing its depth buffer so the
 * model is hidden correctly behind real buildings.
 *
 * Mesh coordinates are local metres (x east, y north, z up) around `origin`.
 */
export class ModelLayer implements CustomLayerInterface {
  readonly id = MODEL_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly root = new THREE.Group();
  private localToMercator = new THREE.Matrix4();

  constructor() {
    this.scene.add(this.root);
    this.scene.add(new THREE.AmbientLight('#ffffff', AMBIENT_INTENSITY));
    const sun = new THREE.DirectionalLight('#ffffff', SUN_INTENSITY);
    sun.position.copy(SUN_POSITION);
    this.scene.add(sun);
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
  }

  onRemove(): void {
    this.clear();
    // The WebGL context belongs to MapLibre, so only three.js bookkeeping is released here.
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  setContent(content: ModelContent | null): void {
    this.clear();
    if (content) {
      const [lng, lat] = content.origin;
      const anchor = MercatorCoordinate.fromLngLat({ lng, lat }, 0);
      const scale = anchor.meterInMercatorCoordinateUnits();
      // Mercator y grows southwards, so y is flipped to keep local y pointing north.
      this.localToMercator = new THREE.Matrix4()
        .makeTranslation(anchor.x, anchor.y, anchor.z)
        .scale(new THREE.Vector3(scale, -scale, scale));
      content.parts.forEach((part) => this.root.add(buildPart(part)));
    }
    this.map?.triggerRepaint();
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, input: CustomRenderMethodInput): void {
    if (!this.renderer || this.root.children.length === 0) return;
    const mapMatrix = new THREE.Matrix4().fromArray(input.defaultProjectionData.mainMatrix as ArrayLike<number> as number[]);
    this.camera.projectionMatrix = mapMatrix.multiply(this.localToMercator);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }

  private clear(): void {
    [...this.root.children].forEach((child) => {
      disposeGroup(child);
      this.root.remove(child);
    });
  }
}
