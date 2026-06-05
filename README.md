# Arbitrum Open House London — Buildathon Workspace

Two projects, one per *reserved* prize lane, to be built over ~10 days.

## Docs map
| File | What it is |
|---|---|
| `STRATEGY.md` | Prize math, competitive analysis, win playbook. **Read first.** |
| `mandate/PLAN.md` | Mandate — strategic plan (architecture, judging map, demo script). |
| `mandate/BUILD.md` | Mandate — execution handbook (contract specs, agent, UI, commands). |
| `sentinel/PLAN.md` | SENTINEL — strategic plan. |
| `sentinel/BUILD.md` | SENTINEL — execution handbook. |

## The two projects
- **`mandate/`** → **Robinhood Chain** reserved slot. A non-custodial robo-advisor for tokenized stocks; an AI agent manages your basket inside on-chain guardrails it *physically cannot* break. Hero moment: an over-cap trade lands **REVERTED** live on-chain.
- **`sentinel/`** → **Best Agentic Project** (Arbitrum). An on-chain risk firewall that reverts an AI agent's transaction *before* it can drain the wallet. Stylus (Rust) risk kernel + live ERC-8004 reads. Hero moment: a prompt-injected agent gets told **NO**, then the **KILL SWITCH** freezes everything.

## Decisions made (2026-06-05)
1. **Build order:** both projects in parallel.
2. **Stylus:** commit to the Rust/WASM risk kernel from the start in SENTINEL (the "why Arbitrum" moat + gas benchmark).
3. **Deployment:** build & test everything locally first; handle on-chain deployment near the end.
4. **Format:** plans captured as markdown now; building happens later.

## Build status
Both projects are built end-to-end from their PLAN/BUILD specs. Contracts compile and the full
Foundry suites pass.

| Layer | Mandate | SENTINEL |
|---|---|---|
| Contracts | ✅ vault, AMM, oracle, factory, hello | ✅ registry, RiskEngine (Sol twin), guard, reader, hello |
| Stylus (Rust) | — | ✅ kernel source mirroring the Solidity scorer |
| Foundry tests | ✅ **25 passing** (unit + 11 adversarial reverts + fuzz + invariants) | ✅ **31 passing** (unit + integration reverts + reader fallback + reentrancy + fuzz parity) |
| Deploy scripts | ✅ `Deploy.s.sol` + `DeployHello.s.sol` (simulated OK) | ✅ `Deploy.s.sol` + `DeployHello.s.sol` (simulated OK) |
| Agent(s) (TS) | ✅ loop/solver/rationale (typechecks) | ✅ 3 reference agents + driver + policy compiler (typechecks) |
| Web (Next.js) | ✅ onboarding · Control Room · ledger (demo-mode runnable) | ✅ Mandate Compiler · Live Floor · Proof panel (demo-mode runnable) |

```bash
# reproduce the tests
cd mandate/contracts  && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts && forge test
cd sentinel/contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts && forge test
```

Dependencies (`lib/`, `node_modules/`, Rust `target/`) are git-ignored and reinstalled via the
commands above + `npm install` per package — see each project's README.

## Repository layout
```
arb/
├── STRATEGY.md · README.md          ← strategy + this file
├── mandate/   (README · PLAN · BUILD)
│   ├── contracts/   src + test + script  (Foundry)
│   ├── agent/       src (TypeScript worker)
│   └── web/         app + components + lib (Next.js)
└── sentinel/  (README · PLAN · BUILD)
    ├── contracts/   src + test + script + src/risk-engine-stylus (Rust)
    ├── agent/       src (3 reference agents + compiler)
    └── web/         app + components + lib (Next.js)
```

## Toolchain (verified 2026-06-05)
- ✅ Foundry (forge 1.5.1) · ✅ Node v22 · ✅ Cargo 1.93
- ⏳ `cargo-stylus` — install with `cargo install cargo-stylus` to build/deploy SENTINEL's Rust kernel
  (the Solidity twin is the standing fallback, so the suite builds and passes without it).

## Global guardrails (apply to both — from the win playbook)
- Deploy to an Arbitrum chain **Day 1** and confirm it resolves on the explorer — the eligibility gate eliminates many submissions.
- Freeze scope to **one bulletproof hero flow** per project by Day 3.
- **Smart-contract quality is checked:** OZ audited components, checks-effects-interactions + ReentrancyGuard, a Foundry suite with fuzz **and** adversarial "attacker reverts" tests, verified source.
- **Incremental commits from Day 1** — a single giant final commit risks DQ and kills the traction signal.
- **2–4 min demo:** ≤20s problem, then straight into a live on-chain transaction confirming.
- Premium, non-generic UI — but only on top of real deployed, tested contracts.
