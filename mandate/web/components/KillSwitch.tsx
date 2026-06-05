"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cx } from "@/lib/format";

interface Props {
  paused: boolean;
  revoked: boolean;
  onPause: () => void;
  onResume: () => void;
  onRevoke: () => void;
}

/**
 * Oversized, always-present kill-switch. PAUSE is reversible; REVOKE removes
 * the agent's on-chain AGENT_ROLE and is gated behind a hold-to-confirm so it
 * reads as the irreversible, room-turns-amber action it is.
 */
export function KillSwitch({ paused, revoked, onPause, onResume, onRevoke }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={cx(
        "card overflow-hidden p-5 transition-shadow",
        revoked ? "shadow-glowAmber" : paused ? "shadow-glowAmber" : "shadow-glow"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="label">Kill switch</span>
        <span
          className={cx(
            "num inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider",
            revoked ? "text-amber" : paused ? "text-amber" : "text-bound"
          )}
        >
          <span
            className={cx(
              "h-1.5 w-1.5 rounded-full",
              revoked ? "bg-amber" : paused ? "bg-amber" : "bg-bound animate-pulseGreen"
            )}
          />
          {revoked ? "AGENT REVOKED" : paused ? "AGENT PAUSED" : "AGENT ACTIVE"}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-mute">
        You hold the only key that moves principal. Pause halts the agent instantly; Revoke strips
        its <span className="num text-faint">AGENT_ROLE</span> on-chain forever.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* PAUSE / RESUME */}
        <button
          type="button"
          disabled={revoked}
          onClick={() => (paused ? onResume() : onPause())}
          className={cx(
            "group relative flex h-14 items-center justify-center rounded-xl border text-sm font-semibold uppercase tracking-wider transition-all",
            revoked
              ? "cursor-not-allowed border-hairsoft text-faint"
              : paused
                ? "border-bound/50 text-bound hover:bg-bound/10"
                : "border-amber/50 text-amber hover:bg-amber/10"
          )}
        >
          {paused ? "Resume agent" : "Pause"}
        </button>

        {/* REVOKE — hold to confirm */}
        <button
          type="button"
          disabled={revoked}
          onMouseDown={() => !revoked && setConfirming(true)}
          onMouseUp={() => setConfirming(false)}
          onMouseLeave={() => setConfirming(false)}
          onTouchStart={() => !revoked && setConfirming(true)}
          onTouchEnd={() => setConfirming(false)}
          onClick={() => {
            if (!revoked) onRevoke();
          }}
          className={cx(
            "group relative flex h-14 items-center justify-center overflow-hidden rounded-xl border text-sm font-semibold uppercase tracking-wider transition-all",
            revoked
              ? "cursor-not-allowed border-amber/40 bg-amber/10 text-amber"
              : "border-breach/60 text-breach hover:bg-breach/10"
          )}
        >
          {/* hold-to-confirm fill */}
          <AnimatePresence>
            {confirming && !revoked && (
              <motion.span
                className="absolute inset-0 origin-left bg-breach/25"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                exit={{ scaleX: 0 }}
                transition={{ duration: 0.18 }}
              />
            )}
          </AnimatePresence>
          <span className="relative">{revoked ? "Revoked" : "Revoke agent"}</span>
        </button>
      </div>

      {!revoked && (
        <p className="num mt-3 text-center text-[10px] uppercase tracking-wider text-faint">
          Revoke is irreversible
        </p>
      )}
      {revoked && (
        <p className="num mt-3 text-center text-[10px] uppercase tracking-wider text-amber/80">
          The agent is silenced · re-grant from policy to resume
        </p>
      )}
    </div>
  );
}
