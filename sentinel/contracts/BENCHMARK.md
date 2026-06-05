# Stylus-vs-Solidity gas benchmark

The "why Arbitrum" thesis: the risk scorer is deliberately compute-heavy, and Arbitrum **Stylus**
(Rust/WASM) runs that compute cheaper than the EVM. The Solidity twin is the verified baseline; the
Stylus kernel (`src/risk-engine-stylus/`) implements the **identical** algorithm.

## Solidity baseline (measured)

Captured with `forge test --gas-report` / `forge snapshot` on the Solidity twin:

| Function | Gas (avg) | Gas (max) | Notes |
|---|---:|---:|---|
| `scorePure(ScoreInput)` | ~2,073 | ~2,612 | the pure scoring core — the apples-to-apples compute |
| `checkSpend(...)` | ~29,891 | — | full stateful path incl. registry + ERC-8004 reads + state writes |

Reproduce:
```bash
forge test --gas-report | grep scorePure
forge snapshot                      # writes .gas-snapshot
```

## Stylus number (capture after deploy)

```bash
cd src/risk-engine-stylus
cargo stylus deploy --endpoint $ARB_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY
# then estimate the same call on the deployed kernel:
cast estimate $RISK_ENGINE_STYLUS \
  "scorePure(uint256,uint256,uint256,uint256,uint256,uint256,uint16,uint16,uint16,bool)" \
  25000000 50000000 100000000 1000000000 900000000 1000000000 5000 70 30 false \
  --rpc-url $ARB_SEPOLIA_RPC
```

Publish the delta (Solidity gas − Stylus gas, and the % saving) here and in the web **Proof panel**.
The more factors the score blends, the larger the Stylus advantage — which is exactly the direction a
production risk engine grows.

> **Status:** Solidity baseline is measured and locked. The Stylus figure is pending a deploy with
> `cargo-stylus` installed; until then the verified Solidity twin is the standing fallback (the suite
> builds and passes without WASM), so nothing in the demo depends on it.
