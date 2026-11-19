# Data pipeline

Bakes the static files the app fetches from `public/data/`. Python only, run everything with `python -I`
(isolated mode: ignores the current directory and `PYTHONPATH`). Every script is re-runnable and
parametrised by bounding box; raw downloads are cached in a work directory so reruns are fast.

| Output (`public/data/`) | Script | Source |
|---|---|---|
| `zones.geojson` | `01_zones.py` | Bangkok Comprehensive Plan 2556 zoning (third-party GeoJSON) |
| `stations.geojson` | `02_stations.py` | OpenStreetMap via Overpass |
| `buildings.geojson` (git-ignored intermediate) | `03_buildings.py` (+ `heights.py`), then `07_sat_heights.py` | Overture Maps `building` footprints; heights from Google Open Buildings 2.5D Temporal |
| `buildings/index.json`, `buildings/part-NN.geojson` | `08_package_buildings.py` | spatial chunks of the above, each under 900 KB (what the app loads) |
| `roads.geojson` | `04_roads.py` | Overture `segment` + OSM tags (lanes/width) |
| `meta.json` | `05_meta.py` | summaries of the above (needs 07 and 08 to have run) |
| (checks) | `06_validate.py` | parses everything back, including every building part |

`sat_raster.py` (fetch the raster window) and `evaluation.py` (error metrics) are helpers for 07.

## Re-run from scratch

```bash
cd data-pipeline
uv venv .venv && uv pip install -p .venv/bin/python -r requirements.txt   # shapely, pyproj, numpy, overturemaps, rasterio
PY=.venv/bin/python
export PIPELINE_WORK=/some/scratch/dir        # default: data-pipeline/.work  (large intermediates; do not commit)

# zoning source (build-time asset; the BMA servers are not reachable from outside Thailand)
mkdir -p "$PIPELINE_WORK/raw"
gh api "repos/Kanesuan/KNS.MAP/contents/public/data/bkk-zoning-current.geojson?ref=claude/land-map-platform-bangkok-vvz7tj" \
  -H "Accept: application/vnd.github.raw" > "$PIPELINE_WORK/raw/kns_zoning.geojson"

$PY -I 01_zones.py     --src "$PIPELINE_WORK/raw/kns_zoning.geojson"   # also writes $PIPELINE_WORK/study.json (study bbox)
$PY -I 02_stations.py                      # add --refresh to re-download from Overpass
$PY -I 03_buildings.py                     # add --release 2026-11-18.0 to pin; --refresh to re-download
$PY -I 04_roads.py                         # add --no-osm to skip the Overpass tag join (then no lanes)
$PY -I 07_sat_heights.py                   # range-reads ~100 MB of a public GCS tile, no login; --stat / --year / --refresh
$PY -I 08_package_buildings.py             # writes public/data/buildings/index.json + part-NN.geojson
$PY -I 05_meta.py
$PY -I 06_validate.py                      # exit code 1 if any check fails
```

Study area: `config.json -> studyZone` names the zone code (`ย.7`) and a seed point (100.6046 E, 13.6941 N) that picks
the single polygon containing BTS Bang Chak (E10) and Punnawithi (E11). The bbox is that polygon's bounds plus
`marginMetres` (600 m, computed in UTM 47N then converted back). `03`/`04` use it by default; override with
`--bbox minLon,minLat,maxLon,maxLat` to bake any other area (zones and stations always cover all of Bangkok;
`bangkokBounds` in `config.json`). Overpass needs a `User-Agent` (set in `config.json`); the public instance can be slow or
return 502/timeouts, the script retries and tries a second mirror. Overture is pinned to the latest release unless `--release` is given;
the release actually used is recorded in `meta.json`.

## What each step does (and how to read it)

**zones**: drops features whose bounds fall outside `bangkokBounds` (none in the file we used, see caveats), repairs invalid rings
with `make_valid`, drops polygon parts under 500 m2 (UTM area), orients exteriors counter-clockwise (RFC 7946), rounds to 6 decimals, re-validates
after rounding. Simplification (2 m) is only applied if the file would exceed 1.5 MB (it did not). `id` = index of the feature in the source file.

**stations**: nodes/ways/relations tagged `railway=station|halt` (and `public_transport=station` with a rail mode) are classified as mass transit by `ref`
prefix (BL, PP, PK, YL = MRT; A = Airport Rail Link; RN/RS/RW = SRT Red; G = BTS Gold; N/E/CEN/S/W = BTS) or SRT Red `network`.
One manual override (OSM node 8986366369, Krung Thep Aphiwat, Thai-only ref). Excluded as not operational when any of:
`railway=construction|proposed`, any `construction*`, `proposed*`, `planned`, `disused*`, `abandoned*`, `razed:railway` tag, or an
`opening_date`/`start_date` after today. Excluded as not mass transit: SRT intercity stations/halts (Thai-only refs), the Muang Thong Thani monorail (MT),
airport people mover. Platforms: `railway=platform` and rail-mode `public_transport=platform` ways/relations are assigned to the nearest included station
node within 150 m (distance to the platform geometry); the platform union (MultiPolygon, else MultiLineString) becomes the station geometry, otherwise the node
(Point). Duplicates (same line, same name, same ref within 150 m, or any two within 15 m) merge; same name on different lines stays separate.
Extra properties: `platformCount`, `platformOsmIds`, `nodeLon/nodeLat`, `osmId`, `classifiedVia`.

**buildings** (`03`): Overture `building` features in the bbox; drops underground and footprints under 12 m2; `hSrc="height"` uses Overture `height`
(ignored if outside 2 to 330 m), `"levels"` uses `num_floors * 3.2 m`, otherwise a heuristic from `heights.py` (kept as `"est"` only where `07` finds no satellite value):
a levels table by footprint-area bin and class group (priors, e.g. under 40 m2 = 1, 40-150 m2 = 2-3, 150-1000 m2 = 3-5, huge footprints = low mall/factory 2-3,
`terrace` = 4, `apartments` growing with footprint), each cell shrunk toward the median of the buildings that do have a height
(`(n*median + 8*prior)/(n+8)`). Error stats are written to `meta.json`. `cls` = Overture `class`, else `subtype`.
Footprints are simplified at 0.6 m (barely changes size: the vertex count is already low). `03` also writes `$PIPELINE_WORK/buildings_base.geojson`
(adds footprint area) which `07` reads, so `07` is re-runnable without losing the heuristic value.

**building heights** (`07`, details and evaluation in the next section): final priority `height` > `levels` > `sat` > `est`. `h` is floored at 3 m and rounded to 0.1 m.
Output properties are `h` and `hSrc` only (`cls` is dropped: nothing reads it).

**packaging** (`08`): buildings go to a regular 3 x 3 grid over the study bbox by representative point (exactly one part each); any cell whose file would exceed 880 KB is bisected
along its longer side. Coordinates are 6 dp, no whitespace, properties `h`/`hSrc` only. `index.json` = `parts[{file,bbox,count,bytes}]`, `total`, `hSrcPercent`, `source`, `generatedAt`; the part `bbox`
is the tight extent of its geometries (a few buildings overhang the study bbox), so it can be used to cull against the viewport. Result: 11 parts, 277 KB to 868 KB, 6.59 MB in total.

**roads**: Overture `segment` (road subtype, classes motorway..service, minus sidewalk/driveway/parking aisle) joined by OSM way id (the `record_id` in the
Overture `sources`) to OSM tags `lanes`, `width`, `oneway`, `name:*` fetched from Overpass. **`widthEst` is an estimate of right-of-way, to pre-fill a default the user confirms.**

| Rule | Value |
|---|---|
| no tags: ROW by class (m) | motorway 30, trunk 30, primary 24, secondary 16, tertiary 10, unclassified 8, residential (soi) 6, living_street 5, service 4 |
| `lanes` tagged: `lanes * 3.25 + margin` (m) | margin: motorway 8, trunk 10, primary 10, secondary 8, tertiary 6, unclassified 4, residential 3, living_street 2, service 2 (minimum 4 m) |
| one-way way of motorway/trunk/primary/secondary with lanes | assumed one half of a divided road: lane count doubled (3 lanes one-way -> 29.5 m) |
| `width` tag (OSM: usually carriageway) | `width + 2 * side allowance` (motorway 4, trunk 3, primary 3, secondary 2.5, tertiary 2, unclassified 1, residential 1, living_street 0.5, service 0); `widthSrc="tag"` |

`widthSrc` is `"tag"` only when an explicit width exists (very rare: 3 of 3,449 segments); lane-derived and class-default values are `"est"`.

## Building heights: sources tried, method, evaluation

Brief: replace guessed heights (under 1% of buildings had a height or level count) with measured ones from an open, no-login dataset. All candidates were tested by fetching data for the study bbox (2026-11-19).

| Candidate | Licence | Resolution | Reachable without login | What I got |
|---|---|---|---|---|
| **Google Open Buildings 2.5D Temporal v1** (`gs://open-buildings-temporal-data/v1`, https://sites.research.google/gr/open-buildings/temporal/) | CC BY 4.0 or ODbL 1.0 (user's choice); leverages Copernicus Sentinel-2 | 0.5 m pixels, 4 m effective; `building_height` 0 to 100 m; 2016 to 2023 | **Yes.** Plain HTTPS on `storage.googleapis.com` (bucket listing and objects are anonymous). Tile manifests at `v1/manifests/<s2>_EPSG_32647_<year>_06_30.json` | **Used.** 2023 tile `30e2c_2023_06_30/tile_2PjBfguk1SU.tif` (UTM 47N, 25000 x 25000 px, 760 MB, COG-like with overviews). It contains the whole bbox; only the window (8200 x 8600 px) was range-read. The other overlapping tile (1.6 GB) was not needed |
| 3D-GloBFP (Zenodo 15459025, figshare part IX; building-level `Height` shapefile) | CC BY 4.0 | per footprint | Yes (figshare direct download) | Downloaded grid 2089 (143 MB zip, 1.8 M footprints). 15,972 polygons in the bbox, 74% of our footprints matched. **Rejected on evaluation**: median height 20 m everywhere (5th percentile 8.8 m), bias +32 m on the 192 known buildings, median abs error 31 m, 5% within a storey. Useless for a low-rise neighbourhood |
| GHSL GHS-BUILT-H R2023A (`ANBH`, 100 m, epoch 2018, tile R8_C28) | CC BY 4.0 (JRC) | 100 m grid, average net building height | Yes (7 MB tile) | Works but coarse: whole bbox is 45 x 26 cells, values 0 to 35 m. On the known set: median abs error 4.0 m, mean 15.7 m, bias -13 m, 0% within a storey above 23 m (cannot see towers). Rejected: 100 m cells smear a 4 m building |
| Microsoft ML Building Footprints (Thailand height attribute), WSF 3D, Bangkok LiDAR/DSM | | | not fetched | Not tested within the time box. Overture already carries the Microsoft footprints in this bbox (3,802) with no height; I did not verify whether the Thailand release carries heights |

**Method (`07`)**: for each footprint, rasterise it onto the 0.5 m height window (UTM 47N), take the non-zero pixels inside, and use their 75th percentile. 27,684 of the 27,772 footprints without a mapped height got a value from the pixels inside; 1,088 had only zero pixels (the model sees no building there) and keep the heuristic `est`. Footprints with no pixel centre inside fall back to all-touched pixels, then the centroid pixel (never used on the 192 known buildings).
Statistic chosen by evaluating eight candidates (p50/p75/p90/max, non-zero pixels or all pixels) on the known buildings: p75 of non-zero pixels has the lowest mean absolute error (8.06 m) and the least bias (-0.9 m), and also wins in both halves of an even/odd split (8.25 and 7.87 m vs 8.78 and 8.05 m for p90). p50 underestimates (bias -5 m), p90 and max overestimate (+1.3, +3.9 m). The statistic was selected on the same 192 points it is scored on, so the headline is slightly optimistic.
Saturation: the raster is capped at 100 m (max seen 99 m). One footprint contains a pixel at 99 m; no building ends up at 99 m or more with p75. The explicit heights above 100 m (up to 150 m) come from Overture, not the satellite.

**Final `hSrc` mix** (28,964 buildings): `sat` 95.58%, `est` 3.76%, `levels` 0.64%, `height` 0.02%. Satellite height percentiles (m): p5 3.0, p25 4.0, median 5.5, p75 7.5, p95 13.0, p99 22.5.

**Evaluation** on the 192 buildings with a mapped height (7) or level count x 3.2 m (185); 191 have a satellite value, all numbers below are on those 191. Error = prediction minus truth, bias is the mean (positive = too tall), "1 storey" = within 3.2 m. The heuristic row is 5-fold out-of-fold (honest) with in-sample in brackets; the constant is the median of the 192 (16.0 m).

| | median abs err (m) | mean abs err (m) | bias (m) | within 1 storey |
|---|---|---|---|---|
| **satellite (p75)** | 3.5 | **8.06** | -0.9 | 47.6% |
| heuristic | **3.2** (3.2) | 14.26 (13.09) | -7.7 (-7.1) | **54.5%** (57.6%) |
| constant median | 3.2 | 15.94 | -11.82 | 52.4% |

By truth band (n, median abs / mean abs / bias, share within a storey):

| band | n | satellite | heuristic (out-of-fold) | constant 16 m |
|---|---|---|---|---|
| under 10 m | 19 | 4.3 / 4.5 / +4.3, 37% | 6.4 / 9.1 / +9.1, 26% | 9.6 / 9.6 / +9.6, 0% |
| 10 to 23 m | 114 | 3.0 / 4.9 / +2.5, 57% | **0.0 / 3.5 / +1.0, 79%** | 3.2 / 2.9 / +0.8, 88% |
| 23 to 60 m | 31 | **3.6 / 6.9 / +2.4, 45%** | 12.8 / 15.0 / -2.0, 29% | 9.6 / 13.7 / -13.7, 0% |
| over 60 m | 27 | **21.1 / 25.0 / -22.6, 19%** | 54.4 / 62.8 / -62.8, 0% | 73.6 / 78.2 / -78.2, 0% |

Reading it honestly: the satellite height is not better on the headline "typical" error. On this ground truth, the median error and the within-a-storey share are no better than the heuristic or a constant 16 m, because 114 of 192 truths are
10 to 23 m and 67 are shophouse terraces mapped at 4 levels, which the heuristic was calibrated on and the constant sits on. Where the satellite data clearly wins is the mean error (8.1 vs 14.3 m) and everything outside that band: it separates low-rise (under 10 m: +4 m over)
from mid-rise (23 to 60 m: 3.6 m median error vs 12.8) and sees towers that the heuristic and a constant cannot (over 60 m: 21 m median error vs 54 and 74), although the band's -22.6 m bias is mostly two things: the 100 m cap (towers mapped at 99 to 131 m read 88 to 98 m) and one bad truth, a 150 m tag on a 5-level building where the raster says 14 m (that single point adds about 5 m to the band's mean error).
Median satellite value for the 27 mapped towers is 75.5 m against a median truth of 89.6 m. Its value over the heuristic is therefore that it carries per-building information; its median-level accuracy on ordinary mid-rise is about one storey worse than a lucky constant.

Limits: n = 192 (191 usable) and 114 of them in one band, so band results other than 10 to 23 m rest on 19 to 31 points; ground truth is biased toward notable OSM-mapped buildings (condos, shophouse rows) and says nothing about the unmapped 99%, which is mostly low-rise;
level count x 3.2 m is itself an approximation (real floor-to-floor heights are roughly 2.8 to 4 m; also 7 explicit heights are inconsistent with their level counts, e.g. 150 m vs 5 levels); the raster is mid-2023 (imagery 2023-01 to 2023-12) while the footprints and tags are the Overture 2026-11-18 release, so buildings built or demolished since are mismatched;
the statistic was chosen on the same points it is scored on; the heuristic is calibrated on these same points, which flatters it; the raster has a 4 m effective resolution, so very small footprints inherit their neighbours' pixels. All numbers are in `public/data/meta.json -> buildings.heightEvaluation`.
Spot-check near the two BTS stations (E10 Bang Chak, E11 Punnawithi): no footprint intersects either station geometry, and the 74 to 85 m values around Punnawithi are plausible towers; I did not check against imagery, so individual wrong buildings are possible (an elevated viaduct about 12 to 16 m high can leak into the 4 m pixels of narrow buildings beside it).

## Sources, licences, attribution

* OpenStreetMap (stations, tags, much of the Overture data): ODbL 1.0, "(c) OpenStreetMap contributors". Share-alike applies to the derived database.
* Overture Maps buildings and transportation: per-source licences (OSM ODbL-1.0; Google Open Buildings, Microsoft ML Buildings, TomTom are listed per
  source in `meta.json -> sources.*.licencesBySourceDataset`). Cite "(c) Overture Maps Foundation".
* Building heights (`sat`): Google Open Buildings 2.5D Temporal, Google Research, CC BY 4.0 or ODbL 1.0 at the user's choice, leverages Copernicus Sentinel-2 data (Sentinel data legal notice applies).
  Attribute "Google Open Buildings 2.5D Temporal (Google Research, CC BY 4.0), Sirko et al. 2023, High-Resolution Building and Road Detection from Sentinel-2, arXiv:2310.11622". Liability disclaimer in the dataset footnotes applies. Recorded in `meta.json -> sources.buildings.heights` and `attribution`.
* Zoning: Bangkok Metropolitan Administration, City Planning Department, Comprehensive Plan B.E. 2556. We use a third-party derived GeoJSON
  (`Kanesuan/KNS.MAP`); neither it nor the BMA states a licence. Treat as indicative and non-commercial until verified.

## Known data-quality caveats

* **Heights**: under 1% of buildings carry an explicit height or level count; 95.6% now carry a satellite-derived height (`sat`, see the section above), 3.8% still use the guessed heuristic (`est`). `sat` is a 4 m effective-resolution model of mid-2023: roughly one storey of
  typical error, and it under-reads towers by about 20 m (capped at 100 m by the dataset). The 192-building ground truth is small and biased (see the evaluation). A few explicit heights are inconsistent with their level counts (e.g. 150 m with 5 levels).
  `building_part` features (tall towers with podiums) are not merged.
* **Zoning**: 498 coarse polygons, third-party derived, excludes white/military areas, unverified boundaries (the earlier research found Ari and Thong Lo as ย.10, which looks wrong). The
  file we received had none of the "junk" features near lon 99.79 / 89.25 and no polygons outside Bangkok, so that filter removed nothing.
  29 invalid polygons (self-intersections) were repaired by `make_valid`, which creates tiny slivers that are then removed (127 sub-parts under 500 m2).
* **Stations**: only about 40% of included stations have platform polygons/lines in OSM; underground stations are mostly Points. Some `railway=station` nodes are tagged
  `station=subway` for elevated BTS stations. Platform assignment is nearest-node, so a platform shared by two close stations may attach to only one.
* **Roads**: Overture segments split OSM ways; lanes/width tags are sparse (about 7% lanes, 0.1% width). `widthEst` is a heuristic, not measured right-of-way.
* **Size**: all buildings are about 6.6 MB uncompressed (about 0.8 MB gzip). GeoJSON per-feature overhead dominates, so they are split into 11 spatial parts under 900 KB each (`buildings/`);
  the single `buildings.geojson` is a git-ignored intermediate and must not be committed (over 1 MB). The app type `hSrc` needs the new value `'sat'`.

## Optional: all-Bangkok buildings as PMTiles (not built)

Not run here. `tippecanoe` (2.79.0) and `pmtiles` (1.31.2) are both Homebrew bottles (`brew install tippecanoe pmtiles`); Go and Cargo are also present. Plan:
`overturemaps download --bbox=100.30,13.45,100.95,14.10 -f geojsonseq --type=building`, run the same height estimator (heights are baked into tile properties),
then `tippecanoe -o buildings.pmtiles -Z12 -z15 --drop-densest-as-needed --no-tile-size-limit`, upload to R2 and read it with the `pmtiles` JS protocol in MapLibre. Expect
roughly 2 to 3 million footprints (this 15 km2 box has 29k; central Bangkok is far denser than the fringe), about 0.8 to 1.5 GB of raw GeoJSON, and about 150 to 350 MB of PMTiles at
z15. A less processed shortcut is `pmtiles extract` from Overture's public planet archive
(`https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/2026-11-18.0/buildings.pmtiles`, 181 GB) with `--bbox`, but those tiles carry no estimated heights.
