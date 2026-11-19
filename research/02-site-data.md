# 02 - Site data sources for the Bangkok plot-envelope tool

Date of testing: 2026-11-19. All tests run from a laptop outside Thailand. Samples are in
`/private/tmp/claude-501/-Users-arpitk-Downloads-Coding-experiments/2c36aa51-5fa3-4f8c-99a9-2ee4a9e118ed/scratchpad/site-data/`
(osm/, ov/, zoning/, transit/). Nothing is in the project directory.

Legend: **[TESTED]** = I made a real request and inspected the response. **[READ]** = from docs/search/other people's repos only.

---------------------------------------------------------------------------------------------

## 0. Headline findings

| Need | Recommendation | Confidence |
|---|---|---|
| Surrounding buildings | **Overture buildings (bbox-extracted, pre-baked)**; fallback raw OSM. Heights are sparse everywhere (~15%), so the app MUST have a height-estimation fallback. | High (tested) |
| Roads + width | **OSM/Overture centrelines for the picture; width NOT available (<1% of roads). User enters road width** (optionally pre-filled by a heuristic). | High (tested) |
| Zoning | **No official live endpoint reachable from outside Thailand.** A third-party GitHub project reports a BMA ArcGIS service. A 1.4 MB GeoJSON derived from it is downloadable and usable as a build-time asset, but licence/accuracy are unverified. Plan for a manual "pick the zone" fallback. | Medium-low |
| Parcels | User draws the plot. LandsMaps is unreachable/undocumented/not an open API. | High |
| Transit stations | **OSM via Overpass, pre-baked** (217 nodes, refs like BL22/E4). | High (tested) |
| Basemap | **OpenFreeMap** (zero key, CORS, tested) for dev + MVP; **Protomaps PMTiles on R2** as the self-hosted upgrade. Esri World Imagery tile endpoint works with CORS but has terms limits. | High (OFM tested) |

---------------------------------------------------------------------------------------------

## 1. Surrounding buildings

### 1a. OpenStreetMap buildings via Overpass [TESTED]

Gotcha: `overpass-api.de` returns **HTTP 406 without a User-Agent**. Add `-A "yourapp/0.1 (contact)"`.

```
UA="site-data-research/0.1 (research test)"
# Sukhumvit/Asok/Thong Lo bbox (S,W,N,E) 13.72,100.55,13.745,100.585  (~3.8 x 2.8 km)
q='[out:json][timeout:90];(way[building](13.72,100.55,13.745,100.585);relation[building](13.72,100.55,13.745,100.585););out tags center;'
curl -s -A "$UA" --data-urlencode "data=$q" https://overpass-api.de/api/interpreter -o sukhumvit.json
# -> http=200 size=3.0 MB, 46 s
# Ari bbox 13.772,100.53,13.792,100.552  -> 1.1 MB, 32 s
```

Results (counts of `building` ways+relations; "either" = has `height` or `building:levels`):

| Area | Total | `height` | `building:levels` | either | % either | `building=yes` (untyped) | with `name` |
|---|---|---|---|---|---|---|---|
| Sukhumvit/Asok/Thong Lo | 9,436 | 190 | 1,372 | 1,377 | **14.6%** | 7,518 (80%) | 884 |
| Ari | 4,997 | 2 | 783 | 783 | **15.7%** | 3,459 (69%) | 197 |

So: footprints are dense (OSM has ~9.4k buildings in 10 km2 of central Bangkok), but only ~15% have any height info and the
explicit `height` tag is almost absent (2% / 0.04%). Levels dominate; 3 m x levels is the usual conversion.
Licence: ODbL (attribution + share-alike on the *database*; a derived, published building layer must carry "(c) OpenStreetMap contributors").
Overpass public instance is fine for pre-baking but not for per-user live queries (rate limits, 30-50 s latency).

### 1b. Overture Maps buildings [TESTED]

Latest release found via STAC: `2026-11-18.0` (`https://stac.overturemaps.org/catalog.json`).
Extraction with the official CLI (installed into a scratch venv with `uv pip install duckdb overturemaps`):

```
overturemaps download --bbox=100.55,13.72,100.585,13.745 -f geojson --type=building -o sukhumvit_ov.geojson
# 15,459 features, 9.0 MB GeoJSON, ~27 s
```

Same bbox as the OSM test:

| Metric | OSM (Overpass) | Overture |
|---|---|---|
| Buildings | 9,436 | **15,459** (+64%) |
| Source mix | - | OSM 9,443; Google Open Buildings 4,930; Microsoft ML 1,086 |
| `height` | 190 | 188 (all from OSM) |
| `num_floors` | 1,372 | 1,369 (all from OSM) |
| any height/floors | 14.6% | **8.9%** of all features (1,373 / 15,459) |
| Properties present | tags | `class`, `subtype`, `names`, `has_parts`, `is_underground`, `sources`. No `roof_height` populated. |

Interpretation: Overture is a *footprint-completeness* upgrade (OSM + Google + Microsoft conflated, ~39% of Overture buildings in this bbox
are absent from OSM) but **adds zero height data**; heights are inherited from OSM only. Overture is therefore "OSM heights + more footprints".
Licence: Overture buildings theme is ODbL/CDLA-mixed per source (Google/MS portions are ODbL via Overture); attribution required. Check
`sources[].license` per feature if you redistribute.

PMTiles route [TESTED headers only]:
- `https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/2026-11-18.0/buildings.pmtiles` -> 200, **181 GB** planet file, CORS `*`, `Accept-Ranges: bytes`.
  Range requests work, so a client could read it directly, but that is a planet archive on an AWS bucket (no SLA, and tile payloads include heavy attributes). Do not ship that to users.
- Extracting a Bangkok subset with `pmtiles extract ... --bbox=100.50,13.70,100.62,13.82` (go-pmtiles v1.31.2) is the right way to get a few-MB file,
  but **I did NOT run it**: the sandbox blocked downloading/running the unsigned binary. [UNTESTED]. The GeoJSON route above is tested and fine
  (a 3.8 x 2.8 km box = 9 MB raw GeoJSON; a metro-wide set would be ~100 MB raw, ~15-25 MB as gzip/FlatGeobuf/Parquet).
- Other extraction route: DuckDB over the public parquet (`s3://overturemaps-us-west-2/release/2026-11-18.0/theme=buildings/type=building/*`) [READ, not run].

### 1c. Google Photorealistic 3D Tiles [READ + 1 request tested]

- Endpoint `https://tile.googleapis.com/v1/3dtiles/root.json` [TESTED unauthenticated] -> **403 PERMISSION_DENIED**: key required, billing-enabled project.
- Coverage: Google's coverage table (`https://developers.google.com/maps/coverage.md.txt`, fetched) lists **TH Thailand** under "Map Tiles 2D / 3D" as supported at country level.
  I could not verify actual mesh quality over Bangkok without a key. Treat as "likely present for central Bangkok, quality unknown".
- Pricing [READ]: Enterprise SKU, billed per root-tile request (a "session"), first 1,000/month free then about $6 per 1,000, tiered down. Only root requests are billed.
- Terms [READ, `https://developers.google.com/maps/documentation/tile/policies`]: visualization only; no extraction/tracing of geometry; no ML/analysis;
  you may overlay your own 3D objects **only if not derived from the tiles**; Google logo/attribution must stay visible and unobscured;
  must honour Cache-Control; no offline use. So drawing a buildable envelope on top is allowed; **you cannot use it to compute heights/neighbour footprints**.
- Clients [READ]: standard OGC 3D Tiles; works in CesiumJS (`showCreditsOnScreen`), three.js via `3d-tiles-renderer` (NASA-AMMOS), deck.gl `Tile3DLayer`.
- Download cost on a laptop: textured meshes are heavy (tens of MB per view). The API key is public in the browser, so restrict by HTTP referrer and set quota caps.
- Verdict: the most visually impressive ("among the actual buildings") but needs a key, cost controls, and can't feed regulation logic. Good **optional visual mode**, not the primary.

### 1d. Mapbox 3D buildings [READ]
Mapbox Streets v8 `building` layer has `height`, `min_height`, `extrude`; heights are derived from OSM levels at 3 m/level when absent, i.e. same data weakness as OSM.
Needs an access token and Mapbox GL / their ToS; no advantage over Overture. Not recommended.

### 1e. Microsoft / Google open footprints [partly TESTED via Overture]
Both are already inside Overture (above), flagged by `sources[].dataset`. Microsoft GlobalMLBuildingFootprints: footprints, height field mostly -1/absent for Thailand [READ].
Google Open Buildings 2.5D Temporal gives per-pixel building heights (coarse ~4 m raster) for Africa/South Asia/SE Asia in Earth Engine [READ, untested, not browser-friendly];
possible offline source for a height prior but too much work for 48 h.

### 1f. Thai government 3D/footprint data
- BMA 3D map `3d-cpd.bangkok.go.th` [TESTED]: DNS resolves (203.155.220.225), but **TCP connection reset** from my network for http and https.
  Likely geo-restricted to Thai IPs or WAF-blocked. Cannot assess content or licence. DOL cadastral and BMA building footprints are not offered as open bulk downloads that I could find.
- `data.bangkok.go.th` / `opendata.bangkok.go.th` [TESTED]: `data.bangkok.go.th` (CKAN `/api/3/action`) connection reset from my IP; `opendata.bangkok.go.th` is a React SPA that returns its HTML shell for every path (no API reachable). Could not search the catalogue for building/zoning layers.

### Recommendation: buildings
- **Primary: Overture buildings**, pre-extracted for the metro bbox (100.30-100.95E, 13.45-14.10N or just the inner ring) at build time, stored as a compact tiled file (PMTiles/FlatGeobuf or per-grid-cell JSON/gz) on R2/Pages.
- **Fallback: raw OSM via Overpass** (client or Worker, per-plot radius ~500 m) if the pre-baked file is missing an area; same schema mostly.
- **Height policy (required):** known height/levels (9-15% of buildings) -> real; otherwise use a deterministic estimate (class/subtype, footprint area, nearby median, e.g. 2-3 storeys for houses, 5-8 for `apartments/commercial`), and render estimated buildings in a visibly neutral "massing" style. Show a note "heights estimated".
- Optional: Google 3D Tiles as a toggled photo-real backdrop, with attribution.

---------------------------------------------------------------------------------------------

## 2. Roads and road width

### OSM [TESTED]
`way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street)$"]` in the same Sukhumvit bbox (450 KB):

| highway | ways | `width` | `lanes` | `name` |
|---|---|---|---|---|
| service | 1,609 | 0 | 4 | 23 |
| residential (sois) | 779 | **4** | 98 | 280 |
| primary | 146 | 0 | 135 | 146 |
| tertiary | 36 | 0 | 13 | 31 |
| motorway | 20 | 0 | 8 | 20 |
| secondary | 15 | 0 | 13 | 15 |
| total | 2,610 | **4 (0.15%)** | 273 (10%) | |

`width` values seen: 3, 3.5, 3.3, 6 (m, carriageway, not right-of-way). Lanes exist on ~93% of primary roads (Sukhumvit Rd) but on only ~13% of sois, which are exactly the roads whose width matters for the regulations (e.g. < 6 m, 6-10 m, 10-20 m, > 20 m).

### Overture transportation segments [TESTED]
`overturemaps download --bbox=... --type=segment` -> 4,041 segments, 4.4 MB. Sources: OSM 4,814 refs, TomTom 126. `width_rules` on **10 of 4,041**; no lanes field; `road_surface` 715, `speed_limits` 607. Effectively the same as OSM; no width.

### BMA / other
- BMA planned roads layer (see section 3) has **right-of-way width 12-60 m for 136 planned road projects only** [READ via third-party repo], not existing roads.
- Nothing found in BMA open data that I could reach.

### Conclusion
Road width is **not reliably available**. Offer: (1) user types road width (m), with preset buttons (<6, 6-10, 10-20, >20); (2) auto-suggest from heuristics: OSM `width` if present, else
estimate from lanes (3.0-3.5 m/lane + margin) or class (service ~4, residential soi ~6, secondary ~12, primary ~20+), and optionally measure the open gap between building footprints on both sides of the road centreline in the pre-baked data (best signal for right-of-way). Label estimates as such.

---------------------------------------------------------------------------------------------

## 3. Bangkok zoning (Comprehensive Plan B.E. 2556, codes ย.1-ย.10, พ.1-พ.5, ก., ศ., อ.)

### What I could not reach [TESTED]
| Host | Result |
|---|---|
| `cpd.bangkok.go.th` (203.155.220.122) | TLS/TCP **connection reset** (curl exit 000, "Recv failure: Connection reset by peer") |
| `data.bangkok.go.th` | connection reset |
| `map.bangkok.go.th` | does not resolve |
| `cpudapp.bangkok.go.th` | 403 (Cloudflare) |
| `bmagis.bangkok.go.th` | connection reset |
| `3d-cpd.bangkok.go.th` | connection reset |
| `data.go.th` | 403 (bot challenge); `data.go.th/api/3/action/package_search` returned 400 |
| `opendata.bangkok.go.th` | 200 but SPA shell only, JS bundle references `https://data.bangkok.go.th/api/3/action` (the unreachable CKAN) |

Probable cause: Thai-IP allowlisting or WAF; not verified. **Retest from a Thai network or a Thai VPS/Cloudflare Worker with a Thai egress is worth 10 minutes.**

### What I found (third-party, via GitHub search) [READ + sample file TESTED]
Repo `Kanesuan/KNS.MAP` (PR #6, branch `claude/land-map-platform-bangkok-vvz7tj`) documents the BMA's public **legacy ArcGIS 10.0 server**:
`http://3d-cpd.bangkok.go.th/ArcGIS/rest/services/DOL/LupDolWms/MapServer`
- layer 1 = "ผังเมืองรวม 2556" (zoning), layer 0 = "ผังโครงการคมนาคมและขนส่ง" (planned roads).
- ArcGIS 10.0: no `f=geojson`, no offset paging -> page by object id (`returnIdsOnly`), `outSR` reprojected from EPSG:32647 (UTM 47N) to 4326. Their script: `scripts/ingest/arcgis-legacy.mjs`.
- That service **excludes "ขาว" and "ทหาร" areas** (white/military) per their notes, so holes are possible.
- The PR notes "no licence stated by the BMA"; they reason the plan is a ministerial regulation excluded from copyright (Copyright Act B.E. 2537 s.7) but marked it **non-commercial only**. That is their legal opinion, not mine or BMA's.
- I could not hit the service myself (connection reset), so live fields/CRS are only as reported by that repo.

Downloaded and inspected their derived sample:
```
gh api "repos/Kanesuan/KNS.MAP/contents/public/data/bkk-zoning-current.geojson?ref=claude/land-map-platform-bangkok-vvz7tj" \
  -H "Accept: application/vnd.github.raw" > kns_zoning.geojson      # 1.4 MB
```
- 498 Polygon features, EPSG:4326, extent lon 100.328-100.939, lat 13.491-13.955 (covers Bangkok).
- Properties: only `zone` (e.g. `ย.3`, `พ.5`) and `category` (residential_low/medium/high, commercial, industrial, agriculture, conservation, warehouse). **No FAR, OSR, or height fields** - those come from the regulation tables, which you must encode yourself.
- Zones present: ย.1-ย.10, พ.1-พ.5, ก.1-ก.5, อ.1-อ.3, ศ.1-ศ.2. Counts: ย.3 70, ย.6 48, พ.3 43, ย.4 40, ก.4 38, ...
- Point-in-polygon spot checks (my own ray-casting): Asok -> พ.5, Siam -> พ.5, Silom -> พ.5, Bang Na -> ย.7, Thong Lo -> ย.10, Ari -> ย.10.
  Asok/Siam/Silom as พ.5 is plausible; **Ari = ย.10 and Thong Lo = ย.10 look suspect to me and need checking against the official map** (I did not verify). 498 polygons for all of Bangkok also suggests dissolve/simplification, so boundaries may be coarse. Do not trust for plot-edge cases.
- Other repos checked: `Jung2812/Thaigeolab` (MIT) only has district-level zoning embedded in SVG, not a usable parcel-level layer. No other zoning GeoJSON found on GitHub.

### Status of the plan [READ, search results]
The 2013 (B.E. 2556) plan is still in force; 4th revision in progress (public hearing 2023-24, final notice reported for mid-2026, effect expected around 2027).
The user's codes ย./พ. match the 2556 plan, but note rules may change.

### Recommendation: zoning
1. Pre-bake the KNS-derived layer (or, better, re-run its ingest from a Thai-reachable host) into the build: ~1.4 MB, no runtime dependency.
2. Always show the detected zone with a **"verify and override" dropdown** (all ~25 codes). Treat auto-detection as a suggestion.
3. Do not call the BMA ArcGIS endpoint from the browser (old HTTP server, no CORS known, geo-blocked, mixed content from an HTTPS site).
4. Licence: unresolved; attribute "Bangkok Metropolitan Administration, City Planning Dept." and flag in the UI that this is indicative, not legal advice.

---------------------------------------------------------------------------------------------

## 4. Land parcels (DOL LandsMaps)

[TESTED] `https://landsmaps.dol.go.th`, `/robots.txt`, `/api/` all **time out after 20 s** from my network (likely geo-restricted or blocking non-Thai/automated traffic).
[READ/known] LandsMaps is a public viewer; I found no documented open parcel API, no bulk download, and no licence permitting redistribution/scraping. Parcel shapes are legally sensitive.
Conclusion confirmed: **the user draws the plot** (optionally snapping to building footprints/road edges). Show an area readout in sq.wah / rai to match Thai practice. Do not scrape LandsMaps.

---------------------------------------------------------------------------------------------

## 5. Mass transit stations

### OSM via Overpass [TESTED]
```
[out:json][timeout:120];(
 node["railway"="station"]["station"~"subway|light_rail|monorail"](13.45,100.30,14.10,100.95);
 node["railway"="station"]["network"~"BTS|MRT|SRT|Airport"](13.45,100.30,14.10,100.95);
 node["railway"="station"]["train"="yes"](13.45,100.30,14.10,100.95););out tags center;
```
-> 217 nodes, 147 KB. `name:en` on 216, `name:th` on 213, `ref` on 213.
Ref prefixes: BL 38 (MRT Blue), PK 30 (Pink), N 23 / E 23 / S 12 (BTS Sukhumvit/Silom lines; E=Sukhumvit, S=Silom, N=north), YL 23 (Yellow), PP 15 (Purple), A 8 (ARL), RN 7 (SRT Red), G 3 (Gold), MT, CEN, W.
Spot check: Asok E4 (13.7370, 100.5604), Phrom Phong E5, Thong Lo E6 (13.7242, 100.5785), Ari N5 (13.7797, 100.5446), Sukhumvit (MRT) BL22.
Quality caveats: the `network` tag is inconsistent (102 nodes have none; Thai-language operator strings) and interchange stations appear as multiple nodes (BTS/MRT) => dedupe by proximity; Pink/Yellow/Gold/Red lines are in OSM and appear complete from refs, but "open vs under construction" should be checked per line (`railway=construction` not queried).
Rules typically need walking/street distance to the *entrance*, which OSM stores sometimes as `railway=subway_entrance`; the station node is a fine MVP proxy; use straight-line distance and say so.

### Alternatives
- GTFS: `api.mobilitydatabase.org` returned 302 [TESTED]; no confirmed official BTS/MRT GTFS feed found. [READ] BMA/OTP publish none that I could verify. Not needed.
- BMA open data: unreachable (section 3).
Recommendation: **pre-bake OSM stations** to a tiny GeoJSON (~50 KB gz), dedupe, tag line colour from `ref` prefix, refresh monthly.

---------------------------------------------------------------------------------------------

## 6. Basemap, labels, terrain, imagery

| Option | Key? | Tested? | Result / notes |
|---|---|---|---|
| **OpenFreeMap** `https://tiles.openfreemap.org/styles/liberty` | none | YES | Style JSON 200 (43 KB, 111 layers). TileJSON `https://tiles.openfreemap.org/planet` -> template `https://tiles.openfreemap.org/planet/20261115_080022_pt/{z}/{x}/{y}.pbf`, maxzoom 14, CORS `*`, `cache-control max-age 10 years` on versioned URLs (the date in the path changes with each build - **fetch TileJSON at runtime, don't hardcode**). Schema = OpenMapTiles. Free, no registration, attribution OpenFreeMap + OpenMapTiles + OSM. Labels: style uses `name:latin`/`name:nonlatin` / `name_en` so Thai + Latin shown together; `name:th` and `name_en` present in the tile I fetched. Heavy use is on donated infrastructure: self-host for production. |
| OpenFreeMap building layer | - | YES | z14 tile over Asok (12768/7560): **only 125 building features** (vs thousands in OSM for the same area) with `render_height` mostly >0. OpenMapTiles thins/filters buildings: **not usable as the surrounding-building source.** (Tile: 475 KB.) |
| **Protomaps** daily planet build `https://build.protomaps.com/20261118.pmtiles` | none | headers | 200, **139.6 GB** planet. Self-host a Bangkok extract (`pmtiles extract --bbox`, likely 30-80 MB for zoom <= 15) on R2 with HTTP range requests; maplibre + `pmtiles` JS protocol; Protomaps basemap styles include Thai/Latin label support (name:th). Extract not run (binary download blocked). ODbL. Cheapest and fastest long-term fit for Cloudflare. [extract UNTESTED] |
| MapTiler | key | tile JSON 403 w/o key | Free plan: 100k requests/mo, 5k sessions; described as non-commercial/prototype only [READ, pricing page]. Okay for a demo, not for production. |
| Stadia Maps | key (free for localhost) | style JSON `osm_bright` returned 200 | Free for non-commercial; production domains need an account/key [READ]. |
| CARTO Positron/Dark | none | style 200 | Free basemap CDN, but terms limit commercial use/volume [READ]. Labels Latin-first; Thai labels poor. |
| **Esri World Imagery** `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | none for tiles | YES | z18 tile over Asok returned 200, JPEG 19 KB, `Access-Control-Allow-Origin: *`. [READ] Esri terms: free use needs attribution and is for non-commercial/low-volume; production use technically requires an ArcGIS licence/key. Fine for prototype; flag as risk. |
| Terrain: AWS Terrarium `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | none | YES | 200, 38 KB PNG. **Skip terrain**: Bangkok is flat (about 0-3 m); a flat ground plane is accurate and saves load time. |

Thai/English labels: use OpenMapTiles-style `["coalesce", ["get","name:th"], ["get","name"]]` / `name_en` text-field expressions in the style; test glyph coverage: you need a Thai-capable glyph PBF font stack (OpenFreeMap ships Noto Sans stacks; for self-hosting use Protomaps' fonts, which include Noto Sans Thai).

---------------------------------------------------------------------------------------------

## 7. Recommended pipeline

### Build-time (pre-bake, commit to repo / R2)
1. **Buildings**: `overturemaps download --type=building --bbox=<Bangkok core>` -> keep `{geom, height, num_floors, class, subtype, source}`, quantise coordinates, convert to tiles (PMTiles via tippecanoe, or a 500 m grid of gzipped JSON/FlatGeobuf). Target < 25 MB. Precompute `heightKnown` flag. Add the height estimator output as `h_est`.
2. **Roads**: Overture or OSM segments for the same bbox with class, name, `lanes`, `width` if any, plus pre-computed "estimated right-of-way" from footprint gaps.
3. **Zoning**: bake the 498-polygon GeoJSON (1.4 MB) -> simplify -> optional PMTiles. Re-source from BMA ArcGIS from a Thai host if possible.
4. **Transit**: OSM stations -> ~50 KB GeoJSON with line/ref/colour.
5. **Basemap**: Protomaps extract for Bangkok on R2 (or just OpenFreeMap at first).
6. **Regulation tables** (FAR/OSR/height/setback per zone and road width, distance-to-station bonuses) are *not* in any dataset: hand-encode with citations (this is the real work).

### Live / runtime
- Basemap tiles (OpenFreeMap or R2 PMTiles, range requests via CF cache).
- Nothing else is required live; building/roads/zoning/transit lookups run client-side against the pre-baked files (turf.js point-in-polygon, nearest station). This avoids CORS, geo-blocking, and Overpass rate limits.
- Optional live: Google 3D Tiles (key + referrer restriction + quota cap), Esri imagery toggle.

### Rendering for a normal laptop
Extrude only buildings within about 400-600 m of the plot as three.js/deck.gl meshes (merge geometry per tile; use instancing/BufferGeometry merge); outside that, flat footprints or none. Estimated-height buildings drawn in a neutral colour; plot envelope in a contrasting translucent colour.

### Risks
1. **Zoning data provenance/licence/accuracy**: official endpoints unreachable from here; the only file is third-party-derived, coarse (498 polygons), 2 spot-checks look wrong. Mitigate with override UI, disclaimer, and verification pass on a Thai network.
2. **Heights**: only ~9-15% of buildings have real heights; massing for the rest is estimated. Impacts "among actual buildings" credibility but not legality.
3. **Road width missing**: the key regulatory input. User-entered, with heuristic default.
4. **Station distance**: straight-line from station nodes, not entrance/walking distance; OSM line tags inconsistent; under-construction lines.
5. **Licences**: OSM/Overture ODbL attribution; Esri imagery and Stadia/MapTiler/CARTO free tiers are not production-grade; Google 3D Tiles forbids deriving data and requires logo + billing.
6. **Plan revision**: 4th revision of the BMA plan expected ~2027; codes/rules may change.
7. **Overture release churn**: pin a release (`2026-11-18.0`).
8. **Not tested**: pmtiles extract (blocked), DuckDB parquet route, Google 3D tile quality over Bangkok, BMA services from a Thai IP, LandsMaps behaviour from Thai IP.
