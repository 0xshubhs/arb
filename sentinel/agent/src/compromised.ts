import { wallet, goodCp } from "./chain.js";
import { attemptSpend, logVerdict } from "./runner.js";

/**
 * CompromisedAgent — prompt-injected to drain the wallet. Fires rapid, high-value transfers that
 * trip the velocity / daily / drawdown limits. SENTINEL reverts each; the gauge spikes red.
 */
export async function runCompromised(rounds = 8, delayMs = 1500): Promise<void> {
  const { account, client } = wallet("COMPROMISED_KEY");
  for (let i = 0; i < rounds; i++) {
    // Escalating drain attempts, well over the per-tx cap.
    const amount = BigInt((80 + i * 40) * 1_000_000); // $80, $120, $160, ...
    const v = await attemptSpend(client, account, account.address, goodCp, amount);
    logVerdict("COMPROMISED", amount, v);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCompromised().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
