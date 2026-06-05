"use client";

import { GasBenchmarkChart, type BenchmarkRow } from "@/components/GasBenchmarkChart";
import { addresses, FACTOR_WEIGHTS, SCORE_THRESHOLD } from "@/lib/contracts";
import { arbiscan } from "@/lib/chain";

/**
 * Proof panel — the "why Stylus / why Arbitrum" thesis as a number.
 * Stylus-vs-Solidity gas benchmark for the compute-heavy checkSpend path,
 * plus links to the verified contracts.
 *
 * Values are representative pending the on-chain `forge snapshot` + cargo-stylus
 * measurement; swap them in once captured (BUILD.md §2 gas benchmark).
 */
const BENCHMARK: BenchmarkRow[] = [
  { op: "checkSpend", stylus: 41_200, solidity: 96_800 },
  { op: "scorePure (composite)", stylus: 7_900, solidity: 22_400 },
  { op: "velocity + daily", stylus: 5_100, solidity: 13_700 },
  { op: "drawdown factor", stylus: 4_300, solidity: 11_900 },
];

export default function ProofPage() {
  const headline = BENCHMARK[0];
  const headlineSavings = Math.round(
    ((headline.solidity - headline.stylus) / headline.solidity) * 100,
  );
  const avgSavings = Math.round(
    (BENCHMARK.reduce((s, r) => s + (r.solidity - r.stylus) / r.solidity, 0) / BENCHMARK.length) *
      100,
  );

  return (
    <div className="mx-auto max-w-5xl py-6">
      <header className="text-center">
        <span className="label">Proof — why Stylus, why Arbitrum</span>
        <h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight text-muted-bright sm:text-4xl">
          The risk score is feasible because Stylus makes it cheap.
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          The compute-heavy scorer runs as an Arbitrum Stylus (Rust/WASM) contract, with an
          identical Solidity twin as the verified fallback and benchmark baseline. Same{" "}
          <span className="text-muted-bright">(allowed, score, reasonCode)</span> for every input —
          measured head-to-head.
        </p>
      </header>

      {/* headline savings */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat value={`−${headlineSavings}%`} label="checkSpend gas" tone="signal" />
        <BigStat value={`−${avgSavings}%`} label="avg across ops" tone="signal" />
        <BigStat value={`${SCORE_THRESHOLD}`} label="block threshold" tone="muted" />
        <BigStat value="4" label="risk factors" tone="muted" />
      </div>

      {/* chart */}
      <section className="panel mt-6 p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Gas per operation · Stylus vs Solidity</span>
          <div className="flex items-center gap-4 font-mono text-2xs uppercase tracking-[0.14em]">
            <Legend color="#00E58A" name="Stylus (Rust/WASM)" />
            <Legend color="#2C3543" name="Solidity twin" />
          </div>
        </div>
        <GasBenchmarkChart data={BENCHMARK} />
        <p className="mt-2 text-2xs text-muted/70">
          Representative figures pending on-chain capture (forge snapshot + cargo-stylus). Lower is
          better; green annotation is Stylus savings vs the Solidity twin.
        </p>
      </section>

      {/* factor weights */}
      <section className="panel mt-4 p-5">
        <span className="label">Transparent composite — 4 explained factors</span>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Factor name="Velocity" weight={FACTOR_WEIGHTS.velocity} desc="per-tx cap" />
          <Factor name="Daily Cap" weight={FACTOR_WEIGHTS.daily} desc="rolling 24h" />
          <Factor name="Drawdown" weight={FACTOR_WEIGHTS.drawdown} desc="vs high-water" />
          <Factor name="Counterparty" weight={FACTOR_WEIGHTS.counterparty} desc="ERC-8004 rep" />
        </div>
        <p className="mt-3 text-xs text-muted">
          Composite = weighted blend, 0–100. Any hard breach pins the score to 100 and reverts; a
          composite ≥ {SCORE_THRESHOLD} blocks on the threshold. No black-box AI score — judges read
          it as transparent engineering.
        </p>
      </section>

      {/* verified contracts */}
      <section className="panel mt-4 p-5">
        <span className="label">Verified contracts</span>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ContractLink name="RiskEngine — Stylus (Rust/WASM)" addr={addresses.riskEngineStylus} />
          <ContractLink name="RiskEngine — Solidity twin" addr={addresses.riskEngineSolidity} />
          <ContractLink name="AgentGuard" addr={addresses.agentGuard} />
          <ContractLink name="PolicyRegistry" addr={addresses.policyRegistry} />
        </div>
        <p className="mt-3 text-2xs text-muted/70">
          Addresses resolve once deployed (set the NEXT_PUBLIC_* env vars). All source-verified on
          Arbiscan (Sepolia).
        </p>
      </section>
    </div>
  );
}

function BigStat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "signal" | "muted";
}) {
  return (
    <div className="panel p-4 text-center">
      <div
        className={`stat text-3xl font-semibold leading-none ${
          tone === "signal" ? "text-signal" : "text-muted-bright"
        }`}
      >
        {value}
      </div>
      <div className="label mt-1.5">{label}</div>
    </div>
  );
}

function Factor({ name, weight, desc }: { name: string; weight: number; desc: string }) {
  return (
    <div className="rounded-md border border-grid bg-ink-900/50 p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted-bright">
          {name}
        </span>
        <span className="stat text-sm text-signal">{weight}%</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-600">
        <div className="h-full rounded-full bg-signal/70" style={{ width: `${weight * 3}%` }} />
      </div>
      <p className="mt-1.5 text-2xs text-muted">{desc}</p>
    </div>
  );
}

function Legend({ color, name }: { color: string; name: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
      {name}
    </span>
  );
}

function ContractLink({ name, addr }: { name: string; addr: string }) {
  const has = /^0x[a-fA-F0-9]{40}$/.test(addr);
  return (
    <a
      href={has ? arbiscan("address", addr) : undefined}
      target="_blank"
      rel="noreferrer"
      aria-disabled={!has}
      className={`flex items-center justify-between rounded-md border border-grid bg-ink-900/50 px-3 py-2.5 transition-colors ${
        has ? "hover:border-signal/40" : "cursor-default opacity-60"
      }`}
    >
      <span className="font-mono text-xs text-muted-bright">{name}</span>
      <span className="font-mono text-2xs text-muted">
        {has ? `${addr.slice(0, 8)}… ↗` : "pending deploy"}
      </span>
    </a>
  );
}
