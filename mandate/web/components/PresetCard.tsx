"use client";

import { motion } from "framer-motion";
import { cx, pct } from "@/lib/format";
import { STOCKS } from "@/lib/contracts";

export interface Preset {
  id: string;
  name: string;
  tagline: string;
  /** Parallel arrays: symbols + target weights (bps, sum 10000). */
  symbols: string[];
  weightsBps: number[];
  /** Suggested guardrails for this mandate. */
  suggested: { driftBps: number; dailyBudgetUsd: number; slippageBps: number };
}

interface Props {
  preset: Preset;
  selected: boolean;
  onSelect: () => void;
}

export function PresetCard({ preset, selected, onSelect }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      className={cx(
        "card group relative w-full overflow-hidden p-5 text-left transition-all",
        selected ? "border-bound/60 shadow-glow" : "hover:border-hair"
      )}
    >
      {selected && (
        <span className="absolute right-4 top-4 inline-flex h-5 w-5 items-center justify-center rounded-full bg-bound text-canvas">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}

      <h3 className="text-base font-semibold">{preset.name}</h3>
      <p className="mt-1 text-xs leading-relaxed text-mute">{preset.tagline}</p>

      {/* weight ladder */}
      <div className="mt-4 space-y-2">
        {preset.symbols.map((sym, i) => {
          const meta = STOCKS[sym];
          const w = preset.weightsBps[i];
          return (
            <div key={sym} className="flex items-center gap-2.5">
              <span className="w-11 text-xs font-medium">{sym}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(w / 10000) * 100}%`, background: meta?.color ?? "#14E08A" }}
                />
              </div>
              <span className="num w-12 text-right text-[11px] text-mute">{pct(w)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-hairsoft pt-3">
        <span className="num text-[11px] text-faint">
          drift <span className="text-mute">{pct(preset.suggested.driftBps, 0)}</span>
        </span>
        <span className="num text-[11px] text-faint">
          budget{" "}
          <span className="text-mute">
            ${preset.suggested.dailyBudgetUsd.toLocaleString()}/d
          </span>
        </span>
        <span className="num text-[11px] text-faint">
          slip <span className="text-mute">{pct(preset.suggested.slippageBps, 1)}</span>
        </span>
      </div>
    </motion.button>
  );
}
