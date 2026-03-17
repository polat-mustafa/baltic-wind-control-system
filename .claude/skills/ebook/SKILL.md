# E-Book Writing Skill — "The Man Who Steered the Wind"

## Trigger
Activate when the user says: "write chapter", "ebook", "next chapter", "continue writing", "chapter [N]", "draft chapter", "ebook session", or any variation involving writing the e-book.

## Identity
- **Title:** The Man Who Steered the Wind
- **Subtitle:** A Story of Wind, Electricity, and the Machines That Changed Everything
- **Scope:** ~280,000 words, 11 parts, 48 chapters, ~700 pages
- **Genre:** Narrative engineering handbook (novel-style story + deep technical content)

## Protagonist
- **Kaan** — Turkish-origin control engineer, late twenties, first offshore wind assignment on the Baltic Sea
- Careful, curious, asks "why?" at every stage
- Not a genius or hero — a learner the reader identifies with
- Two timescales: present (Kaan's year, italicized) and historical vignettes

## Voice & Style
- Sincere American English, conversational, never dumbed down
- No mention of AI writing; natural authorial voice
- Narrative sections always italicized
- Skip all italics → still a complete handbook
- Every chapter earns at least one "fun fact" readers want to share
- No emojis in the manuscript

## Chapter Template

Every chapter MUST follow this structure exactly:

```markdown
# Chapter [N]: [Title]

*[Opening narrative: 300-600 words. Kaan or historical vignette.
Always italicized. Ends with tension the chapter resolves.]*

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

*[Closing narrative: 200-400 words. Reflection, bridge to next.]*

---

## Notes
[1] Author (Year). *Title*. Publisher/Journal. DOI: xxx
```

## Citation Rules
Per-chapter numbered footnotes under `## Notes`. Source hierarchy:
1. IEC/IEEE/ENTSO-E standards (part + year)
2. Peer-reviewed papers (DOI required)
3. University textbooks (edition, publisher, chapter)
4. Government/institutional reports (NREL, IRENA, ECMWF, DNV)
5. Manufacturer technical papers (publicly available)
6. Museum/historical archives (location + accession)

**Never cite:** Wikipedia, blog posts, social media, anonymous sources.

## Worked Examples
- Use a generic "500 MW offshore wind farm" reference case
- Never explicitly name the Baltic Wind project (standalone book)
- Real numbers, real units, full calculations

## Image Placeholders
Use the 7-field format shown in the template. Every chapter should have 2-5 image placeholders.

## Progress Tracking
Check `ebook/skills.md` for current status of all 48 chapters.

## File Naming
- Chapters: `ch-[NN]-[slug].md` (e.g., `ch-01-fire-water-wind.md`)
- Front matter: descriptive names (`preface.md`, `how-to-read.md`)
- Back matter: `appendix-[letter]-[slug].md`, `bibliography.md`, `index.md`

## Session Protocol
1. Read `ebook/skills.md` to see what's done and what's next
2. Write 1-2 chapters per session (5,000-7,000 words each)
3. Update `ebook/skills.md` status after completing each chapter
4. Maintain narrative continuity — re-read prior chapter's closing narrative before starting the next

## Quality Checklist (per chapter)
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
- [ ] At least one "fun fact" or surprising story
- [ ] No Wikipedia/blog citations
- [ ] No explicit Baltic Wind project references
