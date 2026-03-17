# How to Read This Book

This book is designed to be read in three different ways, depending on who you are and what you want from it. You do not have to choose at the start and stick with it — many readers begin on one path and migrate to another once they find their footing. What follows is a description of each path, honest guidance about what each one gives you, and a map of the full structure.

---

## Path 1: The Story

Every chapter opens with a section in italics. These narrative sections follow Kaan — an offshore wind electrical engineer — from his first crew transfer vessel ride out to a Baltic installation site, through the years of construction, commissioning, and eventual commercial operation of a 510 MW wind farm.

If you read only the italicized sections, skipping everything else, you will have a complete narrative arc: a beginning, a middle, and an end. Roughly 30,000 words — the length of a short novel. Kaan's story touches on every major phase of an offshore wind project, but it does so through experience rather than explanation. You will understand what he is doing, why he is under pressure, what it costs him when something goes wrong, and what it feels like when something finally works. You will not come away knowing how to calculate a short-circuit current, but you will have a clear and honest picture of the human reality of the industry.

This path is recommended for: readers who are new to the subject and want orientation before depth; readers who are non-technical but want to understand what the people in their organization actually do; anyone who wants to read the book quickly and return for the technical material later.

---

## Path 2: The Handbook

If you skip the italicized sections entirely and read only the technical prose, you have a structured engineering reference. Roughly 250,000 words. Each chapter stands alone — you can open the book to the chapter on protection coordination or the chapter on wake modelling without needing to have read everything before it.

The technical sections are organized consistently. Each one begins with the physics: what is actually happening in the real world, at the level of electrons, air molecules, or mechanical stress. It then moves to the relevant standard or regulatory requirement — the external rule that the design must satisfy. Then the mathematics: the formula, derived or explained rather than dropped in without context, with every variable named. Then the code or worked example: a calculation using the specific parameters of the book's reference wind farm, or a code snippet showing how the concept is implemented in a real simulation.

Sources are cited by numbered footnote. Every formula can be traced. Where a standard is referenced, the specific clause is given.

This path is recommended for: engineering students who want a worked example to complement their coursework; working engineers who want to understand a domain adjacent to their own; anyone using the book as a study reference for a job interview or a new role.

---

## Path 3: The Full Journey

Read everything, in order. The narrative sections come first in each chapter, so Kaan's story gives you the human and professional context before the technical explanation begins. This is the intended reading experience.

The reason the book is structured this way is that engineering judgment — the quality that distinguishes a senior engineer from a junior one — is not a matter of knowing more formulas. It is a matter of understanding why a formula matters, what goes wrong when its assumptions break down, and what is actually at stake when a calculation comes out on the wrong side of a limit. The narrative earns the technical. Kaan's argument with his protection engineer over a relay setting is not decoration around the protection coordination chapter — it is the reason that chapter's material lands differently than it would in a dry textbook.

This path takes longer. It is more demanding. It is also, in the experience of early readers, the one that sticks.

---

## Structure at a Glance

The book is divided into eleven parts. The table below shows how each part maps to the engineering disciplines it covers and to the real-world project phase it corresponds to.

| Part | Title | Engineering Disciplines | Project Phase |
|------|-------|------------------------|---------------|
| 1 | Wind Before Machines | Meteorology, fluid dynamics, statistics | Site assessment |
| 2 | The Anatomy of a Turbine | Mechanical engineering, aerodynamics | Technology selection |
| 3 | Understanding the Wind | Resource modelling, AEP, uncertainty | Financial modelling |
| 4 | Building in the Sea | Offshore engineering, marine operations | Installation |
| 5 | The Electrical Machine | Power systems, transformers, cables | Design & procurement |
| 6 | Talking to the Grid | Grid code compliance, PPC, FRT, STATCOM | Grid connection |
| 7 | SCADA and Automation | IEC 61850, control systems, cybersecurity | System integration |
| 8 | The Forecasting Problem | Machine learning, time-series, SHAP | Operations |
| 9 | Commissioning | Protection, switching, LOTO, SAT | Commissioning |
| 10 | The Life of a Wind Farm | O&M, degradation, repowering | Operations & end-of-life |
| 11 | What Comes Next | HVDC, floating wind, hydrogen | Future developments |

---

## Image Placeholders

This edition of the book contains image placeholders rather than finished figures. Each placeholder reads something like:

> *[Figure 5.3 — Single-line diagram of the 66 kV array cable layout, showing feeder strings, protection zones, and substation busbar configuration.]*

These placeholders appear exactly where the finished figure will appear in the illustrated edition. In the meantime, they tell you precisely what to picture. If you are reading this as an engineer, you likely already have a mental model for most of these diagrams — the placeholder description is meant to be specific enough to activate it. If you are reading this as a non-engineer, the surrounding text will always describe what the figure shows, so the placeholder is a gap in visual information, not in conceptual information.

---

## Citations and Footnotes

Technical claims are cited by numbered footnote at the end of each chapter. The citation format used throughout is:

- **Standards:** Organisation, document number, year, clause number. Example: *IEC 60909-0:2016, Clause 4.3.*
- **Academic papers:** Author(s), title, journal or conference, year.
- **Industry documents:** Organisation, document title, version, year.
- **Data sources:** Source name, dataset identifier, access date.

Footnote numbers reset to 1 at the start of each chapter. A consolidated bibliography organized by document type appears at the back of the book.

The narrative sections (the italics) are not footnoted. They are fiction, informed by the technical material, but not themselves making technical claims that need to be sourced.

---

## A Note on Mathematics

Formulas appear throughout the technical sections. They are not decoration and they are not optional — they are the precise statement of how things work. But I have tried to write them in a way that serves readers at different levels of mathematical comfort.

Every formula is introduced with a sentence that says in plain language what it is calculating and why that quantity matters. Every variable is named when it first appears in a formula, and a glossary of symbols used in each chapter appears at the chapter's end. Worked examples use consistent numbers throughout — always the same wind farm, always the same grid parameters — so that a reader who works through multiple chapters will find the numbers familiar and the calculations checkable.

For readers who want to go deeper: the appendices include derivations of the key results that are stated without full derivation in the main text, as well as extended worked examples for the most computationally involved topics.

For readers who want to go faster: you can read around the formulas. The text is written so that the words carry the conceptual content and the formulas carry the precision. Skipping a formula will not leave you unable to follow what comes next — it will leave you with a slightly less precise understanding, which for many reading purposes is perfectly adequate.

---

The book is long. Not every chapter will feel equally relevant to every reader. Use it the way it is most useful to you.
