"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RiskGauge } from "./RiskGauge";
import { RevertStamp } from "./RevertStamp";
import { arbiscan } from "@/lib/chain";
import { formatUsdc, shortAddr, type SpendEvent } from "@/lib/contracts";
import type { AgentMeta } from "@/lib/agents";
import type { AgentRuntime } from "@/lib/useAgentEvents";

/**
 * One agent lane: identity header, live RiskGauge, a stream of spend attempts
 * that either slide through (AUTHORIZED, green) or snap back with a REVERTED
 * stamp + reason chip. Honest = green baseline; the other two get blocked.
 */
export function AgentLane({
  meta,
  runtime,
  events,
  frozen,
}: {
  meta: AgentMeta;
  runtime: AgentRuntime;
  events: SpendEvent[];
  frozen: boolean;
}) {
  const lastBlock = runtime.lastVerdict?.verdict === "REVERTED" ? runtime.lastVerdict : null;
  const toneClass =
    meta.archetype === "honest"
      ? "border-signal/25"
      : runtime.score >= 80
        ? "border-alert/40"
        : "border-grid";

  return (
    <div className={`panel relative flex h-full flex-col overflow-hidden border ${toneClass}`}>
      {/* header */}
      <div className="flex items-start justify-between gap-3 border-b border-grid p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                meta.archetype === "honest"
                  ? "bg-signal"
                  : runtime.score >= 80
                    ? "bg-alert animate-pulse"
                    : "bg-caution"
              }`}
            />
            <h3 className="truncate font-mono text-sm font-semibold tracking-[0.08em] text-muted-bright">
              {meta.name}
            </h3>
          </div>
          <p className="mt-1 truncate text-xs text-muted">{meta.role}</p>
          <a
            href={arbiscan("address", meta.account)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block font-mono text-2xs text-muted/70 transition-colors hover:text-signal"
          >
            {shortAddr(meta.account)} ↗
          </a>
        </div>
        <RiskGauge score={runtime.score} size={104} frozen={frozen} />
      </div>

      {/* tallies */}
      <div className="grid grid-cols-3 border-b border-grid text-center">
        <Tally label="Authorized" value={runtime.authorized} tone="signal" />
        <Tally label="Reverted" value={runtime.reverted} tone="alert" divided />
        <Tally label="Spent 24h" value={formatUsdc(runtime.dailySpent)} tone="muted" divided />
      </div>

      {/* live stream */}
      <div className="relative flex-1 overflow-hidden p-3">
        {/* big stamp overlay for the most recent block */}
        <div className="pointer-events-none absolute right-4 top-3 z-10">
          <AnimatePresence mode="popLayout">
            {lastBlock && !frozen && (
              <RevertStamp key={lastBlock.id} reason={lastBlock.reasonLabel} />
            )}
          </AnimatePresence>
        </div>

        <div className="flex max-h-[210px] flex-col gap-1.5 overflow-hidden">
          <AnimatePresence initial={false}>
            {events.slice(0, 7).map((evt) => (
              <FeedRow key={evt.id} evt={evt} />
            ))}
          </AnimatePresence>
          {events.length === 0 && (
            <p className="py-6 text-center font-mono text-2xs uppercase tracking-[0.18em] text-muted/50">
              {frozen ? "Lane frozen" : "Awaiting activity…"}
            </p>
          )}
        </div>
      </div>

      <p className="border-t border-grid px-4 py-2 text-2xs leading-snug text-muted/80">
        {meta.blurb}
      </p>
    </div>
  );
}

function Tally({
  label,
  value,
  tone,
  divided,
}: {
  label: string;
  value: number | string;
  tone: "signal" | "alert" | "muted";
  divided?: boolean;
}) {
  const color =
    tone === "signal" ? "text-signal" : tone === "alert" ? "text-alert" : "text-muted-bright";
  return (
    <div className={`px-2 py-2.5 ${divided ? "border-l border-grid" : ""}`}>
      <div className={`stat text-lg font-semibold ${color}`}>{value}</div>
      <div className="label mt-0.5">{label}</div>
    </div>
  );
}

/** A single row in the live feed. */
function FeedRow({ evt }: { evt: SpendEvent }) {
  const authorized = evt.verdict === "AUTHORIZED";
  return (
    <motion.a
      href={evt.txHash ? arbiscan("tx", evt.txHash) : undefined}
      target="_blank"
      rel="noreferrer"
      layout
      initial={{ opacity: 0, x: authorized ? 24 : -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`flex items-center gap-2 rounded-[3px] border px-2.5 py-1.5 font-mono text-2xs transition-colors ${
        authorized
          ? "border-signal/20 bg-signal/[0.04] hover:border-signal/40"
          : "border-alert/30 bg-alert/[0.05] hover:border-alert/50"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${authorized ? "bg-signal" : "bg-alert"}`} />
      <span className="text-muted">→ {shortAddr(evt.to)}</span>
      <span className="ml-auto nums text-muted-bright">{formatUsdc(evt.amountUsdc)} USDC</span>
      <span
        className={`shrink-0 rounded-[2px] px-1.5 py-0.5 uppercase tracking-[0.12em] ${
          authorized ? "bg-signal/12 text-signal" : "bg-alert/15 text-alert"
        }`}
      >
        {authorized ? "OK" : evt.reasonLabel}
      </span>
    </motion.a>
  );
}
