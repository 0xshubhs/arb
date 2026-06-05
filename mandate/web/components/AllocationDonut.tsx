"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { AllocationSlice } from "@/lib/useVaultEvents";
import { pct, cx } from "@/lib/format";

interface Props {
  allocations: AllocationSlice[];
  maxDriftBps: number;
  /** Tints the center figure amber when the agent is revoked. */
  revoked?: boolean;
}

const SIZE = 260;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const TARGET_RADIUS = RADIUS - STROKE / 2 - 7;
const TARGET_CIRC = 2 * Math.PI * TARGET_RADIUS;

/**
 * Two concentric rings: the bold outer ring is the *current* basket weights
 * (tweened as they move), the faint inner ring is the *target*. The gap you see
 * between them is the drift the agent is paid to close.
 */
export function AllocationDonut({ allocations, maxDriftBps, revoked }: Props) {
  const totalCurrent = allocations.reduce((s, a) => s + a.currentBps, 0) || 1;
  const totalTarget = allocations.reduce((s, a) => s + a.targetBps, 0) || 1;

  const maxDrift = useMemo(() => {
    return allocations.reduce((m, a) => Math.max(m, Math.abs(a.currentBps - a.targetBps)), 0);
  }, [allocations]);

  const inBounds = maxDrift <= maxDriftBps;

  // Precompute the start offsets for each arc (current + target rings).
  let curOffset = 0;
  const currentArcs = allocations.map((a) => {
    const frac = a.currentBps / totalCurrent;
    const arc = { ...a, frac, dash: frac * CIRC, offset: curOffset };
    curOffset += frac * CIRC;
    return arc;
  });

  let tgtOffset = 0;
  const targetArcs = allocations.map((a) => {
    const frac = a.targetBps / totalTarget;
    const arc = { ...a, frac, dash: frac * TARGET_CIRC, offset: tgtOffset };
    tgtOffset += frac * TARGET_CIRC;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-10">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          {/* track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={STROKE}
          />
          {/* target ring (faint, dashed) */}
          {targetArcs.map((a) => (
            <circle
              key={`t-${a.symbol}`}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={TARGET_RADIUS}
              fill="none"
              stroke={a.color}
              strokeOpacity={0.28}
              strokeWidth={6}
              strokeDasharray={`${Math.max(0, a.dash - 3)} ${TARGET_CIRC}`}
              strokeDashoffset={-a.offset}
            />
          ))}
          {/* current ring (bold, tweened) */}
          {currentArcs.map((a) => (
            <motion.circle
              key={`c-${a.symbol}`}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={a.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              initial={false}
              animate={{
                strokeDasharray: `${Math.max(0, a.dash - 2)} ${CIRC}`,
                strokeDashoffset: -a.offset,
              }}
              transition={{ type: "spring", stiffness: 60, damping: 16 }}
            />
          ))}
        </svg>

        {/* center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="label">Max drift</span>
          <span
            className={cx(
              "num mt-1 text-2xl font-semibold",
              revoked ? "text-amber" : inBounds ? "text-bound" : "text-breach"
            )}
          >
            {pct(maxDrift, 2)}
          </span>
          <span
            className={cx(
              "num mt-1 text-[10px] uppercase tracking-wider",
              revoked ? "text-amber" : inBounds ? "text-bound/80" : "text-breach/80"
            )}
          >
            {revoked ? "Agent revoked" : inBounds ? "In bounds" : "Drifting"}
          </span>
          <span className="label mt-1 normal-case tracking-normal text-faint">
            band {pct(maxDriftBps, 0)}
          </span>
        </div>
      </div>

      {/* legend */}
      <div className="grid w-full max-w-xs grid-cols-1 gap-2">
        {allocations.map((a) => {
          const drift = a.currentBps - a.targetBps;
          return (
            <div
              key={a.symbol}
              className="flex items-center justify-between rounded-lg border border-hairsoft bg-panel2/40 px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                <span className="text-sm font-medium">{a.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-sm tabular-nums">{pct(a.currentBps)}</span>
                <span
                  className={cx(
                    "num w-14 text-right text-xs tabular-nums",
                    Math.abs(drift) <= maxDriftBps ? "text-mute" : "text-breach"
                  )}
                >
                  {drift >= 0 ? "+" : ""}
                  {pct(drift, 1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
