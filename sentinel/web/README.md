# SENTINEL — Mission-Control Console

The web front-end for **SENTINEL**, an on-chain risk firewall for AI-agent wallets on **Arbitrum**.
A Bloomberg-terminal × aircraft-cockpit console that lets you watch the firewall arbitrate several
autonomous agents at once — authorizing the honest ones and slamming a **REVERTED** stamp on the
compromised ones, live, before any USDC moves.

Built with **Next.js 14 (App Router) · TypeScript · TailwindCSS · wagmi/viem · framer-motion · recharts**.

---

## Pages

| Route | What it is |
|---|---|
| `/` | **Mandate Compiler** — type one English sentence ("spend up to 50 USDC a day, never pay unverified contracts, halt if it loses 20%"); it compiles into labeled policy chips (VELOCITY / DAILY CAP / DRAWDOWN / COUNTERPARTY TRUST) → one-tap **CONFIRM & WRITE ON-CHAIN**. The LLM authors policy, never enforces it. |
| `/floor` | **THE HERO** — three agent lanes in parallel (HONEST green baseline, COMPROMISED, DENYLIST), each with an animated 0–100 risk gauge filling green→red. Authorized spends slide through; blocked ones snap back with a red REVERTED stamp + reason chip. A guarded **KILL SWITCH** freezes every lane with a screen-wide desaturation. Includes the per-agent session-key Permissions sidebar. |
| `/proof` | **Stylus-vs-Solidity gas benchmark** bar chart with % savings + links to verified contracts. |

---

## Run

> Dependencies are not committed. Install, then run the dev server.

```bash
cd sentinel/web
npm install
cp .env.example .env.local   # optional — see Demo Mode below
npm run dev                  # http://localhost:3000
```

Scripts: `dev`, `build`, `start`, `lint`.

---

## Demo Mode (default)

If the core contract addresses are **blank** in the environment, the console runs in **DEMO MODE**:
`lib/useAgentEvents.ts` streams realistic synthetic agent activity — honest authorized spends, a
compromised agent getting **REVERTED** on velocity / daily / drawdown breaches, and a denylist agent
blocked on a low-reputation ERC-8004 counterparty. **Every page shows live-looking data with no
backend**, so the floor is fully demoable pre-deployment. The nav shows a `DEMO MODE` badge.

To go **live**, set these in `.env.local` (Arbitrum Sepolia, chain id `421614`):

```ini
NEXT_PUBLIC_ARB_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_POLICY_REGISTRY=0x...
NEXT_PUBLIC_AGENT_GUARD=0x...
NEXT_PUBLIC_RISK_ENGINE=0x...
# optional, for the Proof panel links:
NEXT_PUBLIC_RISK_ENGINE_STYLUS=0x...
NEXT_PUBLIC_RISK_ENGINE_SOLIDITY=0x...
```

With all three core addresses set, the hook subscribes (via viem `watchContractEvent`) to
`AgentGuard.SpendExecuted` / `FloorFrozen` and the badge flips to `LIVE`.

---

## Architecture notes

- **`lib/contracts.ts`** — minimal ABIs mirroring the deployed contracts: `AgentGuard`
  (`execute` / `freeze` / `unfreeze`, events `SpendExecuted` / `FloorFrozen`, error
  `SpendRejected`), `RiskEngine` (`previewSpend` / `drawdownBpsOf`, event `SpendChecked`),
  `PolicyRegistry` (`mint` / `killSwitch`, events `PolicyCreated` / `KillSwitchFlipped`). Reason
  codes (OK=0, VELOCITY=1, DAILY_CAP=2, DRAWDOWN=3, COUNTERPARTY=4, KILL_SWITCH=5,
  SCORE_THRESHOLD=6) and the block threshold (80) are kept in lockstep with `RiskTypes.sol`.
- **`lib/chain.ts`** — Arbitrum Sepolia (`421614`) viem chain + Arbiscan link helper.
- **`lib/policyCompiler.ts`** — client-side mock of the off-chain Claude PolicyCompiler. Parses a
  sentence into a `PolicyConfig` + display chips; swap for the real Claude API call in production.
- **`lib/useAgentEvents.ts`** — the single source of floor state: demo streamer or live viem
  subscription, plus per-lane gauge math and the freeze flag.

**Design system:** near-black canvas, restrained signal-green (`#00E58A`) / alert-red (`#FF3B3B`)
as the only loud colors; JetBrains Mono (tabular-nums) for numbers, Space Grotesk for labels.

> Note: the write paths (mint policy, on-chain freeze) are wired as simulated transitions in demo
> mode; connect a wagmi connector + `useWriteContract` to fire them on-chain once contracts deploy.
