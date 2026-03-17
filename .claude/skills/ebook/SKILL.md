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
- The **last completed chapter** (its closing narrative — for continuity)
- The **next chapter stub** (to see the template and any notes)
- If the user asks about the plan: `.claude/plans/sequential-booping-pumpkin.md`

### Step 3: Show the Resume Briefing
Display this to the user before doing anything else:

```
📖 EBOOK STATUS — "The Man Who Steered the Wind"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress:     [X] / 48 chapters complete (~Y,000 words)
Last written: Chapter [N]: [Title] — [date]
Next up:      Chapter [M]: [Title]
Kaan is:      [location], [emotional state]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Last chapter ended with: "[final sentence of closing narrative]"

Ready to write Chapter [M]? Or would you like to do something else?
```

### Step 4: Wait for User Direction
The user may say:
- "continue" / "yes" / "go" → Write the next chapter in sequence
- "chapter [N]" → Write a specific chapter (even out of order)
- "status" → Show detailed progress table
- "plan" → Read and show the master plan
- "review chapter [N]" → Re-read and improve an existing chapter
- "forgotten topics" → Show the forgotten topics queue

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
- [ ] Standard references with clause numbers
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
| "change [X] about the book" | Discuss → update SKILL.md and/or skills.md accordingly |
