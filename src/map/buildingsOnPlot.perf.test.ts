/**
 * Timing of the building filter and the occlusion-based view choice against the real baked
 * buildings. Excluded from `pnpm test`;
 * run with `PERF_TESTS=1 pnpm vitest run src/map/buildingsOnPlot.perf.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../state/presets';
import { buildingsOnPlot, indexFootprints, type FootprintProperties } from './buildingsOnPlot';
import { chooseView } from './viewChoice';

const BUILDINGS_DIRECTORY = join(process.cwd(), 'public', 'data', 'buildings');
const BUDGET_MS = 10;
const VIEW_BUDGET_MS = 30;
const RUNS = 50;

function loadFeatures(): Feature<Geometry, FootprintProperties>[] {
  const index = JSON.parse(readFileSync(join(BUILDINGS_DIRECTORY, 'index.json'), 'utf8')) as {
    readonly parts: readonly { readonly file: string }[];
  };
  const features = index.parts.flatMap(
    (part) => (JSON.parse(readFileSync(join(BUILDINGS_DIRECTORY, part.file), 'utf8')) as FeatureCollection).features,
  );
  return features.map((feature, i) => {
    const h: unknown = feature.properties?.h;
    return { ...feature, properties: { i, h: typeof h === 'number' ? h : 0 } };
  });
}

describe('buildingsOnPlot timing', () => {
  it(`stays under ${BUDGET_MS} ms per plot edit with every building loaded`, () => {
    const features = loadFeatures();
    const indexStart = performance.now();
    const footprints = indexFootprints(features);
    const indexMs = performance.now() - indexStart;

    const timings = PRESETS.map((preset) => {
      buildingsOnPlot(footprints, preset.plot);
      const start = performance.now();
      let hidden = 0;
      for (let run = 0; run < RUNS; run += 1) hidden = buildingsOnPlot(footprints, preset.plot).length;
      return { id: preset.id, ms: (performance.now() - start) / RUNS, hidden };
    });

    process.stdout.write(
      `buildings: ${features.length}, index build ${indexMs.toFixed(1)} ms\n${timings
        .map((t) => `  ${t.id}: ${t.ms.toFixed(2)} ms, ${t.hidden} hidden`)
        .join('\n')}\n`,
    );
    timings.forEach((timing) => expect(timing.ms).toBeLessThan(BUDGET_MS));
  });

  it(`chooses a view in under ${VIEW_BUDGET_MS} ms per framing`, () => {
    const footprints = indexFootprints(loadFeatures());
    const results = PRESETS.map((preset) => {
      const hiddenIds = new Set(buildingsOnPlot(footprints, preset.plot));
      const input = { plot: preset.plot, edges: preset.edges, buildings: footprints, hiddenIds, currentBearing: -20 };
      chooseView(input);
      const start = performance.now();
      let view = chooseView(input);
      for (let run = 1; run < 10; run += 1) view = chooseView(input);
      return { id: preset.id, ms: (performance.now() - start) / 10, view };
    });
    process.stdout.write(
      `${results
        .map((r) => `  ${r.id}: ${r.ms.toFixed(1)} ms, bearing ${r.view.bearing.toFixed(0)}, pitch ${r.view.pitch}, hidden ${(r.view.occlusion * 100).toFixed(0)}%`)
        .join('\n')}\n`,
    );
    results.forEach((result) => expect(result.ms).toBeLessThan(VIEW_BUDGET_MS));
  });
});
