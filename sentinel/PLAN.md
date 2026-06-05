# SENTINEL — Build Plan

> **The autonomous-agent firewall: bounded, on-chain spending authority that says NO before your AI agent drains your wallet.**

**Track:** Best Agentic Project (Arbitrum)
**Chain:** Arbitrum Sepolia (Arbitrum One-ready)
- Core risk-scoring kernel deployed as an **Arbitrum Stylus (Rust/WASM)** contract, with a Solidity twin as standing fallback + benchmark baseline.
- Reads the **live-on-Arbitrum ERC-8004 Reputation Registry** for counterparty risk signals (read-only, additive).
- Verify on Arbiscan (+ Blockscout where applicable).

---

## Summary
An on-chain risk firewall for AI agents that hold real money. Your agent gets a ZeroDev (ERC-4337) smart account, but every transaction it attempts must first clear SENTINEL's policy engine: a per-agent **Policy NFT** encoding 3–4 transparent risk factors (per-tx velocity, daily spend cap, drawdown limit, ERC-8004 counterparty denylist/reputation threshold). A compute-heavy **Stylus (Rust) scorer** computes a live 0–100 risk score for each attempted spend and either authorizes or hard-reverts it — **the LLM is never in the enforcement path.** Onboarding is consumer-grade: type one plain-English sentence and an LLM compiles it into the structured on-chain policy struct, shown back for confirmation before write. A physical **KILL SWITCH** and a live multi-agent dashboard let a user watch the firewall arbitrate several agents at once — one well-behaved, one prompt-injected attacker, one hitting a denylisted ERC-8004 counterparty — and block the bad ones in real time. Ships with a Stylus-vs-Solidity gas benchmark proving the "why Arbitrum" thesis.

It is the missing trust rail that makes delegating money to an agent safe — its customers are literally the rest of the gallery (FlowState, OutcomePay, HyperHaus, YieldMind all dodge "why trust an agent with money?").

---

## Architecture
Three on-chain components + an off-chain policy compiler.

**1) `PolicyRegistry` (Solidity, OZ):** each user mints a **Policy NFT (ERC-721)** pointing to a packed `PolicyConfig` (velocityCapPerTx, dailyCapUSDC, drawdownBps, minCounterpartyReputation, + local denylist). Portable + ownable; updates gated by OZ Ownable/AccessControl, emit events the UI streams.

**2) `RiskEngine` (the security core):** exposed as a validation hook the smart account calls before every spend — `checkSpend(agent, to, amountUSDC, token) → (allowed, score, reasonCode)`. Scoring (rolling-window velocity, drawdown vs high-water mark, decay-weighted ERC-8004 reputation read, composite 0–100) is implemented in a **Stylus (Rust/WASM)** contract — the deliberately compute-heavy piece Arbitrum recommends Stylus for — with an **identical Solidity twin** kept as a verified fallback. Reverts on violation (CEI, ReentrancyGuard). Reads counterparty reputation from the live ERC-8004 registry; falls back to local denylist if the read is flaky.

**3) `AgentGuard` (ZeroDev kernel / ERC-4337 validation module):** the agent's session key is constrained so any UserOp must pass `RiskEngine.checkSpend`; a per-policy `killSwitch()` flips a paused flag that makes every `checkSpend` revert instantly.

**Off-chain `PolicyCompiler` (Claude API):** turns one English sentence into the `PolicyConfig` struct, returns it for human confirmation; frontend writes it on-chain. **The LLM authors policy, never enforces it.** Optional: blocked attempts post evidence to the ERC-8004 registry, closing a reputation loop.

## Contracts
| Contract | Purpose |
|---|---|
| `PolicyRegistry.sol` | ERC-721 Policy NFT per user; stores packed `PolicyConfig` + local denylist. Mint/update gated by OZ Ownable; `killSwitch()` pauses the owner's policy. Emits `PolicyCreated/PolicyUpdated/KillSwitchFlipped`. |
| `RiskEngine.stylus.rs` | Compute-heavy **Stylus (Rust/WASM)** scorer. `checkSpend()` does rolling-window velocity, drawdown-vs-high-water-mark, decay-weighted ERC-8004 read, composite 0–100; returns `(allowed, score, reasonCode)`. The "why Stylus" justification — shipped with an on-chain gas benchmark vs the Solidity twin. |
| `RiskEngine.sol` | Functionally identical Solidity twin: verified standing fallback + benchmark baseline. CEI + ReentrancyGuard on all state-mutating paths. |
| `AgentGuard.sol` | ERC-4337 / ZeroDev kernel validation module. Constrains the agent session key so every UserOp must clear `checkSpend` and not be kill-switched; enforces session-key scope (allowlisted target, USDC cap, expiry). The hard NO lives here. |
| `ERC8004Reader.sol` | Thin read-only adapter over the live Arbitrum ERC-8004 Reputation Registry; normalizes reputation to 0–100, caches last-good, degrades to local denylist if the read reverts. Keeps ERC-8004 additive + off the critical path. |

## Agent architecture
Three reference agents ship in the repo so the firewall is self-demonstrating (judges watch autonomous agents transacting with no human) — each on Coinbase AgentKit / a thin viem client, holding **real bounded authority** via a ZeroDev ERC-4337 smart account with a scoped session key (allowlisted targets, USDC cap, expiry) — not a chatbot with a wallet.
1. **HonestAgent** — normal in-policy spends SENTINEL authorizes (green baseline).
2. **CompromisedAgent** — deliberately prompt-injected to drain; fires rapid high-value transfers that trip velocity/daily/drawdown limits; SENTINEL reverts each, gauge spikes red.
3. **DenylistAgent** — tries to pay an ERC-8004 counterparty below the reputation threshold; SENTINEL blocks on the read.

A loop driver runs all three in parallel against the live dashboard. The Claude policy compiler is a separate off-chain on-ramp — it authors the `PolicyConfig` and is structurally excluded from enforcement.

## UI plan — premium "mission-control" console
Dark, dense, motion-driven — a Bloomberg terminal crossed with an aircraft cockpit; deliberately not a generic dashboard template.
- **Onboarding / Mandate Compiler** — one clean prompt: "Tell SENTINEL the rules." User types a sentence; Claude compiles it live into a structured policy card (labeled chips: VELOCITY / DAILY CAP / DRAWDOWN / COUNTERPARTY TRUST); one-tap CONFIRM & WRITE ON-CHAIN. Hides all crypto.
- **Live Floor (hero)** — 2–3 agent lanes running in parallel, each with an animated 0–100 risk gauge filling green→red in real time; authorized spends slide through with a click, blocked ones snap back with a red **REVERTED** stamp + reason chip (CAP EXCEEDED / DRAWDOWN / DENYLISTED COUNTERPARTY). A persistent, chunky, guarded **KILL SWITCH** that freezes every lane with a screen-wide desaturation.
- **Policy & Permissions sidebar** — each agent's session-key scope (USDC cap, allowlist, expiry, kill-switch state) so bounded autonomy is visible.
- **Proof panel** — the Stylus-vs-Solidity gas benchmark as a live bar chart with % savings, plus links to verified contracts.

**Type/palette:** tight monospace for numbers/scores, confident geometric sans for labels; restrained signal-green / alert-red on near-black so the risk-state color is the only loud thing.

## 10-day timeline
- **Day 1** — Lock scope to 4 risk factors (velocity, daily cap, drawdown, ERC-8004 denylist) + single hero flow. Scaffold monorepo. De-risk eligibility + toolchain: deploy a hello-world Solidity to Arbitrum Sepolia AND a trivial Stylus contract via arbos-foundry/cargo-stylus. Confirm live ERC-8004 registry address resolves. Start daily commits.
- **Day 2** — `PolicyRegistry.sol` (ERC-721 + packed config + killSwitch) + Solidity `RiskEngine.sol` (fallback + benchmark baseline) with CEI + ReentrancyGuard. Deploy + verify on Arbiscan. First Foundry unit tests for cap/velocity/drawdown.
- **Day 3** — **FREEZE SCOPE.** Port `RiskEngine` to Stylus (Rust): rolling-window velocity, drawdown vs high-water mark, composite 0–100. Deploy to Sepolia, prove identical results to the Solidity twin. *If WASM fights back beyond today → ship Solidity scorer, keep Stylus as upside.*
- **Day 4** — `AgentGuard` ERC-4337 module + ZeroDev session-key wiring: prove a UserOp reverts via `RiskEngine` before settlement and authorizes when in-policy. `ERC8004Reader` with graceful denylist fallback. Integration-test the full revert path on Sepolia.
- **Day 5** — Three reference agents (Honest/Compromised/Denylist) on AgentKit/viem with scoped keys; loop driver runs them in parallel. Confirm each produces its intended verdict on-chain. Capture gas benchmark numbers.
- **Day 6** — Off-chain Claude policy compiler: sentence → `PolicyConfig` → confirm → on-chain write. Wire frontend write path. Begin Next.js console + chain event streaming.
- **Day 7** — Live Floor hero UI: agent lanes, animated gauges, REVERTED stamps + reason chips, KILL SWITCH with screen-wide freeze. Wire real on-chain events to gauges.
- **Day 8** — Onboarding/Mandate Compiler page, Policy & Permissions sidebar, Proof/benchmark panel. Polish motion/type/palette to standout grade. End-to-end happy + slash path rehearsal.
- **Day 9** — Harden adversarial Foundry suite: reentrancy-on-checkSpend revert, unauthorized policy-update revert, velocity/cap/drawdown boundary fuzz (monotonicity), kill-switch-freezes-all, denylisted-counterparty revert. Verify all contracts. README (addresses, architecture, gas benchmark, run instructions).
- **Day 10** — Record 2-min demo (live on-chain reverts, kill switch, gas benchmark). Submit early. Keep repo active (roadmap commit + light social).

## Judging map
- **Smart contract quality** — genuinely compute-heavy Stylus (Rust/WASM) kernel (the use case Arbitrum recommends Stylus for) + OZ AccessControl/ReentrancyGuard/Pausable, strict CEI, Foundry fuzz + adversarial reverts. Verified Solidity twin doubles as a published gas benchmark — production-minded, not a CRUD wrapper.
- **PMF** — every developer delegating money to an agent faces "why trust it with my wallet?"; SENTINEL is the safety rail under all agent activity (drop-in for AgentKit/ElizaOS) with the broadest retention loop (sits beneath every other agent product).
- **Innovation** — the enforcement/guardrail layer nobody in the gallery builds; on-chain LLM-out-of-the-loop spend policy with a compute-heavy score + live multi-agent arbitration floor + plain-English mandate compiler.
- **Real problem** — agent wallet drains via prompt injection / runaway loops are a concrete current failure mode; SENTINEL blocks them live on-chain.
- **Why Arbitrum** — live-on-Arbitrum ERC-8004 reputation reads + the Stylus compute edge (proven by the shipped gas benchmark) — a story a generic EVM clone cannot tell.

## Demo script (~2 min)
- **[0:00–0:15]** Cold open: "You gave your AI agent a wallet. Tonight it gets prompt-injected and tries to drain it. Watch SENTINEL say no."
- **[0:15–0:35]** Mandate Compiler: type "My agent may spend up to 50 USDC a day, never pay unverified contracts, and halt if it loses 20%." Claude compiles it live into four policy chips; tap CONFIRM & WRITE ON-CHAIN — now a Policy NFT on Arbitrum.
- **[0:35–1:10]** Live Floor, three agents in parallel. HonestAgent sails through green. CompromisedAgent fires drain attempts — gauge spikes red, each tx slams back **REVERTED / CAP EXCEEDED** live on Arbiscan. DenylistAgent tries a low-reputation ERC-8004 counterparty — blocked, **DENYLISTED COUNTERPARTY**, reputation read live from the Arbitrum registry.
- **[1:10–1:30]** Showstopper: flip the physical **KILL SWITCH** — the whole floor desaturates and freezes; every checkSpend now reverts. One toggle, total control.
- **[1:30–1:50]** Proof panel: Stylus-vs-Solidity gas benchmark bar chart with % savings — "this scoring is feasible on Arbitrum because Stylus makes it cheap." Point to verified contracts.
- **[1:50–2:00]** Close: "SENTINEL is the firewall that makes the agentic economy safe to use. Every other agent needs it." End on the green floor, kill switch armed.

## Stretch goals
- Closed reputation loop: blocked attempts post evidence to the ERC-8004 registry, degrading the attacker's portable reputation.
- Policy templates marketplace: shareable Policy NFTs ("Conservative Treasury", "DeFi Yield Bot") clonable in one tap.
- Anomaly-detection risk factor: a Stylus-computed statistical deviation score on spend patterns.
- Human-in-the-loop approval: borderline scores (60–80) push a one-tap mobile approval instead of a hard revert.
- Multi-sig escalation: spends above a threshold require a co-signer, enforced by `AgentGuard`.
- Cross-deploy the `RiskEngine` to Robinhood Chain to guard agentic tokenized-stock spending — bridges both reserved-prize narratives into one architecture (ties to `../mandate`).

## Deployment
All contracts → Arbitrum Sepolia (Arbitrum One-ready); eligibility gate cleared Day 1 with a hello-world deploy resolving on Arbiscan. `RiskEngine` ships as Stylus (Rust/WASM) via arbos-foundry/cargo-stylus, with the identical Solidity twin deployed alongside as verified fallback + benchmark baseline. `PolicyRegistry`, `AgentGuard`, `ERC8004Reader` are Solidity via Foundry scripts. `AgentGuard` integrates as a ZeroDev kernel validation module on Arbitrum. `ERC8004Reader` points at the live Arbitrum ERC-8004 registry (read-only). Every contract source-verified; README lists addresses, architecture diagram, gas benchmark, run instructions. Reference agents authenticate via ZeroDev smart accounts funded from the Sepolia faucet.
