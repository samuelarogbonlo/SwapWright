import { parseUnits, encodeFunctionData } from "viem";
import { TOKENS } from "@/lib/tokens";
import { UNISWAP_CONTRACTS, SWAP_ROUTER_02_ABI } from "@/lib/uniswap";
import { validateSwapAddresses, deriveTokenAddress, checkRateLimit, logSecurityEvent } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const { tokenIn, tokenOut, amountIn, feeTier, minOutput, from } = await req.json();

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || from || 'anonymous';
    const rateLimit = checkRateLimit(ip, 10, 60000); // 10 swaps per minute
    if (!rateLimit.allowed) {
      logSecurityEvent({
        type: 'rate_limit',
        identifier: ip,
        reason: 'Swap build rate limit exceeded',
      });
      return Response.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s` },
        { status: 429 }
      );
    }

    if (!tokenIn || !tokenOut || !feeTier || !minOutput) {
      return Response.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Validate all swap addresses (router, tokens, spender)
    try {
      validateSwapAddresses({
        to: UNISWAP_CONTRACTS.SwapRouter02,
        tokenInSymbol: tokenIn.symbol,
        tokenOutSymbol: tokenOut.symbol,
        spender: UNISWAP_CONTRACTS.SwapRouter02,
      });
    } catch (error) {
      logSecurityEvent({
        type: 'invalid_contract',
        identifier: ip,
        reason: error instanceof Error ? error.message : 'Invalid contract',
        metadata: { tokenIn: tokenIn.symbol, tokenOut: tokenOut.symbol }
      });
      return Response.json({ error: error instanceof Error ? error.message : "Invalid contract address" }, { status: 403 });
    }

    const isSellingETH = tokenIn.symbol === "ETH";
    const isBuyingETH = tokenOut.symbol === "ETH";

    // Server-side address derivation (never trust client addresses)
    const poolTokenInAddress = (isSellingETH
      ? TOKENS.WETH.address
      : deriveTokenAddress(tokenIn.symbol)) as `0x${string}`;
    const poolTokenOutAddress = (isBuyingETH
      ? TOKENS.WETH.address
      : deriveTokenAddress(tokenOut.symbol)) as `0x${string}`;

    const amountWei = parseUnits(
      amountIn.toString(),
      isSellingETH ? 18 : tokenIn.decimals
    );

    // Build exactInputSingle calldata for SwapRouter02
    const swapCalldata = encodeFunctionData({
      abi: SWAP_ROUTER_02_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: poolTokenInAddress,
          tokenOut: poolTokenOutAddress,
          fee: feeTier,
          recipient: from as `0x${string}`,
          amountIn: amountWei,
          amountOutMinimum: BigInt(minOutput),
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    return Response.json({
      to: UNISWAP_CONTRACTS.SwapRouter02,
      data: swapCalldata,
      value: isSellingETH ? amountWei.toString() : "0",
      gas: "200000", // Conservative estimate, actual gas will be calculated by wallet
      tokenIn: {
        symbol: tokenIn.symbol,
        address: isSellingETH ? TOKENS.WETH.address : tokenIn.address,
      },
    });
  } catch (error) {
    console.error('build-swap failed:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to build swap' },
      { status: 500 }
    );
  }
}
