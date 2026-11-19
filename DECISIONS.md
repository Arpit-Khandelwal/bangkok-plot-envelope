# DECISIONS

The brief says: "We won't answer any. Make a call and write it down." Each row is an ambiguity, the call, and the reason. Evidence is in `RESEARCH.md` and `research/`.

Status: **made** by the agent on the evidence, pending Arpit's review. Any row can be overturned.

## A. What the brief leaves open

| # | Ambiguity | Call | Why |
|---|---|---|---|
| A1 | "One zone in Bangkok" does not say which. | **ย.7 under the 2013 plan**, in the Bang Chak to Punnawithi area on Sukhumvit Road. | Condos are its intended use. It is the densest zone that still has a size test tied to road width and station distance, so the inputs the brief names (the road, the location) visibly change the answer. Denser zones have no such test. The area is confirmed as ย.7 by two sources. |
| A2 | Which plan: the 2013 one or the 2026 draft? | **2013**, labelled as such, with a note that a draft exists and renumbers the zones. Zone data keyed by plan version. | The 2013 plan is the law today. A developer filing now is judged by it. Keying by version makes the draft a data addition later. |
| A3 | "Its location or zone": does the user pick the zone or does the tool find it? | **The tool reads the zone from where the plot is drawn** and shows it. | Asking a user to know their zone code defeats the purpose. We have a zone map that checks out. |
| A4 | What happens when a plot is drawn outside ย.7? | The tool names the zone it found, says it is outside this tool's coverage, and shows no compliance verdict. | "One zone, done properly." Applying ย.7 numbers silently to another zone would be a wrong answer presented as a right one. |
| A5 | "The road it faces": one road or several? Who supplies the width? | The user marks which plot edges face a road and gives each road's width. The tool suggests a default and labels it an estimate. Corner plots with two roads are supported. | Road width exists in no dataset (4 of 2,610 roads tagged). Misjudged width is a known cause of failed projects, so it must be explicit. |
| A6 | "A building type (for example, a condo)": how many types? | **Condo as the primary type, plus one non-residential type (office)**, subject to reading the ย.7 office rules. | The brief requires that changing the type updates everything, so there must be at least two. Office differs in rules that show (10% open space instead of 30%, different parking rate, different size test). |
| A7 | "At least two designs that fit": what makes two designs meaningfully different? | **One per legal regime**: a low-rise block under 23 m and 10,000 m², and a high-rise tower. A third variant if time allows. | These face different setbacks, access rules and approval paths. Low-rise versus high-rise is the actual choice a Bangkok developer makes, not a cosmetic variation. |
| A8 | "The space the building is allowed to fill": one volume? | **One envelope per regime**, switchable, because the high-rise rules change the setbacks for the whole building. | The law does not define a single volume. Showing one would misstate it. |
| A9 | "Each rule visibly changes it" | Each rule can be switched off to see the volume without it, and the binding rule is named. | The most direct reading of the sentence, and it is how a developer learns which constraint to attack. |
| A10 | "The floor areas add up" | Every design is a list of floors with areas. All totals are sums of that list and are shown in an area schedule. | A reviewer can check the arithmetic by eye. |
| A11 | "Actual buildings and roads around it" when 85% of buildings have no height data. | Real footprints and roads. Known heights used where tagged. Others estimated and visibly marked as estimated. | Honest and fast. Photo-real tiles need a paid key and may not run smoothly on a laptop; considered only as a stretch. |
| A12 | Language | English interface, with Thai terms and clause numbers beside each rule. Areas in m² and in rai-ngan-wah. | The reviewers read English. The user's documents and land titles are in Thai units. |
| A13 | Should the tool use an AI model at runtime? | **No.** Rules are data and geometry is computed. | A legal figure must be repeatable and traceable to a clause. |

## B. Where the law is unclear

The stance throughout: take the conservative reading, say so in the interface, and make it a setting where the reading changes the number.

| # | Ambiguity | Call | Why |
|---|---|---|---|
| B1 | MR 55 and the Bangkok ordinance regulate the same things with different numbers. Which wins? | Apply the stricter. | A design meeting both is legal under either reading. |
| B2 | Does parking floor area count toward FAR? | **Yes by default**, with a setting. | The 2013 text excludes nothing and exempts only extra public parking. |
| B3 | Is the 10,000 m² condo test per building or per plot? | Per plot. | The 2013 text has no "in one building" wording; the draft adds it, which suggests the current text is broader. |
| B4 | Does "on a road at least 30 m wide" also need 30 m of frontage? | Yes, read literally from clause 36(4), and flagged. | No official guidance found. Literal is the safer reading. |
| B5 | "Within 500 m of a station": from where, and any part of the plot or all of it? | Distance from the nearest point of the plot to the station platform geometry. Results within a margin of 500 m are marked "verify on site". | The law measures from the platform boundary. Our station geometry is approximate, so a hard pass or fail near the line would be false precision. |
| B6 | Does the 6 m high-rise setback apply to a low podium? | Yes, the whole building. | The text says the outermost edge of the high-rise building. |
| B7 | Height for the 23 m test versus the 2:1 plane. | Both tracked: roof-deck height for the threshold, highest point for the plane. | The definitions differ in the texts, and the gap is an easy way to break a naive tool. |
| B8 | Base level for height: road or ground? | Treated as the same level. | Bangkok is flat and we have no survey data. Stated as an assumption. |
| B9 | Which FAR bonuses can a condo claim? | Bonus off by default. Rainwater and green-building bonuses as optional settings if time allows. | The base case must be right first. The public-building bonuses probably do not apply to condos. |
| B10 | Efficiency, floor-to-floor height, unit size, parking area per car. | Editable assumptions with stated defaults, shown separately from legal rules. | No authoritative source exists. |
| B11 | Overlays not researched: airport height zones, road-specific no-build strips, planned road widenings. | Out of scope, listed in the tool's limits. | Each needs its own map data. Naming them is more honest than implying coverage. |

## C. How we work

| # | Question | Call | Why |
|---|---|---|---|
| C1 | Where do rules live in the code? | One data file per zone and plan version: value, formula, citation, confidence. | The follow-up call adds "a new requirement on the spot". |
| C2 | Is `BRIEF.md` public? | No. Kept locally, excluded from the repo. | It contains a personal link and is the company's hiring material. |
| C3 | Is the research public? | Yes, in `research/`. | It is the evidence for these decisions. |
| C4 | Who writes the submission? | Arpit writes the reasoning and reflection. The agent supplies facts and notes. | The brief requires it. |
