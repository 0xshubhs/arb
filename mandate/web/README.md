# Mandate — Web

The consumer-facing control surface for **Mandate**, a non-custodial robo-advisor
for tokenized stocks on **Robinhood Chain** (testnet, chainId `46630`).

> Give an AI agent a mandate to manage your tokenized stocks — inside a cage the
> blockchain enforces, not one the agent promises.

A private-bank terminal, not a DeFi dApp: deep-ink canvas, one institutional
green for "agent acting within bounds", amber/red reserved for breaches and the
kill-switch. Inter Tight for UI, IBM Plex Mono (tabular) for every number.

---

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **TailwindCSS** (design tokens in `tailwind.config.ts` + `app/globals.css`)
- **wagmi** + **viem** + **@tanstack/react-query** — RH Chain reads/writes
- **Framer Motion** — count-up numbers, tweened donut, spring budget meter
- **Recharts** — the onboarding projection chart

## Pages

| Route        | What it is |
|--------------|------------|
| `/`          | **Onboarding funnel** — passkey/email login (mock) → preset Mandate cards (MAG5 / Growth Tilt / Steady) → three guardrail sliders (drift / daily budget / slippage) with a live projection chart → "Autopilot ON". Balances in dollars. |
| `/control`   | **The Control Room (hero)** — current-vs-target allocation donut, daily budget meter burning down, streaming PROPOSED/EXECUTED/REVERTED activity feed with Blockscout deep-links + rationale, an oversized always-present **PAUSE / REVOKE AGENT** kill-switch, and a **Simulate breach** button that fires an over-cap trade you watch bounce off the contract as a red REVERTED row. Revoking turns the room amber. |
| `/ledger`    | **Accountability ledger** — every rebalance as a receipt: pre/post weights, oracle prices, and the `rationaleHash`. |

## Getting started

Dependencies are **not** installed in this repo — install them first:

```bash
cd mandate/web
npm install          # or pnpm / yarn / bun
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

### Scripts

| Script           | Does |
|------------------|------|
| `npm run dev`    | Start the dev server |
| `npm run build`  | Production build |
| `npm run start`  | Serve the production build |
| `npm run lint`   | Next.js lint |

## Environment

Copy `.env.example` → `.env.local`:

```ini
NEXT_PUBLIC_RH_RPC_URL=https://rpc.testnet.chain.robinhood.com
NEXT_PUBLIC_FACTORY_ADDRESS=     # MandateVaultFactory address
NEXT_PUBLIC_VAULT_ADDRESS=       # a specific MandateVault to watch
NEXT_PUBLIC_ALCHEMY_API_KEY=     # optional, for the sponsored RPC
```

## Demo Mode

**If `NEXT_PUBLIC_VAULT_ADDRESS` is unset, the app runs in DEMO MODE.** This is
the default and is fully self-contained — no backend, no deployed contracts, no
wallet required. `lib/useVaultEvents.ts`:

- seeds a believable already-running history (executed rebalances, an autopilot
  DCA, even a prior REVERTED over-cap attempt);
- streams new synthetic events on an interval — each appears as `PROPOSED`, then
  resolves to `EXECUTED` ~1.4s later, like a real UserOp confirming;
- burns the daily budget meter down and tweens the donut toward target as trades
  land;
- wires the **PAUSE / RESUME / REVOKE** controls and the **Simulate breach**
  button so the full demo sequence works pre-deployment.

The Demo/Live badge in the nav bar reflects the current mode. When you set a real
`NEXT_PUBLIC_VAULT_ADDRESS`, the same hook subscribes to the vault's
`Rebalanced` / `AutopilotBought` / `EmergencyPaused` / `AgentRevoked` events via
`viem.watchContractEvent` and the UI renders real on-chain receipts instead.

## How it maps to the contract

`lib/contracts.ts` carries minimal ABIs whose event/function signatures mirror
`contracts/src/MandateVault.sol` and `MandateVaultFactory.sol` exactly
(`getPolicy`, `getWeights`, `remainingDailyCap`, `pause`, `revokeAgent`,
`vaultOf`, `createVault`, and the four events), so flipping from demo to live is a
config change, not a rewrite.

The guarantee the UI dramatizes is the contract's **negative space**: the agent
can only call `rebalance` / `autopilotBuy`, every breach reverts, and only the
OWNER can move principal. The kill-switch and the REVERTED row are that fact made
visible.
