# 01 — Bangkok regulations for a condo plot-envelope tool

Research date: 19 Nov 2026. Author: research agent. Scope: the rules needed to compute, for one plot in one Bangkok zone, the legal GFA, open space, setbacks, height envelope and condo-specific checks.

## How to read this file

Every rule carries a **confidence tag**:

- **VERIFIED**: I read the clause myself in the official text (Royal Gazette scan) or in a consolidated text that cites its Gazette reference. The consolidations come from the Association of Siamese Architects (ASA) or Yotathai, and they are marked as such.
- **CORROBORATED**: the rule appears in 2+ independent secondary sources (news, professional blogs, theses), or it is a direct logical inference from verified text. The inference is spelled out each time.
- **UNVERIFIED**: a single source, my own interpretation, or an industry norm. Treat it as an assumption and expose it in the UI.

Thai clause numbers are given as `ข้อ N` (clause) and `มาตรา N` (section of an Act). All quoted numbers come from the documents I downloaded, which are listed in §10.

**Source key.** Every clause citation below uses one of these short names, which resolve to the URL given here:

| Short name | Document | URL |
|---|---|---|
| Plan2556 | Bangkok Comprehensive Plan MR B.E. 2556 (Royal Gazette vol 130 part 41 ก) | https://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf |
| Draft-r4 | 4th revision, 90-day posting version: regulations / summary table | https://drive.google.com/file/d/1TUHldvRIL8-BdzsExLCSg7rRtSFopKLl/view ; https://drive.google.com/file/d/1wCbTfC55N5UGtw7rnmqZboNiXMs7h7Aa/view (index: https://plan4bangkok.com/process/) |
| MR55 | MR No. 55 B.E. 2543, consolidated to MR 68 (2563) | https://download.asa.or.th/03media/04law/fubr/a1_bcmr55-63.pdf |
| MR33 | MR No. 33 B.E. 2535, consolidated to 2564 | https://download.asa.or.th/03media/04law/fubr/a3_bcmr33-64.pdf |
| BMA2544 | Bangkok Building Control Ordinance B.E. 2544 | https://download.asa.or.th/03media/04law/cba/bb/bb44-03.pdf |
| MR7 | MR No. 7 B.E. 2517 (parking), consolidated | https://download.asa.or.th/03media/04law/cba/mr/mr17-07-upd64.pdf |
| MR41 | MR No. 41 B.E. 2537 (stall sizes), Gazette scan | https://download.asa.or.th/03media/04law/cba/mr/mr37-41.pdf |
| EIA | ONEP EIA page; MNRE announcement 2566; 2568 amendment | https://www.onep.go.th/eia/ ; https://download.asa.or.th/03media/04law/eqa/ma66-06.pdf ; https://asa.or.th/laws/news20250801/ |
| CPA2562 | City Planning Act 2562 (Yotathai summary) | https://www.yotathai.com/yotanews/town-planning-act62 |
| News | Thansettakij 665274 / 659134 | https://www.thansettakij.com/real-estate/665274 ; https://www.thansettakij.com/real-estate/659134 |

In the text, "MR 55 ข้อ 41" means MR55 in this table, "ข้อ N" without a prefix in §2 means Plan2556, and "BMA ข้อ N" means BMA2544.

---

## 0. TL;DR for the implementer

1. **The plan in force is still the 2013 one (กฎกระทรวงให้ใช้บังคับผังเมืองรวมกรุงเทพมหานคร พ.ศ. 2556).** The 4th revision is a draft. Its 90-day public posting ran 10 Aug to 9 Nov 2026 and closed ten days ago. Enactment is expected around late 2027 (B.E. 2570). Build against the 2013 plan, and key all zone data by `planVersion` so the draft can be swapped in later. **The draft renumbers every zone code**: 2013 "ย.7" ≠ draft "ย.7".
2. **Recommended zone: ย.7 (2013 plan)**, orange, medium-density residential near transit. Its numbers are FAR 5:1 and OSR ≥ 6% of total floor area. A condo over 10,000 m² is allowed only on a ≥30 m public road (with the ข้อ 36 frontage test) or within 500 m of a mass-transit platform edge. On FAR 5, that cliff binds on any plot larger than 2,000 m². This is the interesting interaction.
3. **Building-control rules stack on top of the plan:**
   - MR 55 (setbacks, height = 2× distance to the far side of the road)
   - the BMA ordinance 2544 (Bangkok's own setbacks, open space, parking)
   - MR 33 (high-rise ≥23 m or extra-large ≥10,000 m²: 12 m frontage on a ≥10 m road or ≥18 m road above 30,000 m², 6 m clear of every boundary, 6 m fire road, residential open space ≥30% of the plot, FAR ≤10)

   Where two documents regulate the same thing, implement the **stricter** value and show both.
4. **Parking almost certainly counts toward FAR under the 2013 plan.** No exclusion exists in the definition, and the plan exempts only *extra public* parking (ข้อ 54). This contradicts a common assumption.

---

## 1. The legal stack: which document governs what

| # | Document | Governs (for this tool) | Status (Nov 2026) | Tag |
|---|---|---|---|---|
| 1 | Building Control Act B.E. 2522 (พ.ร.บ.ควบคุมอาคาร พ.ศ. 2522), as amended | Parent act. Empowers ministerial regulations (มาตรา 8) and local ordinances (มาตรา 9, 10). | In force | VERIFIED (the empowering sections are cited in each MR and in the BMA ordinance preamble) |
| 2 | Ministerial Regulation (MR) No. 55 B.E. 2543, amended by MR 58 (2546), 61 (2550), 66 (2559) and 68 (2563) | National rules: building lines and road setbacks (ข้อ 41), waterway setbacks (ข้อ 42), height vs road (ข้อ 44–46), open space (ข้อ 33), spacing from boundaries (ข้อ 50) and between buildings (ข้อ 48), minimum unit size (ข้อ 19), ceiling heights (ข้อ 22) | In force. Gazette vol 117 part 75 ก, 7 Aug 2543; MR 68 in vol 137 part 98 ก, 3 Dec 2563 | VERIFIED (ASA consolidation `a1_bcmr55-63`) |
| 3 | MR No. 33 B.E. 2535, amended by MR 42 (2537), 50 (2540), 69 (2564) and others | High-rise (≥23 m) and extra-large (≥10,000 m²) buildings: access road and frontage (ข้อ 2), 6 m fire road (ข้อ 3), 6 m from boundaries and roads (ข้อ 4), FAR ≤10 (ข้อ 5), open space ≥30% of the plot for residential (ข้อ 6) | In force. A further amendment (new definitions of เขตทาง and compartmentation) was approved in principle by Cabinet; I could not confirm it has been gazetted. | VERIFIED (ASA consolidation `a3_bcmr33-64`, current to 2564) |
| 4 | MR No. 7 B.E. 2517 (parking counts) and MR No. 41 B.E. 2537 (stall sizes; repeals MR 7 ข้อ 5) | Parking numbers and stall dimensions | In force; MR 7 last amended by MR 64 (2555) | VERIFIED (ASA consolidation of MR 7; Gazette scan of MR 41, vol 111 part 37 ก, 31 Aug 2537) |
| 5 | Bangkok Metropolitan Administration ordinance on building control B.E. 2544 (ข้อบัญญัติกรุงเทพมหานคร เรื่อง ควบคุมอาคาร พ.ศ. 2544) | Bangkok-specific: road setbacks (ข้อ 50), height (ข้อ 49), open space 30% of land (ข้อ 52), front open space and fire access (ข้อ 52(6), 53), side clearances (ข้อ 54, 55), parking count, stall and aisle sizes (ข้อ 83–91) | In force. Gazette vol 118 special part 75 ง, 3 Aug 2544 | VERIFIED (ASA text `bb44-03`, file dated Jan 2024; it may not show later amendments, see §9) |
| 6 | Bangkok Comprehensive Plan, MR B.E. 2556 (กฎกระทรวงให้ใช้บังคับผังเมืองรวมกรุงเทพมหานคร พ.ศ. 2556), "3rd revision" | Zoning: land-use categories, permitted and prohibited uses by size, road width and transit distance; FAR; OSR; FAR bonus | **In force.** Gazette vol 130 part 41 ก, 16 May 2556 | VERIFIED (Gazette text) |
| 7 | Draft Bangkok Comprehensive Plan, 4th revision (ผังเมืองรวมกรุงเทพมหานคร ปรับปรุงครั้งที่ 4, ฉบับปิดประกาศ 90 วัน) | Will replace #6 | **Draft, not in force.** See §1.2. | VERIFIED as a document (I downloaded the posted draft regulations and summary table) |
| 8 | City Planning Act B.E. 2562 (พ.ร.บ.การผังเมือง พ.ศ. 2562) | Procedure for the new plan; transitional rule keeping the 2013 plan alive | In force since 25/26 Nov 2562 | CORROBORATED (see §1.1) |
| 9 | Ministry of Natural Resources and Environment (MNRE) announcements on projects requiring an EIA, B.E. 2566 (Gazette 5 Jan 2567), amended by (No. 2) B.E. 2568 (31 Jul 2568) | Whether a condo needs an EIA (approval timing, not envelope) | In force | CORROBORATED for the thresholds (see §5.3) |

**Precedence between #2/#3 (national MRs) and #5 (BMA ordinance)**
- The BMA ordinance was issued under มาตรา 9 and 10 of the Building Control Act. Its preamble says it adds detail because national MRs "do not fully fit Bangkok conditions".
- A Council of State opinion (via comment.ocs.go.th) states the general principle that local ordinances must not conflict with MRs issued under มาตรา 8.
- An appeals-board ruling says that an ordinance under มาตรา 9/10 that conflicts with city-planning law yields to the city-planning law.
- I did not find an authoritative statement of which wins, MR 55 or BMA 2544, clause by clause. **Implementation policy: compute both and apply the stricter.** Tag: UNVERIFIED as a legal conclusion, but it is safe, because a design meeting both is legal under either reading.

Sources: Council of State opinions at comment.ocs.go.th (search result only); the BMA ordinance preamble (VERIFIED).

### 1.1 Why the 2013 plan is still in force although ข้อ 1 says "5 years"

- ข้อ 1 of the 2013 MR: "กฎกระทรวงนี้ให้ใช้บังคับได้มีกําหนดห้าปี" ("in force for five years"). VERIFIED. A reviewer will raise this.
- The City Planning Act B.E. 2562 replaced the 2518 Act. Its transitional provision (reported as **มาตรา 111**) keeps ministerial regulations enforcing existing comprehensive plans in force until a new plan is issued by announcement or local ordinance. Source: the Yotathai summary of the 2562 Act (https://www.yotathai.com/yotanews/town-planning-act62). **CORROBORATED**: the BMA's own public statements (2568 news) say the 2013 plan "still has to be used" until the new one takes effect (Daily News / Prachachat, 2025). I did not read the official text of มาตรา 111. Tag that wording UNVERIFIED.
- Under the 2562 Act, the new Bangkok plan will be enacted as a **Bangkok Metropolitan ordinance (ข้อบัญญัติกรุงเทพมหานคร) passed by the Bangkok Metropolitan Council (สภากรุงเทพมหานคร) and published in the Royal Gazette**, not as a ministerial regulation. Source: Thansettakij 665274 (steps after posting). CORROBORATED.

### 1.2 Status of the 4th revision (as of 19 Nov 2026)

| Date | Event | Source | Tag |
|---|---|---|---|
| 8–22 Dec 2023 | 15-day posting, first round | plan4bangkok.com | VERIFIED (official project site) |
| 23 Dec 2023 – 30 Aug 2024 | Public comment period | plan4bangkok.com | VERIFIED |
| Feb 2026 | Consumer Council (สภาองค์กรของผู้บริโภค) sued in the Administrative Court to halt the draft; BMA says it followed the 2562 Act | Thai PBS Policy Watch; Siam Rath | CORROBORATED |
| 9 Apr 2026 | Bangkok Provincial City Planning Committee approved the draft | Thansettakij 659134; Thai PBS | CORROBORATED |
| 10 Aug – 9 Nov 2026 | **90-day posting and stakeholder petitions (คำร้อง)**; closed | plan4bangkok.com/process (official) | VERIFIED |
| After 9 Nov 2026 | Petitions reviewed by committees → national City Planning Committee → ordinance drafted → BMA Council → Royal Gazette | Thansettakij 665274 | CORROBORATED |
| "ปลายปี 2570" (late 2027) | Expected enactment | Thansettakij 665274, 659134 | CORROBORATED (a forecast, not a fact) |

I found no report after 9 Nov 2026 giving petition counts or a new date. ASA's law-news index (through Sept 2026) lists no enacted Bangkok plan.

**Biggest risk for the tool:** if reviewers expect "the new plan", show both and label the draft **not in force**.

### 1.3 What the draft changes (for a future `planVersion: "draft-r4"`)

Source: the posted "ตารางสรุปข้อกำหนดการใช้ประโยชน์ที่ดิน" (summary table) and "ข้อกำหนดการใช้ประโยชน์ที่ดิน" (129-page regulations), both ฉบับปิดประกาศ 90 วัน, linked from https://plan4bangkok.com/process/. Tag: VERIFIED as draft text.

- **Zone codes renumbered and extended:** ย.1–ย.15 (yellow ย.1–5, orange ย.6–10, brown ย.11–15), พ.1–พ.8, อ.1–อ.3, ก.1–ก.2, อก. (rural/agricultural conservation). One secondary source says old ย.7 maps roughly to new ย.9. UNVERIFIED; zones are redrawn, not just renamed.
- **FAR / OSR by draft zone:**

| Draft zone | ย.1 | ย.2 | ย.3 | ย.4 | ย.5 | ย.6 | ย.7 | ย.8 | ย.9 | ย.10 | ย.11 | ย.12 | ย.13 | ย.14 | ย.15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAR | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6 | 6.5 | 7 | 7.5 | 8 |
| OSR % | 50 | 25 | 20 | 15 | 12.5 | 10 | 9 | 8.5 | 8 | 7.5 | 7 | 6.5 | 6 | 5.5 | 5 |

| Draft zone | พ.1 | พ.2 | พ.3 | พ.4 | พ.5 | พ.6 | พ.7 | พ.8 | อ.1 | อ.2 | อ.3 | ก.1 | ก.2 | อก. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAR | 3 | 4 | 5 | 6 | 7 | 7 | 8 | 10 | 2 | 1.5 | 1 | 1 | 1.5 | 0.5 |
| OSR % | 12.5 | 10 | 7.5 | 6.5 | 5.5 | 5.5 | 4.5 | 3.5 | 20 | 25 | 50 | 50 | 40 | 125 |

  The table was read from the PDF text layer and cross-checked against the rendered table. The FAR/OSR row is complete (29 values for 29 columns). The ก.1/ก.2 OSR values from the text layer are 50/40. Tag: VERIFIED for the draft.

- **OSR definition changes.** Draft: "อัตราส่วนพื้นที่ว่างอันปราศจากสิ่งปกคลุมดินของแปลงที่ดินที่อาคารตั้งอยู่ต่อ**พื้นที่ใช้สอยรวม**ของอาคาร". The denominator becomes **usable floor area**, not total floor area as in 2013. VERIFIED (draft).
- **Condo (อาคารอยู่อาศัยรวม) size tiers.** The 2013 tiers were 1,000/2,000/5,000/10,000. The draft tiers are ≤1,000 / ≤2,000 / ≤5,000 / ≤10,000 / ≤30,000 / >30,000 m². Each tier gets a condition code:
  - Code **1**: road ≥12 m, or within 800 m of a station or joint station.
  - Code **2**: road ≥16 m, or ≤650 m from a station, or ≤800 m from a joint station.
  - Code **3**: road ≥20 m, or ≤500 m from a station, or ≤800 m from a joint station.
  - Code **4**: road ≥30 m, or ≤500 m from a station, or ≤800 m from a joint station.
  - Draft distances are measured from **"แนวเขตสถานี"** (the station boundary), draft ข้อ 43–44. The 2013 plan measures from the **platform edge**.
  - "Joint station" (สถานีร่วม) is defined as an interchange of 2+ lines.

  Condo rows read from the rendered table (VERIFIED for the draft; cell reading is mine):

| Condo GFA | Draft ย.1–ย.5 | ย.6–ย.10 | ย.11–ย.13 | ย.14–ย.15 | พ.1–พ.3 | พ.4–พ.6 | พ.7–พ.8 |
|---|---|---|---|---|---|---|---|
| ≤1,000 | ย.1 ✗, ย.2 code 3, ย.3 code 2, ย.4–5 ok | ok | ok | ok | ok | ok | ok |
| ≤2,000 | ย.1–2 ✗, ย.3–4 code 3, ย.5 ok | ok | ok | ok | พ.1–2 ✗, พ.3 ok | ok | ok |
| ≤5,000 | ย.1–3 ✗, ย.4–5 code 3 | ok | ok | ok | พ.1–2 ✗, พ.3 ok | ok | ok |
| ≤10,000 | ย.1–3 ✗, ย.4 code 4, ย.5 code 3 | ok | ok | ok | ✗ | code 2 | ok |
| ≤30,000 | ✗ | code 3 | ok | ok | ✗ | code 3 | ok |
| >30,000 | ✗ | ✗ | ✗ | ok | ✗ | ✗ | code 3 |

- **Draft FAR bonuses** (draft ข้อ 73–80):
  - TOD bonus up to +20% for residential, commercial and office within 800 m of joint stations (applies in draft ย.1–ย.10).
  - Affordable housing: +20%, capped at 4× the affordable area.
  - Day-care / elderly-care space: ≤8× that area.
  - Riverside public open space: ≤8× that area.
  - Public parking within **200 m** of listed outer stations: 30 m² per extra stall.

  I did not find an overall cap clause in the draft text. UNVERIFIED.
- **Transfer of development rights (TDR)** was removed from the draft pending Council of State advice (Thansettakij 659134). CORROBORATED.
- **Parking in FAR:** I found no clause in the draft text that excludes parking from FAR. News says condo parking near rail is "adjusted" (Thansettakij 665274), with no figures. UNVERIFIED.

---

## 2. Zoning under the 2013 plan (in force)

### 2.1 Definitions (2013 plan ข้อ 4): VERIFIED

- **FAR**, "อัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดิน" = total floor area of **all floors of all buildings** ÷ **land area used as the building site** (พื้นที่ดินที่ใช้เป็นที่ตั้งอาคาร).
- **OSR**, "อัตราส่วนของที่ว่างต่อพื้นที่อาคารรวม" = unobstructed open space (ที่ว่างอันปราศจากสิ่งปกคลุม) **of the building site** ÷ **total floor area of all floors of all buildings**, as a percentage.
- Every zone's OSR clause adds two conditions:
  - "แต่อัตราส่วนของที่ว่างต้องไม่ต่ำกว่าเกณฑ์ขั้นต่ำของที่ว่างอันปราศจากสิ่งปกคลุมตามกฎหมายว่าด้วยการควบคุมอาคาร": the OSR open space may not be less than the building-control minimum (§2.6).
  - "ให้มีพื้นที่น้ำซึมผ่านได้เพื่อปลูกต้นไม้ไม่น้อยกว่าร้อยละห้าสิบของพื้นที่ว่าง": **≥50% of that open space must be permeable planting area**.
- **Subdivision rule** (every zone): if an already-developed plot is later subdivided, the FAR and OSR of **all resulting plots combined** must still comply. The tool should warn if the user draws part of a developed lot. VERIFIED.
- **Floor area** (พื้นที่อาคาร): the 2013 plan does not define it. The building-control definitions are:
  - MR 33 ข้อ 1: floor area of each storey that people can enter or use, within the outer edge of beams, floor, or outer walls, **including verandas/balconies, excluding roof deck and stairs outside the roof**. VERIFIED.
  - BMA 2544 ข้อ 5(62): same, including balconies. VERIFIED.
- **Does parking count toward FAR?** Under the 2013 plan, **yes (inferred)**:
  1. Neither definition excludes parking. VERIFIED.
  2. The plan's park-and-ride bonus (ข้อ 54) says the *added* public parking "ให้ได้รับการยกเว้นไม่ต้องนำมาพิจารณาอัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดินและอัตราส่วนของที่ว่างต่อพื้นที่อาคารรวม" ("is exempted from FAR and OSR"). An explicit exemption for extra parking only makes sense if ordinary parking counts. VERIFIED text, inferred conclusion.

  Tag: **CORROBORATED (inference from two verified texts)**. The brief's assumption ("what is excluded, e.g. parking") is **not supported** for 2013. Show parking floor area inside GFA and let the user toggle it.
- **Mass-transit distance** (ข้อ 37): "ให้วัดระยะจากแนวเขตชานชาลาสถานีรถไฟฟ้าขนส่งมวลชน" (measured **from the station platform boundary**). VERIFIED. Implement as the shortest distance from any point of the plot to the platform polygon. UNVERIFIED: whether "the plot is within 500 m" means any part or the whole plot. Practice reports suggest any part; flag it.

### 2.2 FAR and OSR per zone (2013), all VERIFIED from the Gazette text

| Zone | Colour / meaning | Clause | FAR max | OSR min (% of total floor area) | FAR × OSR (implied open space as % of land at full FAR) |
|---|---|---|---|---|---|
| ย.1 | yellow, low-density residential, suburban | ข้อ 8 | 1 | 40 | 40% |
| ย.2 | yellow | ข้อ 9 | 1.5 | 20 | 30% |
| ย.3 | yellow | ข้อ 10 | 2.5 | 12.5 | 31% |
| ย.4 | yellow, in a mass-transit service area | ข้อ 11 | 3 | 10 | 30% |
| ย.5 | orange, medium density | ข้อ 12 | 4 | 7.5 | 30% |
| ย.6 | orange | ข้อ 13 | 4.5 | 6.5 | 29% |
| **ย.7** | **orange, medium density in a mass-transit service area** | **ข้อ 14** | **5** | **6** | **30%** |
| ย.8 | brown, high density, inner city | ข้อ 15 | 6 | 5 | 30% |
| ย.9 | brown, inner city with mass transit | ข้อ 16 | 7 | 4.5 | 31.5% |
| ย.10 | brown, next to CBD and mass transit | ข้อ 17 | 8 | 4 | 32% |
| พ.1 | red, community commercial | ข้อ 18 | 5 | 6 | 30% |
| พ.2 | red, suburban centre | ข้อ 19 | 6 | 5 | 30% |
| พ.3 | red, city commercial centre | ข้อ 20 | 7 | 4.5 | 31.5% |
| พ.4 | red, secondary CBD around mass transit | ข้อ 21 | 8 | 4 | 32% |
| พ.5 | red, main CBD | ข้อ 22 | 10 | 3 | 30% |
| อ.1 | purple, light industry | ข้อ 23 | 2 | 15 | |
| อ.2 | purple, industry | ข้อ 24 | 1.5 | 20 | |
| อ.3 | warehouse | ข้อ 25 | 1 | 40 | |
| ก.1 | green-hatched, rural conservation (flood) | ข้อ 26 | 0.5 | 100 | |
| ก.2 | green-hatched | ข้อ 27 | 1 | 40 | |
| ก.3 | green-hatched, coastal | ข้อ 28 | 0.5 | 100 | |
| ก.4 | green, rural/agricultural | ข้อ 29 | 1 | 40 | |
| ก.5 | green, rural community | ข้อ 30 | 1 | 40 | |
| ศ.1 | light brown, Thai heritage conservation | ข้อ 31 | 3 | 10 | |
| ศ.2 | light brown | ข้อ 32 | 4 | 7.5 | |
| ส. | blue, government/institutional | ข้อ 33 | — (use restricted) | — | |

Each zone is split into numbered sub-areas: ย.7-1 to ย.7-30, พ.5-1 to พ.5-7, and so on (ข้อ 7). VERIFIED.

Observation: FAR × OSR ≈ 30% across residential/commercial zones. At full FAR, the plan's OSR requires open space ≈ 30% of the land, the same number as BMA ข้อ 52(1) and MR 33 ข้อ 6. With a FAR bonus, the OSR term grows (OSR × bonus GFA) and **becomes the binding open-space constraint**. This is a nice, testable interaction.

### 2.3 Condo (อาคารอยู่อาศัยรวม) restrictions by zone, 2013 plan: VERIFIED

"Allowed if" means the prohibition's exception applies. Road = public road (ถนนสาธารณะ) right-of-way width (ขนาดเขตทาง). Station = within 500 m of a mass-transit station (ข้อ 37 measurement). Size = the condo's "พื้นที่อาคารรวม" (total floor area).

| Zone | Rule (clause / item) | Size bands |
|---|---|---|
| ย.1 | ข้อ 8(12): condos **prohibited** (only semi-detached / row houses in ย.1-1 and ย.1-4 on minimum lot sizes) | none allowed |
| ย.2 | ข้อ 9(12)(ค) | ≤1,000 m² **and** road ≥16 m; else prohibited |
| ย.3 | ข้อ 10(11) | ≤1,000 free; 1,000–10,000 needs road ≥30 m **or** station ≤500 m; >10,000 prohibited |
| ย.4 | ข้อ 11(11) | ≤2,000 free; 2,000–10,000 needs road ≥**10** m or station ≤500 m; >10,000 prohibited (except BMA / National Housing Authority / CODI low-income housing) |
| ย.5 | ข้อ 12(11) | ≤10,000 free; >10,000 needs road ≥30 m or station ≤500 m (low-income public housing exempt) |
| ย.6 | ข้อ 13(11) | same as ย.5 |
| **ย.7** | **ข้อ 14(11)** | **≤10,000 free; >10,000 needs road ≥30 m or station ≤500 m** (no public-housing exception in ย.7) |
| ย.8, ย.9, ย.10 | ข้อ 15–17 | **no condo size restriction**. I read the full prohibition lists and confirmed with a whole-document search for "อยู่อาศัยรวม" on space-normalised text: no hits in ข้อ 15–17, 21, 22. |
| พ.1 | ข้อ 18(9) | ≤5,000 free; **>5,000 prohibited, no exception** |
| พ.2, พ.3 | ข้อ 19(9), 20(9) | ≤5,000 free; 5,000–10,000 needs road ≥16 m or station ≤500 m; >10,000 needs road ≥30 m or station ≤500 m |
| พ.4, พ.5 | ข้อ 21, 22 | no condo size restriction (same search) |
| อ.1, อ.2 | ข้อ 23(11), 24(11) | >2,000 prohibited (no exception text follows the item) |
| อ.3, ศ.1, ศ.2 | ข้อ 25(11), 31(11), 32(11) | >1,000 prohibited |
| ก.1–ก.4 | ข้อ 26–29 | all condos prohibited |
| ก.5 | ข้อ 30(9) | prohibited except ≤1,000 with a location condition (not read in full) |

**Parking floor area and the 10,000 m² cap.** Under the default reading that parking counts in floor area (§2.1), the ย.7 10,000 m² condo cap also counts parking floors. That makes the cap bite much harder: roughly 7,800–8,200 m² of residential floor area once a parking podium is added (1 stall per 120 m² at about 27 m² of gross parking area per stall). This is UNVERIFIED and follows from the same inference.

UNVERIFIED: whether "พื้นที่อาคารรวม" for this test is **per building** or **per project/plot**. The 2013 text does not say "ในหลังเดียวกัน"; the draft does ("พื้นที่อาคารรวมกันทุกชั้นในหลังเดียวกัน"). Conservative implementation: total floor area of all condo buildings on the plot. Expose a toggle.

### 2.4 What "located on a public road of width ≥ X" means: ข้อ 36 (VERIFIED text, interpretation UNVERIFIED)

ข้อ 36 (with the errata, แก้คำผิด) applies to uses that the zone clauses exempt "ริมถนนสาธารณะที่มีขนาดเขตทางตาม (1)(2)(3)(4)". Literal translation:

| Road class | Plot must… |
|---|---|
| (1) road ROW ≥10 m | have **one side ≥12 m long** fronting a public road used as access with ROW ≥10 m. That road must run continuously to connect with another public road, one side ROW ≥10 m and the other ≥8 m. The plot must lie within **200 m** of that road's ROW edge. |
| (2) road ROW ≥12 m | side ≥**12 m**; access road ≥12 m connecting to roads ≥12 m / ≥8 m; plot within **200 m** |
| (3) road ROW ≥16 m | side ≥**16 m**; access road ≥16 m connecting to roads ≥16 m / ≥12 m; plot within **300 m** |
| (4) road ROW ≥30 m | side ≥**30 m**; access road ≥30 m connecting to roads ≥30 m / ≥16 m; plot within **500 m** |

Last paragraph of ข้อ 36: planned **road type ก and ข widenings of existing roads** (listed in the transport-plan annex) count as public roads. **Their planned ROW line is to be used as the road boundary for building lines and all distances under building-control law.** VERIFIED.

**Planned roads crossing the plot** (Plan2556 ข้อ 44–45, VERIFIED):
- Planned-road widths by class: ก = 12 m, ข = 16 m, ค = 20 m, ง = 30 m, จ = 40 m, ฉ = 50 m, ช = 60 m.
- Land inside the right-of-way of a planned road or expressway "may be used only for transport and public benefit" (ข้อ 45). If a planned road line crosses the plot, that strip is **not buildable**.
- Whether that strip still counts in the FAR denominator ("land used as the building site") is **UNVERIFIED**. Default: exclude it from the buildable polygon, keep it in the FAR denominator, and show a warning. Use its ROW line as the road boundary for setbacks (ข้อ 36 last paragraph).

Implementation reading (UNVERIFIED):
- For the condo ">10,000 m² on a ≥30 m road" exception, require a plot edge ≥30 m long that abuts a road segment the user marks as ROW ≥30 m.
- The "connects onward" and "within 500 m of the ROW edge" conditions describe the road network. The tool cannot check them, so it should ask the user to confirm.
- The 500 m station route (ข้อ 37) has **no frontage requirement**.

Consequence: in ย.7 a narrow 20 m-frontage plot on a 30 m road fails the road route even though it touches the road. If it is >500 m from a platform, it is capped at 10,000 m² of condo.

### 2.5 FAR bonus (2013 plan ข้อ 50–57): VERIFIED text

The overall cap is **ข้อ 57**: all bonuses combined ≤ **+20%** of FAR. The 20% is read as relative (FAR × 1.2); the text says "อัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดินรวมกันเพิ่มได้ไม่เกินร้อยละยี่สิบ".

| Clause | Trigger | Bonus | Limit | Applies to condo? |
|---|---|---|---|---|
| ข้อ 52 | Residential use providing below-market housing (price ≥20% below the project's average price per m²) or housing for existing residents (within 5 km). "Low income" = earning ≥20% below Bangkok's average household income. | ≤ +20% FAR | Added floor area ≤ **4×** the affordable area | **Yes** |
| ข้อ 53 | Zones ย.8–ย.10 and พ.2–พ.5, **"อาคารสาธารณะ"** providing public open space or a public park on the plot | ≤ +20% | ≤ **5×** the public open space; the space may not double-count the building-control open space | **Probably no**, see note |
| ข้อ 54 | **"อาคารสาธารณะ"** within 500 m of mass-transit stations or listed rail stations (Thailand Cultural Centre, On Nut, Lat Krabang, Hua Mak, Bang Bamru, Taling Chan, Udom Suk, Bearing) providing **extra** public parking | ≤ +20% | ≤ **30 m² per extra stall**; extra stalls exempt from FAR and OSR | **Probably no** |
| ข้อ 55 | Rainwater retention ≥1 m³ per 50 m² of land | +5% at 1 m³/50 m²; proportionally more | ≤ +20% | **Yes** (any building) |
| ข้อ 56 | Energy-conservation building certified by the Thai Green Building Institute (or other approved body), levels 1–4 | +5 / +10 / +15 / +20% | ≤ +20% | **Yes** |

Note on "อาคารสาธารณะ" (public building) in ข้อ 53/54:
- The Building Control Act defines a public building as one used for gatherings of people (theatres, hotels, hospitals, schools, markets, department stores and similar).
- I could not retrieve the Act's current ข้อ/มาตรา 4 text in this session, so the definition is UNVERIFIED here.
- A condo is an "อาคารอยู่อาศัยรวม", which is a different category. If that holds, **a pure condo can only use ข้อ 52, 55 and 56.** Implement it so, and flag it.

Rainwater bonus formula (ข้อ 55), my reading:

```
ratio = storage_m3 / (siteArea / 50)
bonus = ratio < 1 ? 0 : min(0.20, 0.05 × ratio)
```

Below 1 m³ per 50 m² there is no bonus; 4 m³ per 50 m² gives the full 20%. UNVERIFIED that the scaling above the floor is linear. The text says "ให้มีอัตราส่วน...เพิ่มได้ตามสัดส่วน" ("proportionally").

### 2.6 Plan OSR vs building-control open space: these are different things

| Rule | Measure | Value | Source | Tag |
|---|---|---|---|---|
| Plan OSR (2013) | open space ÷ **total floor area** | zone value (ย.7: 6%) | MR 2556 ข้อ 14(2) | VERIFIED |
| Plan permeable share | permeable planting ÷ that open space | ≥50% | every zone clause | VERIFIED |
| MR 55 ข้อ 33(1) | open space ÷ **largest single floor** of the building, residential / condo | ≥30% | MR 55 | VERIFIED |
| MR 55 ข้อ 33(2) | same, non-residential | ≥10% | MR 55 | VERIFIED |
| BMA 2544 ข้อ 52(1) | open space ÷ **land area**, residential | ≥30% | BMA 2544 | VERIFIED |
| BMA 2544 ข้อ 52(2) | open space ÷ land area, non-residential (30% if any residential use) | ≥10% | BMA 2544 | VERIFIED |
| MR 33 ข้อ 6(1) | open space ÷ **land area**, high-rise/extra-large residential | ≥30% | MR 33 | VERIFIED |
| MR 33 ข้อ 6(2) | non-residential HR/XL (30% if residential use included) | ≥10% | MR 33 | VERIFIED |

What counts as open space (ที่ว่าง; MR 55 ข้อ 1, MR 33 ข้อ 1, BMA ข้อ 5(36)): area free of roof or structure overhead. It may be a pond, pool, wastewater pit, refuse area or **outdoor parking**. It includes structures **≤1.20 m above ground** with nothing above them. VERIFIED.

Implication: an uncovered surface car park counts as open space for building control. For the plan's ≥50% permeable rule it is permeable only if paved with a permeable surface. UNVERIFIED how BMA officials treat grass-block parking.

The term "building coverage ratio" does not appear in any of these documents. **Maximum coverage is derived:** `coverage ≤ siteArea − requiredOpenSpace`. VERIFIED that no explicit BCR clause exists in the texts I read (MR 55, MR 33, BMA 2544, plan 2556).

---

## 3. Setbacks and spacing

Units: metres. "ROW" = public-road right-of-way width (เขตทาง; BMA ข้อ 5(4) defines it as the full width between land lines, including carriageway, footpaths, planting strips and ditches).

### 3.1 Road setbacks (building line, แนวอาคาร)

"Building line" = the outermost wall, column or stair, excluding open external fire stairs (MR 68 amendment to MR 55 ข้อ 1). VERIFIED.

| Case | MR 55 ข้อ 41 | BMA 2544 ข้อ 50 | Tag |
|---|---|---|---|
| Any building, road ROW < 6 m | ≥3 m from **road centreline** | ≥3 m from centreline; nothing may project into it, except a boundary fence ≤2 m high | VERIFIED |
| Buildings > 2 storeys or > 8 m, plus row houses, commercial, factories, public buildings, signs, warehouses (BMA adds "large buildings" and exempts residential ≤3 storeys / ≤10 m / ≤1,000 m²): road ROW < 10 m | ≥6 m from centreline | ≥6 m from centreline | VERIFIED |
| same, 10 m ≤ ROW ≤ 20 m | ≥ ROW/10 from the **road boundary** | ≥ ROW/10 from the road boundary | VERIFIED |
| same, ROW > 20 m | ≥2 m from the road boundary | ≥2 m from the road boundary | VERIFIED |
| High-rise or extra-large building | — | — | MR 33 ข้อ 4: outermost part, **above or below ground**, ≥**6 m** from any public road (and from others' land); foundations excluded. VERIFIED |

Converted to a setback from the **plot's road boundary** (assuming the plot line = the road ROW line, or the plan's ก/ข widening line under ข้อ 36):

```
if ROW < 6:          s = max(0, 3 − ROW/2)   // all buildings
if tall (>2 storeys or >8 m):
   if ROW < 10:      s = max(s, 6 − ROW/2)
   elif ROW <= 20:   s = max(s, ROW/10)
   else:             s = max(s, 2)
if highRise or extraLarge: s = max(s, 6)
```

For a condo high-rise the 6 m rule dominates on every road over 4 m wide.

Ambiguity:
- MR 55 says "≥10 but not over 20" and "over 20", so exactly 20 m → ROW/10 = 2 m. Both formulas agree at 20.
- At 10 m: 6 − 5 = 1 m vs 10/10 = 1 m, also continuous.

### 3.2 Waterways (MR 55 ข้อ 42): VERIFIED; the BMA 2544 ordinance has no separate waterway setback

| Waterway | Setback from the waterway boundary |
|---|---|
| Public waterway (river, canal/khlong, ditch) width < 10 m | ≥3 m |
| width ≥ 10 m | ≥6 m |
| Large water body (lake, reservoir, sea) | ≥12 m |
| Exempt | bridges, dams, fences, drains, piers, signs, boat docks, and **open space used as parking** |

### 3.3 Plot-boundary setbacks (side and rear)

| Rule | Text | Tag |
|---|---|---|
| MR 55 ข้อ 50(1) | Wall with windows, doors, vents or light openings, or a balcony, building height ≤ 9 m: ≥ **2 m** from the boundary | VERIFIED |
| MR 55 ข้อ 50(2) | same, 9 m < height < 23 m: ≥ **3 m** | VERIFIED |
| MR 55 ข้อ 50 ¶2 | Walls closer than these must be **blank walls** (ผนังทึบ, defined by MR 68: no openings; glass block ≥9 cm allowed if ≥1.80 m above the floor and ≤10% of the wall area per storey) and ≥0.50 m from the boundary. Building **on** the boundary is allowed only if height ≤15 m and with the neighbour's written consent. Roof-deck parapet on that side: blank, ≥1.80 m. | VERIFIED |
| BMA 2544 ข้อ 54 | Openings, doors, windows, vents or balcony edges for storeys ≤2 or ≤9 m: ≥2 m from private land. For **storey 3 and up or >9 m: ≥3 m** (**no upper height bound**) | VERIFIED |
| BMA 2544 ข้อ 55 | Clear space around the building ≥1 m if height ≤15 m (except houses ≤300 m²); **≥2 m if height >15 m**. May not be shared with another building's space, except with a high-rise/XL building's. | VERIFIED |
| MR 33 ข้อ 4 | High-rise or extra-large: **≥6 m from others' land on all sides**, including basements; foundations excluded | VERIFIED |
| MR 55 ข้อ 48 | Two buildings on the same owner's land, opening-to-opening: both ≤9 m → 4 m; ≤9 m and 9–23 m → 5 m; both 9–23 m → 6 m. Blank-to-opening: 2 / 3 / 2.5 / 3.5 m by height band; blank-to-blank (15–23 m) → 1 m. (Matters if the tool massed a podium plus a tower as separate buildings.) | VERIFIED |
| Thresholds | 9 m, 15 m, 23 m are all measured as "building height". MR 55 has no rule for ≥23 m because MR 33 takes over (6 m). | VERIFIED |

Condo-tower summary: any part ≥23 m (or any building ≥10,000 m²) → **6 m from every plot boundary and road, for the entire building including podium and basement** (MR 33 ข้อ 4). For a low-rise (<23 m, <10,000 m²) block: 3 m with openings, or ≥0.5 m blank (BMA ข้อ 55 makes it ≥2 m above 15 m).

UNVERIFIED: whether officials apply the 6 m only to the parts of a building that are themselves ≥23 m. The text says "ส่วนที่เป็นขอบเขตนอกสุดของอาคารสูง" ("outermost boundary of the high-rise building"), which I read as the whole building.

### 3.4 Front open space and frontage: BMA 2544 ข้อ 52(6) and ข้อ 53 (VERIFIED text, interpretation UNVERIFIED)

- **ข้อ 52(6):** commercial buildings, factories, warehouses, public buildings, and **buildings >2 storeys or >8 m** need front open space:
  - ≥**6 m** wide.
  - ≥**12 m** wide if the building has >3 storeys.
  - Residential buildings ≤3 storeys not on a public way are excepted.
  - The open space must be continuous over a length ≥ **1/6 of the building's external perimeter**. Side open space connected to the front may count.
  - It must connect to an internal road ≥**6 m** wide leading to a public way.
  - A drive-under passage needs ≥**5 m** clear height.
- **ข้อ 53:** buildings **on a public way** that do not need the ข้อ 52(6) space must instead have:
  - the façade facing the public way > **1/8 of the building's external perimeter**;
  - that façade within **20 m** of the public way.

My reading: a tower set ≤20 m back from the road, with >1/8 of its perimeter facing the road, satisfies ข้อ 53. Otherwise a 12 m-wide front open space along ≥1/6 of the perimeter is needed. Check both and report which one passes.

### 3.5 Access, frontage and fire lane for high-rise / extra-large (MR 33): VERIFIED

| Rule | Value |
|---|---|
| ข้อ 2 ¶1: HR/XL with total floor area **≤ 30,000 m²** | One plot side **≥12 m** abutting a public road with **ROW ≥10 m**. That road must run continuously to another public road with ROW ≥10 m. |
| ข้อ 2 ¶2: HR/XL **> 30,000 m²** | One plot side ≥12 m abutting a public road with **ROW ≥18 m**, connecting to another ≥18 m road |
| ข้อ 2 ¶3 | The 12 m-wide strip of land from the road frontage must run **continuously to the building** and be **open** for fire-truck access |
| ข้อ 3 | A road with a **traffic surface ≥6 m wide, open to the sky, all around the building** for fire trucks. It may lie within a statutory road no-build strip. Where a planned widening line exists, measure from that line. |
| ข้อ 4 | 6 m from neighbours and public roads (see §3.3) |
| ข้อ 5 | FAR of all buildings on the plot **≤10:1** when any HR/XL is on it |
| ข้อ 6 | Open space ≥30% of land (residential) |
| Definitions (ข้อ 1) | **High-rise**: height **≥23.00 m**, measured from ground to the **roof-deck floor** (to the top of the top-storey wall for gable/hip roofs). **Extra-large**: total floor area of all floors, **or of any single floor**, in one building **≥10,000 m²** |

Note: MR 33 says "≥23 m"; MR 55 bands say "not reaching 23 m" (ไม่ถึง 23 เมตร). They are consistent, with 23.00 m exactly counting as high-rise.

**Thresholds to expose in the UI as cliffs:**
- Height 23 m → MR 33 regime (6 m setbacks, fire ring, 12 m frontage on a ≥10 m road).
- 10,000 m² → extra-large (same regime even if low).
- 30,000 m² → 18 m road needed.
- 10,000 m² of condo in ย.5–ย.7 → 30 m road / 500 m station test.

### 3.6 Fire-truck lane

Only MR 33 ข้อ 2–3 above (VERIFIED). The BMA ordinance adds the ข้อ 52(6) 6 m internal road. I did not research the national fire-safety MRs (MR 39, MR 47) in detail. UNVERIFIED that nothing else changes the envelope.

---

## 4. Height

### 4.1 Road-width height plane: MR 55 ข้อ 44–46 and BMA 2544 ข้อ 49 (VERIFIED)

- **MR 55 ข้อ 44 ¶1**: "ความสูงของอาคารไม่ว่าจากจุดหนึ่งจุดใด ต้องไม่เกินสองเท่าของระยะราบ วัดจากจุดนั้นไปตั้งฉากกับแนวเขตด้านตรงข้ามของถนนสาธารณะที่อยู่ใกล้อาคารนั้นที่สุด". The building height **at any point** must not exceed **2 × the horizontal distance measured perpendicularly from that point to the far (opposite) boundary of the nearest public road**.
- **¶2, height measurement**: vertical from **road level or the ground level of the site** up to the **highest part of the building**. For gable or hip roofs, to the top of the top-storey wall.
- **¶3 (added by MR 68, 2563)**: other structures that are themselves "buildings" (for example rooftop tanks, antennae) **are not counted** in building height.
- **BMA 2544 ข้อ 49**: the same 2× rule ("แนวถนนด้านตรงข้าม", the opposite road line). **Exception**: if the building is on, or within **100 m** of, a public road **≥80 m wide**, with an access to it ≥**12 m** wide, measure from the widest road.
  - BMA ข้อ 5(7) defines building height as measured **from road level** to the highest part.
- **MR 55 ข้อ 45, two parallel roads of unequal width**: a building between two unequal public roads ≤60 m apart, with its width along the wider road ≤60 m, uses the far boundary of the **wider** road.
- **MR 55 ข้อ 46, corner of two unequal roads**: use the **wider** road. The building's length along the **narrower** road must be ≤**60 m** (≤15 m for row houses).

Geometry: let the nearest public road be a strip with near boundary line L₁ (the plot's road edge, or the widening line) and far boundary L₂ = L₁ offset by ROW. Then:

```
Hmax(p) = 2 · dist⊥(p, L₂) = 2 · (dist⊥(p, L₁) + ROW)
```

This is a **sloped plane rising at 2:1 away from the road**. It is not a single number. Worked example: on a 30 m road with a 6 m setback, at the building face Hmax = 2 × (6 + 30) = 72 m, and 10 m further back it is 92 m. On a 10 m soi with a 6 m setback, the face may rise only 32 m; to reach 60 m the mass must sit 20 m behind the plot line. Massing steps back accordingly.

UNVERIFIED nuances:
- "Nearest public road": for a plot touching only a soi, the soi governs even if a big road is 50 m away (except via the BMA 80 m-road rule or the MR 55 ข้อ 45/46 cases).
- Whether the nearest road is judged from each point or from the building as a whole. I read "the nearest road to the building".
- How to treat curved roads: use the perpendicular to the local far-boundary segment.

### 4.2 Two different "heights" in one tool (VERIFIED definitions)

| Purpose | Measured from → to |
|---|---|
| High-rise threshold (MR 33, BMA ข้อ 5(110)) | ground at the site → **roof-deck floor** (top-storey wall top for pitched roofs) |
| BMA "large building" (ข้อ 5(101)) | ground → roof-deck floor; ≥15 m and >1,000 m², or >2,000 m² total |
| Road height plane (MR 55 ข้อ 44; BMA ข้อ 49 and ข้อ 5(7)) | road level (or ground) → **highest part**, excluding rooftop structures per MR 68 |
| Boundary-setback bands (MR 55 ข้อ 50; BMA ข้อ 54, 55) | "building height". Not separately defined in MR 55; use the ข้อ 44 measurement. UNVERIFIED |

A tower with a 22.9 m roof deck plus a 3 m parapet and lift overrun is **not** high-rise. Its highest point (25.9 m) still has to satisfy the 2:1 plane. That is a classic "break it" test.

### 4.3 Bangkok-specific height limits by zone or special area

- The **2013 comprehensive plan sets no height limit for the ย./พ. zones.** I found no height clause in ข้อ 8–22. VERIFIED by reading the FAR/OSR and prohibition clauses. The draft summary table shows "ความสูงสูงสุด 12 m" only for a few low-density/rural columns. UNVERIFIED which ones.
- Separate building-control "no-build / height" ordinances and MRs overlay specific areas. ASA's law-news index lists:
  - the Rattanakosin Island and continuous areas (MR, 2020);
  - around the King Taksin and Victory Monuments (MR, 2020);
  - the Thonburi bank opposite Rattanakosin (2020);
  - around Suvarnabhumi airport (BMA ordinance, 2020);
  - eleven obsolete BMA no-build ordinances repealed in 2023;
  - Don Mueang airport aviation safety zones (in ASA's "commonly used laws" pack).

  I did **not** extract their numbers. The recommended zone should be checked against these overlays (§6). UNVERIFIED / out of scope.

---

## 5. Condo-specific requirements that affect massing

### 5.1 Parking: count, stall and aisle sizes

| Rule | Value | Source | Tag |
|---|---|---|---|
| Which condos need parking | Condos (อาคารอยู่อาศัยรวมหรืออาคารชุด) **with any unit ≥60 m²**; and every "large building" (อาคารขนาดใหญ่) | BMA 2544 ข้อ 83(3), 83(16); MR 7 ข้อ 2(3), 2(7) | VERIFIED |
| Large building | BMA ข้อ 5(101): total floor area **>2,000 m²**, or height ≥15 m **and** >1,000 m². MR 7 ข้อ 1(12): ≥15 m and >1,000 m², or >2,000 m² total or on one floor | BMA, MR 7 | VERIFIED |
| Condo rate | **1 stall per unit** (BMA ข้อ 84(3): "1 คันต่อ 1 ห้องชุด"; MR 7 ข้อ 3(1)(ค): 1 per family, inside the 1971 Bangkok Metropolis municipality) | BMA, MR 7 | VERIFIED |
| Large-building rate | **1 stall per 120 m² of floor area, OR the sum of per-use rates, whichever is greater** | BMA ข้อ 84(16); MR 7 ข้อ 3(1)(ซ) | VERIFIED |
| Rounding | Round up fractions per use category (BMA ข้อ 85); MR 7: "เศษของ 120 ตารางเมตร ให้คิดเป็น 120 ตารางเมตร" | BMA, MR 7 | VERIFIED |
| Outside the old municipality (MR 7 ข้อ 3(2)) | condo 1 per 2 units; large building 1 per 240 m² | MR 7 | VERIFIED text. The BMA ordinance (ข้อ 84) sets 1 per unit and 1 per 120 m² for all of Bangkok, so the stricter BMA rate applies city-wide in practice. Inference: CORROBORATED |
| Stall size | Perpendicular 2.40 × 5.00; parallel or <30°: 2.40 × 6.00; ≥30° angled: 2.40 × 5.50 | MR 41 ข้อ 2; BMA ข้อ 86 | VERIFIED |
| Aisle (ทางวิ่ง) widths | <30°: ≥3.50; 30°–60°: ≥5.50; >60° (incl. 90°): ≥**6.00** | BMA ข้อ 88 | VERIFIED |
| Entrance/exit | ≥6.00 m two-way; ≥3.50 m one-way each | BMA ข้อ 88; MR 7 ข้อ 8 | VERIFIED |
| Driveway location | Centreline ≥**20 m** from the start of a junction curve; ≥50 m from the foot of a bridge ramp | BMA ข้อ 89, 91; MR 7 ข้อ 8 | VERIFIED |
| ≥15 stalls | The car access must connect to a public way ≥**6 m** wide, continuing to a wider public way | BMA ข้อ 90 | VERIFIED |
| Clear height | ≥2.10 m under the next floor (parking, aisles and ramps) | MR 41 ข้อ 4 | VERIFIED |
| Off-site parking | Allowed within 200 m walking distance | BMA ข้อ 87; MR 7 ข้อ 6 | VERIFIED |
| Mechanical (automated) parking building | Car-path from the entrance to the building ≥20 m; floors/walls ≥6 m from others' land and public roads if ≥23 m tall, else ≥3 m | MR 41 ข้อ 6 | VERIFIED |
| Open-deck parking | Openings ≥20% of the floor area and ≥3 m from neighbours; else mechanical ventilation. Walls <3 m from a boundary must be fire walls. | BMA ข้อ 95, 96 | VERIFIED |

**Resulting formula for a condo that is a large building:**

```
N = max( count(units with area ≥ 60 m²), ceil(floorArea / 120) )
```

UNVERIFIED:
- Whether "floorArea" for the 120 m² test **includes the parking floors themselves**. A circular inclusion would inflate N. Practitioners usually compute it on the non-parking floor area. Expose it as an assumption.
- Whether units <60 m² are excluded from the per-use sum. The text implies yes, since ข้อ 83(3) only lists condos with units ≥60 m², but the 1/120 m² floor applies regardless.

The brief's "per unit over 60 m², or per 120 m², whichever is greater" is **confirmed for large buildings**.

Typical planning allowance: ~25–30 m² of gross parking-floor area per stall including aisles and ramps. UNVERIFIED rule of thumb, but it follows from a 2.4 × 5 stall plus half of a 6 m aisle (12 + 14.4 = 26.4 m²) plus ramps and cores.

### 5.2 Unit and room minimums (MR 55): VERIFIED

| Item | Value | Clause |
|---|---|---|
| Minimum area of a dwelling unit in a condo (อาคารอยู่อาศัยรวม) | **≥20 m²** | MR 55 ข้อ 19 |
| Bedroom | ≥8 m², narrow side ≥2.50 m | ข้อ 20 |
| Corridor in a condo | ≥1.50 m | ข้อ 21 |
| Floor-to-floor (vertical clear distance, ระยะดิ่ง, "measured floor to floor") for dwelling rooms and corridors | ≥**2.60 m** | ข้อ 22 |
| Office, dining | ≥3.00 m | ข้อ 22 |
| Shops, meeting rooms | ≥3.50 m | ข้อ 22 |
| Balcony | ≥2.20 m | ข้อ 22 |
| Mezzanine | allowed in rooms ≥5 m high, ≤40% of the room area | ข้อ 22 |
| Basements of HR/XL buildings | may not be used for dwelling | MR 33 ข้อ 7 |

### 5.3 EIA thresholds

| Rule | Value | Source | Tag |
|---|---|---|---|
| Condo (อาคารชุด / อาคารอยู่อาศัยรวม) requiring an EIA | **≥80 units, or usable area (พื้นที่ใช้สอย) ≥4,000 m²** | ONEP (the official EIA agency) consumer page https://www.onep.go.th/eia/ ; Thansettakij; theses | CORROBORATED. The 2566 MNRE announcement PDF (ASA `ma66-06.pdf`) has a broken font layer, so I could not read the table text. ASA states the 2566 consolidation kept building thresholds unchanged. ASA's summary of the 2568 (No. 2) amendment mentions changes only to item 27 (large commercial/office buildings ≥10,000 m²), not to residential. |
| High-rise ≥23 m as an EIA trigger | My understanding (not verified this session) is that 23 m triggers an EIA only for **specific locations**: near rivers, coasts, lakes and similar protected areas. | — | UNVERIFIED |

EIA does not change the envelope. It adds roughly a year to approval. Show it as an informational flag.

### 5.4 Developer norms (for concept designs, not law): all UNVERIFIED

I found no authoritative Bangkok benchmark. These are assumptions to expose as sliders:

| Parameter | Working assumption | Basis |
|---|---|---|
| Net saleable / GFA (efficiency) | 60–70% for a high-rise condo with parking counted in GFA | industry rule of thumb, no source found |
| Floor-to-floor, residential | 2.9–3.1 m (legal minimum ≥2.60 m) | MR 55 minimum + typical slab and services allowance |
| Floor-to-floor, podium parking | ~3.0 m | ≥2.10 m clear (MR 41) + beams |
| Typical units | studio / 1-bed 22–35 m², 2-bed 45–70 m² | market listings; ≥20 m² legal minimum |
| Foreign quota | ≤49% of saleable area (Condominium Act) | search result; not envelope-relevant |

---

## 6. Recommended zone: ย.7 (2013 plan)

**Why ย.7:**

1. **Condos are a primary, explicitly anticipated use.** ข้อ 7(2)(ค) describes ย.7 as "รองรับการอยู่อาศัยในบริเวณพื้นที่ต่อเนื่องกับเขตเมืองชั้นในซึ่งอยู่ในเขตการให้บริการของระบบขนส่งมวลชน": residential land next to the inner city, inside the mass-transit service area. That is exactly the mid-market transit condo belt. Thirty sub-areas (ย.7-1 to ย.7-30) mean plenty of real plots.
2. **The rules interact non-trivially, and all of it is verified text:**
   - FAR 5 → GFA = 5A. Bonus up to 6A (ข้อ 52/55/56, cap ข้อ 57).
   - **Condo >10,000 m² only if road ROW ≥30 m with a ≥30 m frontage (ข้อ 36(4)), or within 500 m of a platform edge (ข้อ 37).** At FAR 5 this binds for plots > 2,000 m² (≈1.25 rai). That is most condo plots, so moving the station marker or the road width visibly changes GFA.
   - At ≥23 m or ≥10,000 m² → MR 33: 12 m frontage on a ≥10 m road (≥18 m above 30,000 m²; at FAR 5 that is plots over 6,000 m²), 6 m clearances, fire ring, open space ≥30% of land.
   - OSR 6% × FAR 5 = 30% of land, the same as the building-control 30%. With a bonus the plan OSR dominates (6% × 6 = 36%).
   - Height = 2× distance to the far side of the nearest road. A soi-access plot is height-limited near the front, a 30 m-road plot much less.
   - Parking: 1 per 120 m² vs 1 per unit ≥60 m², whichever is greater; parking floor area counts in GFA.
3. **Contrast with the alternatives:**
   - ย.8–ย.10 and พ.4–พ.5 have **no condo-size or transit test**, so they have fewer interactions.
   - พ.3 has two tiers (5,000/10,000) and would also work, but commercial zones are less "condo-first".
   - ย.5/ย.6 share ย.7's rule with lower FAR (4 / 4.5). Implementing ย.7 makes ย.5/ย.6 nearly free: change the FAR/OSR values and the public-housing exception flag.

**Real neighbourhoods in ย.7: UNVERIFIED.** I could not confirm a street-level mapping of ย.7 sub-areas from two independent sources in this session. Secondary articles describe orange ย.5–ย.7 as the belt around the inner city along rail lines. Candidates to check on the official map before naming them in the product:
- the BTS Sukhumvit line beyond On Nut (Bang Chak, Punnawithi, Udom Suk);
- MRT Blue Line corridors (Lat Phrao / Ratchadaphisek outer segments, Tha Phra / Bang Phai);
- BTS/Purple-line catchments (Tao Poon, Bang Pho).

Check via:
- the BMA city-planning map viewer of the City Planning and Urban Development Department (สำนักการวางผังและพัฒนาเมือง);
- the Department of Lands viewer https://landsmaps.dol.go.th (shows the plan layer per parcel);
- ASA's "การใช้ประโยชน์ที่ดินตามผังเมืองรวมกรุงเทพมหานคร" A4 map set.

Also check any chosen site against airport height zones and the monument / Rattanakosin no-build areas (§4.3). Do not claim a neighbourhood is ย.7 in the UI without that check.

---

## 7. Conflicts between sources (shown, not resolved silently)

| Topic | Source A | Source B | Tool behaviour |
|---|---|---|---|
| Open-space base | MR 55 ข้อ 33: 30% of the **largest floor** | BMA ข้อ 52(1), MR 33 ข้อ 6: 30% of **land** | max of all, plus the plan OSR × GFA |
| Side setback with openings above 9 m | MR 55 ข้อ 50: 3 m for 9–<23 m | BMA ข้อ 54: 3 m for storey 3+ or >9 m, no upper limit | max; for ≥23 m MR 33 sets 6 m anyway |
| Side clearance all round | MR 55: 0.5 m (blank) | BMA ข้อ 55: 1 m (≤15 m), 2 m (>15 m) | max |
| Height measurement | MR 55: road **or** ground level → highest part | BMA ข้อ 5(7): from **road** level | use the lower of road and ground as the base (stricter); flag |
| BMA 80 m-road height exception | BMA ข้อ 49 ¶2 | not in MR 55 | apply only if the user flags a ≥80 m road within 100 m |
| FAR cap | plan zone FAR × (1 + bonus) (ย.7 → 6.0) | MR 33 ข้อ 5: ≤10 | min; binds only in พ.5 with a bonus (12 > 10) |
| Parking rate outside the old municipality | MR 7 ข้อ 3(2): 1 per 2 units, 1 per 240 m² | BMA ข้อ 84: 1 per unit, 1 per 120 m² (all Bangkok) | BMA (stricter) |
| Parking in FAR | Common assumption (brief): excluded | 2013 text: no exclusion; ข้อ 54 implies inclusion | include by default, with a toggle |
| Draft vs 2013 zone codes | draft ย.7 = FAR 4 / OSR 9 | 2013 ย.7 = FAR 5 / OSR 6 | key by planVersion |
| Station distance | 2013 ข้อ 37: from the **platform edge** | draft ข้อ 43: from the **station boundary** | per planVersion |
| Condo size measure | 2013: "พื้นที่อาคารรวม" (no per-building words) | draft: "...ในหลังเดียวกัน" (per building) | 2013: whole plot (conservative), toggle |

---

## 8. Rules as implementable pseudo-code

```ts
// ---------- Inputs ----------
type RoadEdge = {
  segment: [Pt, Pt];          // plot boundary segment abutting the road (or the plan ก/ข widening line)
  rowWidth: number;           // public road right-of-way width, m (เขตทาง)
  isPublic: boolean;
  connectsOnward: boolean;    // user-confirmed: ข้อ 36 / MR33 ข้อ 2 "continuous to another public road of ≥ X"
};
type Waterway = { segment: [Pt, Pt]; width: number; isLargeWaterBody: boolean };
type Input = {
  plot: Polygon;              // site polygon; area A
  roads: RoadEdge[];
  waterways: Waterway[];
  zone: "ย.7";                // data table keyed by planVersion
  planVersion: "2556";        // or "draft-r4"
  buildingType: "condo";
  distToPlatformEdge: number; // m, shortest plot→platform polygon (2013 ข้อ 37)
  bonus: { affordableArea?: number; rainwaterM3?: number; greenLevel?: 0|1|2|3|4 };
  units?: { area: number }[]; // from concept design
  parkingCountsInFAR: boolean;          // default true (2013)
  condoSizeTestScope: "plot" | "building"; // default "plot"
};

const ZONE_2556 = { "ย.7": { far: 5, osr: 0.06, condoBigNeeds: { road: 30, stationM: 500, above: 10_000 } } };

// ---------- 1. Max GFA ----------
A = area(plot)
bonusFrac = min(0.20,                                        // ข้อ 57
    (bonus.affordableArea ? min(0.20, 4*bonus.affordableArea / (A*far)) : 0)   // ข้อ 52 (4x cap)
  + rainBonus(bonus.rainwaterM3 / (A/50))   // ข้อ 55: ratio<1 → 0; else min(.20, .05*ratio) (linear: assumption)
  + [0, .05, .10, .15, .20][bonus.greenLevel ?? 0])                            // ข้อ 56
  // ข้อ 53 / 54 excluded for condos ("อาคารสาธารณะ" only) — flag
farEff = far * (1 + bonusFrac)
gfaPlan = A * farEff

// condo size cliff (ย.5–ย.7, ข้อ 12–14 item 11)
roadRoute = roads.some(r => r.isPublic && r.rowWidth >= 30 && len(r.segment) >= 30 && r.connectsOnward) // ข้อ 36(4)
stationRoute = distToPlatformEdge <= 500                                                                  // ข้อ 37
gfaCondoCap = (roadRoute || stationRoute) ? Infinity : 10_000

// high-rise / extra-large gating (MR 33 ข้อ 2)
bestFront = max over public roads r with r.connectsOnward of {row: r.rowWidth, len: len(r.segment)}
hrAllowed  = exists r: r.isPublic && r.connectsOnward && r.rowWidth >= 10 && len(r.segment) >= 12
hrBigAllowed = exists r: r.isPublic && r.connectsOnward && r.rowWidth >= 18 && len(r.segment) >= 12
gfaHRcap = hrBigAllowed ? Infinity : hrAllowed ? 30_000 : 10_000 - ε   // and height < 23 if !hrAllowed
heightCapNoHR = hrAllowed ? Infinity : 23 - ε                             // to roof-deck floor

gfaMax = min(gfaPlan, gfaCondoCap, gfaHRcap, isHRorXL ? A*10 : Infinity)  // MR 33 ข้อ 5
// NB: GFA includes parking floor area when parkingCountsInFAR

// ---------- 2. Min open space ----------
openMin(gfa, maxFloorPlate) = max(
   zone.osr * gfa,            // plan OSR (2013: ÷ total floor area)
   0.30 * A,                  // BMA ข้อ 52(1); MR 33 ข้อ 6(1) if HR/XL
   0.30 * maxFloorPlate)      // MR 55 ข้อ 33(1)
// plan: ≥50% of "the open space" must be permeable planting. The plan floors its OSR at the
// building-control minimum, so the conservative base is the floored value (UNVERIFIED; toggle):
permeableMin = 0.5 * max(zone.osr * gfa, buildingControlMin)   // alt reading: 0.5 * zone.osr * gfa
//   e.g. 5,000 m² plot, GFA capped at 10,000: 0.5*max(600, 1,500) = 750 m² vs 300 m²
coverageMax = A - openMin(...)             // derived; no explicit BCR clause
// open space = no roof/structure above; may include outdoor parking, pools; structures ≤1.20 m count

// ---------- 3. Setback per edge (offset of the buildable polygon) ----------
isHRorXL = heightToRoofDeck >= 23 || gfaBuilding >= 10_000 || maxFloor >= 10_000
for each road edge r:
   s = r.rowWidth < 6 ? max(0, 3 - r.rowWidth/2) : 0        // MR55 ข้อ41¶1, BMA ข้อ50¶1
   if (storeys > 2 || height > 8):                          // condo always
      s = max(s, r.rowWidth < 10 ? 6 - r.rowWidth/2
               : r.rowWidth <= 20 ? r.rowWidth/10 : 2)      // MR55 ข้อ41¶2, BMA ข้อ50¶2
   if isHRorXL: s = max(s, 6)                               // MR33 ข้อ4 (incl. basement)
   if height > 15: s = max(s, 2)                            // BMA ข้อ55
for each waterway w: s = w.isLargeWaterBody ? 12 : (w.width < 10 ? 3 : 6)  // MR55 ข้อ42
for each other boundary edge:
   s = isHRorXL ? 6                                         // MR33 ข้อ4
     : wallHasOpenings ? (height <= 9 ? 2 : 3)              // MR55 ข้อ50, BMA ข้อ54 (3 m above storey 2)
     : max(0.5, height > 15 ? 2 : 1)                        // MR55 ข้อ50¶2 (blank), BMA ข้อ55
buildable = plot inset per-edge by s     // basement too, if isHRorXL
// HR/XL extras: 6 m-wide open-sky fire road all around the building (MR33 ข้อ3),
//   12 m-wide open access strip from road frontage to building (MR33 ข้อ2¶3)
// BMA ข้อ52(6)/53: either façade within 20 m of the public way & > 1/8 perimeter facing it,
//   or front open space ≥12 m wide (>3 storeys) along ≥1/6 perimeter, linked to a ≥6 m internal road

// ---------- 4. Height constraint ----------
nearest = nearest public road to the building (ข้อ44); if two unequal roads either side ≤60 m apart and
          building width along wider ≤60 → wider road (ข้อ45); if corner of unequal roads → wider road,
          and length along narrower ≤ 60 m (ข้อ46); BMA ข้อ49¶2: road ≥80 m within 100 m with ≥12 m access → that road
farLine = nearest.segment offset outward by nearest.rowWidth
Hmax(p) = 2 * perpDist(p, farLine)        // measured from road (or ground) level to highest part,
                                          // rooftop "other structures" excluded (MR 68)
if !hrAllowed: roofDeck < 23
envelope = extrude(buildable) ∩ { (p,z) : z ≤ Hmax(p) }

// ---------- 5. Condo checks ----------
unit.area >= 20                                  // MR55 ข้อ19
floorToFloor >= 2.60 (dwelling)                  // MR55 ข้อ22
isLarge = gfaBuilding > 2000 || (roofDeck >= 15 && gfaBuilding > 1000)       // BMA ข้อ5(101)
parking = isLarge ? max(count(u.area >= 60), ceil(gfaNonParking / 120))       // BMA ข้อ84(3),(16); base: assumption
                  : count(u.area >= 60)
stall 2.4×5.0 (90°), aisle ≥ 6.0; driveway ≥ 6.0 (2-way), ≥ 20 m from junction curve
eiaRequired = units.length >= 80 || usableArea >= 4000                       // informational
```

Outputs: `gfaMax` (with the binding constraint named), `openMin` and `permeableMin`, the per-edge setback list, `Hmax(p)` as a plane plus the 23 m roof-deck cap if not HR-eligible, the parking count, and pass/fail flags.

---

## 9. Things I could not verify

1. **Legal text of the City Planning Act B.E. 2562 transitional section** (reported as มาตรา 111) that keeps the 2013 plan alive despite its own 5-year clause. Corroborated by a Yotathai summary and BMA statements only.
2. **Any event after 9 Nov 2026** for the 4th revision: petition count, review dates, revised enactment target. The "late 2027" date is a forecast from mid-2026 news.
3. **Street-level mapping of ย.7 sub-areas to named neighbourhoods.** Not confirmed from two sources; check on the BMA / DOL map viewers.
4. **Whether a condo counts as "อาคารสาธารณะ"** for the 2013 bonuses ข้อ 53/54. I believe not, but I did not read the current definition in the Building Control Act.
5. **Parking floor area in FAR (2013).** Inferred from ข้อ 54. No BMA circular found. Also, whether the 1/120 m² parking rate uses floor area including or excluding parking floors.
6. **Condo-size test scope** (per building vs per plot) in the 2013 ย.5–ย.7 rule.
7. **ข้อ 36 interpretation** (frontage length vs road width, the "within 200/300/500 m of the ROW edge" condition). My reading is literal; there is no official guidance in hand.
8. **"Within 500 m of a station"**: any part of the plot vs the whole plot, and which station polygon (platform vs building).
9. **Precedence of MR 55 vs BMA 2544** clause by clause. The tool uses the stricter value; the legal rule was not confirmed.
10. **BMA 2544 amendments after 2544.** The ASA file is dated 2024 but may not show amendments. I did not check for later BMA amendment ordinances to ข้อ 49–55 or 83–91.
11. **A gazetted post-2564 amendment to MR 33.** Cabinet approved one in principle (new definitions of เขตทาง and compartmentation); gazettal not confirmed.
12. **EIA table text in the 2566 MNRE announcement** (unreadable font). The 80-unit / 4,000 m² figure comes from ONEP's own page; the 23 m location-specific trigger was not read.
13. **Height-overlay ordinances** (airports, Rattanakosin, monuments) and their numbers. Not extracted.
14. **Draft (4th revision) details:** whether bonuses have an overall cap, the parking-in-FAR treatment, and the exact zone polygons.
15. **Efficiency ratios, floor-to-floor heights, unit sizes**: industry assumptions with no authoritative source.
16. **Fire-safety MRs (MR 39, MR 47) and the BMA fire clauses** beyond MR 33 ข้อ 2–4. Not reviewed for envelope effects.
17. **Road-specific BMA no-build strips** (ข้อบัญญัติ กำหนดบริเวณห้ามก่อสร้าง…ริมถนน) on named major roads, and Highway Act setbacks where the frontage is a national highway. MR 33 ข้อ 3 refers to such strips, so they can exceed the §3.1 setbacks on specific roads. Not researched.
18. **Base of the plan's 50% permeable rule**: the OSR open space only, or the open space floored at the building-control minimum.
19. **Planned-road (ข้อ 45) land in the FAR denominator.** Not determined.

---

## 10. Sources (all accessed 19 Nov 2026)

Primary and official:
- 2013 plan (Royal Gazette vol 130 part 41 ก, 16 May 2556), ASA mirror: https://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf
- Draft 4th revision, process page and 90-day documents (official project site): https://plan4bangkok.com/process/
  - Regulations (ข้อกำหนดการใช้ประโยชน์ที่ดิน): https://drive.google.com/file/d/1TUHldvRIL8-BdzsExLCSg7rRtSFopKLl/view
  - Summary table (ตารางสรุปข้อกำหนด): https://drive.google.com/file/d/1wCbTfC55N5UGtw7rnmqZboNiXMs7h7Aa/view
- MR 55 consolidated to MR 68 (ASA): https://download.asa.or.th/03media/04law/fubr/a1_bcmr55-63.pdf ; older Yotathai copy: https://www.yotathai.com/yotanews/rule55-buildinglaw
- MR 33 consolidated to 2564 (ASA): https://download.asa.or.th/03media/04law/fubr/a3_bcmr33-64.pdf
- BMA Building Control Ordinance B.E. 2544 (ASA): https://download.asa.or.th/03media/04law/cba/bb/bb44-03.pdf
- MR 7 B.E. 2517 consolidated (ASA): https://download.asa.or.th/03media/04law/cba/mr/mr17-07-upd64.pdf
- MR 41 B.E. 2537 (Gazette scan, ASA): https://download.asa.or.th/03media/04law/cba/mr/mr37-41.pdf
- MNRE EIA announcement B.E. 2566 (ASA): https://download.asa.or.th/03media/04law/eqa/ma66-06.pdf ; 2568 amendment summary: https://asa.or.th/laws/news20250801/
- ONEP EIA page: https://www.onep.go.th/eia/
- ASA law-news index (used to check for new enactments): https://asa.or.th/laws/

Secondary (news and summaries):
- Thansettakij, 90-day posting from 10 Aug 2569, steps, late-2570 target: https://www.thansettakij.com/real-estate/665274
- Thansettakij, committee approval 9 Apr 2569, zone changes, TDR removed: https://www.thansettakij.com/real-estate/659134
- Thansettakij, 148→96 roads: https://www.thansettakij.com/real-estate/659109
- Thai PBS Policy Watch: https://policywatch.thaipbs.or.th/article/agriculture-62 , https://policywatch.thaipbs.or.th/article/agriculture-68
- Siam Rath (BMA rebuts claim it rushed the plan): https://siamrath.co.th/quality-of-life/news/131116
- Yotathai summary of the City Planning Act 2562: https://www.yotathai.com/yotanews/town-planning-act62
- Thaipublica on the draft (per-building caps by colour): https://thaipublica.org/2020/05/draft-of-the-4th-bangkok-city-plan/
- Orange-zone condo rule restated (30 m / 500 m): Thansettakij https://www.thansettakij.com/real-estate/589864 (search snippet)

Local working copies: scratchpad `dl/` and `draft4/`; not part of the repo.
