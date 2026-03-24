# E-Book Writing Skill — "The Man Who Steered the Wind"

## Trigger
Activate when the user says: "continue ebook", "write chapter", "ebook", "next chapter", "continue writing", "chapter [N]", "draft chapter", "ebook session", "where were we", "ebook status", or any variation involving writing or continuing the e-book.

---

## STARTUP PROTOCOL (MANDATORY — run on EVERY trigger)

When this skill is triggered, you MUST execute these steps IN ORDER before writing anything:

### Step 1: Read the State
```
Read: ebook/skills.md
```
This file contains:
- **RESUME POINT** at the top — last chapter, next chapter, Kaan's narrative state
- Progress table for all 48 chapters
- Session log with dates and work done
- Forgotten topics queue
- Style decisions made in prior sessions

### Step 2: Read Context Files
Based on the RESUME POINT in skills.md, read these files:
- The **last completed chapter** (full file — for continuity AND audit)
- The **next chapter stub** (to see the template and any notes)
- If the user asks about the plan: `.claude/plans/sequential-booping-pumpkin.md`

### Step 3: Auto-Audit the Last Completed Chapter
Run the QUALITY CHECKLIST (see below) against the last completed chapter. Build an audit report:
- For each checklist item: PASS or MISSING
- If ALL items pass → mark as "Clean"
- If ANY item is missing → list the gaps

This step is automatic — the user does NOT need to ask for it.

### Step 4: Show the Resume Briefing (with audit)
Display this to the user before doing anything else:

```
📖 EBOOK STATUS — "The Man Who Steered the Wind"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress:     [X] / 48 chapters complete (~Y,000 words)
Last written: Chapter [N]: [Title] — [date]
Next up:      Chapter [M]: [Title]
Kaan is:      [location], [emotional state]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LAST CHAPTER AUDIT — Ch [N]: [Title]
[table with checklist item | status for each item]
Result: Clean / [N] gaps found

Last chapter ended with: "[final sentence of closing narrative]"

Ready to write Chapter [M]? Or would you like to fix gaps first?
```

### Step 5: Wait for User Direction
The user may say:
- "continue" / "yes" / "go" → Write the next chapter in sequence
- "fix gaps" / "fix it" → Fix any gaps found in the audit before moving on
- "chapter [N]" → Write a specific chapter (even out of order)
- "status" → Show detailed progress table
- "plan" → Read and show the master plan
- "review chapter [N]" → Re-read and improve an existing chapter
- "forgotten topics" → Show the forgotten topics queue

**If the audit found gaps:** Recommend fixing them before writing the next chapter, but let the user decide. Do NOT auto-fix without confirmation.

---

## MASTER PLAN REFERENCE

The complete book plan (table of contents, narrative arc, chapter summaries, session strategy, source lists) is stored at:
```
.claude/plans/sequential-booping-pumpkin.md
```
Read this file when:
- The user asks about the overall plan or structure
- You need to check what a chapter should contain
- You need source/citation guidance for a specific topic
- You need to verify the narrative arc

---

## IDENTITY

- **Title:** The Man Who Steered the Wind
- **Subtitle:** A Story of Wind, Electricity, and the Machines That Changed Everything
- **Scope:** ~280,000 words, 11 parts, 48 chapters, ~700 pages
- **Genre:** Narrative engineering handbook (novel-style story + deep technical content)

## PROTAGONIST

- **Kaan** — Turkish-origin control engineer, late twenties, first offshore wind assignment on Baltic Sea
- Careful, curious, asks "why?" at every stage
- Not a genius or hero — a learner the reader identifies with
- Two timescales: present (Kaan's year, italicized) and historical vignettes

## VOICE & STYLE

- Sincere American English, conversational, never dumbed down
- No mention of AI writing; natural authorial voice throughout
- Narrative sections always italicized
- Skip all italics → still a complete handbook
- Every chapter earns at least one "fun fact" readers want to share
- No emojis in the manuscript
- Technical terms defined on first use, then used freely
- Formulas always have: variable definitions + units + physical meaning sentence

---

## VOICE & PATTERNS ESTABLISHED (from Ch 1–5)

These patterns were set in Chapters 1–5 and must be maintained for consistency:

### Core Patterns (Ch 1)
- **Opening narrative length:** ~400 words (4 paragraphs). Sets scene, introduces characters present, ends with Kaan beginning to learn.
- **Section naming:** `## N.X [Descriptive Title]` — active, engaging titles (not "Section about X")
- **Prose-to-formula ratio:** ~300-500 words of prose before each formula. Never drop a formula cold.
- **Formula presentation:** Display math (`$$`), then `where:` block with bullet list of variables, units in square brackets.
- **Historical storytelling:** Concrete details (dates, locations, names, numbers) — never vague. "The Barbegal aqueduct complex near Arles, France (2nd century CE)" not "an ancient mill complex."
- **Image placeholders:** Full 7-field blockquote format, always with a comparison to modern scale.
- **Closing narrative:** ~250 words. Kaan reflects on what he learned, bridges to next chapter with a concrete action (opens tablet, turns page, looks at something).
- **Footnotes:** Detailed — include author, year, full title, publisher/journal, DOI, and a note on what the source covers.
- **Worked example heading:** `## N.X Worked Example: [Descriptive Subtitle]`
- **Key Takeaways:** Bold lead phrase + explanation. 4-5 bullets.
- **Tone:** Conversational authority — "Notice the cubic dependence" not "It should be noted that..." Never didactic, never dumbed down.
- **Fun facts woven into prose**, not called out in boxes.
- **Cross-references to future chapters:** "That story begins in Chapter 2" — natural, not forced.

### Patterns Added (Ch 2–4)
- **Dialogue-driven narrative framing:** When a character (e.g., Elif) narrates the chapter content, the opening/closing use dialogue form. The character tells a story rather than Kaan discovering alone. Different chapters can be "told by" different characters.
- **Character voices in narrative:** Anders is laconic, observational, drops facts with faint amusement. Elif is direct, professionally confident, slightly teasing ("the faint professional disdain that electrical engineers reserve for everyone who is not an electrical engineer").
- **Worked example as dramatic contrast:** Using an absurd extreme (DC at 110 V for 500 MW → cable vaporises) to make the correct approach memorable. The absurdity is stated plainly: "which is exactly the point."
- **Part-ending chapters bridge to next Part:** The final chapter of a Part must close by pivoting Kaan toward the next Part's subject. Ch 4 (end of Part I) pivots from electricity history to seeing a physical turbine (Part II).
- **Thread-pulling across chapters:** Concepts introduced in one chapter are explicitly connected to later ones: "It was Meikle's spring sail reborn" (Ch 3 → Ch 2), "That story belongs to Chapter 20" (Ch 4 → Ch 20). Always natural, never forced.
- **Recurring motifs:** The "I ♥ REACTIVE POWER" mug (Elif's), the porthole view of turbines at night (Kaan's cabin), the pattern of characters asking questions that reveal deeper answers.
- **Technical density increases across Part I:** Ch 1 has 3 formulas, Ch 2 has 1, Ch 3 has 2, Ch 4 has 5. As the book moves from wind history to electrical fundamentals, the formula density rises. Part II onward should maintain ~3-6 formulas per chapter.

### Patterns Added (Ch 5)
- **Physical object as narrative anchor:** Morten lays a decommissioned blade cross-section on trestles — Kaan touches, examines, and learns from it. Using physical artifacts to ground abstract concepts (airfoil shape → lift theory → BEM).
- **Multi-step derivation pacing:** The Betz limit derivation spans ~600 words, building from continuity equation through momentum theory to the final dCp/da = 0 result. Each step is a paragraph with physical interpretation, not just algebra.
- **Worked example with regime contrast:** Show the same turbine operating in Region 2 (10 m/s, Cp = 0.48) and Region 3 (rated, Cp = 0.287) to illustrate deliberate power limitation. The contrast makes the control philosophy concrete.
- **Formula density in Part II:** Ch 5 has 6 display formulas (Kutta-Joukowski, lift/drag coefficients, Betz Cp derivation, velocity triangle, tip speed ratio, power equation). Consistent with the ~3-6 target.
- **Technician's voice:** Morten is practical, hands-on, speaks from experience ("The guys who designed it probably ran ten thousand BEM iterations"). Contrasts with Anders's quiet authority and Elif's intellectual confidence.
- **Speed comparisons for visceral impact:** "374 km/h — faster than a Formula 1 car" makes the tip speed tangible. Use real-world comparisons for extreme engineering numbers.
- **Subsection headers within technical sections:** Section 5.3 uses `### The Derivation` and Section 5.4 uses `### The Idea`, `### The Velocity Triangle`, `### Why Blades Are Twisted and Tapered`. Useful for long sections with distinct sub-topics.

### Patterns Added (Ch 6)
- **Elevator ride as liminal space:** The 4-minute elevator ride (150 m) serves as a narrative transition — physical sensations (ears popping, tower sway, LED-lit steel tube) build anticipation. Liminal moments between locations are opportunities for character interaction and sensory grounding.
- **Scale surprise as narrative beat:** Kaan expects something cramped; the nacelle is 28 m long and 9 m wide. Subverting expectations with concrete dimensions (longer than a tennis court, heavier than a loaded 747) makes industrial scale visceral.
- **Three-way comparison structure:** The drivetrain section presents three competing philosophies (high-speed geared, direct-drive, medium-speed) with quantitative torque comparison. The "three options with trade-offs" pattern works well for engineering design decisions.
- **Inline character dialogue within technical sections:** Brief Morten dialogue is woven INTO sections 6.3, 6.4, and 6.5 (not just opening/closing narrative). He opens hatches, points to accelerometers, taps the gearbox casing. This breaks up dense technical prose with physical interaction.
- **Historical cautionary tale:** Growian (1983, ~400 hours of operation) illustrates the cost of failed engineering ambition. Failure stories are as instructive as success stories — include one per chapter where possible.
- **Geopolitical dimension of engineering:** The rare-earth supply chain (China: ~60% mining, ~90% processing) connects generator design to energy security policy. Engineering choices have political consequences — acknowledge them when they arise.
- **Comparative worked example:** The worked example compares two independent loss mechanisms (drivetrain efficiency vs yaw misalignment) to reveal which matters more economically (reducing yaw error from 10° to 5° recovers 17 MW vs 5 MW from 1% efficiency gain). The comparison teaches more than either calculation alone.
- **Tables in worked examples:** Markdown tables for component efficiencies and yaw loss comparison make numerical data scannable. Tables work better than inline lists for multi-parameter comparisons.
- **Formula density in Part II (continued):** Ch 6 has 5 display formulas (T=P/ω, rotor/generator torque, DFIG slip, cos³ yaw loss, efficiency chain). Consistent with the ~3-6 target.

### Patterns Added (Ch 7)
- **Mentor-led exposition via data visualisation:** Anders opens his tablet to show a scaling chart — the data itself drives the chapter's structure. Using charts/graphs as narrative props lets a character "walk through" technical content naturally.
- **Galileo callback as intellectual anchor:** Framing the square-cube law through Galileo (1638) connects modern wind engineering to foundational physics. Historical intellectual figures lend weight to engineering constraints.
- **Quantitative "beating the prediction" structure:** Present the theoretical limit (cubic scaling → D³), then show the observed reality (D^2.1–2.5), and explain the engineering that closed the gap. The "prediction was wrong because engineers refused to accept it" pattern works for any scaling discussion.
- **Part-ending bridge confirmed as pattern:** Ch 7 (end of Part II) closes with Anders asking "can you tell me what the wind speed will be at hub height tomorrow?" — pivoting from the machine to the wind, exactly as Ch 4 pivoted from electricity to the turbine. Part-ending chapters MUST bridge.
- **Porthole motif returns:** Kaan watches turbines through the SOV mess room porthole in the closing narrative, consistent with the recurring porthole motif from earlier chapters. The view evolves — now he sees them with understanding but recognises what he still doesn't know.
- **Scaling worked example as generation comparison:** Comparing two real turbines (V80 2000 vs V236 2022) across multiple metrics (area, power, specific power, capacity factor, AEP, foundation count) makes the abstract economics of scaling concrete. The "86% fewer foundations" number is the killer fact.
- **Standard references as inline blockquotes:** Introducing `> **Standard reference:** IEC XXXXX:YYYY...` blockquotes within sections (not just in Notes) makes the regulatory context visible without disrupting prose flow. Used for IEC 61400-24 and IEC 61400-12-1.
- **Formula density in Part II (concluded):** Ch 7 has 5 display formulas (power scaling, blade mass D^α, specific power, capacity factor, availability). Consistent with the ~3-6 target. Part II total: Ch 5 (6) + Ch 6 (5) + Ch 7 (5) = 16 formulas across 3 chapters.

### Patterns Added (Ch 8)
- **Physical location as sensory classroom:** Kaan climbs to the met mast platform at 40 m — the wind is "sharper," pressing against his chest. Using physical sensations (pressure, cold, noise) to ground abstract atmospheric physics. The met mast visit makes the ABL tangible before the mathematics begins.
- **New character introduced via professional habit:** Maja Kowalska (Resource Assessment Lead) is established through her Kestrel weather meter — she checks it "the way other people checked their phones." Professional habits define character faster than description.
- **Top-down conceptual flow:** Chapter moves from global scale (heat engine, Hadley cells) through mesoscale (Coriolis, geostrophic wind) to local scale (ABL, shear, turbulence, stability). This "zoom in" structure works for any topic with multiple spatial scales.
- **Multiple historical figures per chapter:** Ch 8 features Hadley (1735), Ferrel (1856), Coriolis (1835), Prandtl (1904), Ekman (1902), Buys Ballot (1857), Monin & Obukhov (1954), Businger (1971). Dense historical threading is appropriate for foundational science chapters — each figure contributes one key concept.
- **Fun facts woven into historical context:** "The force is named after a man who studied waterwheels, not weather" (Coriolis); Hadley's paper forgotten for a century, confused with his brother; Prandtl's 10-minute talk changed fluid mechanics. These are embedded in the prose, not called out.
- **Roughness length comparison table:** A simple markdown table of z₀ values across surface types (0.0002 m sea to 2.0 m city) makes the four-orders-of-magnitude range visceral. Tables for parameter comparisons across categories are more effective than inline lists.
- **Model comparison worked example:** Comparing the neutral log law (11.3 m/s) with the IEC power law (13.1 m/s) for the same input reveals that the choice of shear model is worth hundreds of millions of euros. The "two methods, same input, different answer — why?" structure teaches critical thinking about model assumptions.
- **Cubic amplification as recurring teaching beat:** A 25% wind speed increase → 98% power density increase; a 46% increase → 208%. The cubic law amplifies every uncertainty, and repeating this theme across chapters (Ch 5, Ch 7, Ch 8) builds intuition.
- **Revenue consequence as anchor for engineering decisions:** "13.2 million EUR per year — or nearly 400 million EUR over the farm's 30-year design life" converts abstract modelling choices into financial stakes. Use revenue/cost numbers to close every worked example.
- **Bridge via data, not narrative drama:** The closing narrative bridges to Ch 9 (Measuring and Modelling the Wind) through Maja's statement about data quality — "the difference between data and knowledge" — rather than a dramatic event. Intellectual transitions work for Part III chapters.
- **Part III opening chapter establishes meteorological foundations:** Ch 8 introduces the complete atmospheric framework (circulation → Coriolis → ABL → shear → turbulence → stability) that all subsequent Part III chapters will build upon. The opening chapter of each Part should establish the conceptual vocabulary for the Part.
- **Formula density in Part III (begun):** Ch 8 has 6 display formulas (Coriolis parameter, log law, power law, TI definition, Obukhov length, stability-corrected log law). Consistent with the ~3-6 target.

### Patterns Added (Ch 9)
- **Windowless room as data immersion:** The SOV analysis room — windowless, two monitors, whiteboard with unwiped equations — contrasts with Ch 8's outdoor met mast visit. Moving indoors signals a shift from physical phenomena to data analysis. The physical environment should match the chapter's intellectual mode.
- **Character continuity across paired chapters:** Maja leads both Ch 8 (atmospheric physics) and Ch 9 (measurement and modelling) — the Resource Assessment Lead covers her full domain across two chapters. When a character's expertise spans multiple topics, they can lead consecutive chapters without introducing a new character.
- **Historical figure outside the field:** Waloddi Weibull (1887–1979) studied ball bearings and steel fatigue, not wind. His 1951 ASME paper used seven examples from unrelated domains. Introducing a statistical tool through its origin story in a completely different field (material science) makes the tool memorable and shows the universality of mathematics.
- **Inventor's confident error as cautionary tale:** Robinson's wrong assertion that cups spin at 1/3 wind speed, believed for decades, parallels Growian (Ch 6) as a reminder that plausible physical arguments need empirical validation. Every field has its "everyone believed it until someone checked" moment — use them.
- **Technology evolution timeline within a section:** Cup anemometer (Robinson 1846 → Patterson 1926 → Brevoort & Joiner 1935) and LiDAR (ZephIR 2003 → Windcube → floating LiDAR) show instrument evolution as a compressed timeline. Three to four milestones tell the story efficiently.
- **Three complementary data sources structure:** Met masts (point precision), LiDAR (profile without mast), ERA5 (long-term depth) — presenting three data sources with different strengths and weaknesses teaches the reader that no single source is sufficient. The "three tools, each covering a different gap" structure applies to any measurement topic.
- **Energy pattern factor as cubic surprise:** The Weibull power density (1,180 W/m²) is 82% higher than the naive cube-of-the-mean estimate (650 W/m²). This is the "mean ≠ energy" lesson. The energy pattern factor demonstrates why distribution shape matters, reinforcing the cubic amplification theme from Ch 5, 7, and 8.
- **Wind rose vs energy rose as cubic amplification by direction:** A sector with 18% frequency and 11.5 m/s mean contributes 6.7× more energy than a sector with 12% frequency and 7.0 m/s mean — despite being only 1.5× more frequent. The side-by-side comparison (wind rose vs energy rose) is a powerful visual for the cubic law's directional impact.
- **MCP as financial bridge:** Measure-Correlate-Predict is presented not as a statistical method but as the bridge between a 2-year measurement campaign and a 30-year financial model. The P50/P90 distinction ("what the developer hopes for versus what the bank will lend against") gives the method financial stakes.
- **Worked example as full pipeline:** The worked example walks through the complete chain: Weibull fit → power curve integration → single-turbine AEP → farm scaling → revenue. This "full pipeline" structure shows how each concept feeds the next and closes with a financial number.
- **Revenue hook for next chapter:** The 450M EUR wake loss figure at the end of the worked example creates an irresistible bridge to Ch 10. Quantifying the cost of the next chapter's topic before the chapter begins motivates the reader to continue.
- **Formula density in Part III (continued):** Ch 9 has 6 display formulas (Doppler velocity, Weibull PDF, mean from Weibull, power density from Weibull, sector energy, AEP integration). Consistent with the ~3-6 target. Part III running total: Ch 8 (6) + Ch 9 (6) = 12 formulas across 2 chapters.

### Patterns Added (Ch 10)
- **Observation deck as panoramic classroom:** Kaan and Anders stand on the SOV observation deck at dawn — all 34 turbines visible, front-row blades visibly faster than back-row. Using a wide-angle view to show a systemic phenomenon (wakes across the entire farm) before zooming into the physics. Physical observation → data confirmation → mathematical model is the strongest teaching sequence.
- **Mentor returns with SCADA data as proof:** Anders shows a scatter plot on his tablet — normalised power by turbine position — before explaining any theory. Data-first framing ("here's what you see") makes the reader demand the explanation rather than receiving it passively. The tablet-as-teaching-tool pattern continues from Ch 7.
- **Iconic photograph as narrative anchor:** The Horns Rev fog photograph (Christian Steiness, Vattenfall, 12 February 2008) is introduced in the opening narrative and referenced again in the validation section. A single famous image can serve both as emotional hook and as scientific evidence.
- **Model evolution as narrative arc:** Jensen (1983, top-hat) → Bastankhah & Porté-Agel (2014, Gaussian) → Katić (1986, superposition) → Frandsen (2007, turbulence). Presenting models chronologically shows how each addressed a limitation of its predecessor. The "each model fixes the last model's flaw" structure teaches critical evaluation of engineering tools.
- **Two validation wind farms as contrast pair:** Horns Rev I (7D spacing, 10-12% loss) vs Lillgrund (3.3D spacing, 23-28% loss) — the industry standard vs the cautionary extreme. Contrasting two real datasets with different spacings makes the spacing-loss relationship concrete. The "halving the spacing roughly doubled the losses" conclusion is the killer fact.
- **Worked example with honesty about model limits:** The Jensen model predicts severe row-aligned losses (44-77% power deficit at rows 2-5), then the text explicitly notes these are worst-case instantaneous values vs measured time-averaged data. Acknowledging when a model overpredicts builds trust and teaches the reader to distinguish between model outputs and real-world expectations.
- **"What-if" extension in worked example:** After computing the baseline wake loss (10%, 450M EUR), the worked example adds a "what if we could reduce by 2 percentage points?" calculation (90M EUR value). This forward-looking extension bridges directly to the next chapter's topic (layout optimization) and quantifies its financial stakes.
- **Wake steering as active control frontier:** Introducing wake steering (Fleming et al. 2019 NREL field campaign) at the end of the chapter signals that wakes are not just a passive constraint but an active design variable. The "counterintuitive solution" — deliberately misalign a turbine to help the farm — is memorable and teaches systems thinking.
- **Cubic amplification as recurring motif (continued):** The 10% velocity deficit → 27% power deficit calculation appears in section 10.1, the Lillgrund 25% deficit → 58% power density loss in section 10.6, and the worked example converts all losses to EUR. The cubic law is now a through-line across Ch 5, 7, 8, 9, and 10.
- **Formula density in Part III (continued):** Ch 10 has 6 display formulas (wake radius, Jensen velocity, Gaussian deficit, wake width growth, Katić RSS superposition, Frandsen effective turbulence) plus one approximation formula for I_+. Consistent with the ~3-6 target. Part III running total: Ch 8 (6) + Ch 9 (6) + Ch 10 (6) = 18 formulas across 3 chapters.

### Patterns Added (Ch 11)
- **New character introduced via professional setup:** Signe Vestergaard (Danish layout optimiser) is established through her dual-monitor workstation — left screen shows the layout map with wake halos, right screen shows a convergence plot climbing toward an asymptote. Professional workspace defines character before dialogue begins.
- **"Good but never best" as epistemological theme:** Signe explicitly states she cannot prove her layout is globally optimal — only that it is better than alternatives. The 68-variable, 561-constraint design space has too many local optima. This introduces intellectual humility about optimisation that will recur whenever the book discusses engineering decisions under uncertainty.
- **Three-layout comparison as worked example structure:** Regular grid → staggered grid → optimised irregular, with each step quantified in wake loss, AEP, cable cost, and 30-year revenue. The "progression" structure shows that each improvement builds on the last and that the simplest change (staggering) captures most of the benefit. The 73:1 return on cable investment is the killer fact.
- **Algorithm evolution as historical arc (continued):** Mosetti (1994, GA on 10×10 grid) → Grady et al. (2005, benchmark) → PSO/SA/ACO metaheuristics → Thomas & Ning (2017, gradient-based with smooth models) → TOPFARM/DTU (algorithmic differentiation). The "each generation of methods addressed a scaling limitation" structure parallels the model evolution arc in Ch 10.
- **Constraint taxonomy as structured section:** Five constraint types (lease boundary, environmental, navigational, archaeological, geotechnical) plus cable routing and turbulence, each with a concrete example and regulatory reference. Structuring constraints as a taxonomy with real-world examples (100K Baltic shipwrecks, UXO exclusion circles, EU Habitats Directive) makes abstract optimisation constraints tangible.
- **Software tools as "tools of the trade" section:** WindPRO, openWind, TOPFARM, FLORIS — each described with founding date, developing organisation, key capability, and typical use case. This pattern works for any chapter where industry software implements the theory being taught.
- **Revenue bridge to next chapter via character dialogue:** Signe's closing line — "That is the number the bank cares about" (referring to P90) — bridges to Ch 12 through character voice rather than narrative exposition. The P90 is framed as a financial concept before it is a statistical one.
- **Formula density in Part III (continued):** Ch 11 has 5 display formulas (AEP summation, LCOE, minimum spacing constraint, gradient update, gross AEP calculation in worked example). Consistent with the ~3-6 target. Part III running total: Ch 8 (6) + Ch 9 (6) + Ch 10 (6) + Ch 11 (5) = 23 formulas across 4 chapters.

### Patterns Added (Ch 12)
- **Video call as narrative framing device:** Helena Voss joins from London via video call, Anders from Copenhagen — Kaan from the SOV conference room. The multi-location video call introduces a character who works remotely from the physical site, reflecting the reality that offshore wind projects are managed across cities. The porthole behind Kaan framing turbine towers contrasts the physical world with the financial one.
- **Finance character as verdict-speaker:** Helena Voss is established through her speech pattern — every number sounds like a verdict. She wears reading glasses she never removes, has a dense spreadsheet on her second monitor. The finance lead does not teach gently; she states financial truths with authority. Contrasts with the technical mentors (Anders, Maja, Signe) who invite questions.
- **"Two parallel realities" as chapter-level insight:** Kaan realises the wind farm exists in two realities — physical (blades, cables) and financial (P50, P90, DSCR). The closing narrative crystallises this as "a financial project that requires engineering." This inversion of expectations (not "an engineering project that requires financing") is the chapter's emotional payoff.
- **Full 7-step worked example as pipeline:** The worked example chains gross AEP → loss cascade → net P50 → uncertainty budget → P-values → LCOE → CfD revenue → DSCR. Each step explicitly builds on the previous one, and the final DSCR (1.74) answers the question "is this project bankable?" The pipeline structure ties together five chapters of Part III into a single financial conclusion.
- **1-year vs multi-year P90 distinction:** Separating systematic (epistemic) and random (aleatory) uncertainty, then showing how random uncertainty reduces by √n over n years while systematic does not. The 10-year P90 (93.3% of P50) being higher than the 1-year P90 (91.6%) teaches a subtle but important statistical concept with financial consequences.
- **CfD history as policy narrative arc:** UK AR1→AR6 presented as a story: dramatic cost decline, then AR5 failure (zero awards), then AR6 correction. The "set the cap too low and you get nothing" lesson shows that policy and engineering are intertwined. The Netherlands' zero-subsidy outlier and Poland's first auction contextualise the financial mechanism across markets.
- **Part-ending bridge confirmed (Part III):** Ch 12 (end of Part III) closes with Helena pivoting from finance to physical construction — "the things that hold these turbines up." Kaan watches turbines through the porthole and reflects on his transformation from seeing machines to seeing financial instruments. The Part III → Part IV bridge moves from models to physical engineering in the sea. Consistent with Part I → II (Ch 4) and Part II → III (Ch 7) bridges.
- **Revenue quantification as recurring close:** The 500M EUR lifetime gap between P50 and P90, the 5,676M EUR CfD revenue, the 1.74 DSCR — each number lands as a financial consequence of the physics and statistics taught earlier. Revenue closes every Part III chapter: Ch 9 (AEP), Ch 10 (450M EUR wake loss), Ch 11 (150M EUR layout benefit), Ch 12 (P90 = bankability).
- **Formula density in Part III (concluded):** Ch 12 has 6 display formulas (gross-to-net cascade, time-based availability, energy-based availability, quadrature uncertainty, P-value exceedance, FCR calculation). Part III total: Ch 8 (6) + Ch 9 (6) + Ch 10 (6) + Ch 11 (5) + Ch 12 (6) = 29 formulas across 5 chapters.

### Patterns Added (Ch 13)
- **Jack-up vessel as immersive classroom:** Kaan stands on the jack-up vessel Brave Tern, feeling the hydraulic hammer strikes in his sternum before hearing them. Physical sensations (percussion through deck plates, bubble curtain churning water) ground the reader in the industrial reality of foundation installation before any engineering theory begins. The "feel it before you understand it" sequence continues from Ch 8 (met mast wind) and Ch 6 (nacelle vertigo).
- **Physical artifact as teaching prop (continued):** Pieter carries a transparent soil core sample — layered sediment (grey clay / brown sand / dark glacial till) — that he uses throughout the chapter to explain geotechnical concepts. This continues the pattern from Ch 5 (Morten's decommissioned blade cross-section) and Ch 7 (Anders's scaling chart on tablet). A tangible object that a character carries and refers back to anchors abstract concepts in physical reality.
- **"You cannot fix what you cannot reach" as chapter-level axiom:** Pieter states this explicitly about foundations below the mudline, and it recurs in the DFF of 3.0 (75-year fatigue life for a 25-year structure) and in the closing narrative ("the most consequential piece of engineering... and the one part that would never be seen"). A single axiom, stated once and then demonstrated through multiple engineering decisions, is more powerful than repeating it.
- **Simplified formula acknowledged as wrong, then corrected:** The worked example deliberately shows the simplified cantilever natural frequency formula giving an unrealistically low result (0.058 Hz), then explains why the full FE model gives 0.21 Hz. Showing a model's failure teaches more than hiding it — the reader learns what the simplification ignores (soil springs, distributed mass) and why detailed modelling matters. This is the engineering equivalent of the "two methods, same input, different answer" structure from Ch 8.
- **Cost as percentage of CAPEX:** The worked example closes with EUR 316M foundation cost = 21% of total CAPEX, linking back to Ch 12's EUR 1,479M total. Converting component costs to CAPEX fractions gives the reader a sense of proportion that absolute numbers alone cannot provide.
- **Part-opening chapter establishes physical engineering vocabulary:** Ch 13 opens Part IV (Building in the Sea) by introducing the physical world — soil, steel, hammers, scour — after Part III's models and statistics. The opening chapter of each Part shifts the register: Part I (history), Part II (turbine anatomy), Part III (atmospheric physics and data), Part IV (marine civil engineering). Each Part's first chapter sets the sensory and intellectual tone for what follows.
- **Oil & gas heritage explicitly acknowledged:** The p-y method (Reese & Matlock, 1950s-60s), jacket structures (Gulf of Mexico, 1947), and grouted connections all come from the oil and gas industry. Offshore wind's debt to its predecessor industry is a recurring theme — acknowledged directly rather than obscured.
- **Formula density in Part IV (begun):** Ch 13 has 6 display formulas (mudline overturning moment, Miner's fatigue, p-y curve, scour depth ratio, 1P/3P frequencies, simplified natural frequency). Consistent with the ~3-6 target. Part IV running total: Ch 13 (6).

### Patterns Added (Ch 14)
- **Cable cross-section as physical artifact (pattern continued):** Nora hands Kaan a 30-cm polished slice of decommissioned submarine cable — concentric rings of copper, XLPE, lead, and steel visible like growth rings of a tree. This continues the physical-artifact-as-teaching-prop pattern from Ch 5 (blade cross-section), Ch 7 (tablet chart), and Ch 13 (soil core). Each artifact is carried by its chapter's mentor and referred back to throughout.
- **Layer-by-layer construction as narrative structure:** Nora explains the cable from inside to outside — conductor, screen, insulation, sheath, armour, serving — mirroring the concentric physical structure with a concentric explanatory structure. When a chapter's subject has a natural spatial or temporal ordering, the section structure should follow it.
- **Historical failure as opening hook:** The 1850 Brett Channel cable (fisherman cut it within hours, reportedly mistook gutta-percha for gold-bearing seaweed) opens the technical content with a vivid failure that establishes the chapter's core problem. Every chapter should consider opening its first technical section with a historical failure or surprise that frames the engineering challenge.
- **"The capacitor you did not order" as invisible-consequence motif:** The cable generates 2.6 MVAR/km of reactive power — an unintended physical consequence of its geometry that nobody requested but everybody must compensate. Framing an engineering side-effect as "the [X] you did not order" makes invisible physics visceral and memorable.
- **Cross-chapter thread-pulling via character memory:** "The Ferranti effect that Elif had described over coffee in the SOV common room, weeks earlier" — explicitly connecting Ch 14's reactive power discussion to Ch 4's War of Currents. Character-mediated callbacks (Kaan remembering what a previous character taught him) are stronger than abstract cross-references.
- **Insurance statistic as financial shock:** "10% of CAPEX, 80% of insurance claims" — a single comparative statistic that reframes the reader's understanding of risk. When a component's cost is disproportionate to its failure impact, stating both percentages side by side creates a memorable contrast.
- **Omega loop repair as named procedure:** Naming the repair shape (Ω) gives the reader a visual anchor for a complex marine operation. Engineering procedures with distinctive names or shapes are more memorable than generic descriptions.
- **Weather window as bridge to next chapter:** The closing narrative pivots from cable engineering to installation logistics through the weather forecast — wave height rising, vessel operations suspended, EUR 250,000/day sitting idle. The "weather window closing" is both a narrative device and the literal subject of Ch 15.
- **Multi-vessel construction site as systemic view:** The closing has Kaan seeing four vessels (jack-up, SOV, CLV, rock placement) all operating simultaneously and all governed by the same weather. This "zoom out to the system" moment teaches that offshore construction is a logistics problem, not just an engineering one.
- **Formula density in Part IV (continued):** Ch 14 has 6 display formulas (I_rated=P/√3V, IEC 60287 ampacity, T₄ external thermal resistance, I_c=U₀ωC, Q_c=ωCV²L, P_loss=3I²R_ac·L). Consistent with the ~3-6 target. Part IV running total: Ch 13 (6) + Ch 14 (6) = 12 formulas across 2 chapters.

### Patterns Added (Ch 15)
- **Notebook as character-defining object:** Marc's worn A5 notebook — columns of date, Hs, wind, operation, status, with weather days in red ink — defines his character as a man who lives by data and routine. A physical record-keeping habit reveals a character's relationship to uncertainty (Marc tracks weather to control what he can).
- **"The sea decides the schedule" as chapter axiom:** Marc states this explicitly in the opening narrative, and it recurs through the weather window analysis, the seasonal availability table, and the worked example's EUR 19.4M weather cost. A single axiom that anchors the entire chapter — continuing the pattern from Ch 13 ("You cannot fix what you cannot reach").
- **Industry origin story with financial drama:** MPI Resolution's troubled birth (£20M budget → £53M final cost, company bankruptcy, bought for £12M by managers) gives the world's first WTIV a compelling narrative beyond its technical specifications. When an engineering milestone has a dramatic financial backstory, include it.
- **Vessel comparison table as scaling narrative:** The four-vessel table (MPI Resolution → Voltaire → Charybdis → Orion) tells the scaling story numerically — crane capacity 300t → 5,000t, lifting height 80m → 178m in two decades. Tables that progress chronologically from simple to extreme tell a scaling story without repetitive prose.
- **Jones Act as regulatory digression:** The Charybdis section explains a US-specific regulation (Jones Act 1920) that has no direct technical relevance but shapes the global WTIV market. When a non-technical constraint (legal, political, regulatory) materially affects engineering decisions, explain it briefly within the relevant technical section rather than in a separate policy chapter.
- **Operational procedure as numbered step sequence:** The turbine lift sequence (jack-up → tower → nacelle → blades → jack-down) is presented as Steps 1–5 with hours annotated. Complex multi-step procedures benefit from numbered-step format with durations, giving the reader a timeline sense.
- **Weather as parameter, not failure:** "The weather is not a failure; it is a parameter" — this reframes waiting from a problem to an expected cost. Establishing that natural constraints are budgeted rather than fought teaches engineering mindset.
- **Part-ending capstone with CAPEX synthesis:** The worked example closes by aggregating Ch 13 (foundations EUR 316M, 21%), Ch 14 (cables EUR 145M, 10%), and Ch 15 (installation EUR 220-250M, 15-17%) to show Part IV = 45-48% of CAPEX. Part-ending chapters should synthesise the Part's financial contribution to the overall project, giving the reader a cumulative sense of where the money goes.
- **Part-ending bridge confirmed (Part IV):** Ch 15 closes with the 34th blade bolted, construction phase complete, Anders radioing "Next week, we go inside the substation. And before we touch anything in there, you are going to understand alternating current." The bridge explicitly names Part V's subject (electrical engineering) and shifts from physical construction to invisible physics. Consistent with Part I → II (Ch 4), Part II → III (Ch 7), and Part III → IV (Ch 12) bridges.
- **Formula density in Part IV (concluded):** Ch 15 has 6 display formulas (preload requirement, air gap, weather window probability, crane moment, vessel spread cost, delay cost). Part IV total: Ch 13 (6) + Ch 14 (6) + Ch 15 (6) = 18 formulas across 3 chapters.

---

## CHARACTERS ESTABLISHED (through Ch 15)

| Character | Role | Introduced | Key Traits | Signature Detail |
|-----------|------|-----------|------------|-----------------|
| **Kaan** | Protagonist, control engineer | Ch 1 | Curious, careful, note-taker, asks "why?" | Turkish-origin, late twenties, tablet always open |
| **CTV Captain** | Vessel crew | Ch 1 | Practical, weathered | Brief appearance during storm wait |
| **Anders** | Senior electrical engineer, Kaan's mentor | Ch 3 | Laconic, observational, faintly amused | Drops facts with quiet authority; lifejacket zipped to chin; uses tablet charts as teaching tools (Ch 7); SCADA scatter plot on observation deck (Ch 10); coffee-on-the-railing ritual |
| **Elif** | Electrical engineer | Ch 3 (intro), Ch 4 (main) | Direct, confident, slightly teasing | "I ♥ REACTIVE POWER" mug; professional disdain for non-EEs |
| **Morten** | Turbine technician | Ch 5 | Wiry, unhurried confidence, hands-on | Salt-faded Vestas cap; decade of tower climbing; decommissioned blade as teaching prop (Ch 5); nacelle tour guide — taps gearbox, opens pitch hatch, points to sensors (Ch 6) |
| **Maja** | Resource Assessment Lead | Ch 8 | Precise, data-focused, slight Polish accent, wry | Kestrel weather meter clipped to jacket; checks it like others check phones; measures before she speaks; leads both Ch 8 (atmosphere) and Ch 9 (measurement/data) — the full resource assessment arc |
| **Signe** | Layout Optimisation Specialist | Ch 11 | Sharp-featured, precise English with flat Danish vowels, twenty years of layouts, intellectually honest about uncertainty | Reading glasses pushed into short blonde hair; dual-monitor setup (layout map + convergence plot); refilled coffee mug; "I do not know the best layout — only a better one" |
| **Helena** | Project Finance Lead | Ch 12 | London-accented precision, every number sounds like a verdict, early fifties, silver-streaked dark hair | Reading glasses never removed; dense spreadsheet on second monitor; joins via video call from London; "The bank does not lend on P50"; returns in Ch 44 |
| **Pieter** | Marine Foundations Engineer | Ch 13 | Broad-shouldered Dutchman, mid-forties, two decades offshore (oil & gas → wind), Dutch directness | Hard hat covered in stickers from previous projects; carries transparent soil core sample; "You cannot fix what you cannot reach"; explains soil before steel |
| **Nora** | Cable Engineer | Ch 14 | Norwegian, mid-thirties, calm and methodical, decade of submarine cable work (factory in Halden → project engineering), thinks in layers | Carries polished 30-cm cable cross-section; transparent ruler for measuring insulation thickness; "A submarine cable is not a wire — it is a seven-layer containment system"; runs finger along layers like reading tree rings |
| **Marc** | Installation Campaign Manager | Ch 15 | Belgian, late forties, compact, shaved head, twenty years offshore (North Sea oil & gas → wind), calm under pressure, speaks in probability percentages and weather windows | Worn A5 notebook tracking daily weather/ops (date, Hs, wind, operation, status — weather days in red ink); hi-vis vest covered in radio clips and cable ties; "The sea decides the schedule" |

**Future characters** (from narrative tracker — not yet written):
- HV Technician (Ch 17), Protection Engineer (Ch 19, Ch 26), STATCOM Specialist (Ch 20), PPC Lead (Ch 22, Ch 24), SCADA Engineer (Ch 28-29), Cybersecurity Lead (Ch 31), Safety Officer (Ch 32, Ch 41), Data Scientist (Ch 33), ML Engineer (Ch 34-36), Commissioning Lead (Ch 38), Grid Operator (Ch 25, Ch 37)

---

## CHAPTER TEMPLATE

Every chapter MUST follow this structure exactly:

```markdown
# Chapter [N]: [Title]

*[Opening narrative: 300-600 words. Kaan encounters the problem, or a
historical vignette sets the stage. Always italicized. Ends with tension
the technical content will resolve.]*

---

## [N].1 [First Technical Section]

[Prose with formulas. Every formula has variable definitions + units + physical meaning.]

$$
[formula]
$$

where:
- $[var]$ = [description] [[unit]]
- ...

<!-- IMAGE: fig-[ch]-[seq] -->
> **[Figure N.X]** — [Title]
> **Type:** [line chart / schematic / photograph / flow diagram / map]
> **Content:** [detailed description for illustrator/designer]
> **Caption:** [1-2 publication sentences]
> **Alt text:** [screen reader description]
> **Data source:** [standard / paper / "Author illustration"]
> **Resolution:** 1200 x 800 px minimum
> **Color notes:** [if relevant]

> **Standard reference:** IEC XXXXX:YYYY, "[title]" — [clause]. [N]

---

## [N].2 [Second Section] ...

## [N].X Worked Example
[Complete calculation with real numbers from a generic 500 MW reference case]

## Key Takeaways
- [3-5 precise, memorable bullets]

## For Further Reading
- [2-3 annotated sources with brief descriptions]

*[Closing narrative: 200-400 words. Reflection, bridge to next chapter.]*

---

## Notes
[1] Author (Year). *Title*. Publisher/Journal. DOI: xxx
```

---

## CITATION RULES

Per-chapter numbered footnotes under `## Notes`. Source hierarchy:
1. IEC/IEEE/ENTSO-E standards (part + year)
2. Peer-reviewed papers (DOI required)
3. University textbooks (edition, publisher, chapter)
4. Government/institutional reports (NREL, IRENA, ECMWF, DNV)
5. Manufacturer technical papers (publicly available)
6. Museum/historical archives (location + accession)

**Never cite:** Wikipedia, blog posts, social media, anonymous sources.

## WORKED EXAMPLES

- Use a generic "500 MW offshore wind farm" reference case
- Never explicitly name the Baltic Wind project (standalone book)
- Real numbers, real units, full calculations

## IMAGE PLACEHOLDERS

Use the 7-field format shown in the template. Every chapter should have 2-5 image placeholders.

---

## FILE NAMING

- Chapters: `ch-[NN]-[slug].md` (e.g., `ch-01-fire-water-wind.md`)
- Front matter: descriptive names (`preface.md`, `how-to-read.md`)
- Back matter: `appendix-[letter]-[slug].md`, `bibliography.md`, `index.md`

## DIRECTORY STRUCTURE
```
ebook/
├── skills.md                         ← ALWAYS read this first
├── front-matter/                     ← 6 files
├── part-01-wind-before-machines/     ← Ch 1-4
├── part-02-anatomy-of-turbine/       ← Ch 5-7
├── part-03-understanding-the-wind/   ← Ch 8-12
├── part-04-building-in-the-sea/      ← Ch 13-15
├── part-05-electrical-engineering/   ← Ch 16-21
├── part-06-talking-to-the-grid/      ← Ch 22-27
├── part-07-scada-automation/         ← Ch 28-32
├── part-08-forecasting/              ← Ch 33-37
├── part-09-commissioning/            ← Ch 38-42
├── part-10-life-of-wind-farm/        ← Ch 43-46
├── part-11-what-comes-next/          ← Ch 47-48
└── back-matter/                      ← 6 files
```

---

## SESSION PROTOCOL

1. **Start:** Run STARTUP PROTOCOL above (read skills.md → show resume briefing)
2. **Write:** 1-2 chapters per session (5,000-7,000 words each)
3. **Continuity:** Re-read the prior chapter's closing narrative before starting the next
4. **Research:** Use WebSearch for historical facts. Verify ALL dates, names, and events from reliable sources before writing. Do not hallucinate historical claims.
5. **Update:** After each chapter, update `ebook/skills.md`:
   - Change chapter status (`[ ]` → `[x]`)
   - Update RESUME POINT (next chapter, Kaan's state)
   - Update word count
   - Add session log entry
   - Add any forgotten topics discovered while writing
6. **Close:** Show what was written and what's next

---

## QUALITY CHECKLIST (per chapter)

Before marking a chapter `[x]` complete, verify:

- [ ] Opening narrative (300-600 words, italicized)
- [ ] 3-6 technical sections with formulas
- [ ] Variable definitions with units for every formula
- [ ] 2-5 image placeholders (7-field format)
- [ ] Standard references with clause numbers (N/A for historical chapters in Part I)
- [ ] Worked example with real numbers
- [ ] Key Takeaways (3-5 bullets)
- [ ] For Further Reading (2-3 annotated sources)
- [ ] Closing narrative (200-400 words, bridge to next chapter)
- [ ] Notes section with numbered citations
- [ ] At least one "fun fact" or surprising real story
- [ ] No Wikipedia/blog citations
- [ ] No explicit Baltic Wind project references
- [ ] All historical claims verified via WebSearch
- [ ] Narrative continuity with prior chapter maintained

---

## WHAT TO DO IF THE USER SAYS...

| User says | Action |
|-----------|--------|
| "continue ebook" | Run startup protocol → write next chapter |
| "chapter 14" | Run startup protocol → write Chapter 14 specifically |
| "ebook status" | Run startup protocol → show detailed progress only |
| "ebook plan" | Read `.claude/plans/sequential-booping-pumpkin.md` → show plan |
| "review chapter 5" | Read Ch 5 → suggest improvements → apply if approved |
| "what did we forget" | Show forgotten topics queue from skills.md |
| "check chapter [N]" | Read Ch N → run quality checklist → report gaps → fix if approved |
| "change [X] about the book" | Discuss → update SKILL.md and/or skills.md accordingly |
