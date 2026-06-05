export const agentGuardAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "score", type: "uint8" }],
  },
  { type: "function", name: "freeze", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unfreeze", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "frozen", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "funded",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "SpendExecuted",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "score", type: "uint8", indexed: false },
    ],
  },
  { type: "event", name: "FloorFrozen", inputs: [{ name: "frozen", type: "bool", indexed: false }] },
  // errors
  { type: "error", name: "SpendRejected", inputs: [{ name: "reasonCode", type: "uint8" }] },
  { type: "error", name: "FloorIsFrozen", inputs: [] },
  { type: "error", name: "ScopeExceeded", inputs: [] },
  { type: "error", name: "OnlySessionKey", inputs: [] },
  { type: "error", name: "SessionExpired", inputs: [] },
  { type: "error", name: "NoSession", inputs: [] },
  { type: "error", name: "InsufficientFunds", inputs: [] },
] as const;

export const riskEngineAbi = [
  {
    type: "function",
    name: "previewSpend",
    stateMutability: "view",
    inputs: [
      { name: "policyId", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "score", type: "uint8" },
      { name: "reasonCode", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "drawdownBpsOf",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "SpendChecked",
    inputs: [
      { name: "policyId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "allowed", type: "bool", indexed: false },
      { name: "score", type: "uint8", indexed: false },
      { name: "reasonCode", type: "uint8", indexed: false },
    ],
  },
] as const;

export const REASON_LABELS: Record<number, string> = {
  0: "OK",
  1: "CAP EXCEEDED",
  2: "DAILY CAP",
  3: "DRAWDOWN",
  4: "DENYLISTED COUNTERPARTY",
  5: "KILL SWITCH",
  6: "RISK THRESHOLD",
};
