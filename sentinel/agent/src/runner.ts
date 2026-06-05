import {
  BaseError,
  ContractFunctionRevertedError,
  type Account,
  type Address,
  type WalletClient,
} from "viem";
import { publicClient, GUARD, LAND_REVERTS } from "./chain.js";
import { agentGuardAbi, REASON_LABELS } from "./abi.js";

export interface Verdict {
  ok: boolean;
  score?: number;
  reason?: string;
  hash?: `0x${string}`;
}

/** Decode a revert into a human label using the AgentGuard error ABI. */
function decodeReason(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name === "SpendRejected") {
        const code = Number((revert.data?.args?.[0] as bigint | number) ?? 0);
        return REASON_LABELS[code] ?? `REJECTED(${code})`;
      }
      if (name) return name; // ScopeExceeded / FloorIsFrozen / SessionExpired / ...
    }
  }
  return "REVERTED";
}

/**
 * Attempt a guarded spend. Simulates first to read the verdict; authorized spends are sent and
 * confirmed, blocked spends optionally land on-chain as a real reverting tx (visible on Arbiscan).
 */
export async function attemptSpend(
  client: WalletClient,
  account: Account,
  agent: Address,
  to: Address,
  amount: bigint,
): Promise<Verdict> {
  try {
    const { result } = await publicClient.simulateContract({
      address: GUARD,
      abi: agentGuardAbi,
      functionName: "execute",
      args: [agent, to, amount],
      account,
    });
    const hash = await client.writeContract({
      address: GUARD,
      abi: agentGuardAbi,
      functionName: "execute",
      args: [agent, to, amount],
      account,
      chain: client.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return { ok: true, score: Number(result), hash };
  } catch (err) {
    const reason = decodeReason(err);
    let hash: `0x${string}` | undefined;
    if (LAND_REVERTS) {
      try {
        hash = await client.writeContract({
          address: GUARD,
          abi: agentGuardAbi,
          functionName: "execute",
          args: [agent, to, amount],
          account,
          chain: client.chain,
          gas: 400_000n, // skip estimation so the reverting tx actually lands on-chain
        });
        await publicClient.waitForTransactionReceipt({ hash });
      } catch {
        /* expected: the tx reverts on-chain */
      }
    }
    return { ok: false, reason, hash };
  }
}

const ts = () => new Date().toISOString();

export function logVerdict(tag: string, amount: bigint, v: Verdict): void {
  const usdc = (Number(amount) / 1e6).toFixed(2);
  if (v.ok) {
    console.log(`${ts()} [${tag}] AUTHORIZED  $${usdc}  score=${v.score}  ${v.hash ?? ""}`);
  } else {
    console.log(`${ts()} [${tag}] REVERTED    $${usdc}  reason=${v.reason}  ${v.hash ?? ""}`);
  }
}
