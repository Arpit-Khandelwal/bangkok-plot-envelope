# PLAN

| | UTC | IST |
|---|---|---|
| **Start** | 2026-11-19 09:01:21 | **Thu 19 Nov 2026, 14:31:21** |
| **Feature freeze (T-8h)** | 2026-11-21 01:01:21 | **Sat 21 Nov 2026, 06:31:21** |
| **Submit by (T-2h)** | 2026-11-21 07:01:21 | **Sat 21 Nov 2026, 12:31:21** |
| **Hard deadline** | 2026-11-21 09:01:21 | **Sat 21 Nov 2026, 14:31:21** |

The clock runs on the General Machines server and cannot be paused. Submissions are rejected after the hard deadline.

Receipt ID: _pending submission_

---

_Scope, timeline, architecture and risks are written here after the product direction is picked (Phase 2)._

## Direction

**A rule-traceable envelope, plus the arithmetic slice of a yield calculator.** Picked by Arpit at T+0h40, then audited by an independent agent, which kept the direction and moved the spare effort from more legal depth to robustness and the real site.

The tool answers: what can I build on this plot, and which rule is stopping me from building more?

## Scope

### Must have (the brief's requirements; nothing ships without these)

| # | Item | Brief requirement |
|---|---|---|
| M1 | Draw and edit any polygon plot on the map; mark road edges and enter road width | B1, B3, E1 |
| M2 | Zone read from the plot's location; clear message outside ย.7 or straddling zones | B2, D1 |
| M3 | Building type switch: condo and office | B4, E4 |
| M4 | Rules panel: each rule with its resolved number, clause and source link; binding rule named | C1 |
| M5 | Envelope per regime, following the plot outline, with the 2:1 height plane as an exact mesh | C2, E2a |
| M6 | Each rule can be switched off to see its effect on the envelope | E2b |
| M7 | Two designs, one per regime, each a list of floors; area schedule whose totals are sums of the floors | C3, E2c |
| M8 | Pass/fail checklist per design, each line with required versus actual | C4 |
| M9 | Real surrounding buildings and roads in 3D; estimated heights marked | E3 |
| M10 | Everything recomputes live on any input change | E4 |
| M11 | Survives the break list: bad winding, self-crossing, slivers, nothing buildable, exact thresholds, landlocked plots, bad widths | E6 |
| M12 | Client-ready design on laptop; usable on mobile | E5a, E5b |
| M13 | Preset plots that trigger each threshold (station distance, road width, frontage, 2,000 m2) | E2b |

### Should have

| # | Item |
|---|---|
| S1 | How much of the envelope the floor-area budget fills, shown in 3D |
| S2 | Units, sellable area and parking count under editable assumptions |
| S3 | Areas in rai-ngan-wah as well as m2 |
| S4 | Real building heights from Google Open Buildings 2.5D, with error measured against tagged heights |
| S5 | A third design variant (slender tower placed for height) |
| S6 | Shareable link: the scenario encoded in the URL |
| S7 | Road width pre-filled from nearby road data |

### Stretch (only if ahead at T+30h)

| # | Item |
|---|---|
| X1 | FAR bonus settings (rainwater, green building) |
| X2 | Draft 2026 plan as a second plan version |
| X3 | Photo-real 3D tiles toggle |
| X4 | Print or PDF summary |

### Out of scope

Cost, revenue and land value. Height overlays (airports, monuments). Planned road widenings. Waterway setbacks beyond the basic rule. Any zone other than ย.7.

## Timeline

T is hours since start (Thu 14:31 IST). Feature work stops at T+40.

| T | IST | Work | Checkpoint |
|---|---|---|---|
| 0 to 1 | Thu 14:31 to 15:30 | Research, decisions, audit, scaffold, first deploy | **Done.** Live at T+0h43 |
| 1 to 5 | Thu 15:30 to 19:30 | Parallel: geometry core, rules core, site data, interface shell and 3D layer | Unit tests green for setbacks and height plane |
| 5 to 8 | Thu 19:30 to 22:30 | Designs, checks, pipeline wired to the interface | **First full loop deployed** |
| 8 to 12 | Thu 22:30 to Fri 02:30 | Break-list tests, presets, rule switches, area schedule | M1 to M11 working, rough |
| 12 to 14 | Fri 02:30 to 04:30 | **Buffer 1** | |
| 14 to 22 | Fri 04:30 to 12:30 | Rest for Arpit. Unattended work only: test hardening, code review fixes | |
| 22 to 30 | Fri 12:30 to 20:30 | Design polish, mobile, office type end to end, S1 to S3 | All must-haves polished; deploy |
| 30 to 36 | Fri 20:30 to Sat 02:30 | S4 to S7, performance, real-browser pass on laptop and phone | |
| 36 to 40 | Sat 02:30 to 06:30 | **Buffer 2**, then stretch if clear | **Feature freeze at T+40** |
| 40 to 44 | Sat 06:30 to 10:30 | Bug fixes only, README, submission doc skeleton, final deploy | |
| 44 to 46 | Sat 10:30 to 12:30 | Arpit writes the doc. Link checks in a private window. Submit | **Submitted by T+46** |
| 46 to 48 | Sat 12:30 to 14:31 | **Buffer 3.** Resubmit only if something is broken | |

Rule for slips: if a checkpoint is missed by more than 90 minutes, cut from the bottom of should-have and say so in `LOG.md`. Must-haves are never traded for should-haves.

## Architecture

```
 inputs                    state                 pure pipeline (src/core)
 map: draw plot      ->   Scenario        ->    1 project to local metres
 mark road edges          (zustand)             2 validate the plot
 road width                                     3 resolve rules for both regimes
 building type                                  4 envelope: per-edge setbacks + height planes
 assumptions                                    5 designs: floors inside the envelope
                                                6 checks: design against each rule
 rules as data (src/core/rules)                 7 totals, all summed from floors
 value + clause + source + confidence                        |
                                                             v
                                                       Evaluation (one object)
                                   ____________________________|____________________________
                                  |                            |                            |
                            MapLibre map                 three.js layer                side panel
                            roads, real buildings        envelope, designs             rules, checklist,
                                                                                       area schedule
 static data in public/data: buildings, zones, stations, roads (baked offline by data-pipeline/)
```

- `src/core/types.ts` is the contract. Core code has no DOM, map or network access, so it is unit-tested directly.
- Rules are data. Adding a zone, a plan version or a building type is a data change.
- One Evaluation feeds every view, so the picture and the tables cannot disagree.
- Geometry runs on the main thread, debounced while dragging; it can move to a worker if profiling says so.
- Stack: Vite, React, TypeScript, zustand, MapLibre GL JS 6, three.js, terra-draw, Clipper2, Vitest. Static deploy on Cloudflare Workers.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| three.js layer misaligned or z-fighting inside MapLibre | Medium | Spike it first, in the T+1 to 5 block. Fallback: stacked flat extrusions in 1 m steps |
| Per-edge setbacks fail on concave or thin plots | Medium | Test-first against the break list; return "nothing buildable" with a reason instead of bad geometry |
| A legal reading is wrong | Medium | Conservative readings, each visible and adjustable; the rule list is frozen so effort goes to correctness |
| Surrounding buildings look like grey boxes | Medium | S4 real heights; honest labelling either way |
| Design generator produces ugly or failing designs on odd plots | Medium | Designs are built from the envelope itself, so they fit by construction; checks are still run independently |
| No real-browser verification tool in this session | Now | Claude in Chrome not connected. Unit tests cover the core; visual checks wait for the extension |
| Interface polish squeezed at the end | Medium | Polish has its own block at T+22, not the last hours |
| Arpit's write-up time squeezed | Low | Notes collected in `LOG.md` throughout; doc skeleton ready by T+44 |
