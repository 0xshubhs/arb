"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EXAMPLE_MANDATE } from "@/lib/policyCompiler";

/**
 * The single clean prompt: "Tell SENTINEL the rules." A textarea, a couple of
 * suggestion pills, and a COMPILE button. Hides all crypto.
 */
export function MandatePrompt({
  onCompile,
  compiling,
}: {
  onCompile: (sentence: string) => void;
  compiling: boolean;
}) {
  const [text, setText] = useState("");

  const suggestions = [
    EXAMPLE_MANDATE,
    "Cap each payment at 10 USDC and stop if it drops 15%.",
    "Spend max 200 USDC daily, only verified counterparties, halt on a 30% loss.",
  ];

  const submit = () => {
    const s = text.trim();
    if (s.length > 0 && !compiling) onCompile(s);
  };

  return (
    <div className="panel relative overflow-hidden p-6 sm:p-8">
      {/* faint scan accent */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-signal/[0.06] blur-3xl" />

      <div className="flex items-center gap-3">
        <span className="block h-2 w-2 animate-pulse rounded-full bg-signal shadow-signal-glow" />
        <span className="label">Mandate Compiler</span>
      </div>

      <h2 className="mt-3 font-sans text-2xl font-semibold tracking-tight text-muted-bright sm:text-3xl">
        Tell SENTINEL the rules.
      </h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        One plain-English sentence. The compiler turns it into an on-chain policy you confirm
        before it&apos;s written. The LLM authors policy — it never enforces it.
      </p>

      <div className="relative mt-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={3}
          placeholder={EXAMPLE_MANDATE}
          className="w-full resize-none rounded-md border border-grid bg-ink-900/70 p-4 font-mono text-sm leading-relaxed text-muted-bright outline-none transition-colors placeholder:text-muted/60 focus:border-signal/50 focus:shadow-signal-glow"
        />
        <span className="absolute bottom-3 right-4 font-mono text-2xs text-muted">⌘↵</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setText(s)}
            className="rounded-sm border border-grid bg-ink-700/60 px-2.5 py-1 text-left font-mono text-2xs text-muted transition-colors hover:border-signal/40 hover:text-muted-bright"
          >
            {s.length > 52 ? `${s.slice(0, 52)}…` : s}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={text.trim().length === 0 || compiling}
          className="btn btn-signal"
        >
          <AnimatePresence mode="wait" initial={false}>
            {compiling ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Compiling…
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Compile Mandate
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <span className="font-mono text-2xs uppercase tracking-[0.16em] text-muted">
          → 4 risk factors → Policy NFT
        </span>
      </div>
    </div>
  );
}
