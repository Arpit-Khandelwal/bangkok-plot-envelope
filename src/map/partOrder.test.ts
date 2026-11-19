import { describe, expect, it } from 'vitest';
import type { BuildingPart } from '../site/buildingParts';
import { distanceToBboxM, nextPart, partsAround, shouldReframe, type ReframeInput } from './partOrder';

/** A 3 x 1 row of parts, each 0.01 degrees (about 1.1 km) wide. */
const PARTS: readonly BuildingPart[] = [0, 1, 2].map((index) => ({
  index,
  url: `/p${index}`,
  bbox: [100 + index * 0.01, 13, 100.01 + index * 0.01, 13.01],
  count: 1,
}));

function at(index: number): BuildingPart {
  const part = PARTS[index];
  if (!part) throw new Error('no such part');
  return part;
}

describe('distanceToBboxM', () => {
  it('is zero inside the box and grows with distance outside', () => {
    expect(distanceToBboxM([100.005, 13.005], at(0).bbox)).toBe(0);
    const east = distanceToBboxM([100.011, 13.005], at(0).bbox);
    expect(east).toBeGreaterThan(100);
    expect(east).toBeLessThan(120);
  });
});

describe('nextPart', () => {
  it('picks the part containing the focus, then the nearer ones', () => {
    expect(nextPart(PARTS, [100.025, 13.005])?.index).toBe(2);
    expect(nextPart([at(0), at(1)], [100.025, 13.005])?.index).toBe(1);
  });

  it('breaks a tie on a shared edge by the nearer centre', () => {
    // On the edge between parts 0 and 1, slightly towards part 1's centre.
    expect(nextPart([at(0), at(1)], [100.01, 13.005])?.index).toBe(0);
    expect(nextPart([at(1), at(0)], [100.0101, 13.005])?.index).toBe(1);
  });

  it('is null when nothing is waiting', () => {
    expect(nextPart([], [100, 13])).toBeNull();
  });
});

describe('partsAround', () => {
  it('includes the parts within range of the plot box', () => {
    const plot: [number, number][] = [
      [100.009, 13.004],
      [100.0095, 13.004],
      [100.0095, 13.0045],
    ];
    expect(partsAround(PARTS, plot, 0)).toEqual([0]);
    // The plot is about 55 m from part 1.
    expect(partsAround(PARTS, plot, 300)).toEqual([0, 1]);
  });

  it('is empty for an empty plot', () => {
    expect(partsAround(PARTS, [], 300)).toEqual([]);
  });
});

describe('shouldReframe', () => {
  const base: ReframeInput = {
    pendingPlotKey: 'a',
    currentPlotKey: 'a',
    userMoved: false,
    surroundingsSettled: true,
  };

  it('re-frames a plot framed early once its surroundings have arrived', () => {
    expect(shouldReframe(base)).toBe(true);
  });

  it('waits while the surroundings are loading', () => {
    expect(shouldReframe({ ...base, surroundingsSettled: false })).toBe(false);
  });

  it('never takes the camera back from the user', () => {
    expect(shouldReframe({ ...base, userMoved: true })).toBe(false);
  });

  it('does nothing when no early framing is pending (already re-framed, or framed with data)', () => {
    expect(shouldReframe({ ...base, pendingPlotKey: null })).toBe(false);
  });

  it('does nothing when the plot has changed or been cleared since', () => {
    expect(shouldReframe({ ...base, currentPlotKey: 'b' })).toBe(false);
    expect(shouldReframe({ ...base, currentPlotKey: null })).toBe(false);
  });
});
