# SENTINEL agents

Three reference agents that make the firewall self-demonstrating, plus the off-chain policy
compiler. Each agent holds **real bounded authority** via a scoped session key and routes every
spend through `AgentGuard.execute`, which clears `RiskEngine.checkSpend` before any USDC moves.

```
src/
  honest.ts          # in-policy spends -> AUTHORIZED (green baseline)
  compromised.ts     # prompt-injected drain attempts -> REVERTED (velocity/daily/drawdown)
  denylist.ts        # pays low-rep / denylisted counterparties -> REVERTED (counterparty)
  driver.ts          # runs all three in parallel against the live floor
  runner.ts          # simulate -> verdict -> (optionally) land the real reverting tx on Arbiscan
  policy-compiler.ts # one English sentence -> PolicyConfig (LLM authors, never enforces)
  chain.ts / abi.ts  # viem clients + minimal ABIs
```

## Run
```bash
npm install
cp .env.example .env   # fill AGENT_GUARD, RISK_ENGINE, the three *_KEY session keys, counterparties
npm run driver         # the parallel floor (the hero demo)
npm run compile -- "spend up to 50 USDC a day, never pay unverified contracts, halt if it loses 20%"
```

## Notes
- `LAND_REVERTS=true` sends the blocked spends as real reverting txs so **REVERTED shows on
  Arbiscan** (the centerpiece). Set `false` to only simulate verdicts.
- The compiler uses Claude when `ANTHROPIC_API_KEY` is set, otherwise a deterministic regex
  fallback — either way the LLM is **out of the enforcement path**.
