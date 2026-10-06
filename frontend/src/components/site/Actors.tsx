/**
 * The people of the permitting journey as role avatars: project engineer,
 * survey technician, permitting official, environmental consultant and
 * fisheries representative. Each avatar is an icon for the role plus the
 * name and role in text, so the role is clear without colour alone. One
 * fade-in when it appears; no looping motion, and none at all with
 * prefers-reduced-motion.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bird, Fish, HardHat, Landmark, Radar, type LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { ACTORS, type ActorId } from "./journey";

const AVATAR: Record<ActorId, { Icon: LucideIcon; cls: string }> = {
  engineer: { Icon: HardHat, cls: "bg-orange-500/15 text-orange-500" },
  technician: { Icon: Radar, cls: "bg-sky-500/15 text-sky-500" },
  official: { Icon: Landmark, cls: "bg-slate-400/20 text-slate-400" },
  consultant: { Icon: Bird, cls: "bg-emerald-500/15 text-emerald-500" },
  fisher: { Icon: Fish, cls: "bg-cyan-500/15 text-cyan-500" },
};

export function Actor({
  id,
  speaking = false,
  size = 72,
  showLabel = true,
  className,
}: {
  id: ActorId;
  /** Highlights the avatar (static ring) while this person is talking. */
  speaking?: boolean;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const info = ACTORS[id];
  const { Icon, cls } = AVATAR[id];
  return (
    <motion.figure
      className={cn("flex flex-col items-center gap-1", className)}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        role="img"
        aria-label={`${info.name}, ${info.role}`}
        style={{ width: size, height: size }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full ring-offset-2 ring-offset-bg-secondary",
          cls,
          speaking ? "ring-2 ring-accent" : "ring-1 ring-border-primary",
        )}
      >
        <Icon size={Math.round(size * 0.48)} aria-hidden />
      </div>
      {showLabel && (
        <figcaption className="text-center leading-tight">
          <span className="block text-[11px] font-semibold text-text-primary">{info.name}</span>
          <span className="block max-w-[9rem] text-[10px] text-text-muted">{info.role}</span>
        </figcaption>
      )}
    </motion.figure>
  );
}

/** Speech bubble next to an actor; fades in when its text changes. */
export function SpeechBubble({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduced ? undefined : { opacity: 0 }}
        transition={{ duration: 0.2 }}
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
