/**
 * The people of the permitting journey as small SVG characters: project
 * engineer, survey technician, permitting official, environmental
 * consultant and fisheries representative. Original drawings; each has a
 * readable cue (hard hat, suit and clipboard, binoculars, oilskin) so the
 * role is clear without colour alone. Idle "breathing" and a speech bubble
 * when talking; static with prefers-reduced-motion.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "../../lib/utils";
import { ACTORS, type ActorId } from "./journey";

interface Look {
  skin: string;
  hair: string;
  body: string;
  legs: string;
}

const LOOK: Record<ActorId, Look> = {
  engineer: { skin: "#f1c7a3", hair: "#3b2a20", body: "#f97316", legs: "#334155" },
  technician: { skin: "#c68a5e", hair: "#1f2937", body: "#facc15", legs: "#1e3a5f" },
  official: { skin: "#e8b48f", hair: "#6b4f3a", body: "#1f2a44", legs: "#1f2a44" },
  consultant: { skin: "#8d5b3e", hair: "#111827", body: "#3f7d4e", legs: "#5b4636" },
  fisher: { skin: "#d9a07a", hair: "#9ca3af", body: "#eab308", legs: "#374151" },
};

function Figure({ id }: { id: ActorId }) {
  const c = LOOK[id];
  return (
    <svg viewBox="0 0 64 84" className="h-full w-full" aria-hidden>
      {/* legs */}
      <rect x="23" y="56" width="7" height="22" rx="3" fill={c.legs} />
      <rect x="34" y="56" width="7" height="22" rx="3" fill={c.legs} />
      <rect x="21" y="76" width="10" height="5" rx="2" fill="#111827" />
      <rect x="33" y="76" width="10" height="5" rx="2" fill="#111827" />
      {/* body */}
      <path d="M18 34 Q32 26 46 34 L48 60 L16 60 Z" fill={c.body} />
      {/* arms */}
      <rect x="10" y="35" width="7" height="20" rx="3.5" fill={c.body} />
      <rect x="47" y="35" width="7" height="20" rx="3.5" fill={c.body} />
      <circle cx="13.5" cy="56" r="3.2" fill={c.skin} />
      <circle cx="50.5" cy="56" r="3.2" fill={c.skin} />
      {/* head */}
      <rect x="29" y="27" width="6" height="5" fill={c.skin} />
      <circle cx="32" cy="19" r="10" fill={c.skin} />
      <circle cx="28.5" cy="19" r="1.2" fill="#111827" />
      <circle cx="35.5" cy="19" r="1.2" fill="#111827" />
      <path d="M29 24 Q32 26 35 24" stroke="#7c2d12" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {id === "engineer" && (
        <>
          {/* white hard hat + reflective stripes */}
          <path d="M21 16 Q32 2 43 16 Z" fill="#f8fafc" stroke="#cbd5e1" />
          <rect x="19" y="15" width="26" height="3" rx="1.5" fill="#f8fafc" stroke="#cbd5e1" />
          <rect x="18" y="44" width="28" height="3" fill="#e5e7eb" opacity="0.9" />
        </>
      )}
      {id === "technician" && (
        <>
          {/* blue hard hat + tablet */}
          <path d="M21 16 Q32 2 43 16 Z" fill="#2563eb" />
          <rect x="19" y="15" width="26" height="3" rx="1.5" fill="#1d4ed8" />
          <rect x="18" y="44" width="28" height="3" fill="#f8fafc" opacity="0.8" />
          <rect x="44" y="44" width="12" height="15" rx="2" fill="#0f172a" />
          <rect x="45.5" y="45.5" width="9" height="11" rx="1" fill="#38bdf8" />
        </>
      )}
      {id === "official" && (
        <>
          {/* hair, shirt, tie, clipboard */}
          <path d="M22 16 Q32 4 42 16 Q38 10 32 10 Q26 10 22 16 Z" fill={c.hair} />
          <path d="M28 32 L32 40 L36 32 Z" fill="#f8fafc" />
          <path d="M31 34 L33 34 L33.5 48 L32 50 L30.5 48 Z" fill="#b91c1c" />
          <rect x="4" y="42" width="12" height="16" rx="1.5" fill="#a16207" />
          <rect x="5.5" y="44" width="9" height="12" fill="#f8fafc" />
          <path d="M7 47 H13 M7 50 H13 M7 53 H11" stroke="#94a3b8" strokeWidth="1" />
        </>
      )}
      {id === "consultant" && (
        <>
          {/* hair + binoculars */}
          <path d="M22 17 Q32 3 42 17 Q40 11 32 11 Q24 11 22 17 Z" fill={c.hair} />
          <rect x="24" y="38" width="7" height="8" rx="2" fill="#111827" />
          <rect x="33" y="38" width="7" height="8" rx="2" fill="#111827" />
          <rect x="30" y="40" width="4" height="3" fill="#111827" />
          <path d="M24 38 Q32 31 40 38" stroke="#111827" strokeWidth="1" fill="none" />
        </>
      )}
      {id === "fisher" && (
        <>
          {/* knitted cap + beard + oilskin buttons */}
          <path d="M21 17 Q32 3 43 17 Z" fill="#b91c1c" />
          <rect x="20" y="15" width="24" height="4" rx="2" fill="#991b1b" />
          <path d="M24 22 Q32 33 40 22 Q36 27 32 27 Q28 27 24 22 Z" fill={c.hair} />
          <circle cx="32" cy="42" r="1.3" fill="#374151" />
          <circle cx="32" cy="49" r="1.3" fill="#374151" />
        </>
      )}
    </svg>
  );
}

export function Actor({
  id,
  speaking = false,
  size = 72,
  showLabel = true,
  className,
}: {
  id: ActorId;
  speaking?: boolean;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const info = ACTORS[id];
  return (
    <figure className={cn("flex flex-col items-center gap-1", className)}>
      <motion.div
        style={{ width: size, height: size * 1.3125 }}
        animate={reduced ? undefined : speaking ? { y: [0, -4, 0] } : { y: [0, -1.5, 0] }}
        transition={reduced ? undefined : { duration: speaking ? 0.6 : 3, repeat: Infinity, ease: "easeInOut" }}
        role="img"
        aria-label={`${info.name}, ${info.role}`}
      >
        <Figure id={id} />
      </motion.div>
      {showLabel && (
        <figcaption className="text-center leading-tight">
          <span className="block text-[11px] font-semibold text-text-primary">{info.name}</span>
          <span className="block max-w-[9rem] text-[10px] text-text-muted">{info.role}</span>
        </figcaption>
      )}
    </figure>
  );
}

/** Speech bubble next to an actor; pops in when its text changes. */
export function SpeechBubble({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={reduced ? false : { opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -4 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "relative rounded-xl border border-border-primary bg-bg-secondary px-3 py-2 text-[13px] leading-snug text-text-primary shadow-lg",
          "before:absolute before:-left-2 before:top-5 before:h-3 before:w-3 before:rotate-45 before:border-b before:border-l before:border-border-primary before:bg-bg-secondary",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        “{text}”
      </motion.div>
    </AnimatePresence>
  );
}
