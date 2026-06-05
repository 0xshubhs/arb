import "dotenv/config";
import { type Address } from "viem";
import {
  publicClient,
  walletClient,
  account,
  VAULT_ADDRESS,
  ORACLE_ADDRESS,
  AMM_ADDRESS,
} from "./chain.js";
import { mandateVaultAbi, oracleAbi, ammAbi, erc20Abi } from "./abi.js";
import { solveRebalance, type AssetInfo, type Policy, type Swap } from "./solver.js";
import { buildRationale } from "./rationale.js";

const POLL = Number(process.env.POLL_INTERVAL_SECONDS ?? "60") * 1000;
const SLIPPAGE_BUFFER_BPS = 50n; // ask for slightly less than quote to avoid AMM-level reverts

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function readPolicy(): Promise<Policy> {
  const p = (await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: mandateVaultAbi,
    functionName: "getPolicy",
  })) as any;
  return {
    allowedAssets: p.allowedAssets as Address[],
    targetWeightsBps: (p.targetWeightsBps as number[]).map(Number),
    maxDriftBps: Number(p.maxDriftBps),
    perTradeCapUsdg: p.perTradeCapUsdg as bigint,
    perDayCapUsdg: p.perDayCapUsdg as bigint,
    maxSlippageBps: Number(p.maxSlippageBps),
    windowStart: p.windowStart as bigint,
    windowEnd: p.windowEnd as bigint,
  };
}

async function readAssets(policy: Policy, usdg: Address): Promise<{ usdgDecimals: number; assets: AssetInfo[] }> {
  const usdgDecimals = Number(
    await publicClient.readContract({ address: usdg, abi: erc20Abi, functionName: "decimals" }),
  );
  const assets: AssetInfo[] = [];
  for (const token of policy.allowedAssets) {
    const [decimals, price1e8, balance] = await Promise.all([
      publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address: ORACLE_ADDRESS, abi: oracleAbi, functionName: "priceOf", args: [token] }),
      publicClient.readContract({ address: VAULT_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [VAULT_ADDRESS] }),
    ]);
    assets.push({ token, decimals: Number(decimals), price1e8: price1e8 as bigint, balance: balance as bigint });
  }
  return { usdgDecimals, assets };
}

async function quoteMinOut(swap: Swap): Promise<bigint> {
  try {
    const out = (await publicClient.readContract({
      address: AMM_ADDRESS,
      abi: ammAbi,
      functionName: "quote",
      args: [swap.tokenIn, swap.tokenOut, swap.amountIn],
    })) as bigint;
    return (out * (10_000n - SLIPPAGE_BUFFER_BPS)) / 10_000n;
  } catch {
    return 0n;
  }
}

async function tick(): Promise<void> {
  const usdg = (await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: mandateVaultAbi,
    functionName: "usdg",
  })) as Address;

  const policy = await readPolicy();
  const { usdgDecimals, assets } = await readAssets(policy, usdg);
  const plan = solveRebalance(usdg, usdgDecimals, assets, policy);

  if (plan.swaps.length === 0) {
    log(`no action — ${plan.note}`);
    return;
  }

  for (const s of plan.swaps) s.minOut = await quoteMinOut(s);
  const { text, hash } = await buildRationale(plan);
  log(`proposing ${plan.swaps.length} swap(s): ${text}`);

  try {
    const txHash = await walletClient.writeContract({
      address: VAULT_ADDRESS,
      abi: mandateVaultAbi,
      functionName: "rebalance",
      args: [plan.swaps, hash],
      account,
    });
    const rcpt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    log(`EXECUTED rebalance in block ${rcpt.blockNumber} (${txHash})`);
  } catch (err) {
    // The contract said NO. Do not blind-retry — log the REVERTED row and move on.
    log("REVERTED — blocked by policy:", (err as Error).message.split("\n")[0]);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  log(`Mandate agent starting. session key ${account.address}, vault ${VAULT_ADDRESS}`);
  do {
    try {
      await tick();
    } catch (err) {
      log("tick error:", (err as Error).message);
    }
    if (!once) await new Promise((r) => setTimeout(r, POLL));
  } while (!once);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
