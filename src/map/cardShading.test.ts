import { describe, expect, it } from 'vitest';
import { faceShade, SHADED_WALL, shadeTriangles, SUNLIT_WALL } from './cardShading';

describe('faceShade', () => {
  it('keeps roofs and floor plates at full colour, facing either way', () => {
    expect(faceShade({ x: 0, y: 0, z: 1 })).toBe(1);
    expect(faceShade({ x: 0, y: 0, z: -3 })).toBe(1);
  });

  it('darkens walls by how far they face away from the sun', () => {
    const sunlit = faceShade({ x: -0.6, y: -0.8, z: 0 });
    const shaded = faceShade({ x: 0.6, y: 0.8, z: 0 });
    const side = faceShade({ x: 0.8, y: -0.6, z: 0 });
    expect(sunlit).toBeCloseTo(SUNLIT_WALL);
    expect(shaded).toBeCloseTo(SHADED_WALL);
    expect(side).toBeGreaterThan(shaded);
    expect(side).toBeLessThan(sunlit);
  });

  it('keeps residential white within the card palette', () => {
    // #fbfbf8: sunlit walls at or above #e8e8e4, shaded walls at or above #b9c0c0.
    expect(0xfb * SUNLIT_WALL).toBeGreaterThanOrEqual(0xe8);
    expect(0xfb * SHADED_WALL).toBeGreaterThanOrEqual(0xb9);
  });

  it('treats a degenerate face as unshaded', () => {
    expect(faceShade({ x: 0, y: 0, z: 0 })).toBe(1);
  });
});

describe('shadeTriangles', () => {
  it('splits triangles apart and shades each by its own normal', () => {
    // A roof triangle and a north-facing wall triangle sharing two vertices.
    const mesh = {
      positions: new Float32Array([0, 10, 0, 10, 10, 0, 10, 10, 5, 0, 10, 5, 0, 0, 5]),
      indices: new Uint32Array([3, 2, 4, 0, 2, 1]),
    };
    const { positions, shades } = shadeTriangles(mesh);
    expect(positions).toHaveLength(18);
    expect(Array.from(positions.slice(0, 3))).toEqual([0, 10, 5]);
    expect(Array.from(shades.slice(0, 3))).toEqual([1, 1, 1]);
    const wall = shades[3] ?? 0;
    expect(wall).toBeLessThan(1);
    expect(shades[4]).toBe(wall);
    expect(shades[5]).toBe(wall);
  });
});
