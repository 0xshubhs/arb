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

## Toolchain status (verified on this machine, 2026-06-05)
- ✅ Foundry (forge 1.4.4) — installed; both `*/contracts` scaffolded with OpenZeppelin.
- ✅ Node v24.14.1 — for agents + web.
- ✅ Cargo 1.94 — for Stylus.
- ⏳ `cargo-stylus` — installing (`cargo install cargo-stylus`); needed for SENTINEL's Rust kernel.

## Scaffolds already created
```
arb/
├── STRATEGY.md
├── README.md                  ← this file
├── mandate/
│   ├── PLAN.md · BUILD.md
│   ├── contracts/             ← Foundry project (forge-std + openzeppelin-contracts installed)
│   ├── agent/                 ← (empty) TypeScript agent
│   └── web/                   ← (empty) Next.js app
└── sentinel/
    ├── PLAN.md · BUILD.md
    ├── contracts/             ← Foundry project (forge-std + openzeppelin-contracts installed)
    ├── agent/                 ← (empty) reference agents
    └── web/                   ← (empty) Next.js console
```

## Global guardrails (apply to both — from the win playbook)
- Deploy to an Arbitrum chain **Day 1** and confirm it resolves on the explorer — the eligibility gate eliminates many submissions.
- Freeze scope to **one bulletproof hero flow** per project by Day 3.
- **Smart-contract quality is checked:** OZ audited components, checks-effects-interactions + ReentrancyGuard, a Foundry suite with fuzz **and** adversarial "attacker reverts" tests, verified source.
- **Incremental commits from Day 1** — a single giant final commit risks DQ and kills the traction signal.
- **2–4 min demo:** ≤20s problem, then straight into a live on-chain transaction confirming.
- Premium, non-generic UI — but only on top of real deployed, tested contracts.
