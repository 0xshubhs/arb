# Stylus-vs-Solidity gas benchmark

The "why Arbitrum" thesis: the risk scorer is deliberately compute-heavy, and Arbitrum **Stylus**
(Rust/WASM) runs that compute cheaper than the EVM. The Solidity twin is the verified baseline; the
Stylus kernel (`src/risk-engine-stylus/`) implements the **identical** algorithm.

## Solidity baseline (measured)

Captured with `forge test --gas-report` / `forge snapshot` on the Solidity twin (forge 1.5.1):

| Function | Gas (avg) | Gas (max) | Notes |
|---|---:|---:|---|
| `scorePure(ScoreInput)` | ~2,075 | ~2,612 | the pure scoring core — the apples-to-apples compute |
| `checkSpend(...)` | ~29,891 | — | full stateful path incl. registry + ERC-8004 reads + state writes |

Reproduce:
```bash
forge test --gas-report | grep scorePure
forge snapshot                      # writes .gas-snapshot
```

## Stylus kernel — compiled & validated (measured 2026-06-10)

The Rust kernel **compiles to WASM and passes Arbitrum's on-chain activation simulation** against live
Arbitrum Sepolia (`cargo stylus check`). Measured artifacts:

| Metric | Value | Notes |
|---|---:|---|
| Raw WASM (`--release`) | 34,288 bytes | `target/wasm32-unknown-unknown/release/risk_engine_stylus.wasm` |
| Compressed contract size | 10,920 bytes (10.9 KB) | the deployable size — well under Stylus' ~24 KB cap |
| Activation data fee | ~0.000072 ETH | one-time on-chain activation cost (0.000086 ETH at the +20% bump) |

Reproduce (the kernel predates `cargo-stylus` 0.10.x and has loose dep specs, so two pins are needed):
```bash
cd src/risk-engine-stylus
rustup target add wasm32-unknown-unknown                 # for the toolchain you build with
cargo update -p ruint --precise 1.12.3                   # avoid ruint 1.18's const-eval break on new rustc
cargo build --release --target wasm32-unknown-unknown    # -> risk_engine_stylus.wasm
cargo stylus check \
  --wasm-file target/wasm32-unknown-unknown/release/risk_engine_stylus.wasm \
  --endpoint https://sepolia-rollup.arbitrum.io/rpc      # prints size + activation data fee
```
> `cargo stylus check` prints `missing Stylus.toml` *after* it reports size + data fee — that's a
> newer-tooling metadata artifact, not a validation failure; the activation simulation has already
> passed by then.

## Per-call execution gas (the head-to-head number — needs a deploy)

`cargo stylus check` proves the kernel activates but does **not** run `scorePure`. The apples-to-apples
execution-gas figure requires a deployed instance + an estimate against it:
```bash
cd src/risk-engine-stylus
cargo stylus deploy --endpoint $ARB_SEPOLIA_RPC --private-key $DEPLOYER_PRIVATE_KEY   # needs a funded key
# then estimate the same call on the deployed kernel:
cast estimate $RISK_ENGINE_STYLUS \
  "scorePure(uint256,uint256,uint256,uint256,uint256,uint256,uint16,uint16,uint16,bool)" \
  25000000 50000000 100000000 1000000000 900000000 1000000000 5000 70 30 false \
  --rpc-url $ARB_SEPOLIA_RPC
```
Publish the delta (Solidity gas − Stylus gas, and the % saving) here and in the web **Proof panel**.
The more factors the score blends, the larger the Stylus advantage — which is exactly the direction a
production risk engine grows. (At this small input count the Solidity core is already cheap, so the
Stylus win widens as the scorer gains factors.)

> **Status:** Solidity baseline measured & locked. Stylus kernel **compiles, compresses to 10.9 KB, and
> passes on-chain activation simulation** — confirmed deployable. The one remaining number is per-call
> execution gas, which needs a funded testnet deploy (or a local Stylus/nitro dev node). Until then the
> verified Solidity twin is the standing fallback (the suite builds and passes without WASM), so nothing
> in the demo depends on it.
