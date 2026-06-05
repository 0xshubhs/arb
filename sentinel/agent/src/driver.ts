import { runHonest } from "./honest.js";
import { runCompromised } from "./compromised.js";
import { runDenylist } from "./denylist.js";

/**
 * Runs all three reference agents in parallel against the live dashboard, so the firewall is
 * self-demonstrating: one lane sails through green, one gets slammed REVERTED, one is blocked on
 * counterparty trust — all on-chain, no human in the loop.
 */
async function main() {
  console.log("SENTINEL floor: launching HonestAgent, CompromisedAgent, DenylistAgent in parallel…");
  await Promise.all([runHonest(), runCompromised(), runDenylist()]);
  console.log("Floor run complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
