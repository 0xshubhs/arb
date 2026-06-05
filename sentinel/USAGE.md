# SENTINEL — quick start

Project-specific cheat sheet. Full guide: [`../USAGE.md`](../USAGE.md) · Design: [`PLAN.md`](./PLAN.md) · [`BUILD.md`](./BUILD.md) · Overview: [`README.md`](./README.md)

**Chain:** Arbitrum Sepolia, chainId **421614** (Arbitrum One-ready).

## Test the contracts (no keys/network)
```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # if lib/ is empty
forge test -vvv          # 31 tests: scoring · integration reverts · reader fallback · reentrancy · fuzz parity
forge snapshot           # gas baseline for the Stylus-vs-Solidity benchmark
```

## See the UI now (demo mode — no deployment)
```bash
cd web && npm install && cp .env.example .env.local && npm run dev   # http://localhost:3000
```
**Hero (`/floor`):** 3 agent lanes run in parallel → the compromised one slams back **REVERTED /
CAP EXCEEDED** → flip the guarded **KILL SWITCH** to freeze the whole floor.

## Deploy (Arbitrum Sepolia)
```bash
cd contracts && cp .env.example .env   # DEPLOYER_PRIVATE_KEY, ARB_SEPOLIA_RPC, ARBISCAN_API_KEY
forge script script/DeployHello.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify   # Day-1 de-risk
forge script script/Deploy.s.sol     --rpc-url $ARB_SEPOLIA_RPC --broadcast --verify   # full Solidity stack
```

## Stylus kernel (the "why Arbitrum" moat)
```bash
cargo install cargo-stylus && rustup target add wasm32-unknown-unknown
cd contracts/src/risk-engine-stylus
cargo stylus check
cargo stylus deploy --endpoint $ARB_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY
```
> If WASM fights back, ship the verified Solidity twin (standing fallback) — the suite passes without it.

## Run the agents (the parallel floor)
```bash
cd agent && npm install && cp .env.example .env   # AGENT_GUARD, RISK_ENGINE, *_KEY, counterparties
npm run driver                                     # honest + compromised + denylist in parallel
npm run compile -- "spend up to 50 USDC a day, never pay unverified contracts, halt if it loses 20%"
```

## Remaining for this project
1. Deploy + verify on Arbitrum Sepolia (eligibility gate).
2. Compile/deploy the Stylus kernel + capture the **gas benchmark** vs the Solidity twin → Proof panel + README.
3. Confirm the live ERC-8004 Reputation Registry address and point `ERC8004Reader` at it.
4. Paste addresses into `README.md` table + `web/.env.local` + `agent/.env` → flips demo → live.
5. Wire web write-paths (`useWriteContract`) for mint policy / kill switch / freeze.
