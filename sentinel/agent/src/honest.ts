import { wallet, goodCp } from "./chain.js";
import { attemptSpend, logVerdict } from "./runner.js";

/** HonestAgent — small, in-policy spends to a reputable counterparty. SENTINEL authorizes. */
export async function runHonest(rounds = 8, delayMs = 2500): Promise<void> {
  const { account, client } = wallet("HONEST_KEY");
  for (let i = 0; i < rounds; i++) {
    const amount = BigInt(5_000_000 + Math.floor(Math.random() * 15) * 1_000_000); // $5–$20
    const v = await attemptSpend(client, account, account.address, goodCp, amount);
    logVerdict("HONEST", amount, v);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runHonest().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
