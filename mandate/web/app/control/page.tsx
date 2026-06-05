"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useVaultEvents } from "@/lib/useVaultEvents";
import { AllocationDonut } from "@/components/AllocationDonut";
import { BudgetMeter } from "@/components/BudgetMeter";
import { ActivityRow } from "@/components/ActivityRow";
import { KillSwitch } from "@/components/KillSwitch";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { RetentionPanel } from "@/components/RetentionPanel";
import { cx } from "@/lib/format";
import { IS_DEMO_MODE } from "@/lib/contracts";

export default function ControlRoomPage() {
  const vault = useVaultEvents();

  const executedCount = useMemo(
    () => vault.feed.filter((e) => e.status === "EXECUTED" && e.kind !== "PolicyCheck").length + 18,
    [vault.feed]
  );

  const roomClass = vault.revoked ? "room-revoked" : "room-default";

  return (
    <div className={cx("min-h-[calc(100vh-3.5rem)] transition-colors duration-700", roomClass)}>
      {/* amber wash when revoked */}
      <AnimatePresence>
        {vault.revoked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-0 bg-amber/[0.04]"
          />
        )}
      </AnimatePresence>

      <div className="relative mx-auto max-w-7xl px-6 py-8">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Control Room</h1>
              <StatusPill paused={vault.paused} revoked={vault.revoked} />
            </div>
            <p className="mt-1.5 text-sm text-mute">
              Your agent, working inside the cage. Every action is a verifiable on-chain receipt.
            </p>
          </div>

          <div className="card px-5 py-3 text-right">
            <span className="label">Portfolio value</span>
            <div>
              <AnimatedNumber
                value={vault.portfolioValueUsd}
                currency
                decimals={2}
                className={cx(
                  "text-2xl font-semibold",
                  vault.revoked ? "text-amber" : "text-white"
                )}
              />
            </div>
            <span className="num text-[10px] text-faint">USDG abstracted to USD · gas sponsored</span>
          </div>
        </div>

        {/* demo banner */}
        {IS_DEMO_MODE && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/[0.06] px-4 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            <span className="num text-[11px] text-amber/90">
              Demo mode — streaming synthetic live events. Set NEXT_PUBLIC_VAULT_ADDRESS to watch a
              real vault.
            </span>
          </div>
        )}

        {/* main grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* left column: donut + budget */}
          <div className="space-y-6 lg:col-span-7">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <span className="label">Allocation · current vs target</span>
                <span
                  className={cx(
                    "num text-[10px] uppercase tracking-wider",
                    vault.revoked ? "text-amber" : "text-bound/80"
                  )}
                >
                  {vault.revoked ? "frozen" : "tracking target"}
                </span>
              </div>
              <div className="mt-6">
                <AllocationDonut
                  allocations={vault.allocations}
                  maxDriftBps={vault.maxDriftBps}
                  revoked={vault.revoked}
                />
              </div>
            </div>

            <BudgetMeter
              remainingUsd={vault.remainingCapUsd}
              capUsd={vault.dailyCapUsd}
              revoked={vault.revoked}
              paused={vault.paused}
            />
          </div>

          {/* right column: kill switch + retention */}
          <div className="space-y-6 lg:col-span-5">
            <KillSwitch
              paused={vault.paused}
              revoked={vault.revoked}
              onPause={vault.pause}
              onResume={vault.unpause}
              onRevoke={vault.revoke}
            />
            <RetentionPanel
              valueUsd={vault.portfolioValueUsd}
              goalUsd={20000}
              streakDays={14}
              rebalancesExecuted={executedCount}
            />
          </div>
        </div>

        {/* activity feed */}
        <div className="mt-6 card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="label">Activity feed</span>
              <span className="num text-[11px] text-faint">PROPOSED · EXECUTED · REVERTED</span>
            </div>
            <button
              type="button"
              onClick={vault.simulateBreach}
              disabled={vault.revoked}
              className={cx(
                "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors",
                vault.revoked
                  ? "cursor-not-allowed border-hairsoft text-faint"
                  : "border-breach/50 text-breach hover:bg-breach/10"
              )}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M7 1L1 12h12L7 1zM7 6v3M7 10.5v.01"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Simulate breach
            </button>
          </div>

          <p className="mt-2 text-xs text-mute">
            Press <span className="text-breach">Simulate breach</span> to fire an over-cap trade.
            Watch it bounce off the contract as a red REVERTED row — principal untouched.
          </p>

          <div className="mt-5 space-y-2.5">
            <AnimatePresence initial={false}>
              {vault.feed.map((event) => (
                <ActivityRow key={event.id} event={event} />
              ))}
            </AnimatePresence>
            {vault.feed.length === 0 && (
              <div className="rounded-xl border border-hairsoft bg-panel2/30 px-4 py-8 text-center">
                <span className="num text-sm text-faint">
                  Waiting for the agent&apos;s first action…
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ paused, revoked }: { paused: boolean; revoked: boolean }) {
  const cfg = revoked
    ? { text: "Agent revoked", color: "text-amber", dot: "bg-amber", ring: "border-amber/40" }
    : paused
      ? { text: "Agent paused", color: "text-amber", dot: "bg-amber", ring: "border-amber/40" }
      : { text: "Agent active", color: "text-bound", dot: "bg-bound animate-pulseGreen", ring: "border-bound/40" };

  return (
    <span
      className={cx(
        "num inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider",
        cfg.ring,
        cfg.color
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.text}
    </span>
  );
}
