"use client";

import { arbiscan } from "@/lib/chain";
import { shortAddr } from "@/lib/contracts";
import { AGENTS, type AgentMeta } from "@/lib/agents";

/**
 * Policy & Permissions sidebar — each agent's session-key scope so bounded
 * autonomy is visible: per-call & daily USDC caps, drawdown halt, allowlist,
 * expiry, and the kill-switch state. Real bounded authority, not a chatbot
 * with a wallet.
 */
export function PermissionsSidebar({ frozen }: { frozen: boolean }) {
  return (
    <aside className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-grid px-4 py-3">
        <span className="label">Session-Key Scope</span>
        <span
          className={`rounded-[2px] px-1.5 py-0.5 font-mono text-2xs uppercase tracking-[0.14em] ${
            frozen ? "bg-alert/15 text-alert" : "bg-signal/12 text-signal"
          }`}
        >
          {frozen ? "Frozen" : "Armed"}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {AGENTS.map((a) => (
          <ScopeCard key={a.id} meta={a} frozen={frozen} />
        ))}
      </div>

      <p className="border-t border-grid px-4 py-2.5 text-2xs leading-snug text-muted/70">
        Enforced by <span className="text-muted-bright">AgentGuard</span> + the Policy NFT.
        Every UserOp must clear <span className="text-muted-bright">RiskEngine.checkSpend</span>{" "}
        before settlement.
      </p>
    </aside>
  );
}

function ScopeCard({ meta, frozen }: { meta: AgentMeta; frozen: boolean }) {
  const expiryDate = new Date(meta.scope.expiry * 1000);
  const expiryLabel = expiryDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-md border border-grid bg-ink-900/50 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold tracking-[0.06em] text-muted-bright">
          {meta.name}
        </span>
        <a
          href={arbiscan("address", meta.sessionKey)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-2xs text-muted/70 hover:text-signal"
        >
          key {shortAddr(meta.sessionKey)} ↗
        </a>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
        <Row label="Per-call cap" value={`${meta.scope.perCallCapUsdc} USDC`} />
        <Row label="Daily cap" value={`${meta.scope.dailyCapUsdc} USDC`} />
        <Row label="Drawdown halt" value={`${meta.scope.drawdownPct}%`} />
        <Row label="Min rep" value={`${meta.scope.minCounterpartyReputation}/100`} />
        <Row label="Expiry" value={expiryLabel} />
        <Row label="Policy NFT" value={`#${meta.policyId}`} />
      </dl>

      <div className="mt-2.5">
        <span className="label">Allowlist</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {meta.scope.allowlist.map((t) => (
            <span
              key={t}
              className="rounded-[2px] border border-grid bg-ink-700/60 px-1.5 py-0.5 font-mono text-[10px] text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-grid pt-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${frozen ? "bg-alert" : "bg-signal"}`}
        />
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-muted">
          Kill switch {frozen ? "ENGAGED" : "ready"}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="stat mt-0.5 text-sm text-muted-bright">{value}</dd>
    </div>
  );
}
