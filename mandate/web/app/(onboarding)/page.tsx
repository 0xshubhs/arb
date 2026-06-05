"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PresetCard } from "@/components/PresetCard";
import { GuardrailSlider } from "@/components/GuardrailSlider";
import { ProjectionChart } from "@/components/ProjectionChart";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PRESETS } from "@/lib/presets";
import { pct, cx } from "@/lib/format";

type Step = "login" | "preset" | "guardrails";

const DEMO_DEPOSIT_USD = 12480.55;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("login");
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);

  const [driftBps, setDriftBps] = useState(preset.suggested.driftBps);
  const [budgetUsd, setBudgetUsd] = useState(preset.suggested.dailyBudgetUsd);
  const [slippageBps, setSlippageBps] = useState(preset.suggested.slippageBps);
  const [autopilot, setAutopilot] = useState(false);

  // When a new preset is chosen, snap the sliders to its suggested guardrails.
  function choosePreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setDriftBps(p.suggested.driftBps);
    setBudgetUsd(p.suggested.dailyBudgetUsd);
    setSlippageBps(p.suggested.slippageBps);
  }

  return (
    <div className="room-default min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* progress rail */}
        <div className="mb-10 flex items-center gap-3">
          {(["login", "preset", "guardrails"] as Step[]).map((s, i) => {
            const order = ["login", "preset", "guardrails"];
            const reached = order.indexOf(step) >= i;
            return (
              <div key={s} className="flex items-center gap-3">
                <span
                  className={cx(
                    "num flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                    reached ? "border-bound/60 text-bound" : "border-hair text-faint"
                  )}
                >
                  {i + 1}
                </span>
                {i < 2 && (
                  <span className={cx("h-px w-12", reached ? "bg-bound/40" : "bg-hair")} />
                )}
              </div>
            );
          })}
          <span className="label ml-2">
            {step === "login" ? "Sign in" : step === "preset" ? "Choose a mandate" : "Set the cage"}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {step === "login" && (
            <motion.section
              key="login"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="mx-auto max-w-md"
            >
              <h1 className="text-2xl font-semibold tracking-tight">Give an agent a mandate.</h1>
              <p className="mt-2 text-sm leading-relaxed text-mute">
                A non-custodial robo-advisor for your tokenized stocks. The agent manages your basket
                24/7 inside a cage the blockchain enforces — it physically cannot withdraw your
                principal.
              </p>

              <div className="card mt-6 space-y-3 p-6">
                <button
                  type="button"
                  onClick={() => setStep("preset")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-bound py-3 text-sm font-semibold text-canvas transition-transform hover:scale-[1.01]"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M11 6V4.5a3 3 0 10-6 0V6M4 6h8v6H4V6z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Continue with passkey
                </button>
                <button
                  type="button"
                  onClick={() => setStep("preset")}
                  className="w-full rounded-xl border border-hair py-3 text-sm font-medium text-white/80 transition-colors hover:bg-panel2"
                >
                  Continue with email
                </button>
                <p className="num pt-1 text-center text-[11px] text-faint">
                  No seed phrase · gas sponsored · smart wallet via Account Kit
                </p>
              </div>
            </motion.section>
          )}

          {step === "preset" && (
            <motion.section
              key="preset"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <h1 className="text-2xl font-semibold tracking-tight">Choose a mandate</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
                A preset is a target basket the agent will hold and rebalance toward. You can tighten
                its guardrails on the next step.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {PRESETS.map((p) => (
                  <PresetCard
                    key={p.id}
                    preset={p}
                    selected={p.id === presetId}
                    onSelect={() => choosePreset(p.id)}
                  />
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="text-sm text-mute transition-colors hover:text-white"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep("guardrails")}
                  className="rounded-xl bg-bound px-6 py-2.5 text-sm font-semibold text-canvas transition-transform hover:scale-[1.01]"
                >
                  Set guardrails →
                </button>
              </div>
            </motion.section>
          )}

          {step === "guardrails" && (
            <motion.section
              key="guardrails"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Set the cage</h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-mute">
                    These are the bounds the contract enforces on every agent action. Drag any slider
                    and watch your projection respond.
                  </p>
                </div>
                <div className="card px-4 py-3 text-right">
                  <span className="label">Funding</span>
                  <div>
                    <AnimatedNumber
                      value={DEMO_DEPOSIT_USD}
                      currency
                      decimals={2}
                      className="text-lg font-semibold text-white/90"
                    />
                  </div>
                  <span className="num text-[10px] text-faint">USDG + faucet stocks · shown in USD</span>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-5">
                {/* sliders */}
                <div className="space-y-4 lg:col-span-2">
                  <GuardrailSlider
                    label="Drift band"
                    field="maxDriftBps"
                    hint="How far any holding may stray from target before the agent must act."
                    value={driftBps}
                    min={50}
                    max={1000}
                    step={25}
                    format={(v) => pct(v, 1)}
                    onChange={setDriftBps}
                  />
                  <GuardrailSlider
                    label="Daily budget"
                    field="perDayCapUsdg"
                    hint="Maximum notional the agent may trade in any rolling 24-hour window."
                    value={budgetUsd}
                    min={100}
                    max={5000}
                    step={50}
                    format={(v) => `$${v.toLocaleString()}`}
                    onChange={setBudgetUsd}
                  />
                  <GuardrailSlider
                    label="Max slippage"
                    field="maxSlippageBps"
                    hint="Tolerance between realized price and the oracle mid. Trades outside this revert."
                    value={slippageBps}
                    min={10}
                    max={200}
                    step={5}
                    format={(v) => pct(v, 2)}
                    onChange={setSlippageBps}
                  />
                </div>

                {/* projection centerpiece */}
                <div className="lg:col-span-3">
                  <ProjectionChart
                    principal={DEMO_DEPOSIT_USD}
                    driftBps={driftBps}
                    dailyBudgetUsd={budgetUsd}
                    slippageBps={slippageBps}
                  />

                  {/* Autopilot toggle */}
                  <div
                    className={cx(
                      "card mt-6 flex items-center justify-between p-5 transition-shadow",
                      autopilot && "shadow-glow"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold">Autopilot</span>
                        <span
                          className={cx(
                            "num rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                            autopilot ? "border-bound/40 text-bound" : "border-hair text-faint"
                          )}
                        >
                          {autopilot ? "On" : "Off"}
                        </span>
                      </div>
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-mute">
                        Grant the agent its scoped session key. It may only rebalance and DCA inside
                        the bounds above — nothing else.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={autopilot}
                      onClick={() => setAutopilot((v) => !v)}
                      className={cx(
                        "relative h-8 w-14 shrink-0 rounded-full border transition-colors",
                        autopilot ? "border-bound/60 bg-bound/20" : "border-hair bg-white/5"
                      )}
                    >
                      <motion.span
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cx(
                          "absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full",
                          autopilot ? "right-1 bg-bound" : "left-1 bg-mute"
                        )}
                      />
                    </button>
                  </div>

                  <Link
                    href="/control"
                    onClick={() => setAutopilot(true)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-bound py-3 text-sm font-semibold text-canvas transition-transform hover:scale-[1.005]"
                  >
                    {autopilot ? "Open Control Room →" : "Turn Autopilot ON & open Control Room →"}
                  </Link>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setStep("preset")}
                  className="text-sm text-mute transition-colors hover:text-white"
                >
                  ← Back to mandates
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
