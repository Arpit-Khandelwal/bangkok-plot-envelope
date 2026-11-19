# Buildable: Bangkok edition

## What it is

A browser tool for a developer who owns a plot in Bangkok and wants to know what can be built on it before paying an architect. You draw the plot on a map, mark which edges face a road and how wide each road is, and pick condominium or office. The tool shows which building rules apply, the 3D volume the building may fill, and concept designs with a pass/fail checklist, placed among the real surrounding buildings.

Live: https://bangkok-plot-envelope.arpit-khandelwal.workers.dev

Scope: one zone only, ย.7 under the Bangkok Comprehensive Plan B.E. 2556 (2013), in the area around BTS Bang Chak and Punnawithi.

## How to use it

1. Open the live link. The map shows the study area.
2. Draw a plot with the polygon tool (any shape), or open the presets menu and load one of eight example plots on real blocks.
3. For each plot edge, say whether it faces a road, a neighbour or a waterway. For a road, confirm its width. The tool pre-fills a width estimated from road data and labels it as an estimate.
4. Pick the building type: condo or office.
5. Read the rules, the envelope in 3D, and the designs. Switch between the low-rise and high-rise designs, and read each design's checklist and area schedule.
6. Switch a rule off to see the volume without it. Edit the assumptions (floor height, efficiency) to see how the designs change.
7. Copy the link. The scenario is stored in the URL hash, so a pasted link restores the plot, edges, type and settings.

Everything recomputes as you edit, with no reload. A plot outside ย.7 gets the zone name and no verdict.

## What it checks

Rules are data files under `src/core/rules/data/`. Each carries its clause, source link and a confidence tag (verified, corroborated or assumption).

| Rule | What it does | Source and clause |
|---|---|---|
| Floor area ratio | Caps total floor area at 5 times the plot. Capped at 10 in the high-rise regime. No bonus is applied. | Plan 2556 cl. 14(1); MR 33 cl. 5 |
| Use size limit | Condo over 10,000 m² needs a road 30 m wide (with 30 m frontage) or a station within 500 m. Office over 1,000 m² needs a 16 m road or a station; offices over 10,000 m² are not allowed. | Plan 2556 cl. 14(11), 14(13), 36, 37 |
| Open space ratio | Open space at least 6% of total floor area. | Plan 2556 cl. 14(2) |
| Open space on the plot | 30% of the plot for condo, 10% for office. | BMA 2544 cl. 52; MR 33 cl. 6 |
| Open space on the largest floor | 30% (condo) or 10% (office) of the largest floor. | MR 55 cl. 33 |
| Road setback | 6 m from the road centreline if the road is under 10 m; a tenth of the width if 10 to 20 m; 2 m if wider. | MR 55 cl. 41; BMA 2544 cl. 50 |
| Side and rear setback | 3 m for walls with openings. | MR 55 cl. 50(2); BMA 2544 cl. 54 |
| Clear space | 2 m around the building. | BMA 2544 cl. 55 |
| Waterway setback | 3 m from a waterway under 10 m wide, 6 m otherwise. | MR 55 cl. 42 |
| Height plane | Height at any point at most twice the distance to the far side of the nearest road. | MR 55 cl. 44 to 46; BMA 2544 cl. 49 |
| High-rise threshold | Roof deck at 23 m or more, or 10,000 m² or more, switches the building to the high-rise regime. | MR 33 cl. 1 |
| High-rise setback | 6 m from every boundary, whole building. | MR 33 cl. 4 |
| High-rise road access | 12 m of frontage on a road at least 10 m wide (18 m above 30,000 m²). | MR 33 cl. 2 |
| Front access | Road-facing facade or front open space. Checked on the design only for the facade route. | BMA 2544 cl. 52(6), 53 |
| Parking | Condo: one stall per 60 m² unit or per 120 m², whichever is greater. Office: one per 60 m². | BMA 2544 cl. 84; MR 7 cl. 3 |
| Floor-to-floor height | At least 2.6 m (condo), 3 m (office). | MR 55 cl. 22 |
| Information only | Permeable planting, fire-truck road, environmental impact assessment trigger (80 units or 4,000 m²). Shown, not computed. | Plan 2556 cl. 14(2); MR 33 cl. 2, 3; ONEP guidance |

There are two rule sets, because the law switches the whole building from one to the other:

- **Low-rise:** roof deck under 23 m and floor area under 10,000 m². Ordinary setbacks (3 m at the sides).
- **High-rise or extra-large:** 23 m or more, or 10,000 m² or more. 6 m setback on every boundary for the whole building, open space of 30% of the plot, road access tests.

So there is no single allowed volume. The tool computes one envelope per rule set and shows one design for each. Which one to build is the developer's actual choice.

## How it works

```
 inputs                  state                 pure pipeline (src/core)
 map: draw plot    ->    Scenario       ->     project to local metres
 edges + widths          (zustand, URL         validate plot
 building type            hash)                resolve rules for both rule sets
 assumptions                                   envelope: per-edge setbacks + height planes
                                               designs: floors inside the envelope
 rules as data                                 checks: each design against each rule
 (src/core/rules/data)                         totals, summed from floors
                                                        |
                                                        v
                                                  Evaluation (one object)
                              __________________________|_________________________
                             |                          |                         |
                      MapLibre map                three.js layer            side panel
                      real buildings, roads       envelope, designs         rules, checklist,
                                                                            area schedule
 static data in public/data (baked offline by data-pipeline/)
```

- **Rules are data.** A zone, a plan version or a rule value is one data entry with its clause and confidence. Only ย.7 ships. Adding a zone would be a data addition, not a code change, but none has been added to the tool.
- **One evaluation feeds every view.** The map, the 3D layer, the checklist and the area table all read the same object, so they cannot disagree.
- **Per-edge setbacks by subtraction.** No library offers a different setback per edge. The tool subtracts a strip along each edge at that edge's own distance, and splits triangles directly so the mesh stays closed.
- **The height limit is an exact surface.** It is the lowest of the planes rising at 2:1 from the far side of each road, built as a mesh, not a stack of boxes.
- **Checks are computed independently of the generator.** Designs are built from the envelope. Checks recompute each rule from the design's own geometry. This came from a review that found the first version of the check read the same data as the generator and so could not catch its errors.

Every total in the area schedule is a sum of the floor list.

## Where the site data comes from

Baked offline into `public/data/` by `data-pipeline/`. Study area: the ย.7 polygon containing the two stations, plus 600 m.

| Data | Source | Licence | How it is used | Known accuracy |
|---|---|---|---|---|
| Zones | Bangkok Comprehensive Plan 2556, via a third-party GeoJSON (Kanesuan/KNS.MAP) derived from a BMA map service | None stated: unverified. Treat as indicative, non-commercial | Reads the zone from where the plot is drawn | 498 coarse polygons. Sub-area counts match the plan and one land listing agrees. Boundaries are not official |
| Stations | OpenStreetMap | ODbL 1.0 | 500 m station test | 76 of 190 stations have platform outlines, including both in the study area. Others are points |
| Building footprints | Overture Maps, release 2026-11-18.0 | ODbL 1.0 per source dataset | Surrounding buildings, 28,964 in the study bbox | Footprints are good. Plots are not matched to land parcels |
| Building heights | Google Open Buildings 2.5D Temporal (2023), via Overture footprints | CC BY 4.0 or ODbL 1.0 | 95.6% of buildings carry a satellite-derived height, 3.8% an estimate, 0.64% from level counts, 0.02% from a mapped height | See below |
| Roads | Overture transportation plus OSM tags | ODbL 1.0 | Road lines, and a width estimate by road class or lane count | Width is tagged on about 0.1% of roads, lanes on about 7%. The estimate pre-fills a default the user confirms |

Height evaluation, against the 191 buildings that have both a satellite value and a mapped height or level count (`public/data/meta.json`):

- Median error 3.5 m, mean error 8.1 m, bias -0.9 m. 47.6% are within one storey.
- This is not better than a constant 16 m guess on the median (3.2 m) or the within-a-storey share. It is better on the mean (8.1 m against 15.9 m) and on towers and mid-rise.
- Towers over 60 m are read about 22 m too low, partly because the dataset caps at 100 m.
- The truth set is small and biased toward notable mapped buildings (114 of 192 are 10 to 23 m). It says nothing about the unmapped 99%, mostly low-rise. The raster is from 2023 and the footprints from 2026.

Details and the rejected alternatives are in `data-pipeline/README.md`.

## Run it locally

Prerequisites: Node and pnpm. The data pipeline also needs Python with `uv`.

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm test         # unit and integration tests
pnpm test:perf    # timing tests, run alone so other files do not compete for the CPU
pnpm typecheck
pnpm build        # type-check, then production build to dist/
pnpm preview      # serve the build
pnpm deploy       # build, then wrangler deploy (Cloudflare Workers static assets)
```

To rebuild the data, follow `data-pipeline/README.md`. In short: create a venv from `data-pipeline/requirements.txt`, then run the numbered scripts `01` to `08` with `python -I`, and `06_validate.py` to check the output.

## Project layout

```
src/
  core/        pure logic, no DOM or network
    geom/        polygons, setbacks, envelope, height surface, meshes
    rules/       rule engine; data/ holds the zone and building-control rules
    designs/     floor stacks and massing generated inside the envelope
    checks/      pass/fail checks, computed from the design
    measure/     areas, levels, frontage
    pipeline/    inputs to Evaluation; example plots and test scenarios
    types.ts     the contract between all of the above
  map/         MapLibre map, three.js layer, drawing sync, camera framing
  site/        loading buildings, roads and zones; road width estimate
  state/       zustand store, example plots, URL hash encoding
  ui/          panel, site bar, rules list, checklist, area schedule, section drawing
  styles/      CSS tokens and per-area styles
data-pipeline/ Python scripts that bake public/data/
public/data/   zones, stations, roads, buildings (11 chunks)
research/      the research notes with sources
```

## Performance

Measured on the deployed build with a cold cache on a laptop:

- First paint at 0.76 s (it was 5.2 s before the page shell and code splitting).
- All scripts downloaded by 3.8 s. First surrounding buildings drawn at 3.1 s, all of them by 3.5 s.
- Layout shift 0.
- Entry script 144 KB gzip. The map library (306 KB gzip), the 3D model code (132 KB gzip) and the drawing tool (33 KB gzip) are separate chunks.
- A typical plot evaluates in about 16 ms.

## Tests

Counts from running the commands on 19 Nov 2026:

| Command | Result |
|---|---|
| `pnpm test` | 72 files, 1042 passed, 1 skipped |
| `pnpm test:perf` | 4 files, 19 passed (timing budgets for evaluation and building clipping) |

Kinds of test: geometry (setbacks, height surface, mesh closure), rules per zone and building type, golden cases worked by hand, invariants, a break list (self-crossing, tiny, slivered and out-of-zone plots, exact thresholds), URL round-trips, and component tests for the panel and layout. There is no automated browser suite. The browser checks (drawing, edges, 3D, phone layout, shareable link, outside-zone message) were done by hand on the deployed build.

## Known limits and things it gets wrong

- One zone only (ย.7). Another zone is a data addition, not done.
- It applies the 2013 plan. The 2026 draft renumbers the zones and is not implemented. The tool says which plan it applies.
- Road width is the user's input. The pre-filled value is an estimate.
- It cannot verify: that a road connects onward to a larger road, planned road widenings, airport and conservation height overlays, road-specific no-build strips. It errs strict where it can, and lists the rest as unchecked.
- Still lenient or unchecked: the high-rise fire-road note assumes the road fits in the setback without testing it. The front-access facade length ignores U-shaped outlines. The 12 m front strip and the internal road are not laid out.
- Several legal readings are ours, not official: the condo size test is per plot; the 30 m frontage reading of clause 36(4); the 6 m high-rise setback applies to a podium; parking counts toward floor area (a setting). See `DECISIONS.md` section B. Open items are listed in `research/01-regulations.md` section 9 (19 items).
- Station distance uses approximate geometry. Results near 500 m are marked "verify on site".
- Building heights are satellite-derived with about one storey of typical error (see above). Surrounding buildings exist only inside the study area.
- Efficiency, floor-to-floor height, unit size and parking area per car are assumptions, not law. They are shown separately and are editable.
- Zoning data is third-party, with no stated licence.
- This is not legal advice. Check any result with an architect and the local authority.

## How it was built

Research and build work ran as parallel agents on different models (Opus for regulations and geometry, Sonnet for data and interface), with the main session writing contracts, checking results by hand and integrating. An independent adversarial review found two cases where the tool said Pass on something the research reads as illegal, and the fixes were driven by its failing inputs. The tool was checked in a real browser, which found bugs that unit tests did not. See `LOG.md` for the timeline including mistakes, `DECISIONS.md` for each call, and `RESEARCH.md` for the research.
