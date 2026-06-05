"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * The physical KILL SWITCH — chunky, guarded behind a flip-up cover. Arming
 * the cover exposes the switch; throwing it freezes every lane (the parent
 * applies the screen-wide desaturation). Throwing again disarms.
 */
export function KillSwitch({
  frozen,
  onToggle,
}: {
  frozen: boolean;
  onToggle: (next: boolean) => void;
}) {
  const [coverOpen, setCoverOpen] = useState(false);

  // If already frozen, the switch is hot regardless of cover.
  const armed = coverOpen || frozen;

  return (
    <div className="panel relative flex items-center gap-5 overflow-hidden p-4">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,59,59,0.05)_0_8px,transparent_8px_16px)] opacity-60" />

      <div className="relative flex flex-col">
        <span className="label text-alert/80">Floor Kill Switch</span>
        <span className="mt-0.5 font-mono text-2xs uppercase tracking-[0.16em] text-muted">
          {frozen ? "All lanes frozen" : armed ? "Armed — throw to freeze" : "Guard cover closed"}
        </span>
      </div>

      <div className="relative ml-auto flex items-center gap-3">
        {/* Guard cover toggle */}
        {!frozen && (
          <button
            type="button"
            onClick={() => setCoverOpen((v) => !v)}
            className="rounded-sm border border-alert/30 px-2 py-1 font-mono text-2xs uppercase tracking-[0.16em] text-alert/80 transition-colors hover:bg-alert/10"
          >
            {coverOpen ? "Close cover" : "Lift cover"}
          </button>
        )}

        {/* The switch itself */}
        <button
          type="button"
          disabled={!armed}
          onClick={() => onToggle(!frozen)}
          aria-pressed={frozen}
          className={`group relative grid h-14 w-28 place-items-center rounded-sm border-2 font-mono text-xs font-bold uppercase tracking-[0.18em] transition-all ${
            frozen
              ? "animate-pulseRing border-alert bg-alert/20 text-alert shadow-alert-glow"
              : armed
                ? "border-alert/70 bg-ink-700 text-alert hover:bg-alert/15"
                : "cursor-not-allowed border-grid bg-ink-700/50 text-muted/50"
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={frozen ? "frozen" : "armed"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {frozen ? "Frozen" : "Kill"}
            </motion.span>
          </AnimatePresence>

          {/* travel indicator */}
          <span
            className={`absolute bottom-1 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full transition-colors ${
              frozen ? "bg-alert" : armed ? "bg-alert/40" : "bg-grid"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
