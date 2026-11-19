/** Zone lookup runs on every edit of the plot: it must stay at a few milliseconds on the real map. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../state/presets';
import { locateZone } from './context';
import type { SiteData } from './siteData';

const BUDGET_MS = 5;
const RUNS = 21;

describe('zone lookup on the real zone map', () => {
  const zones = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'zones.geojson'), 'utf8')) as SiteData['zones'];

  it(`takes under ${BUDGET_MS} ms per preset plot (median of warm runs)`, () => {
    for (const preset of PRESETS) locateZone(preset.plot, zones);
    const rows = PRESETS.map((preset) => {
      const times = Array.from({ length: RUNS }, () => {
        const start = performance.now();
        locateZone(preset.plot, zones);
        return performance.now() - start;
      }).sort((a, b) => a - b);
      return { id: preset.id, ms: times[Math.floor(RUNS / 2)] ?? Infinity };
    });
    for (const r of rows) console.info(`  ${r.id}: ${r.ms.toFixed(2)} ms`);
    for (const r of rows) expect(r.ms).toBeLessThan(BUDGET_MS);
  });
});
