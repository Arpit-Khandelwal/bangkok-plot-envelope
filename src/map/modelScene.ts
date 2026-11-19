/**
 * The three.js half of the model layer, loaded on demand (see modelLayer.ts) so three.js is not
 * part of the first download.
 */
import { MercatorCoordinate } from 'maplibre-gl';
import type { CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';
import type { Mesh } from '../core/types';
import { shadeTriangles } from './cardShading';
import type { ModelContent, ModelPart } from './modelLayer';


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

function toGeometry(mesh: Mesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return geometry;
}

/**
 * The solid's faces as separate triangles with fixed colours: the use colour on roofs and floor
 * plates, darker on walls facing away from the sun (see cardShading.ts). Unlit, so the design is
 * always the lightest thing in the scene, a white card model.
 */
function cardGeometry(part: ModelPart): THREE.BufferGeometry {
  const { positions, shades } = shadeTriangles(part.mesh);
  const base = new THREE.Color(part.color);
  const srgb = { r: 0, g: 0, b: 0 };
  base.getRGB(srgb, THREE.SRGBColorSpace);
  const colours = new Float32Array(shades.length * 3);
  const shaded = new THREE.Color();
  shades.forEach((shade, vertex) => {
    // Shades are applied in sRGB, where they were chosen; setRGB stores linear values.
    shaded.setRGB(srgb.r * shade, srgb.g * shade, srgb.b * shade, THREE.SRGBColorSpace);
    colours[vertex * 3] = shaded.r;
    colours[vertex * 3 + 1] = shaded.g;
    colours[vertex * 3 + 2] = shaded.b;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function surfaceMaterial(part: ModelPart, style: LookStyle): THREE.Material {
  if (part.look === 'solid') {
    return new THREE.MeshBasicMaterial({
      vertexColors: true,
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
    const body = new THREE.Mesh(isSolid ? cardGeometry(part) : geometry, surfaceMaterial(part, style));
    body.renderOrder = isSolid ? ORDER.solid : ORDER.glass;
    group.add(body);
  }

  const edges = new THREE.EdgesGeometry(geometry, EDGE_ANGLE_DEGREES);
  // The indexed geometry is only kept where it is drawn as faces (glass); edges have their own.
  if (style.faceOpacity === null || isSolid) geometry.dispose();
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
export class ModelScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly root = new THREE.Group();
  private localToMercator = new THREE.Matrix4();

  constructor(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.scene.add(this.root);
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
  }

  setContent(content: ModelContent | null): void {
    this.clear();
    if (!content) return;
    const [lng, lat] = content.origin;
    const anchor = MercatorCoordinate.fromLngLat({ lng, lat }, 0);
    const scale = anchor.meterInMercatorCoordinateUnits();
    // Mercator y grows southwards, so y is flipped to keep local y pointing north.
    this.localToMercator = new THREE.Matrix4()
      .makeTranslation(anchor.x, anchor.y, anchor.z)
      .scale(new THREE.Vector3(scale, -scale, scale));
    content.parts.forEach((part) => this.root.add(buildPart(part)));
  }

  render(input: CustomRenderMethodInput): void {
    if (this.root.children.length === 0) return;
    const mapMatrix = new THREE.Matrix4().fromArray(input.defaultProjectionData.mainMatrix as ArrayLike<number> as number[]);
    this.camera.projectionMatrix = mapMatrix.multiply(this.localToMercator);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }

  /** The WebGL context belongs to MapLibre, so only three.js bookkeeping is released here. */
  dispose(): void {
    this.clear();
    this.renderer.dispose();
  }

  private clear(): void {
    [...this.root.children].forEach((child) => {
      disposeGroup(child);
      this.root.remove(child);
    });
  }
}
