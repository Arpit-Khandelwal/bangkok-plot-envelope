# Users, domain and market research: Bangkok plot-envelope tool

Research date: 2026-11-19. Method: web search plus page fetches. Tags used throughout:
- **[S]** = sourced fact (URL given).
- **[I]** = my inference, not directly sourced.
- **[UNVERIFIED]** = seen in a weak or single source, or numbers I could not confirm. Do not hard-code these without checking the Royal Gazette text.

Honest summary of gaps: I could NOT retrieve the zone-by-zone OSR table or the exact road-width-versus-FAR rules of the 2556 Bangkok plan, I found almost nothing on General Machines, and I found no sourced data on typical feasibility cost, duration or condo efficiency ratio. Those are flagged below.

---

## 1. Silicon Bricks and General Machines

### Silicon Bricks (siliconbricks.co)
Everything below is from the company's own homepage (marketing claims, not independently verified): https://siliconbricks.co [S]

- Sells "real estate software and services for each stage of a building's life": Concept (test design concepts on your land, with a first cost), Design (BIM, cost estimates, "bye-law checks"), Sell and lease (3D walkthroughs), Build (weekly progress per floor), Run (FloorSense footfall/alerts from existing CCTV, Wayfinding), Refits (reuse the 3D model). [S]
- Industries: residential developers, malls/offices/commercial, contractors/project managers, hotels/resorts. [S]
- The only named customer/case study is Aayra Crown, a residential project in Andal, West Bengal, India (224 flats, 23 layouts, 26 room views in a 3D walkthrough). [S]
- No named people, no office address, no Bangkok/Thailand mention on the page I fetched. Pricing is "per project and per stage", quoted on a call. Offers a free first 3D render within 24 hours and a free 30-minute call. Says its own engineers build the models. Claims the client owns the 3D model. [S]
- [I] The "bye-law checks" wording and the only case study point to an India-first business. The Bangkok brief is therefore likely a new-market probe or a test of whether you can learn a new regulatory domain fast. The "Concept" stage (design concepts on your land, with a first cost) is almost exactly the tool you are building, so expect them to judge you on rule-correctness and credibility of the first-cost/yield numbers.
- Web search for "Silicon Bricks" returned nothing about the company beyond the homepage (https://www.sap.com/... and other results were unrelated). I did not find funding, team, or LinkedIn info.

### General Machines
- Searching "General Machines applied AI lab Silicon Bricks" returned no company of that name. Nearest unrelated hits were Standard Machines (chip-design RL environments, https://www.ycombinator.com/companies/standard-machines) and Physical Intelligence. [S] that these are different companies; [I] they are probably not the same entity.
- Nothing found about team, products, customers or Bangkok. Little public footprint; treat as unknown.

---

## 2. Real users and workflow in Thailand

Caveat: I found no authoritative step-by-step source for the developer workflow, no sourced cost, and no sourced duration for a feasibility study. The workflow below is assembled from regulation and research sources plus my inference. Mark [I] where applicable.

### Who does it
- **Developer's land acquisition / business development team** screens plots, often with brokers bringing land and an in-house or external feasibility analyst. [I]
- **Valuers / real estate consultancies** supply land price and market data. Example: AREA (Agency for Real Estate Affairs) publishes annual land appraisals for 223 Bangkok-area locations since 1994 and runs the FEASY platform for land potential analysis. [S] https://feasyonline.com
- **Architects** are commissioned only after a plot clears screening (this is the premise of your brief). [I]
- Academic interview evidence: a 2025 Thammasat study interviewed 9 academics and condo developers about FAR bonus decisions. It says FAR-bonus consideration appears at several stages of development, including the feasibility study. [S] https://so09.tci-thaijo.org/index.php/PMR/article/download/7652/4584/41399

### Steps (plot to architect brief) [I] unless cited
1. Find plot (broker, owner, auction); get chanote copy and survey plan. Plot size is quoted in rai-ngan-square wah, not m2. [S for units, see section 3]
2. Check the zone colour and code on the Bangkok city plan (BMA City Planning Department), which gives FAR and OSR. [S] Zoning is colour-coded: yellow/orange/brown are residential low to high density; red commercial; green-striped rural/agricultural. https://www.nationthailand.com/thailand/bangkok/40071451 and https://www.nationthailand.com/business/property/40066994 (summaries only)
3. Check the road: its legal right-of-way width (เขตทาง), not the paved width, and the frontage. This drives whether a high-rise (23 m+) or extra-large building (10,000 m2+) is permitted at all. [S] below
4. Check setbacks, the 6 m clear space around high-rise buildings, and surrounding conditions (rail station within 500 m, canals, easements). [S] 6 m rule below
5. Compute max GFA (FAR x plot area), estimate sellable area, unit count, parking, then a pro forma (residual land value). Thai residual-land-value calculators exist, e.g. https://landager.com/th/tools/residual-land-value [S]
6. Screen EIA need, since it adds months. [S] below
7. Commission architect, then permit through BMA. [I]

### Time and cost
- EIA: EIA report must be submitted, then evaluation takes about six months; a failed application means continuous corrections and resubmission. [S] https://propertyscout.co.th/en/guides/eia-the-seal-of-approval-property
- Feasibility study cost/duration: **not found**. [I] screening a plot internally is days; the tool's value is cutting that to minutes. Do not quote these numbers as fact.

### What goes wrong (sourced)
- **Narrow soi and the 23 m / 10,000 m2 thresholds.** Reporting says buildings are capped at 23 m (about 7-8 storeys) when the road/soi is under 10 m wide, and buildings on such roads are capped at 10,000 m2. Another Bangkok Post report says large buildings under 9,999 m2 need a road at least 6 m wide. These two figures conflict across sources. [S/UNVERIFIED] https://www.bangkokpost.com/business/news/1676200/high-rises-skirt-law-to-spring-up-in-narrow-sois and https://bangkokpost.com/thailand/general/2640787/width-restrictions-stymie-three-capital-condo-builds (I could read only search-result summaries; the fetch was redirected).
- **Developers dodge thresholds.** One Soi Ari 4 case: a planned 37-floor and 20-floor scheme was cut to three seven-floor buildings with 324 units. [S] (search summary of Bangkok Post/Coconuts) https://coconuts.co/bangkok/news/news-ari-residents-call-for-halt-of-luxury-condo-construction-on-narrow-soi
- **Road width misstated.** A report says BMA was accused of issuing a certificate that exaggerated road width, and the Administrative Court later ruled the buildings were wrongly allowed. A 2023 court case revoked an EIA approval and construction permit. [S] https://www.dlapiper.com/en/news/2023/10/thai-central-administrative-court-axes-on-going-construction
- **Fire-access clear space abused.** Under Ministerial Regulation No. 33 (B.E. 2535), clause 3, high-rise buildings need at least 6 m open space around them. BMA checked 50 high-rise/condo buildings: 12 fixed, 34 being corrected, 4 under construction; the space was used for trees, landscaping, parking or structures. [S] https://www.thansettakij.com/real-estate/665727
- **13 Bangkok high-rise projects accused of violating construction laws** (Thailand Consumers Council, 2025). [S] https://thailand-construction.com/?p=34938
- **Narrow roads limit achievable FAR.** Condo projects on soi under 10 m wide often cannot build to full zoning FAR because of the large-building/high-rise rules in Ministerial Regulations 33, 42, 50 and 69. [S] https://so09.tci-thaijo.org/index.php/PMR/article/download/7652/4584/41399 (this is the single most useful sentence for your "binding constraint" feature)
- **EIA surprise.** Condo EIA is triggered by 80+ units or 4,000 m2+ of usable area (several sources agree). One source adds high-rise 23 m / 10,000 m2 triggers (single older source). [S/UNVERIFIED] https://propertyscout.co.th/en/guides/eia-the-seal-of-approval-property, https://www.c9hotelworks.com/news/new-environmental-act-amendment-eliminate-condo-abuses. Hotel thresholds conflict (60 vs 80 rooms) between sources. [UNVERIFIED]

---

## 3. Terms of art (English / Thai)

| Term | Thai | Definition |
|---|---|---|
| FAR (floor area ratio) | อัตราส่วนพื้นที่อาคารรวมต่อพื้นที่ดิน | Total floor area allowed divided by plot area. Max GFA = FAR x plot area. [S] |
| OSR (open space ratio) | อัตราส่วนพื้นที่ว่างต่อพื้นที่อาคารรวม | Required open space as a share of total floor area (note: relative to GFA, not plot). [S, name only] https://so02.tci-thaijo.org/index.php/jars/article/download/154441/112375 Exact values per zone: [UNVERIFIED] not found. |
| BCR / building coverage | อัตราส่วนพื้นที่ปกคลุมอาคาร | Footprint share of plot. [I]. A separate Building Control Act open-space share (30%) appeared in one Bangkok Post summary: [UNVERIFIED]. |
| GFA | พื้นที่อาคารรวม / พื้นที่ใช้สอย | Total built floor area counted for FAR and for the 10,000 m2 test. [I] on exact counting exclusions; check the regulation. |
| NSA / NLA / sellable area | พื้นที่ขาย | Area actually sold or leased. A Thammasat worked example assumes sellable = 55% of usable (GFA) area, 70,000 THB/m2 average price and 25,000 THB/m2 construction cost. [S] https://so09.tci-thaijo.org/index.php/PMR/article/download/7652/4584/41399 (one illustrative example, not a market benchmark). |
| Efficiency ratio | | Sellable / GFA. Only the 55% example found. [UNVERIFIED as typical]. |
| Setback | ระยะร่น | Required distance from boundary or road centreline. Example: beside a road under 4 m wide, land within 2 m of the centreline cannot be used. [S] https://openjicareport.jica.go.jp/pdf/11685716_02.pdf (JICA appendix, via search summary) |
| Podium | | Base block (parking/retail) under a tower. [I] |
| High-rise | อาคารสูง | Building 23 m or more in height that people can enter or use. [S] https://faolex.fao.org/docs/pdf/tha155215.pdf and Thai summary via https://www.thansettakij.com/real-estate/665727 |
| Extra-large building | อาคารขนาดใหญ่พิเศษ | Building with 10,000 m2 or more floor area (all floors, or any one floor, in one building). [S] Thai search summary of Ministerial Reg. 33 text at opsmoac.go.th; also stated in the Thammasat paper above. |
| EIA | รายงานการวิเคราะห์ผลกระทบสิ่งแวดล้อม | Environmental impact assessment, needed before a permit for projects over thresholds. [S] |
| Chanote | โฉนดที่ดิน | Full land title deed, records plot size. [S] https://www.superagent.co/en/blog/how-to-verify-your-bangkok-condos-real-size-usable-vs-total-sqm |
| Rai / ngan / square wah | ไร่ / งาน / ตารางวา | 1 rai = 4 ngan = 400 sq wah = 1,600 m2; 1 ngan = 100 sq wah = 400 m2; 1 sq wah = 4 m2. Written rai-ngan-wah, "2-1-50". [S] https://en.wikipedia.org/wiki/Rai,_ngan,_and_tarang_wa and https://cornerstone.co.th/thailand-land-size-convertor |
| Soi | ซอย | Side street. Legal right-of-way width (เขตทาง) is what counts. [I] |
| Zone colours | | Yellow low-density residential, orange medium, brown high, red commercial, green-striped rural/agri conservation. [S summaries] Codes: ย.1 to ย.10 (residential), พ.1 to พ.5 (commercial). |
| Land cost per sq wah | | Land is quoted in THB per square wah. [I]; AREA publishes land price per sq wah appraisals [S] https://feasyonline.com |

### Zone table for FAR (high-rise/extra-large eligible zones) [S]
From the Thammasat paper table 1 (2556 plan; zones where high-rise and extra-large condos can be built): https://so09.tci-thaijo.org/index.php/PMR/article/download/7652/4584/41399

| Colour | Code | FAR |
|---|---|---|
| Orange | ย.5 | 4 |
| Orange | ย.6 | 4.5 |
| Orange | ย.7 | 5 |
| Brown | ย.8 | 6 |
| Brown | ย.9 | 7 |
| Brown | ย.10 | 8 |
| Red | พ.2 | 6 |
| Red | พ.3 | 7 |
| Red | พ.4 | 8 |
| Red | พ.5 | 10 |

OSR values, minimum road width per FAR tier, and FAR for ย.1 to ย.4 and พ.1: **not retrieved**. A thesis I found reports FAR 10:1 plots need minimum road width of 32.5 m (search summary only, [UNVERIFIED]) https://cuir.car.chula.ac.th/dspace/bitstream/123456789/52320/1/5773349125.pdf (fetch failed). Must be pulled from the 2556 Ministerial Regulation in the Royal Gazette or the BMA City Planning Department summary (สรุปสาระสำคัญผังเมืองรวม กทม. 2556).

### FAR bonus under 2556 plan (max +20%) [S] same paper
- Water retention in the plot: 1 m3 per 50 m2 of land gives +5% FAR (used by over 90% of bonus-seeking projects).
- Public open space on site: 1 m2 of open space per 5 m2 extra floor area (zones ย.8-ย.10, พ.2-พ.5).
- Low-income housing: 1 m2 per 4 m2 extra area (residential only).
- Public parking (public buildings, within 500 m of certain stations).
- Energy-efficient building: LEED Certified/Silver/Gold/Platinum = +5/10/15/20%.
- Worked example in the paper: 800 sq wah (3,200 m2), FAR 7 gives 22,400 m2; +20% gives 26,880 m2.

### Typical condo metrics
- Legal minimum condo unit size 21 m2; studios commonly 21-29 m2; one-bedrooms listed about 29.5-30 m2 up to larger. [S] https://research.jllapsites.com/why-are-bangkoks-condominiums-shrinking/ and https://lazudi.com/th-en/properties/studio-condo-for-sale/bangkok
- Low-rise "8 storey / 23 m" versus high-rise: 23 m cap applies on small soi, 23 m+ is high-rise with stricter rules. [S] sources in section 2.
- Floor-to-floor height, typical efficiency, typical FAR utilisation: **not found in sources**. [I] floor-to-floor about 3.0-3.4 m residential and efficiency about 55-70% are my guesses; label them as editable assumptions in the UI, not facts.
- Foreigners may own up to 49% of sellable area in a condo project (affects sellable area as a denominator). [S] https://www.krungsri.com/en/research/industry/industry-outlook/real-estate/housing-in-bmr/io/housing-in-bmr-2024-2026

### Plan status (important for rule-version labelling) [S]
- Bangkok City Plan B.E. 2556 (2013) is in force. The 4th revision draft was approved by the planning committee on 9 April 2026, goes to 90-day public display, and is expected to take effect around late 2027 (reported 2027). https://southeastasiainfra.com/bangkoks-updated-city-plan-set-for-2027-implementation/, https://www.nationthailand.com/thailand/bangkok/40071451
- Draft 2566 adds FAR bonus options (waterfront public space, transit interchange within 200 m, pavement management, through-block link, day-care), still capped at +20%. [S] Thammasat paper.
- Draft reports mention removing height limits near mass-transit interchanges within 800 m (law-firm note, search summary, [UNVERIFIED]) https://chambers.com/practice-guides/guides/real-estate-2026/thailand

---

## 4. Existing tools and gaps

Coverage of Thailand is based on what the vendor pages say. "Not stated" means the page did not list Thailand, so assume no Bangkok rule support. [I]

| Tool | What it does | Thailand coverage | Pricing | Weakness / notes |
|---|---|---|---|---|
| TestFit | Generative site plans, unit mix, parking solver, live yield tabulations, pro forma, exports to Revit/CAD/SketchUp/Excel/PDF [S] https://www.testfit.io | Not stated; US-centric | Not listed on page; third-party listings vary (e.g. about $100/mo, unconfirmed) | Strong yield UI; zoning is user-entered or add-on data. |
| Archistar AI PreCheck (eCheck) | Checks designs against digitised zoning and building codes, shareable compliance reports [S] https://www.archistar.ai/?p=34777 | Terms pages for Australia, Canada, USA; adopted by 25+ municipalities | Not listed | Depends on a municipality digitising rules; no Thai rules. |
| Giraffe | Pipeline, due diligence map, design options, area schedules, revenue/cost/cash flow, investment report; "hundreds of cities" of layers [S] https://www.giraffe.build | Not stated | Sprints from $10k; free 2-week trial of Giraffe Design | Enterprise sales; no Bangkok rule logic stated. |
| Autodesk Forma | Early massing with solar, wind, noise, daylight [S, third party] https://slashdot.org/software/comparison/Autodesk-Forma-vs-TestFit/ | None for zoning | Third-party: about $185/mo or free with Revit/AEC (unconfirmed) | Environmental analysis, not regulation compliance. |
| Deepblocks | Zoning intelligence, parcel capacity, 3D massing, feasibility and financial model; figures traceable to source ordinance [S] https://www.deepblocks.com | US only; cities built on request in 0-3 business days | $99.99 per month for about 2 cities up to $499.99 for about 25 | "Traceable to ordinance" is the credibility pattern to copy. |
| Gridics | Parcel zoning data, real-time 3D development potential, ZoneCheck attributes, Zoning Verification Letters [S] https://www.gridics.com | Miami area municipalities | Quote | Municipality-calibrated; no Thailand. |
| Zoneomics | Zoning search, API, reports [S] https://www.zoneomics.com | US state-organised; says "key global markets" | Not listed | Data, not an envelope tool. |
| Digital Blue Foam | Singapore-based generative/AI massing linked to BIM [S via search summary] https://www.digitalbluefoam.com/faqs | Not found | Not found | Chrome-optimised; desktop for large projects. |
| Hypar | Computational space planning, paid on request with free tier [S via search] | Not found | On request | Custom workflow tool. |
| Skema | Described only as an AI BIM provider; I found nothing specific [UNVERIFIED] | Not found | Not found | Insufficient information. |
| Envelope.city (NYC) | Could not fetch (site certificate error). Not assessed. | | | |
| FEASY (AREA, Thailand) | Land portfolio, land potential reports (PDF export), land price data for 223 Bangkok-area locations, market data by zone; links to a zoning colour check [S] https://feasyonline.com | Thailand | Annual tiers; free tier allows one plot without land price data; prices not on page | Data and valuation oriented; page does not say it computes FAR or an allowed 3D volume. |
| DOODIN | Thai land mobile app for area, perimeter, slope [S via search] | Thailand | Not found | Survey tool, not feasibility. |
| Landager RLV calculator | Free Thai residual land value calculator [S] https://landager.com/th/tools/residual-land-value | Thailand | Free | Financial only. |
| Baania, Propfit, LandsMaps | I found nothing on these in search. [UNVERIFIED] Not assessed. | | | |

[I] Conclusion: none of the tools I could verify combines Bangkok plan rules, Ministerial Regulation 33 road-width constraints, an allowed 3D volume and a rule-cited checklist. The gap is real but my coverage of Thai tools is thin, so state it as "I found no tool that..." not "none exists".

### What the best tools show to feel credible [S/I]
- Figures traceable to the source ordinance, with blanks explained when data is missing (Deepblocks). [S]
- Live area and unit calculations, area schedules, quantities, revenue/cost, exports to Excel, plus shareable report with plans and 3D views (Giraffe). [S]
- Live tabulations of yield, unit counts, parking; exports to PDF/Excel/CAD (TestFit). [S]
- Shareable compliance reports (Archistar). [S]
- Official verification letters (Gridics). [S] [I] This tells you that "report you could hand to a lender/board" is the credibility goal.

---

## 5. Ranked feature list (what makes a Bangkok developer or SB engineer think "they understood")

Effort: Cheap = under half a day given a working rule engine; Medium = about a day; Expensive = multiple days or needs data you may not have.

1. **Binding-constraint callout** (cheap). State which rule limits the result: "Limited by road width: road under 10 m means 23 m height cap, not FAR 7 allows 22,400 m2". Directly grounded in the narrow-soi finding. Cite: Thammasat paper above.
2. **Every rule cited to regulation and clause, with plan version** (cheap if you hand-encode a small table). E.g. "Ministerial Regulation 33 (B.E. 2535) cl. 3: 6 m clear space"; "Bangkok City Plan B.E. 2556, zone ย.8, FAR 6". Label the draft 4th revision as not in force. Mark any value you couldn't verify as "confirm with BMA".
3. **Area in rai-ngan-wah and m2, and land value per sq wah** (cheap). Input and display both (e.g. 2-0-00 = 3,200 m2 = 800 sq wah, matching the paper's own example).
4. **Thai zone codes and colours alongside English** (cheap). ย.8 / brown / "very high density residential" (ที่อยู่อาศัยหนาแน่นมาก).
5. **Threshold flags: 23 m high-rise, 10,000 m2 extra-large, EIA (80 units / 4,000 m2)** (cheap). Show "you cross the extra-large building line, so you need 10 m+ road per..." and an EIA banner with the roughly six-month evaluation. Verify exact thresholds first; where sources conflict, say so.
6. **FAR bonus scenarios** (medium). Toggle +20% via water retention (1 m3 per 50 m2 land gives +5%, etc.) and show the area gained and the cost note. The Thammasat worked example gives you test numbers (800 sq wah, FAR 7, 26,880 m2).
7. **Area schedule and yield summary: GFA, sellable area (efficiency as an editable input), unit count by unit mix, parking count** (medium). Default efficiency about 55% as the one sourced example, labelled as an assumption. Unit size defaults 21-30 m2 for studio/1BR from sources. Parking ratio is not sourced; keep as editable and flagged.
8. **Pass/fail checklist per concept with expandable "why"** (medium). Matches what Archistar and Deepblocks do and is the brief's explicit ask.
9. **Exportable one-page PDF or print view of the feasibility brief** (medium). All credible tools export; reflects the report-for-lender expectation.
10. **Low-rise (under 23 m / 8 storey) versus high-rise comparison toggle** (medium). Shows the developer the trade-off that drives Bangkok soi decisions.
11. **Simple residual-land-value readout (sell price, construction cost per m2 as inputs)** (medium to expensive). Developers think in THB/sq wah; Thai calculators exist. Use the paper's 25,000 THB/m2 and 70,000 THB/m2 only as illustrative defaults.
12. **Real zone lookup from plot polygon (BMA plan GIS)** (expensive). I found no confirmed public parcel-level API; a manual zone picker is the realistic option. Say so in the UI ("select zone as shown on BMA plan").

[I] Recommended build order: 1, 2, 3, 4, 5 first (cheap and domain-signalling), then 7 and 8, then 6 and 9, and leave 11 and 12 as stated limitations.

---

## Source index (primary ones)
- https://siliconbricks.co
- https://so09.tci-thaijo.org/index.php/PMR/article/download/7652/4584/41399 (Thammasat FAR bonus paper, 2025; saved PDF text used for tables)
- https://www.thansettakij.com/real-estate/665727 (Reg. 33 clause 3, 6 m space, BMA inspection of 50 buildings)
- https://propertyscout.co.th/en/guides/eia-the-seal-of-approval-property (EIA thresholds and timeline)
- https://www.bangkokpost.com/business/news/1676200/high-rises-skirt-law-to-spring-up-in-narrow-sois (search summary only)
- https://bangkokpost.com/thailand/general/2640787/width-restrictions-stymie-three-capital-condo-builds (search summary only)
- https://feasyonline.com, https://www.testfit.io, https://www.giraffe.build, https://www.deepblocks.com, https://www.gridics.com, https://www.zoneomics.com, https://www.archistar.ai/?p=34777
- https://southeastasiainfra.com/bangkoks-updated-city-plan-set-for-2027-implementation/
- https://en.wikipedia.org/wiki/Rai,_ngan,_and_tarang_wa
- https://research.jllapsites.com/why-are-bangkoks-condominiums-shrinking/
