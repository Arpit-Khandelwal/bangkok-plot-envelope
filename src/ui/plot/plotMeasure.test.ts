import { describe, expect, it } from 'vitest';
import type { EdgeInfo, LngLat, Site } from '../../core/types';
import { sampleEvaluation } from '../fixtures/sampleEvaluation';
import { measurePlot } from './plotMeasure';

const PLOT: readonly LngLat[] = [
  [100, 13],
  [100.001, 13],
  [100.001, 13.001],
  [100, 13.001],
];

describe('measurePlot', () => {
  it('reports each edge length under the letter the user drew it with', () => {
    const base = sampleEvaluation.site;
    const lengths = [10, 20, 30, 40];
    // A clockwise plot comes back reversed: the site's edge k came from drawn edge 3 - k.
    const edges: EdgeInfo[] = lengths.map((_, k) => {
      const source = 3 - k;
      const original = base.edges[k] as EdgeInfo;
      return { ...original, index: k, sourceIndex: source, lengthM: lengths[source] ?? 0 };
    });
    const site: Site = { ...base, edges };
    expect(measurePlot(PLOT, site).edgeLengthsM).toEqual(lengths);
  });

  it('measures the drawn outline when there is no site', () => {
    expect(measurePlot(PLOT, null).edgeLengthsM).toHaveLength(4);
  });
});
