# SENTINEL — roadmap

SENTINEL is the trust rail under the agentic economy: bounded, on-chain spend authority that says NO
before an AI agent drains a wallet. Its customers are literally the rest of the gallery.

## Now (buildathon, shipped)
- `PolicyRegistry` (Policy NFT), `RiskEngine` (Solidity twin) with a 4-factor 0–100 composite score,
  `AgentGuard` (the hard NO + floor-wide kill switch), `ERC8004Reader` (real ERC-8004 `getSummary`
  read, normalized, graceful fallback).
- **Stylus (Rust/WASM) kernel** mirroring the Solidity scorer exactly; Solidity gas baseline measured.
- 33-test Foundry suite (scoring · integration reverts · reader fallback · reentrancy · fuzz parity).
- Three reference agents (honest/compromised/denylist) + driver + plain-English policy compiler.
- "Mission control" web console (Mandate Compiler · Live Floor · Proof panel).

## Next (post-submission, 2–4 weeks)
- Deploy on Arbitrum Sepolia + verify; deploy the **Stylus kernel** and publish the
  Stylus-vs-Solidity gas delta (see `contracts/BENCHMARK.md`).
- Point `ERC8004Reader` at the live registry (`0x8004B663…`) and resolve real counterparty agentIds.
- Ship as a **ZeroDev kernel validation module** so any ERC-4337 smart account gets the firewall as a drop-in.
- Wire the web write-paths (mint policy, kill switch, freeze) + live event streaming.

## Later (the platform)
- **Closed reputation loop:** blocked attempts post evidence to ERC-8004, degrading attacker reputation portably.
- **Policy templates marketplace:** shareable Policy NFTs ("Conservative Treasury", "DeFi Yield Bot") clonable in one tap.
- **Anomaly factor:** a Stylus-computed statistical deviation score on spend patterns.
- **Human-in-the-loop:** borderline scores (60–80) push a one-tap mobile approval instead of a hard revert.
- **Cross-deploy to Robinhood Chain** to guard agentic tokenized-stock spending — unifies both reserved-prize narratives (ties into `../mandate`).

## Traction signals
- Incremental commit history; published gas benchmark; drop-in SDK for AgentKit/ElizaOS.
- Public build log + 2-min demo; the firewall is self-demonstrating (judges watch agents get blocked live).
