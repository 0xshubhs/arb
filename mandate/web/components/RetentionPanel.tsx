"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "./AnimatedNumber";
import { cx } from "@/lib/format";

interface Props {
  /** Current portfolio value in dollars. */
  valueUsd: number;
  /** Goal target in dollars. */
  goalUsd: number;
  /** Consecutive days the agent has stayed in-bounds. */
  streakDays: number;
  /** Count of rebalances executed (lifetime). */
  rebalancesExecuted: number;
}

/**
 * Retention layer: a goal-progress arc + an in-bounds streak. Gives judges the
 * "why users come back" answer without leaving the institutional tone.
 */
export function RetentionPanel({ valueUsd, goalUsd, streakDays, rebalancesExecuted }: Props) {
  const frac = Math.max(0, Math.min(1, valueUsd / goalUsd));
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="label">Your goal</span>
        <span className="num text-[10px] uppercase tracking-wider text-bound/80">on track</span>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <svg width="132" height="132" className="-rotate-90">
            <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <motion.circle
              cx="66"
              cy="66"
              r={R}
              fill="none"
              stroke="#14E08A"
              strokeWidth="8"
              strokeLinecap="round"
              initial={false}
              animate={{ strokeDasharray: `${frac * C} ${C}` }}
              transition={{ type: "spring", stiffness: 60, damping: 16 }}
              style={{ filter: "drop-shadow(0 0 8px rgba(20,224,138,0.4))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-lg font-semibold text-bound">{Math.round(frac * 100)}%</span>
            <span className="label mt-0.5 normal-case tracking-normal text-faint">to goal</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <div className="num text-xs text-mute">Portfolio</div>
            <AnimatedNumber value={valueUsd} currency decimals={0} className="text-xl font-semibold" />
          </div>
          <div>
            <div className="num text-xs text-mute">Target</div>
            <span className="num text-base text-white/80">
              {goalUsd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="In-bounds streak" value={streakDays} suffix=" days" accent />
        <Stat label="Rebalances" value={rebalancesExecuted} suffix="" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairsoft bg-panel2/40 px-3 py-2.5">
      <div className="label normal-case tracking-normal text-faint">{label}</div>
      <div className={cx("num mt-0.5 text-lg font-semibold", accent ? "text-bound" : "text-white/90")}>
        <AnimatedNumber value={value} decimals={0} suffix={suffix} />
      </div>
    </div>
  );
}
