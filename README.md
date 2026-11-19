# Buildable: Bangkok edition

## What it is

A browser tool for a developer who owns a plot in Bangkok and wants to know what can be built on it before paying an architect. You draw the plot on a map, mark which edges face a road and how wide each road is, and pick condominium or office. The tool shows which building rules apply, the 3D volume the building may fill, and concept designs with a pass/fail checklist, placed among the real surrounding buildings.

Live: https://bangkok-plot-envelope.arpit-khandelwal.workers.dev

Scope: one zone only, ย.7 under the Bangkok Comprehensive Plan B.E. 2556 (2013), in the area around BTS Bang Chak and Punnawithi.

## How to use it

1. Open the live link. The map shows the study area.
2. Make a plot. Draw it with the polygon tool (any shape), or open the examples menu and load one of eight example plots on real blocks. To make a plot without a mouse, open "Enter corner coordinates" and type the corners.
3. For each plot edge, say whether it faces a road, a neighbour or a waterway. For a road, confirm its width. The starting value is estimated from road data (by road class or lane count) and is labelled as an estimate. Replace it with the measured width.
4. Pick the building type: condo or office.
5. Read the rules, the envelope in 3D, and the designs. Switch between the low-rise and high-rise designs, and read each design's checklist and area schedule.
6. Switch a rule off to see the volume without it. Edit the assumptions (floor height, efficiency) or the readings of unclear law to see how the designs change.
7. Press "Copy link". The scenario is stored in the URL hash (format v2): plot, edges, type, assumptions, readings and switched-off rules. The hash is never sent to a server. Links made in the earlier format (v1) still open.

Everything recomputes as you edit, with no reload. A plot outside ย.7 gets the zone name and no verdict.

## What it checks

Rules are data files under `src/core/rules/data/`. Each carries its clause, source link and a confidence tag (verified, corroborated or assumption).

| Rule | What it does | Source and clause |
|---|---|---|
| Floor area ratio | Caps total floor area at 5 times the plot. Capped at 10 in the high-rise regime. No bonus is applied. | Plan 2556 cl. 14(1); MR 33 cl. 5 |
| Use size limit | Condo over 10,000 m² needs a road 30 m wide (with 30 m frontage, measured along the road) or a station within 500 m. Office over 1,000 m² needs a 16 m road (16 m frontage) or a station; offices over 10,000 m² are not allowed. | Plan 2556 cl. 14(11), 14(13), 36, 37 |
| Open space ratio | Open space at least 6% of total floor area. | Plan 2556 cl. 14(2) |
| Open space on the plot | 30% of the plot for condo, 10% for office. | BMA 2544 cl. 52; MR 33 cl. 6 |
| Open space on the largest floor | 30% (condo) or 10% (office) of the largest floor. | MR 55 cl. 33 |
| Road setback | 6 m from the road centreline if the road is under 10 m; a tenth of the width if 10 to 20 m; 2 m if wider. | MR 55 cl. 41; BMA 2544 cl. 50 |
| Side and rear setback | 3 m for walls with openings. | MR 55 cl. 50(2); BMA 2544 cl. 54 |
| Clear space | 2 m around the building. | BMA 2544 cl. 55 |
| Rear walkway | Office only: 2 m walkway behind the building, kept from every neighbouring boundary. It says when the other setbacks already exceed it, as they do on most plots. Applying it to an office is our reading. | BMA 2544 cl. 52(7) |
| Waterway setback | 3 m from a waterway under 10 m wide, 6 m otherwise. | MR 55 cl. 42 |
| Height plane | Height at any point at most twice the distance to the far side of the nearest road. Every road on the plot applies. The wider road governs alone only when the plot verifiably meets the 60 m conditions of cl. 45 and 46. | MR 55 cl. 44 to 46; BMA 2544 cl. 49 |
| High-rise threshold | Roof deck at 23 m or more, or 10,000 m² or more, switches the building to the high-rise regime. | MR 33 cl. 1 |
| High-rise setback | 6 m from every boundary, whole building. | MR 33 cl. 4 |
| High-rise road access | 12 m of frontage on a road at least 10 m wide (18 m above 30,000 m²). | MR 33 cl. 2 |
| Front open space | Two lawful forms, and the one with more floor area is offered. On the road: the building line facing the road is longer than an eighth of the perimeter and within 20 m of the road (cl. 53). Set back: more than 20 m from the road, behind a front open space 6 m wide (12 m over 3 storeys) along a sixth of the perimeter, linked to the road by open ground at least 6 m wide (cl. 52(6)). The summary says which form and why. A setting applies the stricter reading: cl. 52(6) for every building over 2 storeys or 8 m. Our reading, not settled law. | BMA 2544 cl. 52(6), 53 |
| Parking | Condo: one stall per 60 m² unit or per 120 m², whichever is greater. Office: one per 60 m². Parking is sized to the requirement, with one shared level for parking and main use. | BMA 2544 cl. 84; MR 7 cl. 3 |
| Floor-to-floor height | At least 2.6 m (condo), 3 m (office). | MR 55 cl. 22 |
| Fire road and planting | High-rise: the open ground outside a 6 m ring around the building must hold the permeable planting (half the open space). Pass or fail, by area. A design that cannot fit both is not offered. The layout is not drawn. | MR 33 cl. 3; Plan 2556 cl. 14(2) |
| Information only | Permeable planting, parking clear height (2.10 m under beams). Shown, not computed. | Plan 2556 cl. 14(2); MR 41 cl. 4 |
| Environmental impact assessment | Needed at 80 units, or 4,000 m² of usable area. The definition of usable area is not verified, so the check measures total floor area, the strictest reading, and says so. | ONEP guidance |

Other points in how designs are made:

- Frontage is measured along the road, not along a zig-zag edge.
- Parts of a floor narrower than 8 m (6 m for parking) are removed from designs.

There are two rule sets, because the law switches the whole building from one to the other:

- **Low-rise:** roof deck under 23 m and floor area under 10,000 m². Ordinary setbacks (3 m at the sides).
- **High-rise or extra-large:** 23 m or more, or 10,000 m² or more. 6 m setback on every boundary for the whole building, open space of 30% of the plot, road access tests.

So there is no single allowed volume. The tool computes one envelope per rule set and shows one design for each. Which one to build is the developer's actual choice.

## How unclear rules are read

Some clauses can be read two ways. Each reading is a setting, and the default is listed here. The settings are in the interface and are in `src/core/readings.ts`.

| Setting | Default | Stricter value | Looser value |
|---|---|---|---|
| Parking floors count toward FAR | On | On (default) | Off |
| An office's own parking counts in its operating area | On | On (default) | Off |
| 12 m front open space required even on a public road | Off (cl. 53 governs a building on the road) | On | Off (default) |

When a setting is moved to a looser reading than its default, the interface shows a persistent notice, and every Pass reads "Passes under this reading". Start over, a new plot or an example plot resets the settings. Only the first two defaults are the stricter side. The front open space default is the looser reading. It does not raise the notice, because it is the default. Its rule carries the confidence tag "assumption". The reasons are in `DECISIONS.md` B12.

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
- All surrounding buildings drawn by 3.5 s (6.0 s before).
- Layout shift 0.
- Entry script 144 KB gzip. The map library, the 3D model code and the drawing tool are separate chunks.
- Evaluation takes about 16 ms for a typical plot when measured on an idle laptop, before the second building form was added. The budget is under 40 ms. The timing budgets were not re-checked after that change; they are checked separately with `pnpm test:perf`.

## Security

Every response carries a content security policy, `X-Content-Type-Options: nosniff`, a referrer policy, `X-Frame-Options: SAMEORIGIN` and a permissions policy that denies camera, microphone and location (`public/_headers`). The content security policy was verified on the deployed site: no console violations, and fonts, basemap, buildings and the 3D model all load. Shared links are decoded as untrusted input.

## Accessibility

Done:

- A keyboard path to a plot: "Enter corner coordinates".
- Focus handling: focus no longer drops when a control unmounts.
- Each rule switch is named by its rule.
- Thai text is marked as Thai.
- Forced-colours (high-contrast) support, including focus rings.
- Contrast computed from the colour tokens: no text pair fails.

Not verified: no screen-reader session and no forced-colours session was run. The findings came from reading the source. They were fixed, then spot-checked in a browser.

## Tests

Counts from running `pnpm test` on 20 Nov 2026: 85 files, 1,177 passed, 1 skipped (1,178 tests).

Timing budgets (evaluation, building clipping, zone lookup) are checked separately with `pnpm test:perf`, run alone so other files do not compete for the CPU. They were not re-run for this update.

Kinds of test: geometry (setbacks, height surface, mesh closure), rules per zone and building type, golden cases worked by hand, invariants, a break list (self-crossing, tiny, slivered and out-of-zone plots, exact thresholds), URL round-trips, and component tests for the panel, layout and focus. There is no automated browser suite. The browser checks (drawing, edges, 3D, phone layout, shareable link, outside-zone message) were done by hand on the deployed build.

## Known limits and things it gets wrong

- One zone only (ย.7). Another zone is a data addition, not done.
- It applies the 2013 plan. The 2026 draft renumbers the zones and is not implemented.
- Road width is the user's input. The starting value is an estimate.
- It cannot verify: that a road connects onward to another public road, planned road widenings, or airport and conservation height overlays.
- The fire road, the planting and the front open space are checked by area or outline only. Their layout is not drawn.
- Several legal readings are ours, not settled: see `DECISIONS.md` section B (including B12 on the front open space, B13 on the office rear walkway, B14 on the fire road and B16 on the EIA test). Open items are in `research/01-regulations.md` section 9.
- Building heights are satellite-derived, with the evaluation numbers above. Surrounding buildings exist only in the study area.
- Efficiency, floor-to-floor height, unit size and parking area per car are assumptions, not law. They are shown separately and are editable.
- Station distance uses approximate geometry. Results near 500 m are marked "verify on site".
- Browser checks were manual. There is no automated end-to-end suite.
- The set-back form is not tried when the on-road design is already within 1% of the floor-area limit, so a set-back design up to 1% larger can be missed.
- Plates only shrink evenly (with narrow parts cut). A narrow plot may get no high-rise where a shorter tower would fit.
- Zoning data is third-party, with no stated licence.
- This is not legal advice. Check any result with an architect and the local authority.

## How it was built

Research and build work ran as parallel agents on different models (Opus for regulations and geometry, Sonnet for data and interface), with the main session writing contracts, checking results by hand and integrating. An independent adversarial review found two cases where the tool said Pass on something the research reads as illegal, and the fixes were driven by its failing inputs. The tool was checked in a real browser, which found bugs that unit tests did not. See `LOG.md` for the timeline including mistakes, `DECISIONS.md` for each call, and `RESEARCH.md` for the research.
