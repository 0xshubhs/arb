# Arbitrum Open House London — Buildathon Strategy

**Event:** Arbitrum Open House London: Online Buildathon (HackQuest)
**Time left:** ~8–10 days to submit
**Plan:** Submit **two** projects, each targeting a different *reserved* prize bucket so they don't compete with each other.

---

## The prize math (why we win)

| Prize | Amount | Split |
|---|---|---|
| Overall | 70,000 USDC | 40k / 20k / 10k |
| Best Agentic Project | 15,000 USDC | 7k / 5k / 3k |
| Grants | 30,000 USDC | discretionary, milestone-based |

**Two hard structural edges in the rules:**
1. **≥1 of 3 overall prizes is reserved for a Robinhood Chain project.** Robinhood Chain launched its public testnet Feb 10 2026 — it is *underbuilt*, with almost no DeFi primitives shipped. Of all gallery projects only **RobinUSD** targets it. This is the single highest-EV lane.
2. **≥1 of 3 overall prizes is reserved for an Arbitrum project**, and there's a dedicated **15k Best Agentic** track — the event's headline theme is the *Agentic Economy*.

**So we build one project per reserved lane.** They don't cannibalize each other, and together they tell a coherent story (the agentic firewall can protect the tokenized-stock agent).

## Judging criteria (equal weight — must hit all four)
1. **Smart contract quality** — OZ components, CEI ordering, ReentrancyGuard, real Foundry tests (fuzz + adversarial reverts), verified source on explorer.
2. **Product-Market Fit** — a real, retainable user.
3. **Innovation & Creativity** — original mechanism, not a clone.
4. **Real Problem Solving** — genuine market need + a clear "why this chain."

---

## The two projects

### 1. `mandate/` — Robinhood Chain lane (RWA / tokenized stocks)
**Mandate** — a non-custodial robo-advisor for tokenized equities. You grant an AI agent a *cryptographically bounded* mandate to manage your TSLA/AMZN/PLTR/NFLX/AMD basket 24/7. The agent can only trade inside on-chain guardrails (allowlist, target weights + drift band, per-trade & per-day USDG caps, max slippage, trading window, instant kill-switch) and **physically cannot withdraw principal**. Every illegal trade reverts at the contract; every rebalance leaves a verifiable receipt.

- **Why it wins:** RH Chain's *first* active-management primitive for inert faucet tokens; cracks the #1 agentic adoption blocker ("trusting an agent with money") by making "the agent literally cannot drain you" a live, demoable on-chain fact. No overlap with RobinUSD (a stablecoin).
- **Hero demo moment:** trigger a rebalance live → attempt an over-cap swap → watch it land as **REVERTED** on Blockscout → hit **REVOKE AGENT** and the agent goes silent.

### 2. `sentinel/` — Best Agentic Project lane (Arbitrum)
**SENTINEL** — an on-chain risk firewall for AI-agent wallets. Every transaction an agent attempts must clear a **Stylus (Rust/WASM) risk-scoring kernel** (velocity, daily cap, drawdown, ERC-8004 counterparty reputation) before it settles — anything that breaches the policy hard-reverts. Onboarding is a plain-English "mandate compiler" (LLM authors the policy, is *never* in the enforcement path). A live multi-agent floor shows the firewall blocking a prompt-injected attacker in real time.

- **Why it wins:** the enablement/guardrail layer *every* other agentic project (FlowState, OutcomePay, HyperHaus, YieldMind) skips — its customers are literally the rest of the gallery. The Stylus kernel is the genuine "only-Arbitrum-can-do-this" moat, proven with a Stylus-vs-Solidity gas benchmark. Reads the **live-on-Arbitrum ERC-8004** registry.
- **Hero demo moment:** three agents run in parallel; the compromised one's spends slam back **REVERTED / CAP EXCEEDED** live on Arbiscan; flip the physical **KILL SWITCH** and the whole floor freezes.

---

## Competitive white-space (gallery gaps we exploit)
- Most gallery projects are **vague "AI does finance"** (YieldMind, HyperHaus) or **broad "OS for everything"** (OBSCURA) — judges punish unfocused scope and LLM-wrappers.
- **OutcomePay** is the strongest agentic competitor but hand-waves the hard part (proof verification) — SENTINEL sits *underneath* it as infra, not against it.
- **RobinUSD** is the only RH-Chain competitor and is a regulatorily-heavy stablecoin — Mandate out-executes with a focused, non-custodial portfolio primitive.

## Win playbook (applies to both)
- **Deploy on an Arbitrum chain Day 1** — the eligibility gate eliminates a surprising number of submissions. Verify the contract resolves on the explorer *before* submitting.
- **One bulletproof hero flow per project**, frozen by Day 3. Everything off the happy path can be rough.
- **Smart-contract quality is checkable:** OZ audited components, CEI + ReentrancyGuard, a Foundry suite with fuzz + "attacker reverts" tests, verified source.
- **Incremental commits from Day 1** — single giant final commits risk DQ and kill the traction signal.
- **2–4 min demo:** ≤20s problem framing, then straight into a live on-chain transaction confirming. That moment is the WOW.
- **Premium, non-generic UI** — but only on top of real deployed contracts (judges see through slick-UI-thin-contract).

See `mandate/PLAN.md` and `sentinel/PLAN.md` for full build plans (architecture, contracts, agent design, UI direction, 10-day timeline, demo script).
