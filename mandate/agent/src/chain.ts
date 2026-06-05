import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env ${name}`);
  return v;
}

export const RPC_URL = env("RPC_URL", "https://rpc.testnet.chain.robinhood.com");
export const CHAIN_ID = Number(env("CHAIN_ID", "46630"));

export const VAULT_ADDRESS = env("VAULT_ADDRESS", "0x") as Address;
export const ORACLE_ADDRESS = env("ORACLE_ADDRESS", "0x") as Address;
export const AMM_ADDRESS = env("AMM_ADDRESS", "0x") as Address;

/** Robinhood Chain testnet — Arbitrum Orbit L2. */
export const robinhoodChain = defineChain({
  id: CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
});

export const publicClient = createPublicClient({ chain: robinhoodChain, transport: http(RPC_URL) });

// The agent's ONLY on-chain authority: a scoped session key. EOA path here is the documented
// fallback; substitute an Alchemy ERC-4337 session key + Gas Manager for sponsored gas.
const sessionKey = env("AGENT_SESSION_KEY") as Hex;
export const account = privateKeyToAccount(sessionKey);
export const walletClient = createWalletClient({ account, chain: robinhoodChain, transport: http(RPC_URL) });
