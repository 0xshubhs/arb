import { keccak256, stringToHex } from "viem";
import type { Plan } from "./solver.js";

/**
 * ADVISORY ONLY. The LLM produces a one-line, human-readable rationale that is hashed onto the
 * rebalance receipt. It is strictly OFF the validation path — a hallucinated or adversarial output
 * still cannot produce an illegal trade, because the contract re-checks every guardrail and reverts.
 */
export async function buildRationale(plan: Plan): Promise<{ text: string; hash: `0x${string}` }> {
  const fallback = `Rebalance: ${plan.note}; ${plan.swaps.length} policy-legal swaps.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { text: fallback, hash: keccak256(stringToHex(fallback)) };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system:
        "You are a portfolio agent. Given a rebalance summary, write ONE concise sentence " +
        "explaining the rationale for a non-technical investor. No preamble, max 25 words.",
      messages: [{ role: "user", content: `Rebalance summary: ${plan.note}. Swaps: ${plan.swaps.length}.` }],
    });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join(" ").trim() || fallback;
    return { text, hash: keccak256(stringToHex(text)) };
  } catch (e) {
    return { text: fallback, hash: keccak256(stringToHex(fallback)) };
  }
}
