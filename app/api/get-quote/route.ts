import { getTokenBySymbol } from "@/lib/tokens";
import { parseUnits } from "viem";

// Cache quotes to avoid rate limits
const quoteCache = new Map();

export async function POST(req: Request) {
  const { tokenIn, tokenOut, amountIn } = await req.json();

  // Check cache first (30 second TTL)
  const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return Response.json(cached.quote);
  }

  const srcToken = getTokenBySymbol(tokenIn);
  const dstToken = getTokenBySymbol(tokenOut);

  if (!srcToken || !dstToken) {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }

  // Use viem's parseUnits for proper decimal handling
  const amountWei = parseUnits(amountIn.toString(), srcToken.decimals);

  const quoteUrl = new URL("https://api.0x.org/swap/v1/quote");
  quoteUrl.searchParams.append("chainId", "84532"); // Base Sepolia
  quoteUrl.searchParams.append("sellToken", srcToken.address);
  quoteUrl.searchParams.append("buyToken", dstToken.address);
  quoteUrl.searchParams.append("sellAmount", amountWei.toString());

  const response = await fetch(quoteUrl, {
    headers: { "0x-api-key": process.env.ZEROX_API_KEY || "" }
  });

  if (!response.ok) {
    return Response.json({ error: "Failed to get quote" }, { status: 500 });
  }

  const quote = await response.json();

  const result = {
    expectedOutput: quote.buyAmount,
    estimatedGas: quote.estimatedGas,
    price: quote.price
  };

  // Cache the result
  quoteCache.set(cacheKey, { quote: result, timestamp: Date.now() });

  return Response.json(result);
}
