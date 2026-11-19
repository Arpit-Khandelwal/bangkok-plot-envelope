# Submission skeleton

Copy this into a Google Doc and complete it yourself. The brief says: "The write-up is yours to write. Your agent can submit it, not author it."

Facts are filled in. Every part that is reasoning, reflection or personal is marked `[ARPIT TO WRITE]`, with raw notes underneath. The notes are facts and events with a pointer to where each is recorded. Delete the notes and pointers from the final doc.

Deadline: 21 Nov 2026, 09:01:21 UTC (14:31:21 IST). Submit with dev@arpitkhandelwal.com.

---

## 1. Live link

https://bangkok-plot-envelope.arpit-khandelwal.workers.dev

## 2. Repo

https://github.com/Arpit-Khandelwal/bangkok-plot-envelope (public)

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
- Vite, React 19, TypeScript, zustand, MapLibre GL JS 6, three.js, terra-draw, Clipper2 (clipper2-ts), earcut, Vitest, Playwright (dependency only). Versions in package.json.
- Static site on Cloudflare Workers (wrangler.jsonc, assets from dist/).
- Pure core in `src/core` with no DOM or network. One Evaluation object feeds map, 3D layer and panel. (PLAN.md "Architecture")
- Rules are data, one file per zone and plan version. A second zone (ย.6) was added as data only to test this. (DECISIONS.md C1; LOG.md, 19 Nov 15:50)

How the allowed space is worked out
- One envelope per rule set (low-rise, high-rise). (DECISIONS.md A8)
- Per-edge setbacks by subtracting a strip along each edge at its own distance, because no library does this. (RESEARCH.md section 7)
- Height limit built as an exact mesh from the 2:1 plane from the far side of each road. (RESEARCH.md section 4)
- The geometry core triangulates once and splits triangles directly, because carving with the clipping library left half-millimetre overlaps and an open mesh. Its rounded setback corners sat inside the true arc, so it draws its own that err outward. (LOG.md, 19 Nov 16:08)
- Checks recompute each rule from the design, not from the generator's data. (LOG.md, 19 Nov 17:00)
- Conservative readings are stated in the interface. (DECISIONS.md section B)

Where the site data comes from
- Footprints and roads: Overture Maps 2026-11-18.0. Stations: OpenStreetMap. Zones: third-party GeoJSON derived from BMA's plan map, no licence stated. (public/data/meta.json; data-pipeline/README.md)
- Heights: Google Open Buildings 2.5D Temporal (2023). 95.58% of 28,964 buildings carry a satellite height, 3.76% an estimate. (public/data/meta.json)
- Height error on 191 known buildings: median 3.5 m, mean 8.06 m, 47.6% within one storey. Not better than a constant guess on the median. (meta.json heightEvaluation; data-pipeline/README.md)
- Two other height datasets were downloaded, evaluated and rejected (3D-GloBFP: +32 m bias; GHSL: 100 m cells). (data-pipeline/README.md; LOG.md, 19 Nov 16:00)
- Road width exists in no dataset (4 of 2,610 roads tagged in the first test), so it is user input. (RESEARCH.md section 6; DECISIONS.md A5)

How it was kept smooth
- Buildings baked into 11 spatial chunks under 900 KB each, because the pre-commit hook blocks files over 1 MB. (LOG.md, 19 Nov 15:44; data-pipeline/README.md)
- Timing tests run separately (`pnpm test:perf`): 18 tests pass. They run alone because a budget failed only when 44 other files competed for the CPU. (LOG.md, 19 Nov 17:37)
- Evaluation took about 4 ms, then about 16 ms after floors were cleaned of narrow parts; budget 40 ms. (LOG.md, 19 Nov 19:03)
- Measured cold start before the fix: blank map over 10 s, 5.3 s warm, one 2.2 MB script. Progressive nearest-first loading and code splitting were started. (LOG.md, 19 Nov 19:03) Check the final result yourself before writing about it.
- Camera angle is picked from the real building data to avoid towers blocking the view. (LOG.md, 19 Nov 19:03)

### What's still wrong, and what you'd do next

[ARPIT TO WRITE]

Raw notes from the session:
- One zone only; the 2026 draft plan not implemented. (README.md "Known limits"; DECISIONS.md A2)
- Not checked: road connecting onward, planned road widenings, airport and conservation height overlays, road-specific no-build strips. (DECISIONS.md B11; research/01-regulations.md section 9, items 13 and 17)
- Still lenient or unverified: high-rise fire-road note assumes the road fits; front-access facade length ignores U-shaped outlines; onward road connection not checked. (LOG.md, 19 Nov 17:38)
- 19 items in research/01-regulations.md section 9 could not be verified (for example the 2562 Act's transitional section, whether parking counts in FAR, per-plot versus per-building size test).
- Heights: satellite-derived, towers read about 22 m low, truth set small and biased. (data-pipeline/README.md)
- Zoning data has no stated licence and its boundaries are not official. (meta.json sources.zoning)
- Efficiency, floor-to-floor height, unit size are assumptions with no authoritative source. (DECISIONS.md B10)
- Cost, revenue and land value are out of scope. (PLAN.md "Out of scope")
- No end-to-end test suite; real-browser checks were manual. (README.md "Tests")

## 4. Transcripts

[ARPIT TO WRITE] Links to the transcripts.

The brief asks for two or three raw, unedited transcripts of your first sessions with AI, starting with the one where you connected to the MCP server and started the assignment, through research and planning. Not coding sessions. Link each from the doc, with the short note below above the links.

Note: what did the AI miss, and how did you know it was missing? What made you catch it, and how did you research it?

[ARPIT TO WRITE]

Raw notes from the session (each is a fact with its source):
- The research agent treated "open space" as one rule. It is three rules with different denominators (6% of floor area; 30% of plot; 30% of largest floor). (RESEARCH.md section 8, item 1; section 4)
- The stack research assumed setbacks that step in with height. The law switches the whole building to 6 m setbacks once it is a high-rise, so the allowed space is two envelopes. Found when the main session read the law itself. (RESEARCH.md section 8, item 2; LOG.md, 19 Nov 15:07)
- The brief and research prompt assumed parking is excluded from FAR. The 2013 text excludes nothing. (RESEARCH.md section 8, item 3)
- One agent called the zoning dataset "suspect". The main session found exactly 30 ย.7 and 7 พ.5 polygons, matching the plan's sub-area numbering, and a JLL listing that states ย.7 for a plot 90 m from Punnawithi. (LOG.md, 19 Nov 15:07; RESEARCH.md section 6)
- The regulations agent could not name a real ย.7 neighbourhood. Found by intersecting the zoning dataset with station locations. (LOG.md, 19 Nov 15:07)
- Before trusting the regulations research, the main session downloaded the Gazette text and read clause 14 itself: FAR 5, open space 6%, the 10,000 m2 condo test confirmed. (LOG.md, 19 Nov 15:07)
- Site research sampled central Sukhumvit and reported 15% of buildings with a height. In the study area 99.3% had none. Reported by the site data agent. (LOG.md, 19 Nov 15:44)
- Library compatibility (terra-draw with MapLibre 6) was a feared problem and was not one. MapLibre 6 has no default export and its worker must be bundled explicitly; both found by running the code. (LOG.md, 19 Nov 15:14)
- An independent adversarial review (Opus, not told the author's suspicions) found two "Pass" verdicts on things the research reads as illegal: on corner plots only the widest road limited height (a tower 12.45 m over a soi's limit passed), and office operating area left out the office's own parking. 605 passing tests did not catch them because tests and code shared one reading. (LOG.md, 19 Nov 17:00)
- The same review found frontage measured along a zig-zag, a 1 cm kink capping half a plot, rounding that contradicted verdicts, parking filling whole floors, and Bangkok's front open-space rule never built. (LOG.md, 19 Nov 17:00)
- Before the review, designs over-provided parking (124 stalls where 55 needed); after fixes, 68 for 68 required (was 249 for 25). (LOG.md, 19 Nov 16:43 and 17:37)
- Bugs only a real browser showed: edge markers drifting (an in-place class update wiped the map library's positioning class); a building overlapping the plot hiding the proposal; a 92 m tower blocking the default view; example plots losing their road edge after another plot was loaded (a clear event wrote the old outline back). (LOG.md, 19 Nov 17:43 and 19:03)
- Window resizing did not work in the controlled Chrome window, so narrow widths were tested in same-origin frames. (LOG.md, 19 Nov 17:43)
- The AI declined one instruction with a reason: high-rise designs were asked to come out lower after the height fix, but a slender tower became legally taller by moving to where the limit is 80 m. (LOG.md, 19 Nov 17:37)
- Height evaluation: the first heuristic added no skill over a constant. Satellite heights improved the mean error (14.3 to 8.1 m) but not the median. (LOG.md, 19 Nov 16:00)

## 5. Your setup

Six questions from the brief. Name real tools and real numbers.

**1. What tools, models and agents do you use day to day, and for what?**

[ARPIT TO WRITE]

**2. How do you run them? Parallel sessions, rules files, skills, MCP servers, automations.**

[ARPIT TO WRITE]

Raw notes about THIS session only (not your general setup):
- Parallel subagents on Opus and Sonnet. At least eleven had run by T+1h00 (LOG.md, 19 Nov 15:27). Check the final count yourself.
- Orchestrator pattern: the main session wrote contracts and briefs, reviewed and integrated; agents implemented. You asked for this at T+1h00. (LOG.md, 19 Nov 15:27)
- Research split: regulations on Opus, site data, 3D stack and market on Sonnet. (LOG.md, 19 Nov 14:32)
- Agents were confined to their own directories and worked test-first. (LOG.md, 19 Nov 15:19)
- The assignment was started through the General Machines MCP server. The agent refused to start the clock until you gave an explicit yes and a real email. (LOG.md, 19 Nov 14:25)
- Claude in Chrome was used for browser verification (LOG.md, 19 Nov 17:43). Earlier you asked for it instead of Playwright (LOG.md, 19 Nov 15:16).
- A pre-commit hook of yours blocks files over 1 MB; it was not bypassed. (LOG.md, 19 Nov 15:44)
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
- [ ] Keep the receipt ID. Confirm with `check_submission`. Write it in PLAN.md.
- [ ] Check `time_left` before submitting. You can resubmit until the deadline; the latest one is read.
