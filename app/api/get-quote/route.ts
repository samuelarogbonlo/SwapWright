import { TOKENS, getTokenVariants, TokenInfo } from "@/lib/tokens";
import { parseUnits, formatUnits, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { UNISWAP_CONTRACTS, QUOTER_V2_ABI, FEE_TIERS, DEFAULT_SLIPPAGE } from "@/lib/uniswap";
import { checkRateLimit, logSecurityEvent } from "@/lib/security";
import { getPrimaryRPCUrl } from "@/lib/rpc-provider";

// Cache quotes to avoid rate limits
const quoteCache = new Map();

// Create resilient public client with RPC failover support
function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(getPrimaryRPCUrl(), {
      retryCount: 3,
      retryDelay: 100,
    }),
  });
}

export async function POST(req: Request) {
  try {
    const { tokenIn, tokenOut, amountIn, slippage } = await req.json();

    const slippageDecimal =
      typeof slippage === 'number'
        ? Math.max(0, Math.min(slippage / 100, 0.5))
        : DEFAULT_SLIPPAGE;

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
    const rateLimit = checkRateLimit(ip, 30, 60000); // 30 requests per minute
    if (!rateLimit.allowed) {
      logSecurityEvent({
        type: 'rate_limit',
        identifier: ip,
        reason: 'Quote rate limit exceeded',
      });
      return Response.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s` },
        { status: 429 }
      );
    }

    // Check cache first (30 second TTL)
    const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}-${slippageDecimal}`;
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
          // Retry logic with exponential backoff
          let retries = 0;
          const maxRetries = 2;

          while (retries <= maxRetries) {
            try {
              const publicClient = getPublicClient();
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
              }) as readonly [bigint, bigint, bigint, bigint];

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
              break; // Success, exit retry loop
            } catch (error) {
              retries++;
              if (retries > maxRetries) {
                console.error(`Quoter failed for ${srcToken.symbol}->${dstToken.symbol} fee ${fee} after ${maxRetries} retries:`, error);
                break;
              }
              // Exponential backoff: 100ms, 200ms
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
            }
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
      (bestQuote.amountOut * BigInt(Math.floor((1 - slippageDecimal) * 10000))) /
      10000n;

    // Calculate actual execution price
    const actualPrice =
      Number(formatUnits(bestQuote.amountOut, bestQuote.poolTokenOut.decimals)) /
      Number(amountIn);

    // For price impact calculation, we would need to fetch the spot price from an oracle
    // For now, we estimate it based on the trade size relative to a typical pool depth
    // A more accurate implementation would query Uniswap pool reserves or use a price oracle
    // Price impact estimation: larger trades have higher impact
    const amountInUSD = Number(amountIn) * 4000; // Rough ETH price for estimation
    let priceImpact = 0;

    if (amountInUSD > 1000000) {
      priceImpact = 0.5; // >$1M: significant impact
    } else if (amountInUSD > 100000) {
      priceImpact = 0.2; // >$100k: moderate impact
    } else if (amountInUSD > 10000) {
      priceImpact = 0.05; // >$10k: small impact
    } else {
      priceImpact = 0.01; // <$10k: minimal impact
    }

    const responseData = {
      expectedOutput: bestQuote.amountOut.toString(),
      minOutput: minAmountOut.toString(),
      estimatedGas: bestQuote.gasEstimate.toString(),
      feeTier: bestQuote.fee,
      price: actualPrice,
      priceImpact,
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
