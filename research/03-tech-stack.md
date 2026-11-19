# 03 - Tech stack and geometry recommendation (Bangkok plot envelope tool)

Date: 2026-11-19. Versions below were read from `npm view` today. Items marked **[verified]** were read from a source this session; **[memory]** are from prior knowledge and should be confirmed with a quick spike. I did not run any of the libraries.

## 0. Recommendation in one paragraph

Vite 8 + React 19 + TypeScript. **MapLibre GL JS 6 (mercator, ESM) as the map**, with context buildings as stock `fill-extrusion`, and **one three.js custom layer** that draws the sloped/stepped envelope (translucent), the concept massings (opaque, lit) and optional shadows. **terra-draw** for polygon draw/edit. **Clipper2 (TS port) for 2D booleans/offsets plus earcut for triangulation**, with the envelope mesh built *exactly* from a "lower envelope of planes" decomposition (section 3.3), not a heightfield. All geometry is pure TypeScript functions in local metres (tangent-plane tmerc via proj4, k=1 at the plot centroid), driven by a zustand store. Run on the main thread first; the pure-function shape lets you move it to a worker in 30 minutes if profiling demands. Deploy as Workers static assets (`wrangler.jsonc`), big tile archive on R2.

## 1. Versions and maintenance (npm, 2026-11-19)

| Package | Version | Last publish | Note |
|---|---|---|---|
| maplibre-gl | 6.19.0 | 2026-11-17 | v6 is ESM-only, mandatory WebGL [verified] |
| three | 0.187.0 | 2026-10-30 | |
| @react-three/fiber / drei | 9.8.2 / 10.7.9 | Oct / Sep 2026 | not needed with MapLibre custom layer |
| deck.gl / @deck.gl/mapbox | 9.4.1 | 2026-11-12 | |
| terra-draw | 1.40.0 | 2026-11-15 | very active |
| terra-draw-maplibre-gl-adapter | 1.5.0 | 2026-10-06 | peer `maplibre-gl >=4`; README table says "v4/5" [verified], v6 untested by me |
| @mapbox/mapbox-gl-draw | 1.5.2 | 2026-09-14 | |
| @geoman-io/maplibre-geoman-free | 0.10.10 | 2026-11-19 | active but pre-1.0 |
| @countertype/clipper2-ts | 1.5.4 | 2025-11-17 | TS port of Clipper2 |
| clipper2-js | 1.2.4 | 2024-01 | stale |
| clipper2-wasm | 0.4.0 | 2026-05-18 | WASM, pre-1.0 |
| polygon-clipping | 0.15.7 | 2023-12 | booleans only, no offset, stale |
| jsts | 2.12.1 | 2024-11 | robust, slow-ish, uniform buffer only |
| @turf/turf | 7.4.0 | 2026-08 | buffer is uniform distance only |
| straight-skeleton | 3.0.0 | 2026-03 | CGAL WASM, **unweighted** only [verified] |
| earcut | 3.2.4 | 2026-09 | |
| manifold-3d | 3.5.5 | 2026-11-13 | WASM robust CSG, exact volume; optional |
| proj4 | 2.23.0 | 2026-11-12 | |
| zustand | 5.1.0 | 2026-11-06 | |
| vite / @vitejs/plugin-react | 8.3.8 / 6.3.0 | Nov 2026 | |
| vitest / @playwright/test | 5.1.1 / 1.65.1 | Nov 2026 | |
| wrangler | 4.165.0 | 2026-11-18 | |
| cesium | 1.147.0 | 2026-11-02 | |
| mapbox-gl | 3.35.1 | 2026-11-18 | |
| pmtiles / @protomaps/basemaps | 4.5.0 / 5.7.2 | Aug / Mar 2026 | |
| three-bvh-csg | 0.0.18 | 2026-02 | |

## 2. Map + 3D rendering comparison

Criteria: sloped/stepped translucent mesh, shadows/quality, performance, cost/keys, mobile, time to ship.

**(a) MapLibre GL + fill-extrusion + three.js custom layer. RECOMMENDED.**
- Envelope: arbitrary triangle mesh in three.js, so sloped tops are exact. Fill-extrusion cannot do slopes, but is perfect for context buildings.
- Custom layer with `renderingMode: '3d'` shares the map's depth buffer, so real buildings correctly occlude/are occluded by your meshes [verified from MapLibre globe-three.js example text: layer "MUST be marked as 3D" to get the depth buffer].
- No API key, BSD licence, runs on phones (single WebGL context), vector tiles are tiny.
- Quality: three.js standard materials, edge lines, directional light, shadow map on a `ShadowMaterial` ground plane. Shadows fall only on your own objects and that plane, not on MapLibre's extrusions (separate pipeline) unless you also re-extrude nearby context buildings in three (stretch).
- v6 passes projection data to custom layers (`getProjectionData` exposed, PR #7471, in the v6.0.0 notes [verified]); the `render(gl, args)` shape changed vs the old `render(gl, matrix)`. Use the official three.js example as the template, and **force mercator projection** to avoid globe-projection shader work.
- Ship speed: fastest. You write one ~150-line layer class.

**(b) deck.gl over MapLibre (interleaved).** Good for data layers; `SolidPolygonLayer` extruded is flat-topped like fill-extrusion; `SimpleMeshLayer`/`ScenegraphLayer` can draw arbitrary meshes but translucency, lighting and edge lines are weaker, and you gain a large dependency (deck.gl 9.4.1) for no capability three.js lacks. Choose only if you later want large data viz.

**(c) Pure three.js/R3F + ground texture.** Full control and best shadows, but you must build tile fetching/texturing, map camera controls, picking for polygon drawing, and basemap attribution yourself. Not 48 h. R3F adds React reconciliation overhead for a scene that changes on every drag.

**(d) CesiumJS + 3D Tiles (1.147).** Photoreal context possible via Google Photorealistic 3D Tiles (Bangkok coverage: check) but needs key/billing and attribution rules, heavy (multi-MB engine, GPU/memory hungry on mobile), terrain/ellipsoid depth quirks, drawing UX is yours to build. Best visuals, worst ship speed and mobile story. Reject for this timebox.

**(e) Mapbox GL JS v3 Standard.** Nice built-in lighting, shadows and 3D buildings, supports custom layers/slots. But token + usage billing + proprietary licence, and no benefit for the sloped mesh vs (a). Use only if the client already holds Mapbox. Mapbox's own terra-draw/mapbox-gl-draw tooling works either way.

### Pitfalls (custom layer)
1. **Float precision**: mercator units are ~1e-8 per metre. Do not put world-mercator coordinates in the vertex buffer. Build geometry in metres relative to the plot centroid; compute in doubles on CPU `M = mainMatrix * translate(centroidMercator) * scale(s, -s, s)` (s = `MercatorCoordinate.meterInMercatorCoordinateUnits()`), then set `camera.projectionMatrix` and identity view. Z is not flipped; Y is (mercator y points south).
2. **Mercator scale at Bangkok** (13.75 N): 1/cos(lat) = 1.0295, about 3% if you ignore it. `meterInMercatorCoordinateUnits` at the centroid fixes this for a plot-sized scene; fill-extrusion heights are in true metres, so mesh and context heights agree (eyeball-check one known building).
3. **Reset GL state**: call `renderer.resetState()` before `renderer.render()` and `map.triggerRepaint()` after if animating; otherwise MapLibre and three corrupt each other's state.
4. **Transparency sorting**: three sorts per object, not per triangle. For the envelope use: two meshes (BackSide then FrontSide), `depthWrite:false`, `transparent:true`, low `renderOrder` for envelope and higher for opaque massings drawn first (opaque before transparent is automatic), plus opaque `LineSegments` from `EdgesGeometry` to define the shape. Avoid translucent massings.
5. **Z-fighting**: massing faces touching the envelope boundary, and envelope base at z=0 on the map. Lift envelope base by ~2-5 cm, inflate envelope by ~1 cm, use `polygonOffset`, keep `depthWrite:false` on envelope.
6. **Depth precision**: use MapLibre's matrix (its near/far); don't supply your own camera near/far. Keep pitch <= ~75 to limit far-plane stretch.
7. **Globe**: not needed; set mercator explicitly.
8. **Fallback if the custom layer eats > 6 h**: approximate the slope with stacked terraces. `fill-extrusion` supports `fill-extrusion-base`, so slice the envelope into 1 m height bands, each a flat prism of the band footprint; stair-stepped but correct to the metre, translucent via `fill-extrusion-opacity`. Keep this in your pocket; it also validates the geometry before the mesh exists.

### Data for "real surrounding buildings and roads"
- Use vector tiles with building footprints + heights. Options: OpenFreeMap (no key) or **Protomaps PMTiles** extracted to a Bangkok bbox with the `pmtiles extract` CLI and served from **R2** (range requests, CORS), styled with `@protomaps/basemaps` [memory; check the schema's building height property]. Cloudflare static assets have a per-file size cap (25 MiB [memory]), so do not bundle the archive.
- Overture buildings (OSM + ML-derived Microsoft/Google footprints) can be rendered with fill-extrusion in the same way [verified pattern: leafmap 3D PMTiles example]; the published height work is lidar-based in the US, so **expect most Bangkok buildings to lack heights**. Plan a fallback: `height` -> `levels*3.2` -> default (e.g. 9 m, or vary by footprint area) and label context as indicative.

## 2b. Polygon drawing/editing

Pick **terra-draw 1.40 + terra-draw-maplibre-gl-adapter 1.5**.
- Select mode supports draggable vertices, midpoint insertion, `snappable` (to line/coordinate of other terra-draw features), deletable vertices, and a `validation` callback [verified, terra-draw MODES guide]. Select/Point/Line/Polygon are fully supported on touch [verified].
- Maintenance: very active, MIT, maintained adapters for MapLibre/Mapbox/Leaflet/OL/Google.
- Gotchas: (i) add `ValidateNotSelfIntersecting` yourself for select mode; the docs only show it for drawing modes [verified]; (ii) snapping targets terra-draw features, not basemap geometry (you may want snap-to-road-edge later: not for 48 h); (iii) adapter README lists MapLibre v4/5; test v6 on day 1, fallback is pinning maplibre-gl 5.x (the custom layer API difference is the only cost); (iv) **edge roles** (road/side/rear) are not in terra-draw: keep an `edgeRoles[]` array in your store and re-map it on vertex insert/delete (insert at i duplicates role i-1; delete merges). Simplest 48 h choice: after the polygon is finished, allow dragging and midpoint insert, and handle count changes by diffing.
- Marking road edges: on map click in "mark road" mode, convert click to local metres and pick the nearest edge segment (point-to-segment distance), toggle its role; render roles as a coloured `line` layer.

Alternatives: mapbox-gl-draw 1.5.2 works on MapLibre only with CSS class/constants overrides and has no snapping built in (third-party snap mode); historically weaker touch. Geoman free (0.10.10) has snapping and editing and is active but pre-1.0 and its free/pro split needs checking. deck.gl editable layers (nebula.gl lineage) are not worth it. [memory for these three]

## 3. Geometry

### 3.1 Library choice
- Per-edge different offsets: **none of the libraries do this natively.** Clipper2's `InflatePaths` takes one delta and one join type per call; concave joins are always mitred and convex joins follow the join type [verified, Clipper2 docs]. turf/JSTS buffer: uniform distance. Straight skeleton: JS one is unweighted [verified], weighted skeletons (CGAL) have no JS port that I found. Skip all skeleton approaches.
- So build per-edge offsets from **boolean difference with per-edge strips** (3.2). Use `@countertype/clipper2-ts` (pure TS, no async WASM init, Nov 2025) or `clipper2-wasm` (faster, pre-1.0, async init; fine on Cloudflare). Both are ports of the same engine; I did not benchmark. Spike 20 minutes: `Difference`, `Union`, `Intersect`, `InflatePaths` on an open path with round ends, `Area`. Plot-scale operations are sub-millisecond to a few ms either way.
- Coordinates: Clipper is integer based; use the double API with precision 3-4 decimals (mm or 0.1 mm), or scale metres by 1000 yourself.
- Triangulation: earcut 3.2.4 (handles holes; set `deviation`=0 check). Pole of inaccessibility: `polylabel` for tower placement seeds.

### 3.2 Per-edge setback (arbitrary, concave polygon)
Define buildable region B(0) = { x in P : dist(x, edge_i) >= d_i for all i }, i.e. the plot minus the union of **capsules** (segment buffered by d_i, round ends).
```
for each edge i: capsule_i = InflatePaths(open path [a_i,b_i], delta=d_i, EndType.Round)
strip = Union(all capsule_i)         // NonZero
B = Difference(P, strip)             // may be multiple pieces or empty
```
Properties: convex vertices of P give sharp (mitre-equivalent) corners with different d_i on each side; reflex vertices give arcs of radius d_i (true Euclidean setback; for straight mitred reflex corners add a wedge triangle, but note that squared ("butt") strips leave a spurious sliver at reflex corners, so default to round). Raising arc tolerance to ~1 cm keeps vertex counts small. The same output also gives the *setback strip area* so `plot = buildable + strips` partitions exactly in integer coordinates.
- **Road setback measured from centreline**: edge setback `d_road = max(0, S_centre - w/2)` where w is the road width (user input; OSM rarely has it). Compute the offset from the plot's road edge, then if the data says the road edge is not the property line, move the line first.
- **Stepped setbacks**: bands `[z_j, z_{j+1})`, each with footprint F_j = B with extra inset e_j added to all (or per-edge-type) d_i; recompute F_j from the plot with `d_i + e_j`, so F_j are nested by construction (F_{j+1} subset F_j) with no drift. Typical example: F_0 for 0-23 m, F_1 for 23 m+ with extra inset.
- Empty/multi-piece results are normal (thin plots). Treat each piece independently; show "no buildable area" state.

### 3.3 Sloped height surface and exact envelope mesh
Height rule: H(x) = min( cap, min_k 2 * d_k(x) ), d_k = perpendicular distance from x to the far kerb line of road k (road edge offset outward by w for edge-measured, or centreline + w/2). Each term is **linear in x**, so H is the lower envelope of planes (concave, piecewise linear). (If the rule means distance to the far kerb *segment*, not infinite line, only differs for plots that extend past the road's ends; line distance is the usual reading but confirm with the domain note.)

Exact construction, no heightfield error:
1. Per band j (footprint F_j, z range [z_j, z_{j+1}]), the planes are: `L_k(x)` for each road k, and the constant `z_{j+1}` (band ceiling, also the global cap).
2. Restrict to where the band has thickness: `F_j' = F_j ∩ { min_k L_k > z_j }` = F_j ∩ half-planes (clip with big convex polygons via Clipper Intersect).
3. Partition F_j' into convex cells by which plane is lowest: `cell_m = BBox ∩ {L_m <= L_n for all n}` (half-plane clipping, n <= ~5 planes so O(n²)), intersect with F_j', triangulate with earcut, lift vertices to z = L_m(x) (flat for the ceiling plane).
4. Walls: for each boundary edge of F_j' that comes from F_j (not an internal cell seam), build a quad/trapezoid from z_j up to the top height at each endpoint (top heights from the lowest plane evaluated at the endpoint; split the wall where the lowest plane changes along the edge, i.e. at cell seams).
5. Bottom caps are not needed visually (hidden at ground); when the band above is narrower, the ledge top is just the lower band's top surface.
6. Emit `BufferGeometry` + `EdgesGeometry` with a crease angle (ensures the slope/step edges draw sharply).
This yields watertight, exact planar facets, small meshes (hundreds of triangles), trivially recomputed per drag frame.

Alternatives considered: heightfield/grid triangulation (approximate, aliasing at the plot boundary, bigger meshes: skip); contour slicing into 0.5-1 m bands (the same as the fill-extrusion fallback, good as fallback/validator); **manifold-3d** (WASM, exact CSG and exact `volume()`): extrude the stepped footprints and intersect with half-space wedges; robust and gives an independent check of envelope volume and "massing minus envelope = empty" in tests. Optional because of the WASM weight and time; three-bvh-csg is too immature (0.0.18) for correctness-critical work.

### 3.4 Massing fit test and generation
- **Fit test (exact, cheap)** for a prism with footprint Q on [z0, z1]: Q fits iff (a) `Area(Difference(Q, F_{band(z1)}))` < eps (bands are nested so the top band's footprint is the binding one; also check bands between z0 and z1 if massing is also stepped: use the tightest footprint reached) and (b) `z1 <= min over vertices v of Q of H(v)`, since H is concave its minimum over a polygon is attained at a vertex. Floors are discrete: top = z0 + n*floor_h.
- **Slab (low, wide)**: floors share one plate. Plate = F_0 ∩ {coverage limit}; if coverage (1 - OSR) caps the footprint, shrink plate (e.g. inset the buildable region by `t` and bisect t or intersect with a scaled rectangle). Number of floors from FAR budget: `n = floor(FAR*plotArea / plate)` and a **partial last floor** (top floor plate scaled or trimmed by intersecting with a rectangle/half-plane via bisection) so total GFA hits the cap exactly. Check height fit; if it fails, drop floors at the roadside by cropping with `{H >= z_top}` (per-floor plates from the "max floor plate" formula `A_f = area(F(z_f) ∩ {H >= z_f + h})`).
- **Podium + tower**: podium plate = F_0 within coverage, height p floors. Tower: rectangle of area a_t, aspect ~1:1 to 1:2, orientation candidates = each plot edge direction + principal axis; for each orientation and candidate centre (grid over bbox plus polylabel point) grow/shrink by bisection on scale until `Difference(Q, F(z_top))` is empty and the vertex height check holds. The slope pushes the tower away from the road automatically as the height test fails near it. Outer loop: bisection on a_t so `GFA = podium + n_t*a_t` hits FAR cap with n_t = max feasible floors. Pick best by (hits FAR, lowest aspect penalty).
- Output both: massing = list of `{footprintPolygon, z0, z1, floors[]}` with per-floor area; mesh = earcut + extrude.
- Metrics: plot area, buildable area, footprint, coverage = footprint/plot, OSR = 1 - coverage (confirm the regulatory definition; Bangkok OSR is often measured vs total GFA, so keep both formulas switchable), GFA = sum per-floor, FAR = GFA/plot.

### 3.5 Projection, accuracy and "areas add up exactly"
- Convert lon/lat to local metres with proj4 using a **custom tmerc at the plot centroid**: `+proj=tmerc +lat_0=<lat> +lon_0=<lon> +k=1 +ellps=WGS84 +units=m`. Scale error is ~(d/R)²/2, ~1e-8 at 1 km, i.e. nothing. Plain UTM 47N (EPSG:32647) is OK but Bangkok at 100.5 E sits 1.5 deg off the 99 E central meridian, scale factor about 0.99992 (my estimate: 8 cm per km, 0.016% area): fine for a demo but you would have to disclose or correct. A simple equirectangular/ENU approximation (x = R cos(lat0) dlon, y = R dlat) is also within centimetres across a plot; proj4 makes the choice rigorous and cheap.
- Keep geometry in local metres everywhere; convert back to lon/lat only for map overlays (proj4 inverse) and to a mercator matrix for the three.js layer.
- Exact add-up: compute areas with Clipper `Area` on the same snapped integer coordinates (mm grid), store per-floor areas as numbers once, and **derive every total by summing stored values** (never recompute from different paths). Display with round-half-up, and assert in Vitest: `plot == buildable + strips` (to 1e-6 m²), `sum(floors) == GFA`, `GFA <= FAR*plot + eps`, `coverage*plot == footprint`. Property-test with random concave polygons (fast-check).
- Land areas in Thailand are quoted in rai/ngan/square wah (1 rai = 1600 m², 1 ngan = 400, 1 sq wah = 4 m²): offer display units. [memory]

## 4. App framework and pipeline
- **Vite 8 + React 19 + TS**. Next/Remix add nothing for a static SPA and complicate Cloudflare. Vanilla TS would also work but panels/forms are faster in React.
- **State: zustand 5**: `plot (lonlat ring)`, `edgeRoles[]`, `roads: {width,setbackBasis}`, `zoning params`, `buildingType`. Derive with a pure function `compute(inputs) -> { buildable, envelopeMesh, massings, metrics }` memoised on inputs; 3D layer subscribes via `store.subscribe` (outside React render) and calls `triggerRepaint`; React panels use selectors. Signals not needed.
- **Live update**: coalesce pointer events to one compute per `requestAnimationFrame`; recompute is a few ms. Show a cheap preview (2D fill) during drag if mesh is slow, full mesh on idle.
- **Worker**: start on main thread; keep `compute` free of DOM/React so it moves to a Vite `?worker` (comlink 4.4.2 or hand-rolled postMessage with transferable Float32Arrays) when profiling shows > ~8 ms. Do not start with a worker: it hurts debuggability in a 48 h build.
- **Testing**: Vitest 5 for geometry (property + golden tests on known shapes: rectangle with equal setbacks equals inset rectangle; L-shape; area partition; fit test), Playwright 1.65 for the flow (draw polygon via mouse clicks, toggle road edge, change building type, assert metrics text and a canvas screenshot at 1440 and 390 widths). Per your testing rules, add accessibility/keyboard checks if time.
- **Deploy**: Workers static assets with `wrangler.jsonc` (`assets.directory: ./dist`, `not_found_handling: single-page-application`); since a Wrangler config exists, use wrangler rather than the cf CLI. PMTiles on R2.
- **Look**: choose a deliberate visual direction (e.g. warm-paper architectural-drawing UI with a dark map, bronze envelope lines and white massings) rather than default shadcn; keep UI panels small on mobile (bottom sheet).

## 5. Reference implementations (what I found; search was thin)
I did not find a maintained open-source browser project that does zoning envelope + sky-exposure massing; the ecosystem is mostly commercial. Useful write-ups:
- Giraffe envelope docs and the Notion write-up "Solving for Envelope and Set Back Requirements": how a commercial tool models setbacks/height planes (read for rule vocabulary).
- Snaptrude "buildable envelope" plugin API: input/outputs for an envelope object.
- Esri: ArcGIS Urban zoning envelopes help and CityEngine CGA `envelope` operation: formal definition of setbacks, height planes, and sky-exposure style constraints (good for the domain definitions).
- Chicago Cityscape "Building Visualizer" and the Medium "Parametric zoning tool" post: UX ideas (sliders live-updating an envelope).
- Alpaca "zoning-analysis" plugin: generates an interactive envelope viewer from a zoning report.
- Worth borrowing: UX of live-linked sliders and metrics; the vocabulary (front/side/rear, sky exposure plane, FAR/OSR/coverage); the official MapLibre three.js custom layer example for the integration scaffold. Nothing to copy for the algorithm: the construction above is simple enough to write yourself and test.
- Not found/confirmed: any GitHub repo matching "sky exposure plane three.js". Run `gh search code "setback" --language typescript` etc. if you want a second look.

## 6. Biggest risks
1. **Custom-layer integration** (matrix/depth/state/transparency). Mitigate by doing the three.js layer spike first with a hard-coded wedge, and keep the stacked fill-extrusion terrace fallback.
2. **Rule ambiguity, not code**: slope plane definition (line vs segment, edge vs centreline), multiple roads, missing road widths, which setback applies on corner plots, OSR definition. Make each a named, editable parameter and show assumptions in the UI; get the domain note settled before hour 10.
3. **Geometry edge cases and massing search**: concave/thin plots, empty or split buildable area, self-intersection during drag, fit test false negatives from floating tolerance, tower search failing to hit FAR exactly. Mitigate with tolerances (1 mm), validation in terra-draw, an explicit "does not fit" result, and property tests. (Also: context building heights in Bangkok are largely missing; fall back and label it.)

## 7. Order of work (earliest end-to-end loop)
1. 0-3 h: Vite scaffold, MapLibre on Bangkok with free basemap + building extrusions, deploy to Cloudflare immediately (so deployment risk dies on day 1).
2. 3-6 h: terra-draw polygon + zustand store; click-to-mark road edges; show buildable 2D polygon (setback by hand-coded uniform inset first).
3. 6-12 h: geometry core with Vitest: projection, per-edge capsule difference, stepped bands, area metrics. Display buildable polygon live (**first real E2E loop**).
4. 12-20 h: three.js custom layer; exact envelope mesh (section 3.3); translucent look with edges.
5. 20-30 h: massing generators (slab, podium+tower), fit tests, metrics panel, building-type switch.
6. 30-38 h: visual polish (materials, shadow plane, context buildings height fallback, UI design, mobile bottom sheet).
7. 38-46 h: Playwright flows, perf profiling (worker only if needed), accessibility basics, R2 tiles if used.
8. 46-48 h: buffer, final deploy, README of assumptions.

## Sources
- MapLibre v6.0.0 release notes: https://newreleases.io/project/github/maplibre/maplibre-gl-js/release/v6.0.0
- MapLibre v6 ESM-only/WebGL note: https://geo.malagis.com/maplibre-gl-js-v6-mandatory-webgl-and-esm-only.html
- MapLibre three.js on globe example: https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-to-globe-using-threejs/
- MapLibre custom layer on globe: https://maplibre.org/maplibre-gl-js/docs/examples/add-a-simple-custom-layer-on-a-globe/
- Terra Draw repo: https://github.com/JamesLMilner/terra-draw
- Terra Draw modes guide: https://raw.githubusercontent.com/JamesLMilner/terra-draw/main/guides/4.MODES.md
- Terra Draw MapLibre adapter README: https://unpkg.com/terra-draw-maplibre-gl-adapter@1.1.2/README.md
- Clipper2 JoinType docs: https://angusj.com/clipper2/Docs/Units/Clipper/Types/JoinType.htm
- Clipper2 InflatePaths: https://angusj.com/clipper2/Docs/Units/Clipper/Functions/InflatePaths.htm
- Clipper2 overview: https://angusj.com/clipper2/Docs/Overview.htm
- clipper2-ts: https://cdn.jsdelivr.net/npm/@countertype/clipper2-ts@1.5.4-3.9a869ba/README.md
- straight-skeleton (StrandedKitty): https://github.com/StrandedKitty/straight-skeleton
- Overture buildings guide: https://docs.overturemaps.org/guides/buildings
- Leafmap 3D PMTiles example: https://nbviewer.org/github/opengeos/leafmap/blob/master/docs/maplibre/3d_pmtiles.ipynb
- Giraffe envelope: https://intercom.help/giraffe-knowledgebase/en/articles/12551802-envelope
- Giraffe setback write-up: https://giraffetechnology.notion.site/Solving-for-Envelope-and-Set-Back-Requirements-10a689ac43744c1cac4edac0976c375e
- Snaptrude buildable envelope API: https://docs.snaptrude.com/plugin-api/entity/buildable-envelope.html
- ArcGIS Urban zoning envelopes: https://doc.arcgis.com/en/urban/12.0/help/help-zoning-envelopes.htm
- CityEngine envelope op: https://esri.github.io/cityengine-sdk/html/cgaref/cgareference/op_envelope.html
- Chicago Cityscape Building Visualizer: https://publish.obsidian.md/chicagocityscape/buildingvisualizer
- Parametric zoning tool: https://medium.com/generative-design-course/parametric-zoning-tool-06b9565e2bca
- Alpaca zoning analysis: https://alpaca-site.pages.dev/plugins/zoning-analysis
- npm registry pages for all packages in section 1 (queried via `npm view`).
