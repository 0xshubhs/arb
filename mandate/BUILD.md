# Mandate — Execution Handbook

Code-level companion to `PLAN.md`. Build straight from this. Nothing here is built yet — it's the spec.

> Convention: amounts in USDG use 6 decimals (assume USDG = 6dp like USDC; verify on testnet). Weights/bps use basis points (10000 = 100%).

---

## 0. Environment & setup

```bash
# contracts/ is already a Foundry project with forge-std + openzeppelin-contracts.
cd mandate/contracts
forge build
forge test -vvv

# agent/ — TypeScript worker
cd ../agent && npm init -y
npm i viem @alchemy/aa-core @alchemy/aa-alchemy @anthropic-ai/sdk dotenv
npm i -D typescript tsx @types/node

# web/ — Next.js app
cd ../web && npx create-next-app@latest . --ts --tailwind --app --eslint
npm i viem wagmi @tanstack/react-query @alchemy/aa-alchemy framer-motion recharts
```

### `.env` template (never commit real keys)
```ini
# contracts/.env
RH_RPC_URL=https://rpc.testnet.chain.robinhood.com
RH_CHAIN_ID=46630
DEPLOYER_PRIVATE_KEY=0x...        # testnet throwaway only
BLOCKSCOUT_URL=https://explorer.testnet.chain.robinhood.com
# agent/.env
RPC_URL=https://rpc.testnet.chain.robinhood.com
AGENT_SESSION_KEY=0x...           # scoped ERC-4337 session key (or EOA fallback)
ALCHEMY_API_KEY=...
GAS_MANAGER_POLICY_ID=...
ANTHROPIC_API_KEY=...
VAULT_ADDRESS=0x...
# web/.env.local
NEXT_PUBLIC_RH_RPC_URL=https://rpc.testnet.chain.robinhood.com
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_ALCHEMY_API_KEY=...
```

### `foundry.toml`
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
fuzz = { runs = 512 }

[rpc_endpoints]
rh_testnet = "${RH_RPC_URL}"
```
`remappings.txt`: `@openzeppelin/=lib/openzeppelin-contracts/`

### Chain facts (Robinhood Chain testnet)
- chainId **46630** · RPC `https://rpc.testnet.chain.robinhood.com` · gas = native ETH
- Explorer: Blockscout `explorer.testnet.chain.robinhood.com` (verify via Blockscout API, not Etherscan)
- Faucet: `faucet.testnet.chain.robinhood.com` → ETH + 5 each TSLA/AMZN/PLTR/NFLX/AMD; USDG via Paxos faucet
- AA: Alchemy ERC-4337 Smart Wallets + Bundler + Gas Manager (session keys, sponsored gas)

---

## 1. Contract specs

### `src/interfaces/IDexRouter.sol`
```solidity
interface IDexRouter {
    // swap exact `amountIn` of tokenIn for tokenOut, revert if out < minOut
    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        external returns (uint256 amountOut);
    function quote(address tokenIn, address tokenOut, uint256 amountIn)
        external view returns (uint256 amountOut);
}
```

### `src/PriceOracle.sol`
Adapter behind Chainlink `AggregatorV3Interface`. One feed per stock token (price in USDG terms, scaled to 1e8 like Chainlink). Owner-set mock fallback if no live feed on RH testnet — **same interface either way** so guardrail logic is production-shaped.
```solidity
function setFeed(address token, address aggregator) external onlyOwner;
function setMockPrice(address token, int256 price) external onlyOwner;   // labeled testnet-only
function priceOf(address token) external view returns (uint256 priceUsdg1e8);
```

### `src/StockAMM.sol`
Minimal constant-product (x*y=k) AMM, one pool per `stockToken/USDG` pair, seeded from faucet. Implements `IDexRouter` so the rebalance path is self-contained + demo-deterministic. A real router (0x) can replace it without touching the vault.
- `createPool(stockToken, usdgReserve, stockReserve)` (owner, seeds liquidity)
- `swapExactIn(...)` constant-product with a small fee; `quote(...)` view
- Reverts: `InsufficientLiquidity`, `SlippageExceeded`

### `src/MandateVault.sol` — **the load-bearing contract**
```solidity
struct Policy {
    address[] allowedAssets;     // allowlist (stock tokens); USDG implicit
    uint16[]  targetWeightsBps;  // parallel to allowedAssets, sums to 10000
    uint16    maxDriftBps;       // rebalance only triggers past this drift
    uint256   perTradeCapUsdg;   // max notional per single swap
    uint256   perDayCapUsdg;     // rolling-24h cumulative notional cap
    uint16    maxSlippageBps;    // realized price vs oracle mid tolerance
    uint64    windowStart;       // seconds-of-day trading window start
    uint64    windowEnd;         // seconds-of-day trading window end
    bool      paused;            // kill-switch flag
}

struct Swap { address tokenIn; address tokenOut; uint256 amountIn; uint256 minOut; }
```
**Roles (OZ AccessControl):**
- `OWNER` — `deposit`, `withdraw`, `setPolicy`, `pause`/`unpause`, `revokeAgent`. **Only address that can move principal out.**
- `AGENT` — may ONLY call `rebalance(Swap[])` and `autopilotBuy(uint256 usdgAmount)`.

**Guards on every agent action (revert on any breach):**
1. asset ∈ `allowedAssets`
2. swap notional ≤ `perTradeCapUsdg`
3. rolling-24h spend + notional ≤ `perDayCapUsdg` (track `spentWindow` + `windowAnchor`)
4. realized price within `maxSlippageBps` of `PriceOracle` mid
5. `block.timestamp % 86400` within `[windowStart, windowEnd]`
6. resulting weights move **toward** target within `maxDriftBps`
7. `!policy.paused`

**Security:** `ReentrancyGuard` on `rebalance`/`autopilotBuy`/`withdraw`; `Pausable`; `SafeERC20`; strict checks-effects-interactions; explicit input validation. **No function lets AGENT transfer assets to an arbitrary address — that negative space IS the guarantee.**

**Events (the receipt trail):**
```solidity
event Rebalanced(uint256 indexed nonce, int256[] preWeightsBps, int256[] postWeightsBps,
                 uint256[] oraclePrices, uint256 notionalUsdg, bytes32 rationaleHash);
event PolicyUpdated(bytes32 policyHash);
event AgentRevoked(address agent);
event EmergencyPaused(bool paused);
```

**Custom errors:** `AssetNotAllowed`, `PerTradeCapExceeded`, `PerDayCapExceeded`, `SlippageExceeded`, `OutsideTradingWindow`, `DriftNotImproved`, `VaultPaused`, `OnlyAgent`, `OnlyOwner`.

### `src/MandateVaultFactory.sol`
OZ `Clones` (minimal proxy) → one `MandateVault` per user. `createVault() returns address`; `vaultOf(address owner) view`; `event VaultCreated(address owner, address vault)`.

### `test/mocks/MockERC20.sol`
6dp (USDG) and 18dp (stock token) mocks with `mint` for tests + local AMM seeding.

---

## 2. Foundry test matrix (the contract-quality proof)

`test/MandateVault.t.sol`
- **Unit:** deposit/withdraw accounting; setPolicy validation (weights sum to 10000, array lengths match); only-owner / only-agent gating.
- **Happy path:** drift > band → `rebalance` moves weights toward target, emits `Rebalanced` with correct receipt fields.
- **Adversarial (must REVERT):**
  - over-`perTradeCap` swap → `PerTradeCapExceeded`
  - cumulative over-`perDayCap` within 24h → `PerDayCapExceeded`; resets after window
  - non-allowlisted `tokenOut` → `AssetNotAllowed`
  - realized price beyond `maxSlippageBps` → `SlippageExceeded`
  - outside `[windowStart,windowEnd]` → `OutsideTradingWindow`
  - when `paused` → `VaultPaused`
  - **AGENT attempts to withdraw / move funds out → reverts** (prove the negative-space guarantee)
- **Fuzz:** `testFuzz_capNeverExceeded(uint256 amt)`, `testFuzz_weightMathMonotonic(...)`, slippage boundary fuzz.
- **Invariant:** agent actions can never reduce total vault value below (deposits − withdrawals) beyond slippage bound; principal never leaves except via OWNER `withdraw`.

Target: meaningful branch coverage (`forge coverage`). Each adversarial test is a demo talking point.

---

## 3. Deploy scripts (`script/`)

`Deploy.s.sol` (forge script):
1. `PriceOracle` → set feeds or mocks for TSLA/AMZN/PLTR/NFLX/AMD
2. `StockAMM` → create + seed pools from faucet tokens
3. `MandateVault` implementation
4. `MandateVaultFactory(impl)`
5. log all addresses → paste into `web/.env.local` + `agent/.env`

```bash
# Day 1 de-risk (prove deploy+verify pipeline first):
forge create src/HelloRobinhood.sol:HelloRobinhood --rpc-url $RH_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY
# verify on Blockscout, then:
forge script script/Deploy.s.sol --rpc-url $RH_RPC_URL --broadcast --verify \
  --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api
```

---

## 4. Agent (`agent/`) — pseudocode

```
loadEnv(); vault = getContract(VAULT_ADDRESS)
loop every N minutes:
  policy   = vault.getPolicy()
  balances = readBalances(vault)
  prices   = oracle.priceOf(each allowedAsset)
  weights  = computeWeights(balances, prices)
  if maxDrift(weights, policy.targetWeightsBps) <= policy.maxDriftBps and no DCA due:
      sleep; continue
  swaps = solveMinimalLegalSwaps(weights, policy, prices)   # split to stay under perTradeCap
  rationale = claude.oneLineRationale(weights, swaps, marketNote)   # ADVISORY ONLY
  rationaleHash = keccak256(rationale)
  userOp = buildUserOp(vault.rebalance(swaps, rationaleHash))
  submitViaAlchemyBundler(userOp, gasManager)               # sponsored gas
  on revert: log REVERTED row (do not blind-retry)
```
**Hard rules:** the LLM is advisory and **off the validation path** — a hallucinated output still can't produce an illegal trade (it reverts). Session key scoped to only `rebalance`/`autopilotBuy`, expiring + revocable. **Fallback:** plain scoped EOA key if ERC-4337/Gas Manager lags (security identical, lose sponsored-gas UX). Second action `autopilotBuy` = recurring DCA through the *same* caps.

Files: `src/agent.ts` (loop), `src/solver.ts` (drift→swaps), `src/rationale.ts` (Claude, prompt-cached), `src/chain.ts` (viem clients), `src/abi.ts`.

---

## 5. Web (`web/`) — "Private bank terminal" UI

**Design tokens** (`tailwind.config` + globals):
- canvas `#0B0E14`; in-bounds green `#14E08A`; breach/kill red `#FF5C5C`
- UI font Inter Tight; **all numbers** IBM Plex Mono + `tabular-nums`
- 1px hairlines, frosted-glass cards, Framer Motion (count-up numbers, tweened donut, spring budget meter)

**Route / component tree:**
```
app/
  (onboarding)/page.tsx        Login(passkey) → PresetMandateCards → GuardrailSliders + ProjectionChart → "Autopilot ON"
  control/page.tsx  (HERO)     AllocationDonut · BudgetMeter · ActivityFeed(PROPOSED/EXECUTED/REVERTED + Blockscout links) · KillSwitch(PAUSE/REVOKE)
  ledger/page.tsx              Receipts: per-rebalance pre/post weights, oracle prices, rationaleHash
components/
  AllocationDonut.tsx  BudgetMeter.tsx  ActivityRow.tsx  KillSwitch.tsx
  GuardrailSlider.tsx  ProjectionChart.tsx (recharts)  PresetCard.tsx  RetentionPanel.tsx (goal/streak)
lib/  wagmi.ts  contracts.ts  useVaultEvents.ts (live event stream)
```
**Key interactions:** slider drag re-renders projection live; "Simulate breach" affordance fires an over-cap trade → audience watches it bounce as REVERTED; REVOKE turns the room amber + silences the agent. Balances shown in **dollars** (USDG abstracted), gas hidden.

---

## 6. Build order checklist (maps to PLAN.md 10-day timeline)
- [ ] D1 faucet + HelloRobinhood deploy/verify; scaffold all three; daily commits start
- [ ] D2 MandateVault skeleton + StockAMM + PriceOracle, deploy
- [ ] D3 **FREEZE**; full rebalance validation + Factory
- [ ] D4 Foundry suite (unit+fuzz+adversarial) → redeploy/verify
- [ ] D5 agent loop submitting real rebalance UserOps
- [ ] D6 frontend core (onboarding + Control Room live events)
- [ ] D7 UI polish to brokerage grade + projection + retention panel
- [ ] D8 "Simulate breach" + verify all + README + roadmap
- [ ] D9 record 2–4 min video; submit early
- [ ] D10 buffer + traction + Q&A rehearsal; stretch only if bulletproof

## 7. Open questions to resolve when building
- USDG decimals on RH testnet (assume 6 — verify).
- Whether real Chainlink stock feeds exist on RH testnet (else use the labeled mock).
- ERC-4337 session-key maturity on RH testnet (else EOA fallback).
- Stock token decimals (assume 18 — verify from faucet token).
