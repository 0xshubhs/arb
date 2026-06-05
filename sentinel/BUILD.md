# SENTINEL — Execution Handbook

Code-level companion to `PLAN.md`. Build straight from this. Nothing here is built yet — it's the spec.

> Amounts in USDC use 6 decimals. Scores are 0–100 (uint8). Reputation normalized to 0–100.

---

## 0. Environment & setup

```bash
# contracts/ — Foundry (forge-std + openzeppelin-contracts already installed)
cd sentinel/contracts && forge build && forge test -vvv

# Stylus kernel (Rust) — needs cargo-stylus (installing via `cargo install cargo-stylus`)
cd src/risk-engine-stylus            # cargo project (see §1)
cargo stylus check
cargo stylus deploy --endpoint $ARB_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY

# agent/ — three reference agents
cd ../../agent && npm init -y
npm i viem @zerodev/sdk @zerodev/permissions permissionless @anthropic-ai/sdk dotenv
npm i -D typescript tsx @types/node

# web/ — Next.js mission-control console
cd ../web && npx create-next-app@latest . --ts --tailwind --app --eslint
npm i viem wagmi @tanstack/react-query @zerodev/sdk framer-motion recharts
```

### `.env` template
```ini
ARB_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
DEPLOYER_PRIVATE_KEY=0x...                 # testnet throwaway
ARBISCAN_API_KEY=...
ERC8004_REPUTATION_REGISTRY=0x...          # live-on-Arbitrum address (confirm)
ZERODEV_PROJECT_ID=...
ANTHROPIC_API_KEY=...
RISK_ENGINE_STYLUS=0x...
RISK_ENGINE_SOLIDITY=0x...
POLICY_REGISTRY=0x...
AGENT_GUARD=0x...
```

### Chain facts (Arbitrum Sepolia)
- RPC `https://sepolia-rollup.arbitrum.io/rpc` · explorer Arbiscan (Sepolia) · gas = ETH
- ERC-8004 Reputation Registry is **live on Arbitrum** (confirm exact testnet address Day 1)
- ZeroDev provides ERC-4337 kernel accounts + session-key validators on Arbitrum

---

## 1. Contract specs

### `src/risk-engine-stylus/` — **Stylus (Rust/WASM) RiskEngine** (the moat)
Compute-heavy scorer; the piece Arbitrum recommends Stylus for. `Cargo.toml` uses `stylus-sdk`.
```rust
// checkSpend(agent, to, amount, token) -> (allowed, score, reasonCode)
// State per agent: ring-buffer of recent (timestamp, amount) for velocity;
//   high-water-mark + current value for drawdown; cached counterparty reputation.
// Score 0..=100 = weighted blend of:
//   velocityFactor (rolling-window sum vs cap),
//   dailyFactor    (24h cumulative vs dailyCap),
//   drawdownFactor (drop from high-water vs drawdownBps),
//   counterpartyFactor (100 - normalized ERC-8004 reputation, or denylist => max).
// allowed = score < threshold AND not killSwitched.
```
Keep factors **few and explained** — judges must read it as transparent engineering, not a black-box AI score. Ships with an on-chain **gas benchmark vs the Solidity twin** (the entire "why Stylus" thesis rests on showing this number on camera).

### `src/RiskEngine.sol` — Solidity twin
Functionally identical; verified **standing fallback** + benchmark baseline. If the WASM toolchain fights past Day 3, this is the shipped path and Stylus becomes upside. CEI + `ReentrancyGuard` on state-mutating paths. Same `checkSpend` signature so `AgentGuard` is agnostic to which engine it calls.

### `src/PolicyRegistry.sol`
ERC-721 **Policy NFT** per user (OZ `ERC721` + `Ownable`/`AccessControl`).
```solidity
struct PolicyConfig {
    uint256 velocityCapPerTx;   // max single spend (USDC, 6dp)
    uint256 dailyCapUSDC;       // rolling-24h cap
    uint16  drawdownBps;        // halt if value drops this much from high-water
    uint16  minCounterpartyReputation; // 0..100 gate
    bool    killSwitched;
}
mapping(uint256 tokenId => PolicyConfig) policies;
mapping(uint256 tokenId => mapping(address => bool)) denylist;  // local fallback
function mint(PolicyConfig cfg) external returns (uint256 id);
function update(uint256 id, PolicyConfig cfg) external onlyOwnerOf(id);
function killSwitch(uint256 id, bool on) external onlyOwnerOf(id);
// events: PolicyCreated, PolicyUpdated, KillSwitchFlipped
```

### `src/AgentGuard.sol` — ERC-4337 / ZeroDev validation module
The hard NO. Constrains the agent session key so **every** UserOp must clear `RiskEngine.checkSpend(...)` and the policy is not kill-switched; enforces session-key scope (allowlisted target, USDC cap, expiry). A violating spend reverts **before settlement**.

### `src/ERC8004Reader.sol`
Read-only adapter over the live Arbitrum ERC-8004 Reputation Registry; normalizes reputation → 0–100, caches last-good, **degrades to the local denylist if the read reverts** (keeps ERC-8004 additive + off the critical path).

---

## 2. Foundry test matrix
`test/`:
- **Unit:** PolicyRegistry mint/update/killSwitch gating; RiskEngine factor math (velocity, daily, drawdown, counterparty) in isolation.
- **Parity:** Solidity twin and Stylus kernel return identical `(allowed, score, reasonCode)` for a shared vector set.
- **Adversarial (must REVERT before settlement):**
  - velocity-cap breach · daily-cap breach · drawdown breach
  - denylisted / sub-threshold ERC-8004 counterparty
  - kill-switch ON → every `checkSpend` reverts
  - unauthorized policy update (non-owner) → revert
  - reentrancy-on-`checkSpend` → revert
- **Fuzz:** cap/drawdown **monotonicity** (more spend never lowers risk), score bounds stay 0–100.
- **Gas benchmark:** `forge snapshot` Stylus vs Solidity `checkSpend`; export the delta for README + Proof panel.

---

## 3. Agents (`agent/`) — three reference agents
Each on a ZeroDev ERC-4337 smart account with a **scoped session key** (allowlisted target, USDC cap, expiry) — real bounded authority, not a chatbot with a wallet. A loop driver runs all three in parallel against the live dashboard.
- `honest.ts` — normal in-policy spends → SENTINEL authorizes (green baseline).
- `compromised.ts` — prompt-injected to drain → rapid high-value transfers trip velocity/daily/drawdown → each reverts, gauge spikes red.
- `denylist.ts` — pays a low-reputation ERC-8004 counterparty → blocked on the read.
- `driver.ts` — runs all three concurrently, streams verdicts.

Separate off-chain **PolicyCompiler** (`policy-compiler.ts`, Claude API): one English sentence → `PolicyConfig` struct → return for confirmation → frontend writes on-chain. **LLM authors policy, never enforces it.**

Optional: blocked attempts post evidence to the ERC-8004 Reputation Registry (closed reputation loop) — stretch.

---

## 4. Web (`web/`) — "mission-control" console
Bloomberg-terminal × aircraft-cockpit; dark, dense, motion-driven. Restrained signal-green / alert-red on near-black; risk-state color is the only loud thing. Monospace numbers, geometric sans labels.

```
app/
  (onboarding)/page.tsx   MandateCompiler: prompt "Tell SENTINEL the rules" → Claude → policy chips
                          (VELOCITY/DAILY CAP/DRAWDOWN/COUNTERPARTY TRUST) → CONFIRM & WRITE ON-CHAIN
  floor/page.tsx  (HERO)  2–3 AgentLanes, each with animated 0–100 RiskGauge (green→red),
                          authorized spends slide through, blocked → red REVERTED stamp + reason chip,
                          persistent guarded KILL SWITCH → screen-wide desaturation freeze
  proof/page.tsx          Stylus-vs-Solidity gas benchmark bar chart + verified-contract links
components/
  AgentLane.tsx  RiskGauge.tsx  RevertStamp.tsx  KillSwitch.tsx
  PolicyChip.tsx  MandatePrompt.tsx  GasBenchmarkChart.tsx  PermissionsSidebar.tsx
lib/  zerodev.ts  contracts.ts  useAgentEvents.ts
```
**Centerpiece:** the moment a prompt-injected agent gets told NO, live on Arbiscan. **Showstopper:** the KILL SWITCH freeze.

---

## 5. Build order checklist (maps to PLAN.md 10-day timeline)
- [ ] D1 lock 4 risk factors; scaffold monorepo; deploy hello-world Solidity + trivial Stylus; confirm ERC-8004 address; daily commits
- [ ] D2 PolicyRegistry + Solidity RiskEngine, deploy/verify, first unit tests
- [ ] D3 **FREEZE**; port RiskEngine to Stylus, prove parity *(if WASM fights past today → ship Solidity, Stylus = upside)*
- [ ] D4 AgentGuard + ZeroDev session keys; ERC8004Reader; full revert path integration test
- [ ] D5 three reference agents + driver; capture gas benchmark numbers
- [ ] D6 Claude policy compiler → on-chain write; Next.js scaffold + event streaming
- [ ] D7 Live Floor hero UI (lanes, gauges, REVERTED stamps, KILL SWITCH freeze)
- [ ] D8 onboarding + permissions sidebar + Proof panel; polish to standout grade
- [ ] D9 adversarial Foundry suite + verify all + README (addresses, architecture, gas benchmark)
- [ ] D10 record 2-min demo; submit early; roadmap commit + light social

## 6. Non-negotiables (protect the win)
- **Ship the Stylus-vs-Solidity gas benchmark** in README + on camera — the "why Stylus" thesis depends on it.
- Keep the LLM strictly **out of the enforcement path** (it only authors policy).
- 3–4 transparent risk factors, frozen Day 3; spend the back half on the adversarial suite + a bulletproof 2-min demo.
- Deploy a trivial Stylus contract Day 1 to de-risk the toolchain; Solidity-only scorer is the standing fallback.

## 7. Open questions — status
- ✅ **Live ERC-8004 ReputationRegistry on Arbitrum Sepolia: `0x8004B663056A597Dffe9eCcC1965A193B7388713`**
  (IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`). `ERC8004Reader` now matches the
  real `getSummary(agentId, clients, tag1, tag2) -> (count, int128 value, uint8 decimals)` shape and
  normalizes the signed fixed-point result to 0–100. ERC-8004 has no on-chain address→agentId reverse
  lookup, so the reader keeps an owner-set `agentIdOf[counterparty]` map; unknown counterparties fall
  back to the neutral default + the policy's local denylist.
- ZeroDev session-key validator API version + whether a custom validation module can gate on an external `checkSpend` call pre-settlement. *(AgentGuard models this self-contained; a ZeroDev kernel module is the production wiring.)*
- Stylus ↔ Solidity cross-contract call cost (AgentGuard → RiskEngine) and how it affects the benchmark framing.
