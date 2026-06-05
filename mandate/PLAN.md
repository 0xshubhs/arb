# Mandate — Build Plan

> **Give an AI agent a mandate to manage your tokenized stocks — inside a cage the blockchain enforces, not one the agent promises.**

**Track:** Robinhood Chain (reserved RWA slot) + strong secondary claim on Best Agentic Project
**Chain:** Robinhood Chain testnet — Arbitrum Orbit L2, **chainId 46630**
- RPC: `https://rpc.testnet.chain.robinhood.com` (Alchemy: `https://robinhood-testnet.g.alchemy.com/v2/<KEY>`)
- Explorer: Blockscout @ `explorer.testnet.chain.robinhood.com` (verify via Blockscout API)
- Gas: native ETH · Faucet: `faucet.testnet.chain.robinhood.com` (ETH + 5 each TSLA/AMZN/PLTR/NFLX/AMD) · USDG via Paxos faucet
- AA: Alchemy ERC-4337 Smart Wallets + Bundler + Gas Manager (session keys, sponsored gas)

---

## Summary
Non-custodial robo-advisor for tokenized equities. Deposit USDG + stock tokens into a personal vault; grant an AI agent a cryptographically bounded mandate to manage the basket 24/7. The agent acts only inside on-chain guardrails (allowlisted assets, target weights + drift band, per-trade & per-day USDG caps, max slippage, trading window, instant kill-switch). **The agent never holds funds and physically cannot withdraw principal — every illegal trade reverts at the contract.** Each rebalance emits a verifiable receipt (pre/post weights, oracle prices, rationale hash). Wrapped in a consumer-fintech UI (preset Mandates, dollar-denominated balances, passkey login, sponsored gas).

Solves two problems at once: gives Robinhood Chain its **first active portfolio-management primitive** for inert faucet tokens, and cracks the #1 agentic adoption blocker — trusting an autonomous agent with money — by making "the agent literally cannot drain you" a provable, demoable fact.

---

## Architecture
Three layers, all gated by one security-critical contract.

**1) On-chain (Solidity + OpenZeppelin, deployed + verified on RH Chain):**
- `MandateVaultFactory` — deploys per-user `MandateVault` clones (OZ Clones / minimal-proxy), maps owner→vault.
- `MandateVault` — non-custodial vault holding USDG + stock tokens; stores the `Policy` struct; enforces every guardrail on every agent action. CEI ordering, ReentrancyGuard, Pausable, SafeERC20.
- `StockAMM` — minimal in-repo constant-product (x*y=k) pool per stock-token/USDG pair, seeded from the faucet, so the rebalance path is fully deterministic and never depends on an unconfirmed external DEX. Implements `IDexRouter` so a real router (0x) can swap in.
- `PriceOracle` — adapter behind Chainlink `AggregatorV3Interface`; real feeds if present on RH testnet, else owner-set mock (labeled). Slippage logic identical either way.

**2) Agent (off-chain TypeScript, holds only a scoped ERC-4337 session key):**
Loop: read balances + prices → compute drift vs target → if out of band, compute minimal policy-legal swaps → (advisory) Claude one-line rationale, hashed into the receipt → submit `rebalance()` UserOp via Alchemy bundler with sponsored gas. Second bounded action: recurring/DCA "Autopilot" buys through the **same** caps. **The LLM is strictly advisory and off the validation path — a hallucinated/adversarial output still cannot produce an illegal trade; it reverts.**

**3) Frontend (Next.js + viem/wagmi + Alchemy Account Kit):** the Mandate dashboard — consumer onboarding funnel + live agent control room reading vault events.

**Kill-switch:** OWNER calls `pause()` / `revokeAgent()` → all agent UserOps revert instantly.

## Contracts
| Contract | Purpose |
|---|---|
| `MandateVaultFactory` | Deploys one `MandateVault` per user via OZ Clones; maps owner→vault; emits `VaultCreated`. |
| `MandateVault` | **Load-bearing.** Non-custodial vault. Stores `Policy {address[] allowedAssets; uint16[] targetWeightsBps; uint16 maxDriftBps; uint256 perTradeCapUsdg; uint256 perDayCapUsdg; uint16 maxSlippageBps; uint64 windowStart; uint64 windowEnd; bool paused}`. OZ AccessControl: **OWNER** (deposit/withdraw/setPolicy/pause/revokeAgent — only address that can move principal) and **AGENT** (session key, may ONLY call `rebalance()` / `autopilotBuy()`). `rebalance(Swap[])` validates each swap: in allowlist, ≤ perTradeCap, rolling-24h spend ≤ perDayCap, price within maxSlippageBps of oracle mid, inside window, weights move toward target — else revert. Emits `Rebalanced` (full receipt). **No function lets AGENT transfer assets to an arbitrary address — the negative space is the guarantee.** |
| `StockAMM` | Minimal constant-product AMM (pool per stockToken/USDG), seeded from faucet, so execution is self-contained + demo-deterministic. Implements `IDexRouter`. |
| `PriceOracle` | Adapter behind Chainlink `AggregatorV3Interface` for slippage + NAV/weight math; real feeds or labeled owner-set mock. |

## Agent architecture
Single autonomous TS process; its only on-chain authority is an ERC-4337 session key scoped by `MandateVault` to exactly `rebalance()` and `autopilotBuy()`. Authority is enforced by the contract, not the agent's discretion.

Loop (every N min, per active vault): read balances + Policy + prices → compute weights vs target → if drift ≤ band and no recurring buy due, sleep → else solve minimal policy-legal swaps (split large trades to stay under caps) → (advisory) Claude rationale → keccak256 → `rationaleHash` on receipt → build + submit UserOp via Alchemy bundler + Gas Manager. On any breach the contract reverts and the agent logs a REVERTED entry.

Safety: session key independently expiring + instantly revocable; agent holds zero custody; worst case for a compromised key is trades within the user's own caps/allowlist. **Fallback:** plain scoped EOA key if RH testnet ERC-4337/Gas Manager lags — security story identical, only gas-sponsorship UX is lost.

## UI plan — "Private bank terminal, not a DeFi dApp"
Calm, premium, trustworthy — a fintech control room a regulator would respect; the opposite of neon casino DeFi.
- **Palette:** deep ink (#0B0E14); one restrained institutional green (#14E08A) ONLY for "agent acting / within bounds"; amber→red (#FF5C5C) ONLY for breaches/reverts + kill-switch. Generous negative space.
- **Type:** precise grotesk (Inter Tight) for UI; tabular monospace (IBM Plex Mono) for ALL numbers. `tabular-nums` everywhere.
- **Texture:** 1px hairlines, frosted-glass cards, Framer Motion micro-interactions (numbers count up, donut tweens, budget meter drains with spring physics).

**Pages:**
1. **Onboarding funnel** — passkey/email login (no seed phrase); pick a preset Mandate card ("MAG5" equal-weight, "Growth Tilt", "Steady"); three large guardrail sliders (drift, daily budget, slippage) with a **live projected-value + drift-band chart** as centerpiece; balances in DOLLARS; "Autopilot ON" toggle.
2. **The Control Room (hero)** — animated current-vs-target **donut**; per-day **budget meter** burning down; streaming **activity feed** of PROPOSED / EXECUTED / **REVERTED** rows with rationale + Blockscout deep-links; oversized always-present **PAUSE / REVOKE AGENT** kill-switch. Green pulses when in-bounds; a red REVERTED "blocked by your policy" row is the emotional payoff.
3. **Track-record / receipts** — "your agent's accountability ledger": every rebalance with pre/post weights, oracle prices, rationale hash.
4. **Retention layer** — goal/streak + projected-growth panel so judges see why users return.

**Key interactions:** dragging a slider re-renders the projection live; a "Simulate breach" affordance fires an over-cap trade so the audience watches it bounce off the contract; REVOKE turns the room amber and silences the agent instantly.

## 10-day timeline
- **Day 1** — De-risk the eligibility gate FIRST: add RH Chain, pull faucet tokens + USDG, deploy + verify a HelloRobinhood on Blockscout. Scaffold Foundry + Next.js + agent. Start daily commits.
- **Day 2** — `MandateVault` skeleton (Policy, AccessControl, Pausable, ReentrancyGuard, SafeERC20, deposit/withdraw); `StockAMM` + seed pools; `PriceOracle` adapter. Deploy to RH testnet.
- **Day 3** — **FREEZE SCOPE** (single-user vault + presets + `rebalance()` + `autopilotBuy()`). Full `rebalance()` validation: allowlist, perTradeCap, rolling-24h perDayCap, slippage, window, drift-toward-target. Emit `Rebalanced`. `MandateVaultFactory` (Clones).
- **Day 4** — Foundry suite (the quality proof): unit + fuzz on weight/cap/slippage + adversarial tests proving over-cap/over-slippage/non-allowlisted/out-of-window/paused all REVERT and AGENT can never withdraw. Redeploy + verify.
- **Day 5** — Agent loop: read→drift→solve→submit UserOp via bundler + Gas Manager. Wire Claude advisory → `rationaleHash`. Confirm a real rebalance lands + emits a receipt.
- **Day 6** — Frontend core: wagmi/viem + Account Kit, onboarding funnel, Control Room reading live events (donut, budget meter, feed, kill-switch). End-to-end happy path.
- **Day 7** — UI polish to brokerage-grade: palette, tabular-mono, Framer Motion, animated donut/meter, projection chart, retention panel. Dollar balances, gas hidden.
- **Day 8** — Harden demo path: "Simulate breach" → visible on-chain REVERT; verify all contracts; README (addresses, architecture, run instructions, honest testnet-mitigation disclosure) + roadmap; final fuzz pass.
- **Day 9** — Record 2–4 min video (good mic): ≤20s problem → live rebalance → REVERT → PAUSE/REVOKE → onboarding + projection wrapper. Submit early.
- **Day 10** — Buffer + traction (small commits, roadmap, light social), confirm contract resolves on explorer, rehearse Q&A ("why RH Chain", "what the contract enforces", "who's the user"). Stretch only if core is bulletproof.

## Judging map
- **Smart contract quality** — focused non-custodial vault on OZ AccessControl/ReentrancyGuard/Pausable/SafeERC20, strict CEI, Foundry fuzz + adversarial reverts, verified source. The negative-space guarantee is testable and demoed live.
- **PMF** — turns inert faucet tokens into an actively managed, diversified, dollar-denominated portfolio with zero gas friction + consumer onboarding; retention via Autopilot/DCA + goals + an operator-fee model.
- **Innovation** — bounded autonomy as an on-chain primitive applied to RWA-equities; verifiable rebalance receipts.
- **Real problem** — attacks the #1 agentic adoption blocker AND the RH Chain gap; strong "why this chain" (tokenized equities live only on RH Chain).

## Demo script (2.5–3 min)
- **[0:00–0:20] Problem:** "Robinhood Chain gives you tokenized stocks — and nothing to do with them. Letting an AI manage them is blocked by one fear: nobody hands an agent their portfolio. Mandate fixes that — not with a promise, with the blockchain."
- **[0:20–1:30] Load-bearing sequence (live, on-chain):** Control Room, agent active, budget full → trigger rebalance → EXECUTED row streams in, meter drains, tx confirms on Blockscout → "Simulate breach": over-cap/non-allowlisted swap lands **REVERTED** with red "blocked by your policy" badge, open failed tx on Blockscout → hit **REVOKE AGENT** live, room turns amber, agent silent. "The agent literally cannot drain you. Enforced by the contract."
- **[1:30–2:20] Lovable wrapper:** rewind to onboarding — passkey login, tap "MAG5", drag sliders watching the projection update, flip "Autopilot ON." Two clicks from faucet tokens to a managed dollar-denominated position with gas sponsored.
- **[2:20–2:50] Close:** accountability ledger → "Robinhood Chain's first active management primitive for tokenized equities — agentic, equities-specific, guardrail-enforced, verifiable. That's Mandate." Show verified contract + address.

## Stretch goals (only if core is bulletproof)
- One allowlisted, contract-capped yield action (covered-call/yield venue slice) realized strictly inside the vault's caps.
- Multi-user operator model: one strategy author runs an agent for many vaults, earns a fee, still can't withdraw principal.
- Stylus (Rust) acceleration for the drift/weight optimization math.
- ERC-8004 agent identity + validation registry for portable, scorable agent reputation.
- Mobile-responsive PWA so the kill-switch is reachable from a phone.

## Deployment
Foundry deploy to RH testnet (46630). Day 1 de-risk: add network, pull faucet ETH + 5 each stock token + USDG, deploy + verify HelloRobinhood on Blockscout. Core: `forge script` deploying `PriceOracle`, `StockAMM` (seed pools), `MandateVault` impl, `MandateVaultFactory`; verify via Blockscout API; record addresses in README. Frontend on Vercel; agent as a long-running worker (Railway/Fly) or cron holding an Alchemy-scoped session key with Gas Manager.

**Honest fallbacks (disclosed in README, so no testnet dependency hard-blocks the demo):**
1. scoped-EOA agent key if ERC-4337/Gas Manager lags (security identical, lose sponsored-gas UX);
2. in-repo `StockAMM` seeded from faucet instead of an unconfirmed external DEX;
3. owner-set mock behind the real Chainlink interface if stock feeds are absent on RH testnet.

Confirm the deployed `MandateVault` resolves on the RH Chain Blockscout explorer before submission. Maintain incremental commit history throughout.
