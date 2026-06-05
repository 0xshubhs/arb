# Mandate

> Give an AI agent a mandate to manage your tokenized stocks — inside a cage the blockchain
> enforces, not one the agent promises.

A non-custodial robo-advisor for tokenized equities on **Robinhood Chain** (Arbitrum Orbit L2,
chainId 46630). You grant a scoped AI agent a cryptographically bounded mandate to manage your
TSLA/AMZN/PLTR/NFLX/AMD basket. The agent acts only inside on-chain guardrails and **physically
cannot withdraw your principal** — every illegal trade reverts at the contract.

See [`PLAN.md`](./PLAN.md) (strategy) and [`BUILD.md`](./BUILD.md) (spec). This README documents
what is built.

## What's here
```
mandate/
├── contracts/   Foundry: the load-bearing vault + AMM + oracle + factory, full test suite
├── agent/       TypeScript worker holding only a scoped session key (read → solve → rebalance)
└── web/         Next.js "private bank terminal" — onboarding, Control Room (hero), ledger
```

## Contracts
| Contract | Role |
|---|---|
| `MandateVault.sol` | **Load-bearing.** Non-custodial vault; enforces allowlist, per-trade & rolling-24h caps, slippage band, trading window, drift-toward-target on every agent action. OZ AccessControl + ReentrancyGuard + SafeERC20, strict CEI. Custom kill switch. |
| `MandateVaultFactory.sol` | One `MandateVault` per user via OZ minimal-proxy `Clones`. |
| `StockAMM.sol` | Self-contained constant-product AMM (pool per stock/USDG), seeded from faucet; implements `IDexRouter`. |
| `PriceOracle.sol` | Chainlink `AggregatorV3Interface` adapter; labeled owner-set mock fallback. |
| `HelloRobinhood.sol` | Day-1 deploy/verify de-risk. |

**The guarantee is the negative space:** there is no function that lets the AGENT role move assets
to an arbitrary address. Only the OWNER can withdraw.

## Build & test
```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # if lib/ is empty
forge build
forge test -vvv          # 25 tests: unit, happy-path, 11 adversarial reverts, fuzz, invariants
forge coverage           # branch coverage on the guardrails
```

Test coverage proves each guardrail reverts: over-`perTradeCap`, cumulative over-`perDayCap` (and
reset after 24h), non-allowlisted asset, slippage beyond band, outside trading window, paused, a
drift-worsening trade — plus **the AGENT can never withdraw** and an invariant that the agent never
accrues funds across a fuzzed call sequence.

## Deploy (Robinhood Chain testnet)
```bash
cp contracts/.env.example contracts/.env   # set DEPLOYER_PRIVATE_KEY, RH_RPC_URL, BLOCKSCOUT_URL
# Day 1 de-risk:
forge script script/DeployHello.s.sol --rpc-url $RH_RPC_URL --broadcast \
  --verify --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api
# Full stack (mock tokens + seeded pools; point at real faucet tokens for production):
forge script script/Deploy.s.sol --rpc-url $RH_RPC_URL --broadcast \
  --verify --verifier blockscout --verifier-url $BLOCKSCOUT_URL/api
```

### Deployed addresses (fill after deploy)
| Contract | Address |
|---|---|
| MandateVault impl | `0x…` |
| MandateVaultFactory | `0x…` |
| StockAMM | `0x…` |
| PriceOracle | `0x…` |
| USDG / TSLA / AMZN / PLTR / NFLX / AMD | `0x…` |

## Agent & web
- `agent/` — see [agent/README.md](./agent/README.md). `npm i && npm start`.
- `web/` — see [web/README.md](./web/README.md). `npm i && npm run dev` (demo mode works with no deployment).

## Honest fallbacks (so no testnet dependency hard-blocks the demo)
1. **Agent authority:** ships with a plain scoped EOA session key; swap in an Alchemy ERC-4337
   session key + Gas Manager for sponsored gas (security identical, only gas UX changes).
2. **Execution:** in-repo `StockAMM` seeded from faucet tokens instead of an unconfirmed external DEX.
3. **Prices:** owner-set mock behind the real Chainlink interface if stock feeds are absent on RH testnet.
