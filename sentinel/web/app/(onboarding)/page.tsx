"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MandatePrompt } from "@/components/MandatePrompt";
import { PolicyChip } from "@/components/PolicyChip";
import { compileMandate, type CompiledPolicy } from "@/lib/policyCompiler";
import { isLive, USDC_DECIMALS } from "@/lib/contracts";

type Phase = "idle" | "compiling" | "compiled" | "writing" | "written";

export default function OnboardingPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [policy, setPolicy] = useState<CompiledPolicy | null>(null);
  const [sentence, setSentence] = useState("");

  const handleCompile = (text: string) => {
    setSentence(text);
    setPhase("compiling");
    // Simulate the off-chain Claude PolicyCompiler round-trip.
    setTimeout(() => {
      setPolicy(compileMandate(text));
      setPhase("compiled");
    }, 750);
  };

  const handleWrite = () => {
    setPhase("writing");
    // In live mode this would call PolicyRegistry.mint(cfg) via wagmi useWriteContract.
    setTimeout(() => setPhase("written"), 1400);
  };

  const reset = () => {
    setPhase("idle");
    setPolicy(null);
    setSentence("");
  };

  return (
    <div className="mx-auto max-w-4xl py-6">
      <Hero />

      <div className="mt-6">
        <MandatePrompt onCompile={handleCompile} compiling={phase === "compiling"} />
      </div>

      <AnimatePresence>
        {policy && phase !== "idle" && phase !== "compiling" && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="label">Compiled Policy</span>
                <span className="font-mono text-2xs text-muted">
                  from: <span className="text-muted-bright">&ldquo;{sentence}&rdquo;</span>
                </span>
              </div>
              <button onClick={reset} className="nav-link hover:text-muted-bright">
                ↺ Recompile
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {policy.chips.map((chip, i) => (
                <PolicyChip key={chip.kind} chip={chip} index={i} />
              ))}
            </div>

            <StructPreview policy={policy} />

            <ConfirmBar phase={phase} onWrite={handleWrite} onReset={reset} />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Hero() {
  return (
    <div className="text-center">
      <span className="label">Step 1 — Author the mandate</span>
      <h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight text-muted-bright sm:text-4xl">
        Bounded authority, in one sentence.
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        SENTINEL is the firewall under your AI agent&apos;s wallet. Describe the rules in plain
        English; we compile them into an on-chain Policy NFT that says <span className="text-signal">NO</span>{" "}
        before a compromised agent can drain you.
      </p>
    </div>
  );
}

function StructPreview({ policy }: { policy: CompiledPolicy }) {
  const scaled = {
    velocityCapPerTx: `${policy.velocityCapPerTx * 10 ** USDC_DECIMALS}`,
    dailyCapUSDC: `${policy.dailyCapUSDC * 10 ** USDC_DECIMALS}`,
    drawdownBps: policy.drawdownBps,
    minCounterpartyReputation: policy.minCounterpartyReputation,
    killSwitched: policy.killSwitched,
  };
  return (
    <details className="panel mt-3 p-4">
      <summary className="label cursor-pointer select-none">
        PolicyConfig struct (written on-chain)
      </summary>
      <pre className="mt-3 overflow-x-auto rounded-sm bg-ink-900/70 p-3 font-mono text-2xs leading-relaxed text-muted">
        {`PolicyConfig {
  velocityCapPerTx:          ${scaled.velocityCapPerTx}   // ${policy.velocityCapPerTx} USDC (6dp)
  dailyCapUSDC:              ${scaled.dailyCapUSDC}   // ${policy.dailyCapUSDC} USDC (6dp)
  drawdownBps:               ${scaled.drawdownBps}        // ${policy.drawdownBps / 100}%
  minCounterpartyReputation: ${scaled.minCounterpartyReputation}        // 0..100 gate
  killSwitched:              ${scaled.killSwitched}
}`}
      </pre>
    </details>
  );
}

function ConfirmBar({
  phase,
  onWrite,
  onReset,
}: {
  phase: Phase;
  onWrite: () => void;
  onReset: () => void;
}) {
  if (phase === "written") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel mt-4 flex flex-col items-center gap-3 border-signal/40 p-6 text-center shadow-signal-glow"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-signal text-signal">
          ✓
        </span>
        <p className="font-mono text-sm uppercase tracking-[0.16em] text-signal">
          Policy NFT minted{isLive ? " on Arbitrum" : " (demo)"}
        </p>
        <p className="max-w-md text-xs text-muted">
          Your agent&apos;s session key is now bound to this policy. Watch the firewall arbitrate
          live spends on the floor.
        </p>
        <Link href="/floor" className="btn btn-signal mt-1">
          Open the Live Floor →
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-2xs text-muted">
        {isLive
          ? "Confirm writes PolicyRegistry.mint(cfg) to Arbitrum Sepolia."
          : "Demo mode — confirm simulates the on-chain mint."}
      </p>
      <div className="flex gap-3">
        <button onClick={onReset} className="btn">
          Edit
        </button>
        <button onClick={onWrite} disabled={phase === "writing"} className="btn btn-signal">
          {phase === "writing" ? "Writing on-chain…" : "Confirm & Write On-Chain"}
        </button>
      </div>
    </div>
  );
}
