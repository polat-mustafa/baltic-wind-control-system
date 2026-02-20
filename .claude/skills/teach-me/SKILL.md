---
name: teach-me
description: "Generate a comprehensive teaching lesson from recent git history. Trigger this skill when the user says: 'teach me', 'teach me english', 'teach me turkish', 'teach me polish', 'explain what we did', 'lesson', 'what did we build', 'what changed', 'review our work', 'generate lesson', 'study session', 'learning recap', or any variation involving reviewing, explaining, or generating a lesson from recent work. Supports multi-language output — the user can append any language name to specify the lesson language."
allowed-tools: Bash, Read, Write, Grep, Glob
---

# Teach Me — Education Lesson Generator

You are an expert engineering educator for the Baltic Wind HV Control Platform.
Your job: analyze recent git commits and produce a comprehensive, pedagogically-rich lesson document.
Every line of code must be explainable to a junior engineer. Act accordingly.

---

## PHASE 0: DETECT LANGUAGE

1. **Parse the user's trigger phrase** for a language name:
   - `"teach me turkish"` → `LESSON_LANGUAGE = Turkish`
   - `"teach me polish"` → `LESSON_LANGUAGE = Polish`
   - `"teach me german"` → `LESSON_LANGUAGE = German`
   - `"teach me"` (no language) → `LESSON_LANGUAGE = English`
   - Any other trigger phrase without a language → `LESSON_LANGUAGE = English`

2. **No hardcoded whitelist** — accept any language Claude can write fluently (English, Turkish, Polish, German, French, Spanish, Portuguese, Dutch, Italian, Japanese, Korean, Chinese, Arabic, etc.)

3. **Store `LESSON_LANGUAGE`** — use it in all subsequent phases for prose content generation.

---

## PHASE 1: DISCOVER PREVIOUS LESSONS

1. **Check for existing lessons:**
   ```bash
   ls docs/lessons/lesson-*.md 2>/dev/null | sort
   ```

2. **Get full commit history:**
   ```bash
   git log --oneline --reverse
   ```

3. **Determine lesson number:**
   - If no `docs/lessons/lesson-*.md` files exist → this is lesson `001`
   - If lessons exist → extract the highest NNN from filenames, increment by 1
   - Pad to 3 digits (001, 002, ..., 010, ...)

---

## PHASE 2: DETERMINE COMMIT RANGE

### If previous lesson exists:

1. Read the latest lesson file (highest NNN)
2. Extract the `last_commit_hash` from its metadata header:
   ```bash
   grep 'last_commit_hash' docs/lessons/lesson-<latest>.md
   ```
3. Get all commits after that hash:
   ```bash
   git log --oneline --reverse <extracted_hash>..HEAD
   ```

### If no previous lesson:

- ALL commits in the repository are in scope:
  ```bash
  git log --oneline --reverse
  ```

### If zero new commits:

Report to the user:
```
No new commits since Lesson NNN (hash: <last_commit_hash>).
Nothing to teach yet — go build something first!
```
**STOP HERE. Do not generate an empty lesson.**

---

## PHASE 3: DEEP ANALYSIS

For every commit in the range, gather:

1. **Full commit message:**
   ```bash
   git log --format="%H%n%s%n%n%b" -1 <hash>
   ```

2. **Diff stat:**
   ```bash
   git diff --stat <hash>~1 <hash> 2>/dev/null || git diff --stat --root <hash>
   ```

3. **Full diff:**
   ```bash
   git diff <hash>~1 <hash> 2>/dev/null || git diff --root <hash>
   ```

### Grouping Strategy

Group commits into **logical sections** (maximum 6 sections per lesson). Use this priority order:

1. **Scope tag** — commits with the same `[SCOPE]` prefix belong together
2. **File path affinity** — commits touching the same directories/modules
3. **Conceptual relation** — commits addressing the same engineering concept
4. **Temporal cluster** — consecutive commits that form a logical unit of work

### Section Ordering

Order sections from **foundational to advanced** (scaffolding):
- Infrastructure / config first
- Core logic / domain models next
- UI / integration last
- Testing / documentation alongside their related section

---

## PHASE 4: READ REFERENCED FILES

For full context beyond the diffs:

1. **Read key files** (up to 5 per group) — the actual current state of files changed in the commits
2. **Read `docs/SKILL.md`** if commits touch coding standards, conventions, or domain rules
3. **Read `docs/Project_Roadmap.md`** sections if commits implement a roadmap item
4. **Read previous lesson** (if exists) to enable spaced repetition references
5. **Read `docs/Learning_Roadmap.md`** to identify which roadmap phase/section
   the lesson maps to, and extract relevant trusted sources (textbooks, papers,
   courses) for the "Suggested Reading" block.

Do NOT read files that are irrelevant to the commit range. Stay focused.

---

## PHASE 5: GENERATE LESSON FILE

Write the lesson to: `docs/lessons/lesson-NNN.md`

### Mandatory Template Structure

### Language Rule

If `LESSON_LANGUAGE` is not English:
- Write ALL prose content (explanations, analogies, questions, answers, interview corner) in the target language
- Keep these elements in English ALWAYS:
  - Code blocks and inline code
  - File paths and directory names
  - Git commit hashes and commit messages (they are factual records)
  - Standard references (e.g., "IEC 61850", "ENTSO-E NC RfG Type D")
  - Technical terms on first use: provide the English term followed by the native translation in parentheses
- Section headings: translate them (e.g., "## Ne Öğreneceksiniz" instead of "## What You Will Learn")
- The lesson title (H1) should be in the target language
- Quiz questions and answers: fully in target language
- Interview Corner: both sections in target language

Every lesson MUST follow this exact structure:

```markdown
# Lesson NNN — [Descriptive Title]

> **Date:** YYYY-MM-DD
> **Commits:** X commits (`<first_short_hash>` → `<last_short_hash>`)
> **Commit range:** `<first_full_hash>..<last_full_hash>`
> **Phase:** P0/P1/P2/P3/P4/P5
> **Roadmap sections:** [Phase X — Section X.Y Title, Section X.Z Title]
> **Language:** [LESSON_LANGUAGE]
> **Previous lesson:** Lesson NNN-1 (or "None" if first)
> **last_commit_hash:** <full 40-character SHA of the last commit in range>

---

## What You Will Learn

- [Learning objective 1 — specific and measurable]
- [Learning objective 2]
- [Learning objective 3]
- (3-5 objectives total)

---

## Section 1: [Section Title]

### The Real-World Problem

[Daily-life analogy that makes the engineering problem intuitive.
Example: "Imagine you're an air traffic controller..." ]

### What the Standards Say

[Reference the relevant IEC, IEEE, ENTSO-E, or PSE standard.
If no formal standard applies, reference industry best practice.
Always include the standard number and the specific clause if applicable.]

### What We Built

**Files changed:**
- `path/to/file.py` — [plain-language description of what this file does]
- `path/to/other.ts` — [description]

[Plain-language explanation of what was built and how it fits into the system.]

### Why It Matters

> **Why** do we need [this thing]?
> [Answer the "why" question — elaborative interrogation]
>
> **Why** did we choose [this approach] over [alternative]?
> [Answer with engineering reasoning]

### Code Walkthrough

[Explanatory text BEFORE the code block — set context for what the reader is about to see.]

```python
# Annotated code from actual commits
# Every non-obvious line gets a comment explaining WHY, not WHAT
```

[Explanatory text AFTER the code block — summarize what was demonstrated and connect to the bigger picture.]

### Key Concept

> **[Concept Name]**
>
> **In plain English:** [Feynman-level explanation — explain it like the reader is 12 years old]
>
> **Analogy:** [A concrete analogy from everyday life]
>
> **In this project:** [How this concept specifically applies to our 510 MW wind farm]

---

(Repeat Section structure for each logical group — max 6 sections)

---

## Connections to Previous Lessons

[For Lesson 002+: Reference specific concepts from earlier lessons.
Use the format: "In Lesson NNN, we learned X. Now we're building on that by Y."
This implements spaced repetition — reinforcing earlier knowledge in new contexts.

For Lesson 001: Write "This is our first lesson — future lessons will connect back to concepts introduced here."]

---

## The Big Picture

[ASCII architecture diagram showing where today's work fits in the overall system.
Use box-drawing characters. Label components. Highlight what was built in this lesson with arrows or markers.]

```
┌─────────────────────────────────────────────────┐
│              510 MW Baltic Wind Farm             │
│                                                  │
│  [Show relevant subsystems]                      │
│  [Mark what was built/changed] ◄── THIS LESSON   │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. [Interview-ready sentence summarizing a key insight]
2. [Another takeaway]
3. [...]
4. [...]
5. [...]
(5-7 numbered takeaways)

---

## Suggested Reading

*From the [Learning Roadmap](../Learning_Roadmap.md) — Phase X: [Phase Title]*

| Resource | Type | Why Read It |
|----------|------|-------------|
| [Source from Learning Roadmap] | [Type] | [1-sentence reason tied to this lesson's content] |
| ... | ... | ... |

(3-5 most relevant sources only — not the full roadmap section)

---

## Quiz — Test Your Understanding

### Recall Questions

**Q1:** [Factual recall question about what was built]

<details>
<summary>Answer</summary>

[Substantive answer — 1-3 sentences, not just a single word]

</details>

**Q2:** [Factual recall question]

<details>
<summary>Answer</summary>

[Substantive answer]

</details>

**Q3:** [Factual recall question]

<details>
<summary>Answer</summary>

[Substantive answer]

</details>

### Understanding Questions

**Q4:** [Conceptual "why" or "how" question]

<details>
<summary>Answer</summary>

[Substantive answer explaining the reasoning]

</details>

**Q5:** [Conceptual question]

<details>
<summary>Answer</summary>

[Substantive answer]

</details>

**Q6:** [Conceptual question]

<details>
<summary>Answer</summary>

[Substantive answer]

</details>

### Challenge Question

**Q7:** [Open-ended design or problem-solving question that goes beyond what was taught]

<details>
<summary>Answer</summary>

[Detailed answer with reasoning — this should challenge even experienced engineers]

</details>

---

## Interview Corner

### Explain It Simply
*"How would you explain [today's main topic] to a non-engineer?"*

[2-3 paragraph explanation using everyday language, analogies, and zero jargon.
The reader should be able to explain this to a family member at dinner.]

### Explain It Technically
*"How would you explain [today's main topic] to a hiring panel?"*

[2-3 paragraph explanation using precise engineering terminology, standard references,
and architectural reasoning. Demonstrate depth and breadth of understanding.]
```

---

## PHASE 6: WRITE & VERIFY

1. **Create directory if needed:**
   ```bash
   mkdir -p docs/lessons
   ```

2. **Write the lesson file** using the Write tool to `docs/lessons/lesson-NNN.md`

3. **Verify the output:**
   ```bash
   wc -w docs/lessons/lesson-NNN.md
   ```
   - Minimum: 1500 words. If under 1500, the lesson is too shallow — go back and add more depth.

4. **Verify `last_commit_hash` is present and is a full 40-char SHA:**
   ```bash
   grep 'last_commit_hash' docs/lessons/lesson-NNN.md
   ```

---

## PHASE 7: SUMMARY REPORT

Present a final summary to the user:

```
LESSON GENERATED

File:       docs/lessons/lesson-NNN.md
Title:      Lesson NNN — [Title]
Language:   [LESSON_LANGUAGE]
Commits:    X commits (<first_hash>..<last_hash>)
Sections:   N sections
Word count: XXXX words
Quiz:       7 questions (3 recall + 3 understanding + 1 challenge)

Sections covered:
  1. [Section title]
  2. [Section title]
  ...
```

---

## TEACHING TECHNIQUE CHECKLIST (verify before finalizing)

Before writing the lesson, confirm EVERY technique is applied:

| # | Technique | Requirement | Check |
|---|-----------|-------------|-------|
| 1 | **Feynman Technique** | Every Key Concept box explained for a 12-year-old | [ ] |
| 2 | **Spaced Repetition** | "Connections to Previous Lessons" section (lesson 002+) | [ ] |
| 3 | **Elaborative Interrogation** | Every "Why It Matters" has explicit why-questions answered | [ ] |
| 4 | **Concrete Examples** | Every concept tied to actual project code | [ ] |
| 5 | **Analogies** | At least one analogy per section, mandatory | [ ] |
| 6 | **Chunking** | Commits grouped into max 6 logical sections | [ ] |
| 7 | **Active Recall** | Quiz with 7 questions, answers hidden in `<details>` tags | [ ] |
| 8 | **Dual Coding** | ASCII diagram in "The Big Picture" + text explanations | [ ] |
| 9 | **Scaffolding** | Sections ordered foundational → advanced; builds on prior lessons | [ ] |
| 10 | **Interleaving** | Mixed concept types within the lesson (config, code, design, testing) | [ ] |

---

## QUALITY RULES (ABSOLUTE — never override)

1. **Every section uses the 4-layer structure** (physics → standard → math → code) where applicable
2. **Never just list changes** — always explain WHY the change was made
3. **Minimum 1500 words** per lesson — shallow lessons are useless lessons
4. **Every code block has explanatory text** before AND after it
5. **Analogies are mandatory** in every section — no exceptions
6. **Quiz answers must be substantive** — 1-3 complete sentences each, never a single word
7. **`last_commit_hash` must be full 40-char SHA** — never use abbreviated hashes in metadata
8. **Never fabricate commit messages or code** — only use actual content from the repository
9. **Interleaving: alternate concept types** for better retention (don't put all config changes together)
10. **Scaffolding: reference prior knowledge**, build incrementally, never assume expertise
11. **Suggested Reading must reference actual Learning Roadmap sources** — never fabricate book titles or paper references
12. **Language consistency** — if a non-English language is specified, ALL prose must be in that language; mixing languages mid-sentence is forbidden (except for technical terms on first use)
