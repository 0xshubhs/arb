"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "./AnimatedNumber";
import { cx } from "@/lib/format";

interface Props {
  remainingUsd: number;
  capUsd: number;
  revoked?: boolean;
  paused?: boolean;
}

/**
 * The per-day spend budget, burning down with spring physics as the agent
 * trades. Green while there's headroom; warms toward amber/red as it drains.
 */
export function BudgetMeter({ remainingUsd, capUsd, revoked, paused }: Props) {
  const frac = capUsd > 0 ? Math.max(0, Math.min(1, remainingUsd / capUsd)) : 0;
  const spent = Math.max(0, capUsd - remainingUsd);

  const color = revoked
    ? "#FFB020"
    : frac > 0.5
      ? "#14E08A"
      : frac > 0.2
        ? "#FFB020"
        : "#FF5C5C";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="label">Daily budget</span>
        <span
          className={cx(
            "num text-[10px] uppercase tracking-wider",
            paused || revoked ? "text-amber" : "text-bound/80"
          )}
        >
          {revoked ? "revoked" : paused ? "paused" : "rolling 24h"}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <AnimatedNumber
            value={remainingUsd}
            currency
            decimals={0}
            className="text-3xl font-semibold"
          />
          <span className="num ml-1.5 text-sm text-mute">left</span>
        </div>
        <div className="text-right">
          <div className="num text-sm text-mute">
            <AnimatedNumber value={spent} currency decimals={0} /> spent
          </div>
          <div className="num text-xs text-faint">
            of {capUsd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} cap
          </div>
        </div>
      </div>

      {/* track */}
      <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 18px -2px ${color}` }}
          initial={false}
          animate={{ width: `${frac * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        {/* hairline ticks at 25/50/75% */}
        {[0.25, 0.5, 0.75].map((t) => (
          <span
            key={t}
            className="absolute top-0 h-full w-px bg-canvas/70"
            style={{ left: `${t * 100}%` }}
          />
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-mute">
        The agent can spend at most this much notional in any rolling 24-hour window. Exceeding it
        reverts on-chain — enforced by{" "}
        <span className="num text-faint">perDayCapUsdg</span>.
      </p>
    </div>
  );
}
