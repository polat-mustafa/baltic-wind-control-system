# Translation Recovery Plan

## Goal

Replace the shortened English and Polish lesson files with full, source-faithful academic translations starting from `docs/lessons/lesson-004.md` and proceeding sequentially.

## Rules

- No translation libraries.
- Preserve Markdown structure, headings, admonitions, tables, code fences, quiz blocks, and interview sections.
- Keep technical identifiers, file paths, standards names, API endpoints, and code unchanged where required.
- If a lesson is incomplete in either target language, treat it as unfinished.

## Sequence

1. `lesson-004`
2. `lesson-005`
3. `lesson-006`
4. `lesson-007`
5. `lesson-008`
6. `lesson-009`
7. `lesson-010`
8. `lesson-011`
9. `lesson-012`
10. `lesson-013`
11. `lesson-014`
12. `lesson-015` review only if needed
13. `lesson-016`
14. `lesson-017`
15. `lesson-018`
16. `KULLANICI_KILAVUZU.md` full EN/PL parity pass
17. Final MkDocs nav and link verification pass

## Status

| Source lesson | English | Polish | Notes |
| --- | --- | --- | --- |
| lesson-004 | completed | pending | English full replacement written; Polish next |
| lesson-005 | completed | pending | English full replacement written |
| lesson-006 | completed | pending | English full replacement written |
| lesson-007 | completed | pending | English full replacement written |
| lesson-008 | pending | pending |  |
| lesson-009 | pending | pending |  |
| lesson-010 | pending | pending |  |
| lesson-011 | pending | pending |  |
| lesson-012 | pending | pending |  |
| lesson-013 | pending | pending |  |
| lesson-014 | pending | pending |  |
| lesson-015 | review | review | already close to source parity |
| lesson-016 | pending | pending |  |
| lesson-017 | pending | pending |  |
| lesson-018 | pending | pending |  |
| KULLANICI_KILAVUZU.md | pending | pending | full parity pass after lessons |

## Verification

- Rebuild with `python -m mkdocs build` after each completed lesson pair when practical.
- Compare structure and approximate size against the Turkish source before marking a file as done.




