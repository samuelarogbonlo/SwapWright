import { TOKENS, getTokenVariants, TokenInfo } from "@/lib/tokens";
import { parseUnits, formatUnits, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { UNISWAP_CONTRACTS, QUOTER_V2_ABI, FEE_TIERS, DEFAULT_SLIPPAGE, getBaseRpcUrl } from "@/lib/uniswap";

// Cache quotes to avoid rate limits
const quoteCache = new Map();

// Create public client for reading from blockchain
const publicClient = createPublicClient({
  chain: base,
  transport: http(getBaseRpcUrl()),
});

export async function POST(req: Request) {
  try {
    const { tokenIn, tokenOut, amountIn } = await req.json();

    // Check cache first (30 second TTL)
    const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}`;
    const cached = quoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return Response.json(cached.quote);
    }

    const srcVariants = getTokenVariants(tokenIn);
    const dstVariants = getTokenVariants(tokenOut);

    if (!srcVariants.length || !dstVariants.length) {
      return Response.json({ error: "Invalid token" }, { status: 400 });
    }

    // Try fee tiers in order: 500 (0.05%), 3000 (0.3%), 10000 (1%)
    let bestQuote: {
      amountOut: bigint;
      gasEstimate: bigint;
      fee: number;
      tokenIn: TokenInfo;
      poolTokenIn: TokenInfo;
      tokenOut: TokenInfo;
      poolTokenOut: TokenInfo;
      amountWei: bigint;
    } | null = null;

    const feeTiers = [FEE_TIERS.LOW, FEE_TIERS.MEDIUM, FEE_TIERS.HIGH];

    for (const srcToken of srcVariants) {
      for (const dstToken of dstVariants) {
        const isSrcETH = srcToken.symbol === "ETH";
        const isDstETH = dstToken.symbol === "ETH";

        const poolTokenIn = isSrcETH ? TOKENS.WETH : srcToken;
        const poolTokenOut = isDstETH ? TOKENS.WETH : dstToken;

        const amountWei = parseUnits(
          amountIn.toString(),
          isSrcETH ? 18 : srcToken.decimals
        );

        for (const fee of feeTiers) {
          try {
            const result = await publicClient.readContract({
              address: UNISWAP_CONTRACTS.QuoterV2 as `0x${string}`,
              abi: QUOTER_V2_ABI,
              functionName: "quoteExactInputSingle",
              args: [
                {
                  tokenIn: poolTokenIn.address,
                  tokenOut: poolTokenOut.address,
                  amountIn: amountWei,
                  fee: fee,
                  sqrtPriceLimitX96: 0n,
                },
              ],
            });

            const [amountOut, , , gasEstimate] = result;

            if (!bestQuote || amountOut > bestQuote.amountOut) {
              bestQuote = {
                amountOut,
                gasEstimate,
                fee,
                tokenIn: srcToken,
                poolTokenIn,
                tokenOut: dstToken,
                poolTokenOut,
                amountWei,
              };
            }
          } catch (error) {
            console.error(`Quoter failed for ${srcToken.symbol}->${dstToken.symbol} fee ${fee}:`, error);
            continue;
          }
        }
      }
    }

    if (!bestQuote) {
      return Response.json(
        { error: "No liquidity pool found for this token pair" },
        { status: 404 }
      );
    }

    // Calculate minimum amount out with slippage
    const minAmountOut =
      (bestQuote.amountOut * BigInt(Math.floor((1 - DEFAULT_SLIPPAGE) * 10000))) /
      10000n;

    const responseData = {
      expectedOutput: bestQuote.amountOut.toString(),
      minOutput: minAmountOut.toString(),
      estimatedGas: bestQuote.gasEstimate.toString(),
      feeTier: bestQuote.fee,
      price:
        Number(formatUnits(bestQuote.amountOut, bestQuote.poolTokenOut.decimals)) /
        Number(amountIn),
      tokenIn: {
        symbol: bestQuote.tokenIn.symbol,
        address: bestQuote.tokenIn.address,
        decimals: bestQuote.tokenIn.decimals,
        poolAddress: bestQuote.poolTokenIn.address,
        poolDecimals: bestQuote.poolTokenIn.decimals,
      },
      tokenOut: {
        symbol: bestQuote.tokenOut.symbol,
        address: bestQuote.tokenOut.address,
        decimals: bestQuote.tokenOut.decimals,
        poolAddress: bestQuote.poolTokenOut.address,
        poolDecimals: bestQuote.poolTokenOut.decimals,
      },
    };

    // Cache the result
    quoteCache.set(cacheKey, { quote: responseData, timestamp: Date.now() });

    return Response.json(responseData);
  } catch (error) {
    console.error('get-quote failed:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to get quote' },
      { status: 500 }
    );
  }
}
