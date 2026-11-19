# LOG

Running record of key decisions and pivots. Times in IST. T+ is time since the clock started (19 Nov 2026, 14:31 IST).

| When (IST) | T+ | Entry |
|---|---|---|
| 19 Nov 14:25 | pre | Read `get_assignment`. The real brief is hidden until the clock starts, so no pre-planning was possible. Agent refused to start until an explicit yes and a real email were given (the prompt carried an `<EMAIL>` placeholder). |
| 19 Nov 14:31 | 0h00 | Clock started. Brief revealed: Bangkok plot feasibility tool (rules, 3D envelope, two or more designs with checklists, real 3D site, live updates). One zone, done properly. |
| 19 Nov 14:32 | 0h01 | Launched four parallel research agents before writing any files, because research has the longest latency. Split by independence: (1) regulations, on opus, since a wrong number breaks the "accurate" criterion; (2) site and zoning data sources, sonnet, told to test endpoints with real requests; (3) 3D stack and geometry algorithms, sonnet; (4) users, workflow, competitors, Silicon Bricks, sonnet. Each writes its own file under `research/` and must tag claims as verified or not. |
| 19 Nov 14:34 | 0h03 | `BRIEF.md` kept out of the public repo: it contains a personal brief link, and the brief is the company's hiring material. `REQUIREMENTS.md` quotes the lines we need. |
| 19 Nov 14:34 | 0h03 | Noted from the brief: the follow-up call will "take a new requirement on the spot". So rules must live as data in one place, and the write-up reasoning must be Arpit's own. |
| 19 Nov 14:36 | 0h05 | Public repo created: github.com/Arpit-Khandelwal/bangkok-plot-envelope (working name). First push failed because the machine's SSH key belongs to another GitHub account; fixed by using HTTPS plus the `gh` credential helper for this repo only. |
| 19 Nov 14:37 | 0h06 | Market research back. Silicon Bricks looks India-first and its "Concept" stage is this assignment. No existing tool covers Bangkok. |
| 19 Nov 14:39 | 0h08 | Stack research back: MapLibre plus a three.js layer; per-edge setbacks need a strip-subtraction method because no library does them. Versions were read, not run, so compatibility is a day-one spike. |
| 19 Nov 14:50 | 0h19 | Arpit asked for the architecture and decisions before building. Wrote the pipeline design: rules as data, one pure pipeline, one Result that the 3D view, checklist and area table all read. |
| 19 Nov 14:55 | 0h24 | Site data back. Only about 15% of Bangkok buildings have height data, and road width is tagged on 4 of 2,610 roads. So: road width is user input, and surrounding heights are estimated and labelled. |
| 19 Nov 15:03 | 0h32 | Regulations research back (opus, 30 min, read the Thai Gazette texts). Recommends zone ย.7 under the 2013 plan. Found that parking counts toward FAR, against the common assumption, and that the 2026 draft renumbers every zone. |
| 19 Nov 15:07 | 0h4x | Main-session checks before trusting the research. (1) Downloaded the Gazette text independently and read clause 14: FAR 5:1, open space 6%, the 10,000 m² condo test all confirmed. (2) The agent could not name a real ย.7 neighbourhood. Found one by intersecting the zoning dataset with station locations (Bang Chak, Punnawithi), then confirmed with a JLL land listing. (3) The dataset one agent called "suspect" has exactly 30 ย.7 and 7 พ.5 polygons, matching the plan's sub-area numbering. |
| 19 Nov 15:07 | 0h4x | Key insight from reading the law myself: the allowed space is not one volume. Crossing 23 m or 10,000 m² switches the whole building to 6 m setbacks. So there are two envelopes, and "two designs" should be one per regime (low-rise versus high-rise), which is the developer's real choice. The stack research had assumed setbacks that step with height. |
| 19 Nov 15:07 | 0h4x | Wrote RESEARCH.md and DECISIONS.md (28 calls). Open: ย.7 rules for a second building type. |
