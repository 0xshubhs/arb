# Mandate — roadmap

Mandate turns inert tokenized-stock faucet tokens into an actively-managed, dollar-denominated
portfolio you can hand to an AI agent without handing over custody. Here's where it goes.

## Now (buildathon, shipped)
- Non-custodial `MandateVault` with on-chain guardrails (allowlist, per-trade + rolling-24h caps,
  slippage band, trading window, drift-toward-target) — the agent **cannot** withdraw principal.
- Self-contained `StockAMM` + `PriceOracle`, one-vault-per-user factory (OZ Clones).
- 25-test Foundry suite (unit · adversarial reverts · fuzz · invariants).
- Autonomous rebalancing agent (scoped session key) + "private bank terminal" web app.

## Next (post-submission, 2–4 weeks)
- Deploy + verify on Robinhood Chain; point the vault at the real faucet tokens (TSLA/AMZN/PLTR/NFLX/AMD) + USDG.
- Alchemy ERC-4337 session keys + Gas Manager for passkey login and **sponsored gas** (no-seed-phrase onboarding).
- Wire the web write-paths (`createVault`, `pause`, `revokeAgent`) and live event streaming.
- Real Chainlink stock feeds where available; keep the labeled mock only as fallback.

## Later (mainnet path)
- **Multi-user operator model:** one strategy author runs an agent for many vaults, earns a fee,
  still cannot withdraw principal — the retention + revenue loop.
- One allowlisted, contract-capped **yield action** (covered-call / yield slice) realized strictly inside the caps.
- **ERC-8004 agent identity** so a vault's agent carries portable, scorable reputation (ties into SENTINEL).
- Mobile PWA so the kill switch is one tap from a phone.
- Stylus acceleration for the drift/weight optimization math.

## Traction signals
- Incremental commit history from day one (no single giant commit).
- Public build log + demo video; recruit 3–5 pilot users from the RH Chain testnet faucet cohort.
