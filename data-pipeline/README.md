# Data pipeline

Bakes the static files the app fetches from `public/data/`. Python only, run everything with `python -I`
(isolated mode: ignores the current directory and `PYTHONPATH`). Every script is re-runnable and
parametrised by bounding box; raw downloads are cached in a work directory so reruns are fast.

| Output (`public/data/`) | Script | Source |
|---|---|---|
| `zones.geojson` | `01_zones.py` | Bangkok Comprehensive Plan 2556 zoning (third-party GeoJSON) |
| `stations.geojson` | `02_stations.py` | OpenStreetMap via Overpass |
| `buildings.geojson` | `03_buildings.py` (+ `heights.py`) | Overture Maps `building` |
| `roads.geojson` | `04_roads.py` | Overture `segment` + OSM tags (lanes/width) |
| `meta.json` | `05_meta.py` | summaries of the above |
| (checks) | `06_validate.py` | parses everything back |

## Re-run from scratch

```bash
cd data-pipeline
uv venv .venv && uv pip install -p .venv/bin/python -r requirements.txt   # shapely, pyproj, numpy, overturemaps
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

**buildings**: Overture `building` features in the bbox; drops underground and footprints under 12 m2; `hSrc="height"` uses Overture `height`
(ignored if outside 2 to 330 m), `"levels"` uses `num_floors * 3.2 m`, otherwise `"est"` from `heights.py`:
a levels table by footprint-area bin and class group (priors, e.g. under 40 m2 = 1, 40-150 m2 = 2-3, 150-1000 m2 = 3-5, huge footprints = low mall/factory 2-3,
`terrace` = 4, `apartments` growing with footprint), each cell shrunk toward the median of the buildings that do have a height
(`(n*median + 8*prior)/(n+8)`). Error stats are written to `meta.json`. `cls` = Overture `class`, else `subtype`.
Footprints are simplified at 0.6 m (barely changes size: the vertex count is already low).

**roads**: Overture `segment` (road subtype, classes motorway..service, minus sidewalk/driveway/parking aisle) joined by OSM way id (the `record_id` in the
Overture `sources`) to OSM tags `lanes`, `width`, `oneway`, `name:*` fetched from Overpass. **`widthEst` is an estimate of right-of-way, to pre-fill a default the user confirms.**

| Rule | Value |
|---|---|
| no tags: ROW by class (m) | motorway 30, trunk 30, primary 24, secondary 16, tertiary 10, unclassified 8, residential (soi) 6, living_street 5, service 4 |
| `lanes` tagged: `lanes * 3.25 + margin` (m) | margin: motorway 8, trunk 10, primary 10, secondary 8, tertiary 6, unclassified 4, residential 3, living_street 2, service 2 (minimum 4 m) |
| one-way way of motorway/trunk/primary/secondary with lanes | assumed one half of a divided road: lane count doubled (3 lanes one-way -> 29.5 m) |
| `width` tag (OSM: usually carriageway) | `width + 2 * side allowance` (motorway 4, trunk 3, primary 3, secondary 2.5, tertiary 2, unclassified 1, residential 1, living_street 0.5, service 0); `widthSrc="tag"` |

`widthSrc` is `"tag"` only when an explicit width exists (very rare: 3 of 3,449 segments); lane-derived and class-default values are `"est"`.

## Sources, licences, attribution

* OpenStreetMap (stations, tags, much of the Overture data): ODbL 1.0, "(c) OpenStreetMap contributors". Share-alike applies to the derived database.
* Overture Maps buildings and transportation: per-source licences (OSM ODbL-1.0; Google Open Buildings, Microsoft ML Buildings, TomTom are listed per
  source in `meta.json -> sources.*.licencesBySourceDataset`). Cite "(c) Overture Maps Foundation".
* Zoning: Bangkok Metropolitan Administration, City Planning Department, Comprehensive Plan B.E. 2556. We use a third-party derived GeoJSON
  (`Kanesuan/KNS.MAP`); neither it nor the BMA states a licence. Treat as indicative and non-commercial until verified.

## Known data-quality caveats

* **Heights**: under 1% of buildings in the study box carry an explicit height or level count (Google/Microsoft footprints have none). Nearly all heights are estimates. The
  calibration set (192 buildings) is biased toward notable OSM-mapped buildings (condos, shophouse rows), so error figures on it flatter or penalise the heuristic in ways
  that do not transfer to the unmapped majority. A few explicit heights are inconsistent with their level counts (e.g. 150 m with 5 levels).
  `building_part` features (tall towers with podiums) are not merged.
* **Zoning**: 498 coarse polygons, third-party derived, excludes white/military areas, unverified boundaries (the earlier research found Ari and Thong Lo as ย.10, which looks wrong). The
  file we received had none of the "junk" features near lon 99.79 / 89.25 and no polygons outside Bangkok, so that filter removed nothing.
  29 invalid polygons (self-intersections) were repaired by `make_valid`, which creates tiny slivers that are then removed (127 sub-parts under 500 m2).
* **Stations**: only about 40% of included stations have platform polygons/lines in OSM; underground stations are mostly Points. Some `railway=station` nodes are tagged
  `station=subway` for elevated BTS stations. Platform assignment is nearest-node, so a platform shared by two close stations may attach to only one.
* **Roads**: Overture segments split OSM ways; lanes/width tags are sparse (about 7% lanes, 0.1% width). `widthEst` is a heuristic, not measured right-of-way.
* **Size**: `buildings.geojson` is about 6.6 MB uncompressed (about 0.8 MB gzip; Cloudflare compresses automatically). GeoJSON per-feature overhead dominates, so the
  4 MB target was not met without discarding data.

## Optional: all-Bangkok buildings as PMTiles (not built)

Not run here. `tippecanoe` (2.79.0) and `pmtiles` (1.31.2) are both Homebrew bottles (`brew install tippecanoe pmtiles`); Go and Cargo are also present. Plan:
`overturemaps download --bbox=100.30,13.45,100.95,14.10 -f geojsonseq --type=building`, run the same height estimator (heights are baked into tile properties),
then `tippecanoe -o buildings.pmtiles -Z12 -z15 --drop-densest-as-needed --no-tile-size-limit`, upload to R2 and read it with the `pmtiles` JS protocol in MapLibre. Expect
roughly 2 to 3 million footprints (this 15 km2 box has 29k; central Bangkok is far denser than the fringe), about 0.8 to 1.5 GB of raw GeoJSON, and about 150 to 350 MB of PMTiles at
z15. A less processed shortcut is `pmtiles extract` from Overture's public planet archive
(`https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/2026-11-18.0/buildings.pmtiles`, 181 GB) with `--bbox`, but those tiles carry no estimated heights.
