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

---

## CHARACTERS ESTABLISHED (through Ch 9)

| Character | Role | Introduced | Key Traits | Signature Detail |
|-----------|------|-----------|------------|-----------------|
| **Kaan** | Protagonist, control engineer | Ch 1 | Curious, careful, note-taker, asks "why?" | Turkish-origin, late twenties, tablet always open |
| **CTV Captain** | Vessel crew | Ch 1 | Practical, weathered | Brief appearance during storm wait |
| **Anders** | Senior electrical engineer, Kaan's mentor | Ch 3 | Laconic, observational, faintly amused | Drops facts with quiet authority; lifejacket zipped to chin; uses tablet charts as teaching tools (Ch 7) |
| **Elif** | Electrical engineer | Ch 3 (intro), Ch 4 (main) | Direct, confident, slightly teasing | "I ♥ REACTIVE POWER" mug; professional disdain for non-EEs |
| **Morten** | Turbine technician | Ch 5 | Wiry, unhurried confidence, hands-on | Salt-faded Vestas cap; decade of tower climbing; decommissioned blade as teaching prop (Ch 5); nacelle tour guide — taps gearbox, opens pitch hatch, points to sensors (Ch 6) |
| **Maja** | Resource Assessment Lead | Ch 8 | Precise, data-focused, slight Polish accent, wry | Kestrel weather meter clipped to jacket; checks it like others check phones; measures before she speaks; leads both Ch 8 (atmosphere) and Ch 9 (measurement/data) — the full resource assessment arc |

**Future characters** (from narrative tracker — not yet written):
- Layout Engineer (Ch 11), Project Finance Lead (Ch 12, Ch 44), Marine Engineer (Ch 13), Cable Engineer (Ch 14), HV Technician (Ch 17), Protection Engineer (Ch 19, Ch 26), STATCOM Specialist (Ch 20), PPC Lead (Ch 22, Ch 24), SCADA Engineer (Ch 28-29), Cybersecurity Lead (Ch 31), Safety Officer (Ch 32, Ch 41), Data Scientist (Ch 33), ML Engineer (Ch 34-36), Commissioning Lead (Ch 38), Grid Operator (Ch 25, Ch 37)

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
