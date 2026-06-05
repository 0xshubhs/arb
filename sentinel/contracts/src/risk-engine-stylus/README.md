# RiskEngine — Stylus (Rust/WASM) kernel

The compute-heavy risk scorer, written in Rust and compiled to WASM via Arbitrum **Stylus**.
It implements the **exact** algorithm of the Solidity twin (`../RiskTypes.sol :: RiskScoreLib`)
so both return identical `(allowed, score, reasonCode)` for every input.

- **Solidity twin** = verified standing fallback + gas-benchmark baseline.
- **This kernel** = the "why Arbitrum" moat — the same scoring, cheaper per call.

## Prerequisites
```bash
cargo install cargo-stylus       # one-time
rustup target add wasm32-unknown-unknown
```

## Build / check / deploy
```bash
cd src/risk-engine-stylus
cargo stylus check
cargo stylus deploy \
  --endpoint $ARB_SEPOLIA_RPC \
  --private-key $DEPLOYER_PRIVATE_KEY
# record the deployed address into contracts/.env as RISK_ENGINE_STYLUS
```

## Parity & benchmark
1. Deploy this kernel **and** `RiskEngine.sol`.
2. Feed both the shared test vectors (see `test/RiskParity.t.sol`) and assert equal verdicts.
3. `forge snapshot` the Solidity `scorePure`; compare against the Stylus call gas from
   `cast estimate <stylus_addr> "scorePure(...)"`. Publish the delta in the README + Proof panel.

> If the WASM toolchain fights back, ship the Solidity twin (the standing fallback) and keep
> Stylus as upside — the security story is identical either way.
