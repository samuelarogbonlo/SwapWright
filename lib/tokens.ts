// Base Sepolia Token Addresses
export const TOKENS = {
  ETH: {
    symbol: "ETH",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    decimals: 18,
    name: "Ethereum"
  },
  WETH: {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    name: "Wrapped Ether"
  },
  USDC: {
    symbol: "USDC",
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
    name: "USD Coin"
  }
} as const;

export function getTokenBySymbol(symbol: string) {
  return TOKENS[symbol.toUpperCase() as keyof typeof TOKENS];
}
