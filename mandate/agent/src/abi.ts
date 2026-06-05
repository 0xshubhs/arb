// Minimal ABIs the agent needs. Full ABIs live in contracts/out after `forge build`.

export const mandateVaultAbi = [
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "allowedAssets", type: "address[]" },
          { name: "targetWeightsBps", type: "uint16[]" },
          { name: "maxDriftBps", type: "uint16" },
          { name: "perTradeCapUsdg", type: "uint256" },
          { name: "perDayCapUsdg", type: "uint256" },
          { name: "maxSlippageBps", type: "uint16" },
          { name: "windowStart", type: "uint64" },
          { name: "windowEnd", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getWeights",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "weightsBps", type: "uint256[]" },
      { name: "totalStockValue", type: "uint256" },
    ],
  },
  { type: "function", name: "usdg", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "remainingDailyCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "rebalance",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "swaps",
        type: "tuple[]",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minOut", type: "uint256" },
        ],
      },
      { name: "rationaleHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "autopilotBuy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "stockOut", type: "address" },
      { name: "usdgAmount", type: "uint256" },
      { name: "minOut", type: "uint256" },
      { name: "rationaleHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Rebalanced",
    inputs: [
      { name: "nonce", type: "uint256", indexed: true },
      { name: "preWeightsBps", type: "int256[]", indexed: false },
      { name: "postWeightsBps", type: "int256[]", indexed: false },
      { name: "oraclePrices", type: "uint256[]", indexed: false },
      { name: "notionalUsdg", type: "uint256", indexed: false },
      { name: "rationaleHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const oracleAbi = [
  {
    type: "function",
    name: "priceOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const ammAbi = [
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;
