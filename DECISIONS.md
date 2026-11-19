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
| B12 | Bangkok ordinance ข้อ 52(6) and ข้อ 53: does a building on a public road need the 12 m front open space, or only the clause 53 road-facing façade? | **Default: the 52(6) front open space is for buildings not on a public road; a building on a public road is governed by clause 53** (its road-side building line longer than one eighth of its perimeter and within 20 m of the road), pass or fail. The stricter reading, 52(6) for every building over 2 storeys or 8 m, is a setting (`frontOpenSpaceOnPublicRoad`). A building behind a narrow access (a flag plot) is not on a public road, so 52(6) applies to it under both settings. | Our reading of the text, not settled law; quoted and argued below the table. |
| B13 | Bangkok ordinance ข้อ 52(7), the 2 m rear walkway: does it cover an office? | **Applied to offices** as a 2 m setback from neighbouring land (`bma.rear-walkway`), confidence "assumption". Not applied to condos. | The clause names commercial buildings, factories and public buildings; an office is not named, but the ordinance's definition of a commercial building includes "business services". Quoted below. |
| B14 | MR 33 ข้อ 3 fire road and the plan's permeable planting (half the required open space): both are required; the tool does not lay out the site. | Tested by area: the open ground left after a 6 m ring around the building's ground coverage, clipped to the plot, must hold the required planting. The generator shrinks a high-rise plate until it does; the check is pass or fail, never a warning. | Two legal requirements cannot both be met when the ring takes all the open ground; showing that as a warning beside "passes" was wrong. |
| B15 | Readings of unclear law (B2 and the office operating-area reading) can be switched to the less conservative side. | The switches reset with the plot (new plot, example plot), and every evaluation lists each non-default reading in a plain sentence (`nonDefaultReadings`). The defaults live in one table in the core. | A less conservative reading carried silently onto another plot produced an unmarked result 1.85 times the FAR. |
| B16 | EIA threshold: 4,000 m² of "usable area" (พื้นที่ใช้สอย), definition not verified. | Compared with the **total floor area of the building**, the largest measure, and the check says so. | Sellable area after an efficiency discount can hide a needed EIA; the stricter measure cannot. |

### B12: the text of ข้อ 52(6) and ข้อ 53

From the ASA copy of the ordinance (`bb44-03.pdf`, pdftotext output; the extraction drops some upper vowels and tone marks, restored here: ที่, ชั้น, หนึ่ง, ต่อเนื่อง, เชื่อม, นี้).

ข้อ 52(6), first to third paragraphs:

> (6) อาคารพาณิชย์ โรงงานอุตสาหกรรม คลังสินค้า อาคารสาธารณะ อาคารสูงเกิน 2 ชั้นหรือสูงเกิน 8 เมตร ยกเว้นอาคารอยู่อาศัยสูงไม่เกิน 3 ชั้น ที่ไม่อยู่ริมทางสาธารณะ ให้มีที่ว่างด้านหน้ากว้างไม่น้อยกว่า 6 เมตร
> อาคารตามวรรคหนึ่งถ้าสูงเกิน 3 ชั้น ให้มีที่ว่างกว้างไม่น้อยกว่า 12 เมตร
> ที่ว่างตามวรรคหนึ่งและวรรคสอง ต้องมีพื้นที่ต่อเนื่องกันยาวไม่น้อยกว่า 1 ใน 6 ของความยาวเส้นรอบรูปภายนอกอาคาร โดยอาจรวมที่ว่างด้านข้างที่ต่อเชื่อมกับที่ว่างด้านหน้าอาคารด้วยก็ได้ และที่ว่างนี้ต้องต่อเชื่อมกับถนนภายในกว้างไม่น้อยกว่า 6 เมตรออกสู่ทางสาธารณะได้

Translation: "(6) Commercial buildings, factories, warehouses, public buildings, buildings over 2 storeys or over 8 m high, except residential buildings of not more than 3 storeys, not on a public way, shall have a front open space at least 6 m wide. A building under paragraph one that is over 3 storeys shall have an open space at least 12 m wide. The open space under paragraphs one and two must be continuous over a length of at least one sixth of the building's external perimeter, which may include side open space joined to the front open space, and must connect to an internal road at least 6 m wide leading out to a public way."

ข้อ 53, first paragraph:

> ข้อ 53 อาคารอยู่ริมทางสาธารณะที่ไม่ต้องมีที่ว่างตามข้อ 52(3) และ 52(6) ต้องมีลักษณะ ดังนี้ แนวอาคารด้านที่ประชิดติดริมทางสาธารณะต้องมีความยาวมากกว่า 1 ใน 8 ส่วนของความยาวเส้นรอบรูปภายนอกของอาคาร ทั้งนี้ แนวอาคารด้านที่ประชิดติดทางสาธารณะต้องห่างทางสาธารณะไม่เกิน 20 เมตร

Translation: "A building on a public way that is not required to have the open space of clauses 52(3) and 52(6) must be as follows: the building line on the side adjoining the public way must be longer than one eighth of the building's external perimeter, and that building line must be no more than 20 m from the public way."

Reading. Clause 53 is plainly not an alternative a building may choose: it governs only buildings that do not need the 52(6) space. What the text leaves open is which buildings those are, because "ที่ไม่อยู่ริมทางสาธารณะ" ("not on a public way") can attach to two things:

- **Reading A:** it qualifies the whole list, so 52(6) covers only buildings not on a public way, and every building on a public way falls under clause 53. For this reading: clause 52(3) is limited the same way ("และไม่อยู่ริมทางสาธารณะ"); the third paragraph's internal road "leading out to a public way" presumes a building away from one; and clause 53's opening words then describe every building on a road.
- **Reading B:** it qualifies only the exception (residential buildings of up to 3 storeys), so every building over 2 storeys or 8 m needs the 52(6) space, on a road or not, and clause 53 covers only the small buildings 52(6) leaves out. For this reading: it is the nearest phrase, and 52(6), unlike 52(3), has no "และ" joining it to the list.

Clause 52(3), the sibling clause for row houses, uses the same construction without ambiguity:

> (3) ห้องแถวหรือตึกแถวสูงไม่เกิน 3 ชั้นและไม่อยู่ริมทางสาธารณะ ต้องมีที่ว่างด้านหน้าอาคารกว้างไม่น้อยกว่า 6 เมตร ถ้าสูงเกิน 3 ชั้นต้องมีที่ว่างกว้างไม่น้อยกว่า 12 เมตร

("Row houses or shophouses of not more than 3 storeys and not on a public way must have a front open space at least 6 m wide; if over 3 storeys, at least 12 m.")

**Decision: reading A is the default.** Reasons: (a) in 52(3) the front open space is plainly for buildings not on a public way, and 52(6) repeats its structure and its 6 m and 12 m widths; (b) 52(6) requires the open space to connect to a public way by an internal road at least 6 m wide, which presupposes a building set back from the public way; (c) clause 53 then covers the buildings that are on a public way. This is our reading, not settled law. Reading B (52(6) for every building over 2 storeys or 8 m, wherever it stands) remains possible on the text and is offered as a setting; under it the generator keeps a 12 m strip along the governing road, which cut the low-rise floor area of the example plots by roughly 20 to 40% (for example 9,999 to 8,123 m² on soi-large-far, 7,111 to 5,151 m² on corner-two-roads).

Clause 53's conditions, as implemented (for Form A): "แนวอาคารด้านที่ประชิดติดริมทางสาธารณะต้องมีความยาวมากกว่า 1 ใน 8 ส่วนของความยาวเส้นรอบรูปภายนอกของอาคาร ทั้งนี้ แนวอาคารด้านที่ประชิดติดทางสาธารณะต้องห่างทางสาธารณะไม่เกิน 20 เมตร": the building line on the side adjoining the public way longer than one eighth of the external perimeter, and no more than 20 m from the public way.

Which building is "on a public road" (อาคารอยู่ริมทางสาธารณะ): one that comes within 20 m of a road edge. The sentence relied on is clause 53's "แนวอาคารด้านที่ประชิดติดทางสาธารณะต้องห่างทางสาธารณะไม่เกิน 20 เมตร" (the building line adjoining the public way must be no more than 20 m from it): a building whose nearest face is further away cannot have such a building line, so it is not on the public road in the clause's sense and clause 52(6) governs it. Every building is under exactly one of the two clauses, judged by its own position, so none can dodge both. Under the default reading this gives two lawful forms on a plot with a road frontage, and the tool generates each design in both where each can win and offers the one with more floor area counted toward FAR (Form A on a tie): **Form A, on the road**, meeting clause 53; **Form B, set back** more than 20 m from every road behind the 52(6) front open space, the ground in front left open as the link to the road (it counts as open space). The summary and the check say which form and why. A plot that reaches the road only through a narrow access strip (a flag plot) can only take Form B.

The 52(6) open space is measured as the longest continuous part of the outline with the required width of open ground straight out in front of it, which must be at least one sixth of the perimeter and reach a road edge through open ground at least 6 m wide.

### B13: the text of ข้อ 52(7)

> (7) อาคารพาณิชย์ โรงงานอุตสาหกรรม และอาคารสาธารณะ จะต้องมีที่ว่างโดยปราศจากสิ่งปกคลุมเป็นทางเดินหลังอาคารได้ถึงกัน กว้างไม่น้อยกว่า 2 เมตร โดยให้แสดงเขตดังกล่าวให้ปรากฏด้วย
> ที่ว่างตามวรรคหนึ่ง จะก่อสร้างอาคาร รั้ว กำแพง หรือสิ่งก่อสร้างอื่นใดหรือจัดให้เป็นบ่อน้ำ สระว่ายน้ำ ที่พักมูลฝอยหรือที่พักรวมมูลฝอยหรือสิ่งของอื่นใดที่จะขัดขวางทางเดินร่วมไม่ได้

Translation: "(7) Commercial buildings, factories and public buildings must have an open space, free of any covering, as a walkway behind the building giving through access, at least 2 m wide, and its extent shall be shown. Within that open space no building, fence, wall or other structure may be built, and no pond, swimming pool, refuse store or anything else obstructing the shared walkway may be placed."

Definition, ข้อ 5(106): "“อาคารพาณิชย์” หมายความว่า อาคารที่ใช้เพื่อประโยชน์ในการพาณิชยกรรมหรือบริการธุรกิจ ..." ("a commercial building is a building used for commerce or business services ...").

Reading. A condo is residential and is not covered. An office is not named; it is caught only if an office building counts as one "used for business services", which is a reading, not the text, so the rule carries confidence "assumption". Where "behind the building" is depends on the layout, so the 2 m is kept from every boundary with neighbouring land. The existing side and rear setbacks (3 m for walls with openings, 2 m clear space) already meet it, and the rule says so instead of claiming to bind.

## C. How we work

| # | Question | Call | Why |
|---|---|---|---|
| C1 | Where do rules live in the code? | One data file per zone and plan version: value, formula, citation, confidence. | The follow-up call adds "a new requirement on the spot". |
| C2 | Is `BRIEF.md` public? | No. Kept locally, excluded from the repo. | It contains a personal link and is the company's hiring material. |
| C3 | Is the research public? | Yes, in `research/`. | It is the evidence for these decisions. |
| C4 | Who writes the submission? | Arpit writes the reasoning and reflection. The agent supplies facts and notes. | The brief requires it. |
