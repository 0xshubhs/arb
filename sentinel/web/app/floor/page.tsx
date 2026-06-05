"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentLane } from "@/components/AgentLane";
import { KillSwitch } from "@/components/KillSwitch";
import { PermissionsSidebar } from "@/components/PermissionsSidebar";
import { useAgentEvents, peakScore } from "@/lib/useAgentEvents";
import { AGENTS } from "@/lib/agents";
import { isLive, type AgentId, type SpendEvent } from "@/lib/contracts";

export default function FloorPage() {
  const { events, runtime, frozen, live, setFrozen } = useAgentEvents();

  // Partition events by lane once per render.
  const byLane = useMemo(() => {
    const map: Record<AgentId, SpendEvent[]> = {
      honest: [],
      compromised: [],
      denylist: [],
    };
    for (const e of events) map[e.agentId].push(e);
    return map;
  }, [events]);

  const peak = peakScore(runtime);
  const totalReverted = Object.values(runtime).reduce((s, r) => s + r.reverted, 0);
  const totalAuthorized = Object.values(runtime).reduce((s, r) => s + r.authorized, 0);

  return (
    <div className={`relative ${frozen ? "frozen-world" : ""}`}>
      {/* freeze overlay */}
      <FreezeOverlay frozen={frozen} />

      {/* HUD bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div>
          <span className="label">Live Floor</span>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-muted-bright">
            Firewall arbitration, in real time
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Hud label="Peak Risk" value={peak.toString()} tone={peak >= 80 ? "alert" : "signal"} />
          <Hud label="Authorized" value={totalAuthorized.toString()} tone="signal" />
          <Hud label="Reverted" value={totalReverted.toString()} tone="alert" />
          <Hud
            label="Source"
            value={live ? "ON-CHAIN" : "DEMO"}
            tone={live ? "signal" : "muted"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        {/* main: lanes + kill switch */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((meta) => (
              <div key={meta.id} className="min-h-[420px]">
                <AgentLane
                  meta={meta}
                  runtime={runtime[meta.id]}
                  events={byLane[meta.id]}
                  frozen={frozen}
                />
              </div>
            ))}
          </div>

          <KillSwitch frozen={frozen} onToggle={setFrozen} />

          {!isLive && (
            <p className="text-center font-mono text-2xs uppercase tracking-[0.16em] text-muted/60">
              Demo mode — synthetic agent activity. Set NEXT_PUBLIC_AGENT_GUARD to stream live
              Arbitrum events.
            </p>
          )}
        </div>

        {/* sidebar */}
        <PermissionsSidebar frozen={frozen} />
      </div>
    </div>
  );
}

function Hud({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "signal" | "alert" | "muted";
}) {
  const color =
    tone === "signal" ? "text-signal" : tone === "alert" ? "text-alert" : "text-muted-bright";
  return (
    <div className="panel px-3 py-1.5 text-center">
      <div className={`stat text-lg font-semibold leading-none ${color}`}>{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

/** Screen-wide freeze banner overlaid when the kill switch is thrown. */
function FreezeOverlay({ frozen }: { frozen: boolean }) {
  return (
    <AnimatePresence>
      {frozen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="scanlines pointer-events-none fixed inset-0 z-30 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="rounded-md border-2 border-alert/70 bg-ink-900/85 px-8 py-5 text-center shadow-alert-glow backdrop-blur-sm"
          >
            <p className="font-mono text-2xl font-bold uppercase tracking-[0.3em] text-alert">
              Floor Frozen
            </p>
            <p className="mt-2 font-mono text-2xs uppercase tracking-[0.18em] text-muted">
              Kill switch engaged · every checkSpend now reverts
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
