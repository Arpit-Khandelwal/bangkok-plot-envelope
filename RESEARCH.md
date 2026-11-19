# RESEARCH

Synthesis of four parallel research threads, run 19 Nov 2026. The detail, clause references and every source URL are in `research/`:

| File | Covers |
|---|---|
| `research/01-regulations.md` | The legal stack, every rule with clause and confidence tag, conflicts, pseudo-code, 19 unverified items |
| `research/02-site-data.md` | Buildings, roads, zoning map, transit, basemap. Commands run and results |
| `research/03-tech-stack.md` | Rendering, drawing and geometry options |
| `research/04-users-market.md` | Users, workflow, terms of art, existing tools, Silicon Bricks |

Confidence tags used below: **V** read in the official text, **C** corroborated by two or more sources or inferred from verified text, **U** unverified assumption.

## 1. The user and the problem

- The user is a developer's land or business-development person, or a small landowner, deciding whether a plot is worth pursuing before paying an architect. The question is yield: how much floor area, how many storeys, roughly how many units.
- The known failure modes are concrete: road width misjudged, a narrow frontage that blocks a high-rise, and thresholds discovered late (23 m, 10,000 m², the EIA trigger). Condos on a soi narrower than 10 m often cannot reach their full FAR. (C, `04`)
- No existing tool covers Bangkok. TestFit, Giraffe, Deepblocks, Archistar and Gridics target the US, Australia and Canada. The Thai tool FEASY checks zone colour but does not appear to compute a volume. Deepblocks' habit of tracing each number to its ordinance is the credibility pattern worth copying. (C, `04`)
- Silicon Bricks (siliconbricks.co) sells software by project stage. Its "Concept" stage, testing designs on your land with a first cost, is this assignment. Its one named customer is in West Bengal; the site does not mention Thailand. (V for what the site says, `04`)

## 2. Which rulebook applies

- **The Bangkok Comprehensive Plan B.E. 2556 (2013) is in force.** Its own clause 1 says "five years", but the City Planning Act B.E. 2562 keeps it alive until a new plan is enacted. (C: we did not read the Act's section itself.)
- **The 4th revision is a draft.** Its 90-day public posting ran 10 Aug to 9 Nov 2026. Enactment is forecast for late 2027. (V for the posting dates, C for the forecast.)
- **The draft renumbers every zone.** 2013 "ย.7" is FAR 5 / OSR 6%. Draft "ย.7" is FAR 4 / OSR 9%. Any tool must say which plan version it applies.
- Building-control rules stack on top of the plan: Ministerial Regulation 55 (setbacks, height), Ministerial Regulation 33 (high-rise and extra-large buildings), the Bangkok building ordinance B.E. 2544 (Bangkok's own setbacks, open space, parking), and MR 7 / MR 41 (parking). Which wins clause by clause was not confirmed, so the tool applies the stricter value.

## 3. The chosen zone: ย.7 (2013 plan)

Orange, medium-density residential inside the mass-transit service area. Chosen because condos are its intended use and its rules interact, so inputs visibly change the answer.

| Rule | Value | Source | Tag |
|---|---|---|---|
| FAR | max 5:1 | Plan 2556 clause 14(1) | V, re-checked by hand |
| OSR | open space at least 6% of total floor area | clause 14(2) | V, re-checked by hand |
| Permeable planting | at least 50% of that open space | clause 14(2) | V |
| Condo over 10,000 m² | only on a public road at least 30 m wide, or within 500 m of a mass-transit station | clause 14(11) | V, re-checked by hand |
| "On a 30 m road" also needs | a plot side at least 30 m long on that road | clause 36(4) | V text, U interpretation |
| Station distance measured from | the platform boundary | clause 37 | V |
| FAR bonus | capped at +20% in total. A condo can probably use only the affordable-housing, rainwater and green-building bonuses | clauses 52, 55, 56, 57 | V text, U scope |
| Height limit in the plan | none for this zone | clauses 8 to 22 | V |

"Re-checked by hand" means the main session downloaded the Gazette text independently and read clause 14, separately from the research agent.

At FAR 5 the 10,000 m² limit bites on any plot over 2,000 m², so station distance and road width change the answer for most real condo plots.

## 4. Building-control rules that shape the volume

**Two regimes.** This is the central finding for the product.

| | Low-rise regime | High-rise or extra-large regime |
|---|---|---|
| Applies when | roof deck under 23 m **and** floor area under 10,000 m² | roof deck 23 m or more, **or** floor area 10,000 m² or more (MR 33 clause 1) |
| Side and rear setback | 2 m up to 9 m tall, 3 m above, for walls with openings (MR 55 cl. 50, BMA cl. 54) | **6 m from every boundary and road, for the whole building including podium and basement** (MR 33 cl. 4) |
| Road access needed | ordinary | a plot side of at least 12 m on a road at least 10 m wide; 18 m wide above 30,000 m² (MR 33 cl. 2) |
| Extra | | 6 m open fire road around the building (cl. 3); open space at least 30% of the plot (cl. 6); FAR at most 10 (cl. 5) |

All V. The whole-building reading of the 6 m rule is the literal text; how officials apply it to low podiums is U.

**Road setback** (MR 55 cl. 41, BMA cl. 50; V). From the plot's road edge, for a condo:

| Road width (right of way) | Setback |
|---|---|
| under 10 m | 6 m from the road **centreline** |
| 10 to 20 m | one tenth of the road width, from the road boundary |
| over 20 m | 2 m from the road boundary |
| any, if high-rise or extra-large | at least 6 m |

**Height** (MR 55 cl. 44 to 46, BMA cl. 49; V). At any point, height may not exceed twice the horizontal distance to the far side of the nearest public road. This is a plane sloping up at 2:1 away from the road, not one number. On a 10 m soi with a 6 m setback the front face may rise 32 m. At corners and between two roads up to 60 m apart, the wider road governs.

**Two different heights.** The 23 m threshold is measured to the roof-deck floor. The 2:1 plane is measured to the highest part. A building with a 22.9 m roof deck and a 3 m parapet is not a high-rise but still has to clear the plane.

**Open space: three different rules, apply the largest.**
- Plan OSR: 6% of total floor area.
- BMA cl. 52 and MR 33 cl. 6: 30% of the plot, for residential (10% for non-residential).
- MR 55 cl. 33: 30% of the largest floor.

At full FAR these roughly coincide (6% x 5 = 30% of the plot). With a FAR bonus the plan OSR becomes the binding one. No document sets a maximum building coverage; it is derived from the open-space rules.

**Waterways** (MR 55 cl. 42; V): 3 m from a canal under 10 m wide, 6 m otherwise.

## 5. Condo specifics

- **Parking** (BMA cl. 83 to 91, MR 7, MR 41; V): one space per unit of 60 m² or more, or one per 120 m² of floor area, whichever is greater. Stalls 2.4 x 5.0 m, aisle 6 m.
- **Parking counts toward FAR under the 2013 plan** (C, by inference). The definitions exclude nothing, and clause 54 exempts only *extra public* parking, which only makes sense if ordinary parking counts. This runs against a common assumption.
- **Minimum unit** 20 m²; **floor-to-floor** at least 2.6 m (MR 55 cl. 19, 22; V).
- **EIA** needed at 80 units or 4,000 m² of usable area (C: from the environment agency's page; the announcement's table could not be read). It does not change the volume, only the approval time.
- **Developer norms** (efficiency 60 to 70%, floor-to-floor about 3 m, unit sizes): U. No authoritative source. These are editable assumptions in the tool, never presented as law.

## 6. Site data

| Need | Source | Finding | Tag |
|---|---|---|---|
| Surrounding buildings | Overture Maps (includes OpenStreetMap) | Good footprint coverage: 15,459 buildings in a 3.8 x 2.8 km Sukhumvit test box | V, tested |
| Building heights | same | Only about 15% carry a height or storey count. The rest must be estimated | V, tested |
| Road width | none | Tagged on 4 of 2,610 roads. Must be user input | V, tested |
| Zoning map | community GeoJSON derived from a BMA map service | 498 polygons with zone codes only. No official endpoint was reachable. Licence unclear | V that it exists; provenance C |
| Transit stations | OpenStreetMap | 217 stations, all lines | V, tested |
| Parcels | none | No open API. The user draws the plot | C |
| Basemap | OpenFreeMap | No key, Thai and English labels | V, tested |
| Photo-real 3D | Google 3D Tiles | Needs a billing key; quality over Bangkok untested; terms forbid deriving geometry | C |

**Checks on the zoning dataset made in the main session:**
- It contains exactly 30 polygons for ย.7 and 7 for พ.5, matching the plan's own sub-area numbering (ย.7-1 to ย.7-30, พ.5-1 to พ.5-7). Two independent sources agree.
- It places BTS Punnawithi inside ย.7. A JLL land listing for a plot on Sukhumvit 101, 90 m from that station, independently states "Orange, Yor. 7 (FAR 5:1)". Source: https://invest.jll.com/hk/en/listings/land/freehold-land-on-sukhumvit-rd-sukhumvit-101
- It contains some junk sliver polygons and at least two with coordinates far outside Bangkok. These need cleaning.

**Study area:** the ย.7 area around BTS Bang Chak (E10) and Punnawithi (E11) on Sukhumvit Road. About 3.5 km², two stations, a wide main road and narrow sois, so every rule can be exercised on real ground.

## 7. Technology

- MapLibre GL JS for the map and surrounding buildings, with a three.js layer for the envelope and designs, because map extrusions can only be flat-topped and the height limit slopes.
- terra-draw for drawing and editing the plot.
- No library offers a different setback per edge. The method is to subtract a strip along each edge at that edge's own distance.
- The height limit is the lowest of a few planes, so it can be built as an exact mesh.
- Geometry in local metres on a projection centred on the plot.
- Library versions were read from package registries, not run. Compatibility of terra-draw with the newest MapLibre is untested.

## 8. What the research got wrong or left open

Kept as a list because the submission asks what the AI missed.

1. **The first research brief treated "open space" as one rule.** It is three rules with different denominators (section 4).
2. **The envelope is not one volume.** The stack research proposed setbacks that step in with height. The law instead switches the whole building to 6 m setbacks once it is a high-rise. So there are two envelopes, one per regime, and the choice between them is the developer's real decision.
3. **The brief's and the research prompt's assumption that parking is excluded from FAR** is not supported by the 2013 text.
4. **One agent called the zoning dataset "suspect"** for placing Thong Lo and Ari in ย.10. The sub-area counts and the JLL listing suggest the dataset is sound. Thong Lo itself was not separately checked.
5. **The regulations agent could not name any real ย.7 neighbourhood.** Resolved in the main session by combining the dataset with station locations, then confirming with a second source.
6. **Still open:** the 19 items in `research/01-regulations.md` section 9. The ones that affect numbers are handled as stated calls in `DECISIONS.md`.
7. **Not researched yet:** the ย.7 rules for a second building type (office or hotel), needed because the brief requires the building type to be changeable.
