"use client";

import { motion } from "framer-motion";

/**
 * The REVERTED stamp — slams in over a blocked spend like an ink stamp,
 * slightly rotated, with the reason chip underneath.
 */
export function RevertStamp({ reason }: { reason: string }) {
  return (
    <motion.div
      initial={{ scale: 1.9, opacity: 0, rotate: -16 }}
      animate={{ scale: 1, opacity: 1, rotate: -9 }}
      transition={{ type: "spring", stiffness: 700, damping: 18, mass: 0.7 }}
      className="pointer-events-none flex flex-col items-center gap-1"
    >
      <span className="rounded-[3px] border-2 border-alert px-3 py-1 font-mono text-sm font-bold uppercase tracking-[0.22em] text-alert shadow-alert-glow">
        Reverted
      </span>
      <span className="rounded-[2px] bg-alert/15 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.16em] text-alert">
        {reason}
      </span>
    </motion.div>
  );
}
