# Submission skeleton

Copy this into a Google Doc and complete it yourself. The brief says: "The write-up is yours to write. Your agent can submit it, not author it."

Facts are filled in. Every part that is reasoning, reflection or personal is marked `[ARPIT TO WRITE]`, with raw notes underneath. The notes are facts and events with a pointer to where each is recorded. Delete the notes and pointers from the final doc.

Deadline: 21 Nov 2026, 09:01:21 UTC (14:31:21 IST). Submit with dev@arpitkhandelwal.com.

---

## 1. Live link

https://buildable-bangkok.arpit-khandelwal.workers.dev

## 2. Repo

https://github.com/Arpit-Khandelwal/buildable-bangkok (public)

## 3. One-pager

**Reminder: this part must fit one page of the doc.**

### What you understood

[ARPIT TO WRITE]

Raw notes from the session:
- The user is a developer's land or business-development person deciding if a plot is worth pursuing. The question is yield. (RESEARCH.md section 1)
- Failure modes found in research: road width misjudged, narrow frontage blocking a high-rise, thresholds found late (23 m, 10,000 m2, EIA). (RESEARCH.md section 1)
- No existing tool covers Bangkok. (RESEARCH.md section 1; research/04-users-market.md)
- Rules sit in several documents: Plan 2556, MR 55, MR 33, BMA ordinance 2544, MR 7. Which wins clause by clause was not confirmed, so the stricter value is applied. (RESEARCH.md section 2; DECISIONS.md B1)
- The 2013 plan is in force. A 2026 draft renumbers every zone (2013 ย.7 is FAR 5, draft ย.7 is FAR 4). (RESEARCH.md section 2)
- The allowed space is not one volume: crossing 23 m or 10,000 m2 switches the whole building to 6 m setbacks. (LOG.md, 19 Nov 15:07)

### What you did, and why

[ARPIT TO WRITE]

Raw notes from the session:
- Chose zone ย.7 under the 2013 plan, near BTS Bang Chak and Punnawithi. Reason on record: condos are its intended use, and it has a size test tied to road width and station distance. (DECISIONS.md A1)
- Chose building types condo and office. (DECISIONS.md A6)
- Two designs, one per rule set (low-rise, high-rise). (DECISIONS.md A7, A8)
- Direction picked at T+0h40: a rule-traceable envelope plus the arithmetic of a yield calculator. Three directions were presented. (LOG.md, 19 Nov 15:08; PLAN.md "Direction")
- Four parallel research agents were launched at T+0h01, before any file was written. (LOG.md, 19 Nov 14:32)
- No AI model runs inside the tool. (DECISIONS.md A13)
- Outside zone ย.7 the tool shows the zone and no verdict. (DECISIONS.md A4)
- Each rule can be switched off to see its effect. (DECISIONS.md A9)
- Eight example plots on real blocks, each tested to be in ย.7 and on the intended side of the 500 m line. (LOG.md, 19 Nov 16:20)
- Shareable link, road width pre-filled from road data, and a pass in a real browser were done. (LOG.md, 19 Nov 19:03)

### Technical decisions, and why

[ARPIT TO WRITE]

Raw notes from the session:

The stack
- Vite, React 19, TypeScript, zustand, MapLibre GL JS 6, three.js, terra-draw, Clipper2 (clipper2-ts), earcut, Vitest. Versions in package.json. No Playwright dependency; browser checks were manual.
- Static site on Cloudflare Workers (wrangler.jsonc, assets from dist/). Response headers in public/_headers, including a content security policy verified on the deployed site. (LOG.md, 19 Nov 22:50)
- Pure core in `src/core` with no DOM or network. One Evaluation object feeds map, 3D layer and panel. (PLAN.md "Architecture")
- Rules are data, one file per zone and plan version. A second zone (ย.6) was added as data only to test this. (DECISIONS.md C1; LOG.md, 19 Nov 15:50)
- Unclear readings are three settings in one table, `src/core/readings.ts`. A looser reading raises a notice and every Pass reads "Passes under this reading". (DECISIONS.md B15; LOG.md, 20 Nov 00:19)

How the allowed space is worked out
- One envelope per rule set (low-rise, high-rise). (DECISIONS.md A8)
- Per-edge setbacks by subtracting a strip along each edge at its own distance, because no library does this. (RESEARCH.md section 7)
- Height limit built as an exact mesh from the 2:1 plane from the far side of each road. Every road applies unless the plot verifiably meets the 60 m conditions. (src/core/rules/height-roads.ts; LOG.md, 19 Nov 17:00)
- The geometry core triangulates once and splits triangles directly, because carving with the clipping library left half-millimetre overlaps and an open mesh. Its rounded setback corners sat inside the true arc, so it draws its own that err outward. (LOG.md, 19 Nov 16:08)
- Checks recompute each rule from the design, not from the generator's data. (LOG.md, 19 Nov 17:00)
- Front open space: designs are generated in two lawful forms, on the road (clause 53) and set back (clause 52(6)), and the one with more floor area is offered. (DECISIONS.md B12; LOG.md, 20 Nov 00:19)
- High-rise plates shrink until the fire road and the planting both fit; a design that cannot fit both is not offered. (DECISIONS.md B14; LOG.md, 19 Nov 23:41)
- Floor parts narrower than 8 m (6 m for parking) are removed. (LOG.md, 19 Nov 19:03)
- Conservative readings are stated in the interface. (DECISIONS.md section B)

Where the site data comes from
- Footprints and roads: Overture Maps 2026-11-18.0. Stations: OpenStreetMap. Zones: third-party GeoJSON derived from BMA's plan map, no licence stated. (public/data/meta.json; data-pipeline/README.md)
- Heights: Google Open Buildings 2.5D Temporal (2023). 95.58% of 28,964 buildings carry a satellite height, 3.76% an estimate. (public/data/meta.json)
- Height error on 191 known buildings: median 3.5 m, mean 8.06 m, 47.6% within one storey. Not better than a constant guess on the median. (meta.json heightEvaluation)
- Two other height datasets were downloaded, evaluated and rejected (3D-GloBFP: +32 m bias; GHSL: 100 m cells). (data-pipeline/README.md; LOG.md, 19 Nov 16:00)
- Road width exists in no dataset (4 of 2,610 roads tagged in the first test), so it is user input; the starting value is estimated from road class or lanes and labelled. (RESEARCH.md section 6; DECISIONS.md A5; LOG.md, 19 Nov 19:03)

How it was kept smooth
- Buildings baked into 11 spatial chunks under 900 KB each, loaded nearest first. (public/data/buildings/index.json; LOG.md, 19 Nov 19:39)
- Measured cold on the live site: first paint 5.2 s to 0.76 s; all surrounding buildings 6.0 s to 3.5 s; layout shift 0; entry script 144 KB gzip. The first round of fixes only moved the bottleneck; a second round (static page shell, non-blocking fonts, map library as its own chunk) fixed it. (LOG.md, 19 Nov 19:39)
- Evaluation took about 4 ms, then about 16 ms after floors were cleaned of narrow parts; budget 40 ms. Not re-measured after the second building form was added (machine busy with another project). (LOG.md, 19 Nov 19:03 and 20 Nov 00:19)
- Timing tests run separately with `pnpm test:perf`, because a budget failed only when 44 other files competed for the CPU. (LOG.md, 19 Nov 17:37)
- Camera angle is picked from the real building data to avoid towers blocking the view. (LOG.md, 19 Nov 19:03)

### What's still wrong, and what you'd do next

[ARPIT TO WRITE]

Raw notes from the session (from the README "Known limits" list):
- One zone only (ย.7). The 2026 draft plan is not implemented. (DECISIONS.md A2)
- Not verifiable by the tool: the road connecting onward to another public road, planned road widenings, airport and conservation height overlays. (DECISIONS.md B11)
- The layout of the fire road, the planting and the front open space is not drawn; they are checked by area or outline only. (DECISIONS.md B12, B14)
- Legal readings that are ours and not settled: DECISIONS.md section B (B2 to B4, B6, B12, B13, B16). 19 open items in research/01-regulations.md section 9.
- Road width is the user's input. (DECISIONS.md A5)
- Heights are satellite-derived; towers over 60 m read about 22 m low; the truth set is small and biased. (public/data/meta.json heightEvaluation)
- Surrounding buildings exist only in the study area. (public/data/meta.json study)
- Efficiency, floor-to-floor height, unit size, parking area per car are assumptions, not law. (DECISIONS.md B10)
- Browser checks were manual; no automated end-to-end suite. No screen-reader or forced-colours session was run. (README.md "Tests", "Accessibility")
- The set-back design is not tried when the on-road one is within 1% of the floor-area limit, so one up to 1% larger can be missed. (src/core/pipeline/run.ts)
- Plates only shrink evenly (narrow parts cut), so a narrow plot may get no high-rise where a shorter tower would fit. (src/core/designs/stack.ts)
- Per-evaluation timing was not re-measured after the second form was added. (LOG.md, 20 Nov 00:19)
- Zoning data has no stated licence and its boundaries are not official. (meta.json sources.zoning)
- Cost, revenue and land value are out of scope; stretch items X1 to X4 not done. (PLAN.md)

## 4. Transcripts

[ARPIT TO WRITE] Links to the transcripts.

The brief asks for two or three raw, unedited transcripts of your first sessions with AI, starting with the one where you connected to the MCP server and started the assignment, through research and planning. Not coding sessions. Link each from the doc, with the short note below above the links.

Note: what did the AI miss, and how did you know it was missing? What made you catch it, and how did you research it?

[ARPIT TO WRITE]

Raw notes from the session (each is a fact with its source), grouped by how it was caught:

(a) Caught by reading the primary legal text
- The research treated "open space" as one rule. It is three rules with different denominators (6% of floor area; 30% of plot; 30% of largest floor). (RESEARCH.md section 8, item 1; section 4)
- The stack research assumed setbacks that step in with height. The law switches the whole building to 6 m setbacks once it is a high-rise, so there are two envelopes. Found when the main session read the law itself. (RESEARCH.md section 8, item 2; LOG.md, 19 Nov 15:07)
- The brief and research prompt assumed parking is excluded from FAR. The 2013 text excludes nothing. (RESEARCH.md section 8, item 3)
- The main session downloaded the Gazette text and read clause 14 before trusting the regulations research. FAR 5, open space 6% and the 10,000 m2 condo test were confirmed. (LOG.md, 19 Nov 15:07)
- One agent called the zoning dataset "suspect". The main session found exactly 30 ย.7 and 7 พ.5 polygons, matching the plan's sub-area numbering, and a JLL listing for a plot 90 m from Punnawithi. (LOG.md, 19 Nov 15:07; RESEARCH.md sections 6 and 8, item 4)
- The regulations agent could not name a real ย.7 neighbourhood. Found by intersecting the zoning dataset with station locations. (RESEARCH.md section 8, item 5; LOG.md, 19 Nov 15:07)
- Office rules had not been researched when the building type was required to be changeable. Read from the Gazette text. (RESEARCH.md section 8, item 7; LOG.md, 19 Nov 15:17)
- The second review's finding on front open space (tall buildings passing by a route the research said was not open to them) sent the main session to the Thai text of clauses 52(6), 53 and 52(3). The agent had read 52(6) strictly and reserved 12 m on every plot. The main session overrode that with reasons from the sibling clause. (LOG.md, 19 Nov 22:52 and 23:41; DECISIONS.md B12)

(b) Caught by an independent reviewer agent given the code but not the orchestrator's suspicions
- Round one (Opus, 19 Nov 17:00). (LOG.md, 19 Nov 17:00)
  - On corner plots only the widest road limited height. The law allows that only when the building runs 60 m or less along the narrower road. A tower 12.45 m over a soi's limit passed. The checklist could not catch it because it read the same list of planes the generator used.
  - Office operating area left out the office's own parking.
  - Frontage measured along a zig-zag instead of along the road.
  - A 1 cm kink capped half a plot.
  - Rounding contradicted verdicts.
  - Parking filled whole floors (124 stalls where 55 needed).
  - Bangkok's front open-space rule was researched but never built.
  - 605 passing tests did not catch these, because tests and code shared one reading.
- Round two (Opus, 19 Nov 22:52). (LOG.md, 19 Nov 22:52)
  - A high-rise marked passing while its own check said the fire road left 0 m2 for required planting.
  - Tall buildings passing the front open-space rule by a route the research said was not open to them.
  - Switching "parking counts toward FAR" off survived Start over and example loads, giving the next plot nearly double the legal floor area with no what-if banner.
  - A zone pocket inside a large plot was missed.
  - The EIA test used sellable instead of usable area.
  - The road-width suggestion could pick a far main road.
- Before the first review, the main session had listed known weak points: parking over-provided, no design on a 150 m2 plot, parapet applied to every stepped floor. (LOG.md, 19 Nov 16:43)

(c) Caught by looking at the deployed page in a real browser while all tests passed
- Edge markers drifted off their edges on hand-drawn plots. Cause: an in-place class update wiped the map library's own positioning class. (LOG.md, 19 Nov 17:43 and 19:03)
- An existing building overlapping the plot swallowed the proposal. (LOG.md, 19 Nov 17:43)
- Neighbouring towers (a 92 m tower) blocked the default view. (LOG.md, 19 Nov 17:43 and 19:03)
- The design read as a grey-blue haze, three designs squeezed the comparison table, the road prompt showed twice, and the attribution covered the zoom buttons. (LOG.md, 19 Nov 17:43)
- Example plots loaded after another plot lost their road edge. A clear event wrote the old outline back over the new plot. (LOG.md, 19 Nov 19:03)
- The flag-shaped plot produced a 3 m wide sliver of building. (LOG.md, 19 Nov 19:03)
- Blank map after the first-paint change: the map library's stylesheet loaded after ours and its `position: relative` overrode our sizing rule, leaving the map container at zero height. All 1,038 tests passed. (LOG.md, 19 Nov 19:39)
- Slow first paint moved rather than disappeared: round one of the load-time fix left a blank screen until the 449 KB entry script landed; measuring showed the bottleneck had only moved. (LOG.md, 19 Nov 19:39)
- Deep narrow plots were under-reported: a legal result that no developer would accept (3,524 m2 where 5,801 m2 was lawful in the set-back form). (LOG.md, 20 Nov 00:19)
- Window resizing did not work in the controlled Chrome window, so narrow widths were tested in same-origin frames. (LOG.md, 19 Nov 17:43)
- Also found by running code: MapLibre 6 has no default export and its web worker must be bundled explicitly. The feared terra-draw incompatibility did not exist. (LOG.md, 19 Nov 15:14)

(d) Caught by measuring instead of trusting a report
- Site research sampled central Sukhumvit and reported 15% of buildings with a height. The site data agent measured the study area: 99.3% had none. (LOG.md, 19 Nov 15:44)
- Height dataset evaluation against 191 buildings with known heights: mean error fell from 14.3 m to 8.1 m, but the median was no better than a constant guess. Two other datasets were evaluated and rejected. (LOG.md, 19 Nov 16:00; public/data/meta.json heightEvaluation)
- Cold load time measured on the live site: first paint 5.2 s to 0.76 s, all buildings 6.0 s to 3.5 s. Before the fix: blank map over 10 s, 5.3 s warm, one 2.2 MB script. (LOG.md, 19 Nov 19:03 and 19:39)
- Timing budget for 500 corners failed only when 44 other test files competed for the CPU. (LOG.md, 19 Nov 17:37)
- The agent's heuristic for heights added no skill over a constant. (LOG.md, 19 Nov 15:44)
- Accessibility audit with contrast computed from the tokens found no failing text pair, but a plot could only be drawn with a pointer. (LOG.md, 19 Nov 19:45)

(e) Changed by Arpit's own direction
- Asked for the architecture and decisions before building. (LOG.md, 19 Nov 14:50)
- Accepted the recommended direction and asked for an independent audit and for building to start with model-appropriate subagents. (LOG.md, 19 Nov 15:08)
- Said to use Claude in Chrome, not Playwright. (LOG.md, 19 Nov 15:16)
- Said to act as orchestrator and keep subagents on opus, sonnet or haiku. (LOG.md, 19 Nov 15:27)
- Named the product "Buildable: Bangkok edition". (LOG.md, 19 Nov 16:55)
- His pre-commit hook blocking files over 1 MB shaped the building data into chunks. (LOG.md, 19 Nov 15:44)
- Paused the session for a restart so Claude in Chrome could connect. (LOG.md, 19 Nov 17:38)
- Other cases where an agent was wrong or declined are in LOG.md: an agent declined the instruction to make high-rise designs lower after the height fix, with a reason (19 Nov 17:37); the main session overrode an agent's strict reading of clause 52(6) with reasons (19 Nov 23:41).

## 5. Your setup

Six questions from the brief. Name real tools and real numbers.

**1. What tools, models and agents do you use day to day, and for what?**

[ARPIT TO WRITE]

**2. How do you run them? Parallel sessions, rules files, skills, MCP servers, automations.**

[ARPIT TO WRITE]

Raw notes about THIS session only (not your general setup):
- Subagents on Opus and Sonnet: 32 launched in this session up to the final documentation pass (T+9h50), 13 on Opus and 19 on Sonnet, none on Haiku. Count taken from the orchestrator's own launch record in the session transcript; LOG.md describes each. Opus: regulations research, direction audit, geometry core, rules engine, interface, pipeline integration, first adversarial review, its fixes, map and 3D fixes, narrow-floor removal, load-time work, second adversarial review, its fixes. Sonnet: the three other research threads, office rules, site data, zone and station lookup, building heights, example plots, and the interface, layout, accessibility, link, polish and documentation passes.
- Orchestrator pattern: the main session wrote contracts and briefs, reviewed and integrated; agents implemented. You asked for this at T+1h00. (LOG.md, 19 Nov 15:27)
- Research split: regulations on Opus, site data, 3D stack and market on Sonnet. (LOG.md, 19 Nov 14:32)
- Agents were confined to their own directories and worked test-first. (LOG.md, 19 Nov 15:19)
- Two independent reviews (Opus), given the code and not the main session's suspicions. (LOG.md, 19 Nov 17:00 and 22:52)
- The assignment was started through the General Machines MCP server. The agent refused to start the clock until you gave an explicit yes and a real email. (LOG.md, 19 Nov 14:25)
- Claude in Chrome was used for browser verification (LOG.md, 19 Nov 17:43). Earlier you asked for it instead of Playwright (LOG.md, 19 Nov 15:16).
- A pre-commit hook of yours blocks files over 1 MB; it was not bypassed. (LOG.md, 19 Nov 15:44)
- A network outage of about three hours killed three running tasks; two agents were resumed from their transcripts. (LOG.md, 19 Nov 22:50)
- Cloudflare deploy through wrangler. (wrangler.jsonc)

**3. Roughly how many tokens, or how much money, do you spend a month?**

[ARPIT TO WRITE]

**4. What's the most ambitious thing you've built mostly with AI? Add a link. Where did the AI break?**

[ARPIT TO WRITE]

**5. How do you get up to speed on a codebase or domain you've never seen?**

[ARPIT TO WRITE]

**6. Have you worked with 3D, vision, diffusion, local or open-source models? Say what you did.**

[ARPIT TO WRITE]

## 6. Your best project

[ARPIT TO WRITE] One link to the most complete project you have owned end to end, and a line on which parts were yours.

## 7. About you

**Who you are** (a few lines on what you have done so far and what you are doing now):

[ARPIT TO WRITE]

**Your links** (résumé, LinkedIn, GitHub, portfolio or personal site):

[ARPIT TO WRITE]

**Projects** (anything else you have built that you want them to see):

[ARPIT TO WRITE]

**Anything else** (optional):

[ARPIT TO WRITE]

---

## Pre-submission checklist

- [ ] Live link, repo, the doc and your résumé all open without a sign-in, checked in a private window. The server opens these four links and rejects the submission otherwise.
- [ ] The live and repo links in the doc are the same as the ones in the `submit_application` call.
- [ ] Submit with the same email as at the start: dev@arpitkhandelwal.com.
- [ ] All seven parts are in the doc, in order.
- [ ] The one-pager fits one page.
- [ ] Each transcript link is viewable by anyone with the link.
- [ ] You wrote the write-up yourself. The agent may submit it, not author it.
- [ ] Decide whether to rename the URL and repository before the links go into the doc.
- [ ] Keep the receipt ID. Confirm with `check_submission`. Write it in PLAN.md.
- [ ] Check `time_left` before submitting. You can resubmit until the deadline; the latest one is read.
