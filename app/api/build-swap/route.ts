import { parseUnits, encodeFunctionData } from "viem";
import { TOKENS } from "@/lib/tokens";
import { UNISWAP_CONTRACTS, SWAP_ROUTER_02_ABI } from "@/lib/uniswap";

export async function POST(req: Request) {
  try {
    const { tokenIn, tokenOut, amountIn, feeTier, minOutput, from } = await req.json();

    if (!tokenIn || !tokenOut || !feeTier || !minOutput) {
      return Response.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const isSellingETH = tokenIn.symbol === "ETH";
    const isBuyingETH = tokenOut.symbol === "ETH";

    const poolTokenInAddress = isSellingETH
      ? TOKENS.WETH.address
      : (tokenIn.poolAddress as `0x${string}`);
    const poolTokenOutAddress = isBuyingETH
      ? TOKENS.WETH.address
      : (tokenOut.poolAddress as `0x${string}`);

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
