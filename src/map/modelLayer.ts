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

const LAYER_ID = 'plot-model';
const GLASS_OPACITY = 0.2;
const GHOST_OPACITY = 0.06;
const GLASS_EDGE_OPACITY = 0.9;
const GHOST_EDGE_OPACITY = 0.35;
const SOLID_EDGE_COLOR = '#12303a';
/** Faces meeting at more than this angle get a drawn edge, so floor plates read as lines. */
const EDGE_ANGLE_DEGREES = 20;
const SUN_POSITION = new THREE.Vector3(-0.6, -0.8, 1.4);

function toGeometry(mesh: Mesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geometry;
}

function buildPart(part: ModelPart): THREE.Group {
  const group = new THREE.Group();
  group.name = part.key;
  const geometry = toGeometry(part.mesh);
  const isSolid = part.look === 'solid';

  const surface = isSolid
    ? new THREE.MeshLambertMaterial({ color: part.color, flatShading: true, side: THREE.DoubleSide })
    : new THREE.MeshBasicMaterial({
        color: part.color,
        transparent: true,
        opacity: part.look === 'glass' ? GLASS_OPACITY : GHOST_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
  const body = new THREE.Mesh(geometry, surface);
  // Glass is drawn after solids so buildings inside the envelope stay visible through it.
  body.renderOrder = isSolid ? 1 : 2;
  group.add(body);

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: isSolid ? SOLID_EDGE_COLOR : part.color,
    transparent: true,
    opacity: isSolid ? 0.55 : part.look === 'glass' ? GLASS_EDGE_OPACITY : GHOST_EDGE_OPACITY,
    depthWrite: false,
  });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, EDGE_ANGLE_DEGREES), edgeMaterial);
  edges.renderOrder = 3;
  group.add(edges);
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
  readonly id = LAYER_ID;
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
    this.scene.add(new THREE.AmbientLight('#ffffff', 2.1));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
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
