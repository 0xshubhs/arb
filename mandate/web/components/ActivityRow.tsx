"use client";

import { motion } from "framer-motion";
import type { ActivityEvent } from "@/lib/useVaultEvents";
import { blockscoutTx } from "@/lib/wagmi";
import { cx, shortHash, timeAgo, usd } from "@/lib/format";

interface Props {
  event: ActivityEvent;
}

const STATUS_STYLES: Record<
  ActivityEvent["status"],
  { dot: string; text: string; ring: string; label: string }
> = {
  PROPOSED: {
    dot: "bg-mute",
    text: "text-mute",
    ring: "border-hair",
    label: "PROPOSED",
  },
  EXECUTED: {
    dot: "bg-bound",
    text: "text-bound",
    ring: "border-bound/30",
    label: "EXECUTED",
  },
  REVERTED: {
    dot: "bg-breach",
    text: "text-breach",
    ring: "border-breach/45",
    label: "REVERTED",
  },
};

export function ActivityRow({ event }: Props) {
  const s = STATUS_STYLES[event.status];
  const isRevert = event.status === "REVERTED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className={cx(
        "relative overflow-hidden rounded-xl border bg-panel2/40 p-4",
        s.ring,
        isRevert && "bg-breach/[0.06] shadow-glowRed"
      )}
    >
      {isRevert && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-breach to-transparent" />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cx(
                  "num rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                  s.ring,
                  s.text
                )}
              >
                {s.label}
              </span>
              <span className="num text-[11px] text-faint">#{event.nonce}</span>
              {event.kind !== "PolicyCheck" && (
                <span className="num text-[11px] text-faint">{event.kind}</span>
              )}
            </div>
            <p className="mt-1.5 truncate text-sm font-medium text-white/90">{event.summary}</p>
            <p className={cx("mt-1 text-xs leading-relaxed", isRevert ? "text-breach/90" : "text-mute")}>
              {event.rationale}
            </p>

            {isRevert && event.revertReason && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-breach/40 bg-breach/10 px-2 py-1">
                <span className="text-[11px] text-breach">Blocked by your policy ·</span>
                <span className="num text-[11px] font-medium text-breach">{event.revertReason}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
          {event.notionalUsd > 0 && (
            <span className={cx("num text-sm font-medium", isRevert ? "text-breach line-through" : "text-white/90")}>
              {usd(event.notionalUsd, true)}
            </span>
          )}
          <span className="num text-[11px] text-faint">{timeAgo(event.timestamp)}</span>
          {event.txHash && (
            <a
              href={blockscoutTx(event.txHash)}
              target="_blank"
              rel="noreferrer"
              className={cx(
                "num inline-flex items-center gap-1 text-[11px] underline-offset-2 hover:underline",
                isRevert ? "text-breach/80" : "text-mute hover:text-bound"
              )}
            >
              {shortHash(event.txHash)}
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M3 9L9 3M9 3H4M9 3V8"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
