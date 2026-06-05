import type { Address } from "viem";

export interface Policy {
  allowedAssets: Address[];
  targetWeightsBps: number[];
  maxDriftBps: number;
  perTradeCapUsdg: bigint;
  perDayCapUsdg: bigint;
  maxSlippageBps: number;
  windowStart: bigint;
  windowEnd: bigint;
}

export interface AssetInfo {
  token: Address;
  decimals: number;
  price1e8: bigint; // USDG per whole stock, 1e8-scaled
  balance: bigint; // vault holding in base units
}

export interface Swap {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minOut: bigint; // filled in by the caller after quoting
}

const BPS = 10_000n;

/** USDG (6dp) value of `amount` base units of a stock. */
export function usdgValue(amount: bigint, decimals: number, price1e8: bigint, usdgDecimals: number): bigint {
  const scale = 10n ** BigInt(decimals + 8 - usdgDecimals);
  return (amount * price1e8) / scale;
}

/** Convert a USDG (6dp) notional into base units of a stock at oracle price. */
export function usdgToStock(usdg: bigint, decimals: number, price1e8: bigint, usdgDecimals: number): bigint {
  const scale = 10n ** BigInt(decimals + 8 - usdgDecimals);
  return (usdg * scale) / price1e8;
}

export interface Plan {
  swaps: Swap[];
  maxDriftBps: number;
  note: string;
}

/**
 * Compute minimal, policy-legal swaps that move the basket toward target. The contract is the
 * source of truth — it re-checks every guardrail and reverts illegal trades — so the solver only
 * needs to *propose* drift-reducing swaps, splitting any leg that would exceed the per-trade cap.
 */
export function solveRebalance(
  usdgAddress: Address,
  usdgDecimals: number,
  assets: AssetInfo[],
  policy: Policy,
): Plan {
  const values = assets.map((a) => usdgValue(a.balance, a.decimals, a.price1e8, usdgDecimals));
  const total = values.reduce((s, v) => s + v, 0n);
  if (total === 0n) return { swaps: [], maxDriftBps: 0, note: "empty basket" };

  const weights = values.map((v) => Number((v * BPS) / total));
  const drifts = weights.map((w, i) => w - policy.targetWeightsBps[i]);
  const maxDrift = Math.max(...drifts.map((d) => Math.abs(d)));
  if (maxDrift <= policy.maxDriftBps) {
    return { swaps: [], maxDriftBps: maxDrift, note: `within band (${maxDrift}bps)` };
  }

  // Target USDG value per asset; positive delta = underweight (buy), negative = overweight (sell).
  const deltas = assets.map((_, i) => (BigInt(policy.targetWeightsBps[i]) * total) / BPS - values[i]);

  const sells: Swap[] = [];
  const buys: Swap[] = [];
  const cap = policy.perTradeCapUsdg;

  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const delta = deltas[i];
    if (delta < 0n) {
      // Overweight -> sell stock for USDG, in cap-sized chunks.
      let remaining = -delta;
      while (remaining > 0n) {
        const chunkUsdg = remaining > cap ? cap : remaining;
        const amountIn = usdgToStock(chunkUsdg, a.decimals, a.price1e8, usdgDecimals);
        if (amountIn === 0n) break;
        sells.push({ tokenIn: a.token, tokenOut: usdgAddress, amountIn, minOut: 0n });
        remaining -= chunkUsdg;
      }
    } else if (delta > 0n) {
      // Underweight -> buy stock with USDG, in cap-sized chunks.
      let remaining = delta;
      while (remaining > 0n) {
        const chunkUsdg = remaining > cap ? cap : remaining;
        buys.push({ tokenIn: usdgAddress, tokenOut: a.token, amountIn: chunkUsdg, minOut: 0n });
        remaining -= chunkUsdg;
      }
    }
  }

  // Sells first so the buys are funded from realized USDG.
  return { swaps: [...sells, ...buys], maxDriftBps: maxDrift, note: `drift ${maxDrift}bps -> rebalancing` };
}
