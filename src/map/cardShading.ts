/**
 * Fixed per-face shades for the solid design, so it reads as a white card model whatever the
 * lights or the camera do. Pure: works on plain arrays, tested without WebGL.
 *
 * Horizontal faces (roofs, floor plates) keep the use colour. Walls are darkened by how far they
 * face away from the sun: a wall facing the sun keeps SUNLIT_WALL of its colour, a wall facing
 * away keeps SHADED_WALL. For the residential white (#fbfbf8) that is about #eeeeeb in the sun
 * and #c0c0bd in the shade; parking floors (#a9b4b6) stay a clearly darker grey.
 */
import type { Mesh } from '../core/types';

/** Horizontal direction the sunlight comes from (x east, y north): south-south-west. */
const SUN_FROM = { x: -0.6, y: -0.8 } as const;
export const SUNLIT_WALL = 0.95;
export const SHADED_WALL = 0.765;
/** Faces whose normal is steeper than this (|z| of the unit normal) count as horizontal. */
const HORIZONTAL_NZ = 0.7;

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Brightness factor (0 to 1) applied to the use colour, in sRGB, for a face with this normal. */
export function faceShade(normal: Vec3): number {
  const length = Math.hypot(normal.x, normal.y, normal.z);
  if (!(length > 0)) return 1;
  if (Math.abs(normal.z / length) >= HORIZONTAL_NZ) return 1;
  const horizontal = Math.hypot(normal.x, normal.y);
  const sunLength = Math.hypot(SUN_FROM.x, SUN_FROM.y);
  // 1 facing the sun, -1 facing away.
  const facing = (normal.x * SUN_FROM.x + normal.y * SUN_FROM.y) / (horizontal * sunLength);
  const lit = (facing + 1) / 2;
  return SHADED_WALL + (SUNLIT_WALL - SHADED_WALL) * lit;
}

export interface ShadedTriangles {
  /** Non-indexed positions: three vertices per triangle. */
  readonly positions: Float32Array;
  /** One shade factor per vertex (the same for the three vertices of a triangle). */
  readonly shades: Float32Array;
}

/**
 * Splits an indexed mesh into separate triangles, each with its own shade, so neighbouring faces
 * never blend. Normals come from the winding; walls of extruded meshes face outward.
 */
export function shadeTriangles(mesh: Mesh): ShadedTriangles {
  const triangleCount = Math.floor(mesh.indices.length / 3);
  const positions = new Float32Array(triangleCount * 9);
  const shades = new Float32Array(triangleCount * 3);
  const corner = (index: number): Vec3 => {
    const offset = (mesh.indices[index] ?? 0) * 3;
    return { x: mesh.positions[offset] ?? 0, y: mesh.positions[offset + 1] ?? 0, z: mesh.positions[offset + 2] ?? 0 };
  };
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const a = corner(triangle * 3);
    const b = corner(triangle * 3 + 1);
    const c = corner(triangle * 3 + 2);
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const vz = c.z - a.z;
    const shade = faceShade({ x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx });
    [a, b, c].forEach((point, vertex) => {
      const at = triangle * 9 + vertex * 3;
      positions[at] = point.x;
      positions[at + 1] = point.y;
      positions[at + 2] = point.z;
      shades[triangle * 3 + vertex] = shade;
    });
  }
  return { positions, shades };
}
