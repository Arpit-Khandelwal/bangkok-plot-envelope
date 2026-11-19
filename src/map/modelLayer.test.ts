import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Mesh } from '../core/types';
import { buildPart, type ModelPart } from './modelLayer';

/** A 10 m cube: 8 corners, 12 triangles. */
function cube(): Mesh {
  const positions = new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10]);
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  ]);
  return { positions, indices };
}

function part(look: ModelPart['look']): ModelPart {
  return { key: look, mesh: cube(), look, color: '#fbfbf8' };
}

function children(group: THREE.Group) {
  const meshes = group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  const lines = group.children.filter((child): child is THREE.LineSegments => child instanceof THREE.LineSegments);
  return { meshes, lines };
}

function lineMaterial(line: THREE.LineSegments | undefined): THREE.LineBasicMaterial {
  const material = line?.material;
  if (!(material instanceof THREE.LineBasicMaterial)) throw new Error('expected a line material');
  return material;
}

describe('buildPart', () => {
  it('draws solids as offset faces, depth-tested edges and a later see-through edge pass', () => {
    const { meshes, lines } = children(buildPart(part('solid')));
    expect(meshes).toHaveLength(1);
    const surface = meshes[0]?.material;
    expect(surface).toBeInstanceOf(THREE.MeshLambertMaterial);
    if (!(surface instanceof THREE.MeshLambertMaterial)) return;
    expect(surface.polygonOffset).toBe(true);
    expect(surface.polygonOffsetFactor).toBe(1);
    expect(surface.polygonOffsetUnits).toBe(1);
    expect(surface.flatShading).toBe(true);

    expect(lines).toHaveLength(2);
    const [visible, xray] = lines;
    expect(lineMaterial(visible).depthTest).toBe(true);
    expect(lineMaterial(visible).opacity).toBeCloseTo(0.75);
    expect(lineMaterial(xray).depthTest).toBe(false);
    expect(lineMaterial(xray).opacity).toBeCloseTo(0.22);
    expect(xray?.renderOrder ?? 0).toBeGreaterThan(visible?.renderOrder ?? 0);
    expect(xray?.renderOrder ?? 0).toBeGreaterThan(meshes[0]?.renderOrder ?? 0);
    expect(xray?.geometry).toBe(visible?.geometry);
  });

  it('draws glass as faint faces that never write depth, crisp edges and a fainter see-through pass', () => {
    const { meshes, lines } = children(buildPart(part('glass')));
    const surface = meshes[0]?.material;
    expect(surface).toBeInstanceOf(THREE.MeshBasicMaterial);
    if (!(surface instanceof THREE.MeshBasicMaterial)) return;
    expect(surface.opacity).toBeCloseTo(0.1);
    expect(surface.depthWrite).toBe(false);
    expect(surface.transparent).toBe(true);

    const [visible, xray] = lines;
    expect(lineMaterial(visible).opacity).toBeCloseTo(0.85);
    expect(lineMaterial(xray).depthTest).toBe(false);
    expect(lineMaterial(xray).opacity).toBeCloseTo(0.12);
  });

  it('draws the ghost as edges only', () => {
    const { meshes, lines } = children(buildPart(part('ghost')));
    expect(meshes).toHaveLength(0);
    expect(lines).toHaveLength(1);
    expect(lineMaterial(lines[0]).opacity).toBeCloseTo(0.3);
  });
});
