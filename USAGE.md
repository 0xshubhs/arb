# USAGE — how to run everything, and what's left

This repo holds **two** independent buildathon projects that share a story:

- **`mandate/`** — a non-custodial robo-advisor for tokenized stocks on **Robinhood Chain**. An AI
  agent manages your basket inside on-chain guardrails it *physically cannot* break.
- **`sentinel/`** — an on-chain risk **firewall** for AI-agent wallets on **Arbitrum**. Every agent
  spend must clear a Stylus (Rust) risk kernel before it settles, or it hard-reverts.

Each project has three layers: `contracts/` (Foundry/Solidity + Stylus), `agent/` (TypeScript), and
`web/` (Next.js). Read `STRATEGY.md` for the why; `mandate/PLAN.md` & `sentinel/PLAN.md` for the
full design; this file is the operational how-to.

---

## 0. Prerequisites

| Tool | Version used | Needed for |
|---|---|---|
| [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`) | 1.5.1 | contracts, tests, deploy |
| Node.js + npm | v22 / 11 | agents + web |
| Rust + Cargo | 1.93 | SENTINEL Stylus kernel |
| `cargo-stylus` | — (install when needed) | compile/deploy the Rust kernel |

```bash
# one-time installs
curl -L https://foundry.paradigm.xyz | bash && foundryup
cargo install cargo-stylus && rustup target add wasm32-unknown-unknown   # only for SENTINEL Stylus
```

> **Dependencies are git-ignored** (`lib/`, `node_modules/`, Rust `target/`). Reinstall them with the
> commands below — the repo intentionally doesn't vendor them.

---

## 1. Fastest path: run the tests (no keys, no network needed)

```bash
# Mandate — 25 tests
cd mandate/contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # if lib/ is empty
forge test -vvv

# SENTINEL — 31 tests
cd ../../sentinel/contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # if lib/ is empty
forge test -vvv
```

Expected: **25 passing** (Mandate) and **31 passing** (SENTINEL). Useful extras:
```bash
forge coverage        # branch coverage on the guardrails
forge test --gas-report
forge snapshot        # SENTINEL: gas baseline for the Stylus-vs-Solidity benchmark
```

---

## 2. See the UI immediately (demo mode — no deployment)

Both web apps ship a **demo mode** that streams realistic synthetic on-chain activity, so you can
record the hero moments before anything is deployed.

```bash
# Mandate "private bank terminal"
cd mandate/web && npm install && cp .env.example .env.local && npm run dev   # http://localhost:3000

# SENTINEL "mission control"
cd sentinel/web && npm install && cp .env.example .env.local && npm run dev   # http://localhost:3000
```

Leave the `NEXT_PUBLIC_*` contract addresses blank → demo mode. Fill them in → the apps switch to a
live viem event subscription (the nav badge flips DEMO → LIVE).

**Hero moments to film**
- *Mandate* → `/control`: trigger a rebalance, watch the budget meter drain and donut tween, then hit
  **Simulate breach** to see a red **REVERTED — blocked by your policy** row; hit **REVOKE** to wash
  the room amber.
- *SENTINEL* → `/floor`: three agent lanes run in parallel; the compromised one's spends slam back
  **REVERTED / CAP EXCEEDED**; flip the guarded **KILL SWITCH** to freeze the whole floor.

---

## 3. Run the agents (against a deployment)

### Mandate agent
```bash
cd mandate/agent && npm install
cp .env.example .env     # set RPC_URL, AGENT_SESSION_KEY, VAULT_ADDRESS, ORACLE_ADDRESS, AMM_ADDRESS
npm run once             # single tick:  read → solve drift → rebalance
npm start                # continuous loop
```

### SENTINEL agents (the parallel floor)
```bash
cd sentinel/agent && npm install
cp .env.example .env     # set AGENT_GUARD, RISK_ENGINE, the three *_KEY session keys, counterparties
npm run driver           # honest + compromised + denylist, in parallel
npm run compile -- "spend up to 50 USDC a day, never pay unverified contracts, halt if it loses 20%"
```
`LAND_REVERTS=true` (default) sends blocked spends as **real reverting txs** so REVERTED shows on
Arbiscan. The policy compiler uses Claude if `ANTHROPIC_API_KEY` is set, else a regex fallback.

---

## 4. Deploy to testnet

### Mandate → Robinhood Chain (chainId 46630)
```bash
cd mandate/contracts && cp .env.example .env   # set DEPLOYER_PRIVATE_KEY, RH_RPC_URL, BLOCKSCOUT_URL
# Day-1 eligibility de-risk (prove deploy+verify first):
forge script script/DeployHello.s.sol --rpc-url $RH_RPC_URL --broadcast \
  --verify --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api
# Full stack (deploys mock tokens + seeds AMM pools; swap in real faucet tokens for production):
forge script script/Deploy.s.sol --rpc-url $RH_RPC_URL --broadcast \
  --verify --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api
```

### SENTINEL → Arbitrum Sepolia (chainId 421614)
```bash
cd sentinel/contracts && cp .env.example .env  # set DEPLOYER_PRIVATE_KEY, ARB_SEPOLIA_RPC, ARBISCAN_API_KEY
forge script script/DeployHello.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify  # Day 1
forge script script/Deploy.s.sol     --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify  # full stack
```

### SENTINEL Stylus kernel (the "why Arbitrum" moat)
```bash
cd sentinel/contracts/src/risk-engine-stylus
cargo stylus check
cargo stylus deploy --endpoint $ARB_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY
# record the address as RISK_ENGINE_STYLUS, then benchmark vs the Solidity twin
```

After deploying, paste the addresses into the README address tables and the web/agent `.env` files.

---

## 5. Environment variables, at a glance

| File | Key vars |
|---|---|
| `mandate/contracts/.env` | `RH_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `BLOCKSCOUT_URL`, `BLOCKSCOUT_API_KEY` |
| `mandate/agent/.env` | `RPC_URL`, `AGENT_SESSION_KEY`, `VAULT_ADDRESS`, `ORACLE_ADDRESS`, `AMM_ADDRESS`, `ANTHROPIC_API_KEY` |
| `mandate/web/.env.local` | `NEXT_PUBLIC_RH_RPC_URL`, `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_VAULT_ADDRESS`, `NEXT_PUBLIC_ALCHEMY_API_KEY` |
| `sentinel/contracts/.env` | `ARB_SEPOLIA_RPC`, `DEPLOYER_PRIVATE_KEY`, `ARBISCAN_API_KEY`, `USDC`, `ERC8004_REPUTATION_REGISTRY` |
| `sentinel/agent/.env` | `AGENT_GUARD`, `RISK_ENGINE`, `HONEST_KEY`, `COMPROMISED_KEY`, `DENYLIST_KEY`, `GOOD_CP`, `BAD_CP`, `LOW_CP`, `LAND_REVERTS` |
| `sentinel/web/.env.local` | `NEXT_PUBLIC_ARB_SEPOLIA_RPC`, `NEXT_PUBLIC_POLICY_REGISTRY`, `NEXT_PUBLIC_AGENT_GUARD`, `NEXT_PUBLIC_RISK_ENGINE` |

> Never commit real keys. Only `*.env.example` files are tracked; `.env` / `.env.*` are git-ignored.

---

## 6. Status — what's done

| Layer | Mandate | SENTINEL |
|---|---|---|
| Contracts | ✅ vault, AMM, oracle, factory, hello | ✅ registry, RiskEngine (Sol twin), guard, reader, hello |
| Stylus (Rust) | n/a | ✅ kernel **source** mirroring the Solidity scorer |
| Foundry tests | ✅ **25 passing** | ✅ **31 passing** |
| Deploy scripts | ✅ simulated end-to-end | ✅ simulated end-to-end |
| Agent(s) (TS) | ✅ typechecks | ✅ typechecks |
| Web (Next.js) | ✅ 3 pages, demo + live | ✅ 3 pages, demo + live |

Test coverage proves every guardrail reverts on breach, and (Mandate) that the agent can never
withdraw — plus (SENTINEL) Solidity↔reference scoring parity, reentrancy protection, and graceful
ERC-8004 fallback.

---

## 7. What's remaining (next steps, in order)

These are deployment/integration steps that need keys, faucet funds, or external services — none are
code gaps in the tested core.

1. **Deploy + verify on testnet** (Section 4). This is the eligibility gate — do it first and confirm
   the contracts resolve on Blockscout / Arbiscan.
2. **Compile + deploy the Stylus kernel** and capture the **gas benchmark** vs the Solidity twin
   (`forge snapshot` + `cast estimate`); publish the delta in `sentinel/README.md` and the Proof panel.
   *Until then, the verified Solidity twin is the standing fallback and the suite passes without it.*
3. **Fill in addresses** in the two README address tables, the web `.env.local` files, and the agent
   `.env` files → flips the UIs from demo to live.
4. **Wire web write-paths**: the web apps currently simulate on-chain writes (mint policy, pause,
   freeze) in demo mode. Add `useWriteContract` calls once addresses exist (noted in each web README).
5. **Mandate AA upgrade (optional)**: swap the EOA session key for an Alchemy ERC-4337 session key +
   Gas Manager for sponsored gas. Security is identical; you only gain gas UX.
6. **SENTINEL ERC-8004**: confirm the live registry address on Arbitrum Sepolia and point
   `ERC8004Reader` at it (it degrades to the local denylist if the read is flaky).
7. **`npm install` + build the web apps** in CI / before the demo. They were validated structurally
   (pages, `'use client'`, ABIs vs contracts) but not `npm`-built in this environment.
8. **Record the 2–4 min demos** (Section 2 hero moments) and **submit early**.

### Known assumptions baked in (verify on testnet)
- USDG/USDC treated as 6-decimal; stock tokens 18-decimal.
- Stock prices use labeled owner-set mocks behind the real Chainlink interface (Mandate) — swap in
  live feeds if present.
- Agent session scopes, gas-benchmark numbers, and demo data in the web `lib/` files are
  representative placeholders, labeled as such, pending real deployment.

---

## 8. Troubleshooting

- **`forge test` can't find imports** → `lib/` is empty; run the `forge install` line in Section 1.
- **Stack too deep** → already handled via `via_ir = true` in `foundry.toml`; keep it on.
- **`cargo stylus` missing** → `cargo install cargo-stylus`; not required to build/test the Solidity stack.
- **Web shows static data** → that's demo mode (no `NEXT_PUBLIC_*` addresses). Add them for live data.
- **Deploy reverts on pool seeding** → the deployer needs faucet ETH + tokens; the script mints mocks
  itself, so this only applies when pointing at real tokens.
