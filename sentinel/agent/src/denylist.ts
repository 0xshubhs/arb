import { wallet, badCp, lowCp } from "./chain.js";
import { attemptSpend, logVerdict } from "./runner.js";

/**
 * DenylistAgent — tries to pay counterparties below the reputation threshold: one locally
 * denylisted, one with low ERC-8004 reputation read live from the Arbitrum registry. Both blocked.
 */
export async function runDenylist(rounds = 8, delayMs = 2000): Promise<void> {
  const { account, client } = wallet("DENYLIST_KEY");
  const targets = [badCp, lowCp];
  for (let i = 0; i < rounds; i++) {
    const to = targets[i % targets.length];
    const amount = 10_000_000n; // $10 — well within caps; only counterparty trust fails
    const v = await attemptSpend(client, account, account.address, to, amount);
    logVerdict("DENYLIST", amount, v);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDenylist().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
