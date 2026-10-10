/** Plain-text maths (`P_max`, `(1+r)^−n`) → text with <sub>/<sup> (used by MathPaper). */

import type { ReactNode } from "react";

// One sub/superscript: a bracketed group, or a run of letters, digits and primes,
// with commas between letters (G_ij, I_k,max), optionally signed (^−n). An apostrophe
// ends it, so a Turkish suffix stays on the line: P_max'ın → P<sub>max</sub>'ın.
const SCRIPT = /([_^])(\(([^()]*)\)|\{([^{}]*)\}|[-−+]?[\p{L}\p{N}′]+(?:,[\p{L}\p{N}]+)*)/gu;

/** Plain-text maths → text with <sub>/<sup>. */
export function formatMath(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(SCRIPT)) {
    const i = m.index ?? 0;
    // `_` or `^` must follow a symbol, not start a word ("snake_case" in prose has no space either,
    // so only scripts right after a letter, digit, bracket or prime are formatted)
    if (i === 0 || !/[\p{L}\p{N})\]′'|]/u.test(text[i - 1])) continue;
    if (i > last) out.push(text.slice(last, i));
    const body = m[3] ?? m[4] ?? m[2];
    const Tag = m[1] === "_" ? "sub" : "sup";
    out.push(<Tag key={i}>{body}</Tag>);
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
