export const SWAP_TOOL = {
  name: "execute_defi_swap",
  description: "Execute a token swap on Base Sepolia",
  input_schema: {
    type: "object",
    properties: {
      token_in: {
        type: "string",
        description: "Input token symbol (ETH, WETH, USDC)"
      },
      token_out: {
        type: "string",
        description: "Output token symbol"
      },
      amount_in: {
        type: "number",
        description: "Amount to swap (human-readable, e.g. 0.1 for 0.1 ETH)"
      },
      slippage_tolerance: {
        type: "number",
        description: "Max slippage percentage (default 1%)",
        default: 1
      }
    },
    required: ["token_in", "token_out", "amount_in"]
  }
} as const;
