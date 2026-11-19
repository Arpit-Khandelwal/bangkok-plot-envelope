/**
 * Timing of the building filter against the real baked buildings. Excluded from `pnpm test`;
 * run with `PERF_TESTS=1 pnpm vitest run src/map/buildingsOnPlot.perf.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../state/presets';
import { buildingsOnPlot, indexFootprints } from './buildingsOnPlot';

const BUILDINGS_DIRECTORY = join(process.cwd(), 'public', 'data', 'buildings');
const BUDGET_MS = 10;
const RUNS = 50;

function loadFeatures(): Feature<Geometry, { readonly i: number }>[] {
  const index = JSON.parse(readFileSync(join(BUILDINGS_DIRECTORY, 'index.json'), 'utf8')) as {
    readonly parts: readonly { readonly file: string }[];
  };
  const features = index.parts.flatMap(
    (part) => (JSON.parse(readFileSync(join(BUILDINGS_DIRECTORY, part.file), 'utf8')) as FeatureCollection).features,
  );
  return features.map((feature, i) => ({ ...feature, properties: { i } }));
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
});
