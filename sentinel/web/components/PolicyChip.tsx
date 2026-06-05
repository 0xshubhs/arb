"use client";

import { motion } from "framer-motion";
import type { PolicyChipData } from "@/lib/policyCompiler";

/**
 * A labeled policy chip — one of VELOCITY / DAILY CAP / DRAWDOWN /
 * COUNTERPARTY TRUST — produced by the Mandate Compiler.
 */
export function PolicyChip({ chip, index }: { chip: PolicyChipData; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.08 * index, type: "spring", stiffness: 320, damping: 24 }}
      className="panel relative overflow-hidden p-4"
    >
      {/* left accent */}
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${
          chip.detected ? "bg-signal" : "bg-muted/40"
        }`}
      />
      <div className="flex items-center justify-between">
        <span className="label">{chip.label}</span>
        <span
          className={`rounded-[2px] px-1.5 py-0.5 font-mono text-2xs uppercase tracking-[0.14em] ${
            chip.detected ? "bg-signal/12 text-signal" : "bg-ink-600 text-muted"
          }`}
        >
          {chip.detected ? "parsed" : "default"}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="stat text-2xl font-semibold text-muted-bright">{chip.value}</span>
        <span className="font-mono text-2xs text-muted">· w {chip.weight}%</span>
      </div>

      <p className="mt-1.5 text-xs leading-snug text-muted">{chip.detail}</p>
    </motion.div>
  );
}
