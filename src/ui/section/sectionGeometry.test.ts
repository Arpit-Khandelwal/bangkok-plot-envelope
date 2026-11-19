import { describe, expect, it } from 'vitest';
import type { SectionProfile } from '../../core/types';
import { capLabelCentreY, clampLabelX, LABEL_CLEARANCE, layoutSection, limitHeightAt, placeLimitLabel, VIEW_WIDTH } from './sectionGeometry';

const PROFILE: SectionProfile = {
  roadEdgeIndex: 0,
  rowWidthM: 12,
  setbackM: 6,
  plotDepthM: 50,
  slope: 2,
  roofDeckCapM: 23,
  floors: [{ level: 1, use: 'residential', baseM: 0, topM: 30, nearM: 6, farM: 40 }],
};

describe('layoutSection', () => {
  it('measures the height limit from the far side of the road', () => {
    expect(limitHeightAt(PROFILE, 0)).toBe(24);
    expect(limitHeightAt(PROFILE, 6)).toBe(36);
  });

  it('uses the same scale on both axes', () => {
    const layout = layoutSection(PROFILE);
    const tenMetresAcross = layout.toX(10) - layout.toX(0);
    const tenMetresUp = layout.toY(0) - layout.toY(10);
    expect(tenMetresAcross).toBeCloseTo(tenMetresUp, 9);
    expect(layout.width).toBe(VIEW_WIDTH);
  });

  it('starts the limit line on the ground at the far side of the road', () => {
    const layout = layoutSection(PROFILE);
    expect(layout.limitStart.x).toBeCloseTo(layout.toX(-12), 9);
    expect(layout.limitStart.y).toBeCloseTo(layout.groundY, 9);
  });

  it('clips the limit line at the top of the drawing', () => {
    const layout = layoutSection(PROFILE);
    expect(layout.limitEnd.y).toBeGreaterThanOrEqual(layout.toY(layout.heightMaxM) - 1e-9);
    expect(layout.limitEnd.x).toBeLessThanOrEqual(layout.toX(layout.xMaxM) + 1e-9);
  });

  it('leaves headroom above the tallest floor', () => {
    expect(layoutSection(PROFILE).heightMaxM).toBeGreaterThan(30);
  });
});

describe('clampLabelX', () => {
  it('keeps a label inside the frame', () => {
    expect(clampLabelX(0, 'Road width 12 m', 11, 400)).toBeGreaterThan(40);
    expect(clampLabelX(200, 'x', 11, 400)).toBe(200);
  });
});

describe('placeLimitLabel', () => {
  const profiles: SectionProfile[] = [10, 23, 36, 60, 120].flatMap((top) =>
    [1, 2, 4].map((slope): SectionProfile => ({
      ...PROFILE,
      slope,
      floors: [{ level: 1, use: 'residential', baseM: 0, topM: top, nearM: 6, farM: 40 }],
    })),
  );

  it('never sits within the clearance of the cap label, or outside the drawing', () => {
    for (const profile of profiles) {
      const layout = layoutSection(profile);
      const placed = placeLimitLabel(layout, profile.roofDeckCapM, 'Height limit');
      const capY = capLabelCentreY(layout, profile.roofDeckCapM ?? 0);
      expect(Math.abs(placed.y - capY)).toBeGreaterThanOrEqual(LABEL_CLEARANCE);
      expect(placed.x).toBeGreaterThan(0);
      expect(placed.x).toBeLessThan(layout.width);
    }
  });

  it('runs along the line and is drawn above it when there is no cap', () => {
    const layout = layoutSection(PROFILE);
    const placed = placeLimitLabel(layout, null, 'Height limit');
    expect(placed.angleDeg).toBeLessThan(0);
    expect(placed.side).toBe('above');
  });
});
