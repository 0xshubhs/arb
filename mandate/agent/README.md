# Mandate agent

An autonomous TypeScript worker whose **only** on-chain authority is a scoped session key. Each
loop it reads the vault's policy, balances and oracle prices, computes drift vs target, and — if
out of band — submits a policy-legal `rebalance()`. Every guardrail is enforced by the contract,
not the agent: a hallucinated or adversarial proposal simply **reverts**.

```
src/
  agent.ts      # the loop: read -> solve -> rationale -> submit -> log EXECUTED/REVERTED
  solver.ts     # drift -> minimal, cap-split, policy-legal swaps
  rationale.ts  # Claude one-line rationale (ADVISORY ONLY), hashed onto the receipt
  chain.ts      # viem public/wallet clients, Robinhood Chain definition
  abi.ts        # minimal ABIs
```

## Run
```bash
npm install
cp .env.example .env   # fill RPC_URL, AGENT_SESSION_KEY, VAULT_ADDRESS, ORACLE_ADDRESS, AMM_ADDRESS
npm run once           # single tick
npm start              # continuous loop (POLL_INTERVAL_SECONDS)
```

## Safety model
- The session key can ONLY call `rebalance()` / `autopilotBuy()` (enforced by `MandateVault`'s
  AGENT role). It can never withdraw principal — that's the negative-space guarantee.
- **LLM is off the enforcement path.** It only writes the rationale string that gets hashed.
- **Fallback:** this ships with a plain EOA session key. Swap in an Alchemy ERC-4337 session key +
  Gas Manager for sponsored gas — the security story is identical, you only gain gas UX.
