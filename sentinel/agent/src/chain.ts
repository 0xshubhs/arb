import "dotenv/config";
import { createPublicClient, createWalletClient, http, defineChain, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

export const RPC_URL = env("ARB_SEPOLIA_RPC", "https://sepolia-rollup.arbitrum.io/rpc");
export const CHAIN_ID = Number(env("CHAIN_ID", "421614"));
export const GUARD = env("AGENT_GUARD", "0x") as Address;
export const RISK_ENGINE = env("RISK_ENGINE", "0x") as Address;
export const LAND_REVERTS = (process.env.LAND_REVERTS ?? "true") === "true";

export const goodCp = env("GOOD_CP", "0x") as Address;
export const badCp = env("BAD_CP", "0x") as Address;
export const lowCp = env("LOW_CP", "0x") as Address;

export const arbitrumSepolia = defineChain({
  id: CHAIN_ID,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" } },
  testnet: true,
});

export const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC_URL) });

export function wallet(keyEnv: string) {
  const account = privateKeyToAccount(env(keyEnv) as Hex);
  const client = createWalletClient({ account, chain: arbitrumSepolia, transport: http(RPC_URL) });
  return { account, client };
}
