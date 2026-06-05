# Mandate — quick start

Project-specific cheat sheet. Full guide: [`../USAGE.md`](../USAGE.md) · Design: [`PLAN.md`](./PLAN.md) · [`BUILD.md`](./BUILD.md) · Overview: [`README.md`](./README.md)

**Chain:** Robinhood Chain testnet — Arbitrum Orbit L2, chainId **46630**.

## Test the contracts (no keys/network)
```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # if lib/ is empty
forge test -vvv          # 25 tests: unit · 11 adversarial reverts · fuzz · invariants
forge coverage           # guardrail branch coverage
```

## See the UI now (demo mode — no deployment)
```bash
cd web && npm install && cp .env.example .env.local && npm run dev   # http://localhost:3000
```
**Hero (`/control`):** trigger a rebalance → watch budget meter drain + donut tween → **Simulate
breach** = red **REVERTED** row → **REVOKE** washes the room amber.

## Deploy (Robinhood Chain)
```bash
cd contracts && cp .env.example .env   # DEPLOYER_PRIVATE_KEY, RH_RPC_URL, BLOCKSCOUT_URL
forge script script/DeployHello.s.sol --rpc-url $RH_RPC_URL --broadcast \
  --verify --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api   # Day-1 de-risk
forge script script/Deploy.s.sol --rpc-url $RH_RPC_URL --broadcast \
  --verify --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api   # full stack (mock tokens + seeded pools)
```

## Run the agent
```bash
cd agent && npm install && cp .env.example .env   # AGENT_SESSION_KEY, VAULT/ORACLE/AMM addresses
npm run once     # single tick   |   npm start   # loop
```

## Remaining for this project
1. Deploy + verify on RH Chain (eligibility gate).
2. Paste addresses into `README.md` table + `web/.env.local` + `agent/.env` → flips demo → live.
3. Wire web write-paths (`useWriteContract`) for pause/revoke/createVault.
4. Optional: Alchemy ERC-4337 session key + Gas Manager for sponsored gas (EOA fallback is wired).
5. Confirm USDG decimals + whether live Chainlink stock feeds exist (else keep labeled mock prices).
