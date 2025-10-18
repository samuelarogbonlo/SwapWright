// Base Mainnet Token Addresses
export interface TokenInfo {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  name: string;
}

export const TOKENS = {
  ETH: {
    symbol: "ETH",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const,
    decimals: 18,
    name: "Ethereum"
  },
  WETH: {
    symbol: "WETH",
    address: "0x4200000000000000000000000000000000000006" as const,
    decimals: 18,
    name: "Wrapped Ether"
  },
  USDC: {
    symbol: "USDC",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const, // Native USDC on Base
    decimals: 6,
    name: "USD Coin"
  }
} as const;

const TOKEN_ALIASES: Record<string, TokenInfo[]> = {
  USDC: [
    {
      symbol: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
      decimals: 6,
      name: "USD Coin",
    },
    {
      symbol: "USDBC",
      address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" as const,
      decimals: 6,
      name: "USD Base Coin",
    },
  ],
};

export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return TOKENS[symbol.toUpperCase() as keyof typeof TOKENS];
}

export function getTokenVariants(symbol: string): TokenInfo[] {
  const upper = symbol.toUpperCase();
  const variants: TokenInfo[] = [];
  const baseToken = getTokenBySymbol(upper);
  if (baseToken) variants.push(baseToken);
  const aliases = TOKEN_ALIASES[upper];
  if (aliases) variants.push(...aliases);
  return variants;
}
