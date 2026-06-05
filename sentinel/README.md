# SENTINEL

> The autonomous-agent firewall: bounded, on-chain spending authority that says **NO** before your
> AI agent drains your wallet.

An on-chain risk firewall for AI-agent wallets on **Arbitrum** (Sepolia → One-ready). Every spend an
agent attempts must clear a transparent, compute-heavy risk-scoring kernel — implemented as an
**Arbitrum Stylus (Rust/WASM)** contract with a verified Solidity twin — before it settles. Anything
that breaches the policy hard-reverts. The LLM only *authors* policy; it is never in the enforcement path.

See [`PLAN.md`](./PLAN.md) (strategy) and [`BUILD.md`](./BUILD.md) (spec). This README documents
what is built.

## What's here
```
sentinel/
├── contracts/   Foundry: PolicyRegistry, RiskEngine (Solidity twin) + Stylus kernel, AgentGuard,
│                ERC8004Reader, full adversarial test suite + Stylus/Solidity parity vectors
├── agent/       Three reference agents (honest / compromised / denylist) + driver + policy compiler
└── web/         Next.js "mission-control" console — Mandate Compiler, Live Floor (hero), Proof panel
```

## Contracts
| Contract | Role |
|---|---|
| `RiskEngine.sol` | Security core (Solidity twin). Stateful `checkSpend` wraps the pure scorer with rolling-window state + ERC-8004 reputation; reverts-by-verdict on breach. CEI + ReentrancyGuard. Verified fallback + gas-benchmark baseline. |
| `src/risk-engine-stylus/` | **Stylus (Rust/WASM)** kernel — the same scoring algorithm, the "why Arbitrum" moat. Mirrors `RiskScoreLib` exactly. |
| `PolicyRegistry.sol` | ERC-721 **Policy NFT** per user: packed `PolicyConfig` (velocity, daily cap, drawdown, min counterparty reputation) + local denylist + per-policy kill switch. |
| `AgentGuard.sol` | The hard NO. Scoped session keys; every spend must clear `RiskEngine.checkSpend` and the floor isn't frozen, before any USDC moves. Floor-wide KILL SWITCH. |
| `ERC8004Reader.sol` | Read-only adapter over the live Arbitrum ERC-8004 Reputation Registry; normalizes to 0–100, caches last-good, degrades to the local denylist. |
| `HelloArbitrum.sol` | Day-1 deploy/verify de-risk. |

Four transparent risk factors blend into a 0–100 composite: per-tx velocity, rolling-24h daily cap,
drawdown vs high-water mark, and ERC-8004 counterparty reputation. Reason codes drive the UI chips.

## Build & test
```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # if lib/ is empty
forge build
forge test -vvv     # 31 tests: registry, pure scoring, integration reverts, reader fallback,
                    #           reentrancy, fuzz parity vs reference, monotonicity, gas benchmark
forge snapshot      # gas baseline for the Stylus-vs-Solidity comparison
```

Adversarial coverage proves the firewall: velocity / daily / drawdown breaches, denylisted &
low-reputation counterparties, per-policy kill switch, floor freeze, session scope/expiry,
unauthorized callers, and reentrancy-on-execute — all revert before settlement.

### Stylus kernel
```bash
cargo install cargo-stylus && rustup target add wasm32-unknown-unknown
cd src/risk-engine-stylus
cargo stylus check
cargo stylus deploy --endpoint $ARB_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY
```
> If the WASM toolchain fights back, ship the Solidity twin (the standing fallback) and keep Stylus
> as upside — the security story is identical. See `src/risk-engine-stylus/README.md`.

## Deploy (Arbitrum Sepolia)
```bash
cp contracts/.env.example contracts/.env   # set DEPLOYER_PRIVATE_KEY, ARB_SEPOLIA_RPC, ARBISCAN_API_KEY
forge script script/DeployHello.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify   # Day 1
forge script script/Deploy.s.sol     --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify   # full stack
```

### Deployed addresses (fill after deploy)
| Contract | Address |
|---|---|
| PolicyRegistry | `0x…` |
| RiskEngine (Solidity) | `0x…` |
| RiskEngine (Stylus) | `0x…` |
| AgentGuard | `0x…` |
| ERC8004Reader | `0x…` |
| ERC-8004 Reputation Registry (live) | `0x…` |

## Agents & web
- `agent/` — see [agent/README.md](./agent/README.md). `npm i && npm run driver` runs the parallel floor.
- `web/` — see [web/README.md](./web/README.md). `npm i && npm run dev` (demo mode works with no deployment).

## Why Arbitrum
Live-on-Arbitrum ERC-8004 reputation reads + the Stylus compute edge (proven by the shipped
gas benchmark) — a story a generic EVM clone cannot tell.
