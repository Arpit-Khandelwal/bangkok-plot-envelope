/**
 * Main-thread cost of a building part as it arrives: JSON parse, ids, footprint index, and a
 * structured clone (what MapLibre's postMessage to its worker costs). Compared with handling all
 * 6.6 MB in one go, as the app did before parts were streamed. Excluded from `pnpm test`; run
 * with `pnpm test:perf`. Budgets are loose: the point is the printed numbers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import { indexFootprints } from '../map/buildingsOnPlot';
import { BUILDING_PARTS, withPartIds } from './buildingParts';

/** One part must stay well inside a frame budget of a few frames on a laptop. */
const PART_BUDGET_MS = 120;

function time<T>(work: () => T): { readonly result: T; readonly ms: number } {
  const start = performance.now();
  const result = work();
  return { result, ms: performance.now() - start };
}

describe('building part processing', () => {
  const texts = BUILDING_PARTS.map((part) => readFileSync(join(process.cwd(), 'public', part.url), 'utf8'));

  it(`handles each part in under ${PART_BUDGET_MS} ms`, () => {
    // Warm up the JIT once, as a browser would after the first part.
    indexFootprints(withPartIds(JSON.parse(texts[0] ?? '{}') as FeatureCollection, 0).features);

    const rows = BUILDING_PARTS.map((part, position) => {
      const text = texts[position] ?? '';
      const parse = time(() => JSON.parse(text) as FeatureCollection);
      const ids = time(() => withPartIds(parse.result, part.index));
      const index = time(() => indexFootprints(ids.result.features));
      const clone = time(() => structuredClone(ids.result));
      return { part, kb: text.length / 1024, parse: parse.ms, ids: ids.ms, index: index.ms, clone: clone.ms };
    });
    const total = (row: (typeof rows)[number]): number => row.parse + row.ids + row.index + row.clone;

    const all = time(() => {
      const parsed = texts.map((text) => JSON.parse(text) as FeatureCollection);
      const merged = withPartIds({ type: 'FeatureCollection', features: parsed.flatMap((p) => p.features) }, 0);
      indexFootprints(merged.features);
      structuredClone(merged);
    });

    process.stdout.write(
      `${rows
        .map(
          (row) =>
            `  part ${row.part.index}: ${row.kb.toFixed(0)} KB, parse ${row.parse.toFixed(1)} ms, ids ${row.ids.toFixed(1)} ms, ` +
            `index ${row.index.toFixed(1)} ms, clone ${row.clone.toFixed(1)} ms, total ${total(row).toFixed(1)} ms`,
        )
        .join('\n')}\n  worst part ${Math.max(...rows.map(total)).toFixed(1)} ms; all parts at once ${all.ms.toFixed(1)} ms\n`,
    );
    rows.forEach((row) => expect(total(row)).toBeLessThan(PART_BUDGET_MS));
  });
});
