import { parseUnits } from "viem";
import { getTokenBySymbol } from "@/lib/tokens";

export async function POST(req: Request) {
  const { tokenIn, tokenOut, amountIn, slippage, from } = await req.json();

  const srcToken = getTokenBySymbol(tokenIn);
  const dstToken = getTokenBySymbol(tokenOut);

  if (!srcToken || !dstToken) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  const amountWei = parseUnits(amountIn.toString(), srcToken.decimals);

  const swapUrl = new URL("https://api.0x.org/swap/v1/quote");
  swapUrl.searchParams.append("chainId", "84532"); // Base Sepolia
  swapUrl.searchParams.append("sellToken", srcToken.address);
  swapUrl.searchParams.append("buyToken", dstToken.address);
  swapUrl.searchParams.append("sellAmount", amountWei.toString());
  swapUrl.searchParams.append("takerAddress", from);
  swapUrl.searchParams.append("slippagePercentage", (slippage / 100).toString()); // 0x uses 0.01 for 1%

  const response = await fetch(swapUrl, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" }
  });

  if (!response.ok) {
    return Response.json({ error: "Failed to build swap" }, { status: 500 });
  }

  const swapData = await response.json();

  return Response.json({
    to: swapData.to,
    data: swapData.data,
    value: swapData.value,
    gas: swapData.estimatedGas
  });
}
