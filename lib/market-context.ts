// Market Context Service for real-time price data and market insights

interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  lastUpdated: Date;
}

interface MarketContext {
  prices: Record<string, TokenPrice>;
  volatility: 'low' | 'medium' | 'high';
  liquidityWarning?: string;
}

// Cache prices for 30 seconds
const CACHE_DURATION = 30000;
let priceCache: { data: MarketContext | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

/**
 * Fetch real-time token prices from CoinGecko API (free tier)
 */
export async function getMarketContext(tokens: string[]): Promise<MarketContext> {
  // Check cache
  const now = Date.now();
  if (priceCache.data && now - priceCache.timestamp < CACHE_DURATION) {
    return priceCache.data;
  }

  try {
    // Map token symbols to CoinGecko IDs
    const tokenIds: Record<string, string> = {
      ETH: 'ethereum',
      WETH: 'weth',
      USDC: 'usd-coin',
      USDBC: 'bridged-usd-coin-base',
    };

    const ids = tokens.map(t => tokenIds[t]).filter(Boolean).join(',');

    if (!ids) {
      throw new Error('No valid token IDs');
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { next: { revalidate: 30 } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch prices');
    }

    const data = await response.json();

    // Transform to our format
    const prices: Record<string, TokenPrice> = {};
    for (const [symbol, id] of Object.entries(tokenIds)) {
      if (data[id]) {
        prices[symbol] = {
          symbol,
          price: data[id].usd || 0,
          change24h: data[id].usd_24h_change || 0,
          volume24h: data[id].usd_24h_vol || 0,
          lastUpdated: new Date(),
        };
      }
    }

    // Calculate volatility
    const avgChange = Object.values(prices).reduce((sum, p) => sum + Math.abs(p.change24h), 0) / Object.values(prices).length;
    const volatility = avgChange > 10 ? 'high' : avgChange > 5 ? 'medium' : 'low';

    const marketContext: MarketContext = {
      prices,
      volatility,
    };

    // Update cache
    priceCache = {
      data: marketContext,
      timestamp: now,
    };

    return marketContext;
  } catch (error) {
    console.error('Failed to fetch market context:', error);

    // Return fallback data
    return {
      prices: {},
      volatility: 'medium',
    };
  }
}

/**
 * Generate market insights text for AI copilot
 */
export function generateMarketInsights(
  tokenIn: string,
  tokenOut: string,
  marketContext: MarketContext
): string {
  const insights: string[] = [];

  const inPrice = marketContext.prices[tokenIn];
  const outPrice = marketContext.prices[tokenOut];

  if (inPrice) {
    const changeText = inPrice.change24h >= 0 ? 'up' : 'down';
    const changeAbs = Math.abs(inPrice.change24h).toFixed(2);
    insights.push(`${tokenIn} is ${changeText} ${changeAbs}% in the last 24h`);
  }

  if (outPrice) {
    const changeText = outPrice.change24h >= 0 ? 'up' : 'down';
    const changeAbs = Math.abs(outPrice.change24h).toFixed(2);
    insights.push(`${tokenOut} is ${changeText} ${changeAbs}% in the last 24h`);
  }

  if (marketContext.volatility === 'high') {
    insights.push('High volatility detected - consider increasing slippage tolerance');
  }

  return insights.join('. ');
}

/**
 * Assess swap risk based on market conditions
 */
export function assessSwapRisk(
  amount: string,
  tokenIn: string,
  tokenOut: string,
  marketContext: MarketContext,
  priceImpact?: number
): {
  level: 'low' | 'medium' | 'high';
  warnings: string[];
} {
  const warnings: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // Check price impact
  if (priceImpact && priceImpact > 5) {
    warnings.push(`High price impact (${priceImpact.toFixed(2)}%) - your trade may move the market significantly`);
    riskLevel = 'high';
  } else if (priceImpact && priceImpact > 2) {
    warnings.push(`Moderate price impact (${priceImpact.toFixed(2)}%)`);
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }

  // Check volatility
  if (marketContext.volatility === 'high') {
    warnings.push('High market volatility - prices may change rapidly');
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }

  // Check token price changes
  const inPrice = marketContext.prices[tokenIn];
  if (inPrice && Math.abs(inPrice.change24h) > 10) {
    warnings.push(`${tokenIn} has moved ${Math.abs(inPrice.change24h).toFixed(1)}% today - consider timing`);
    riskLevel = 'medium';
  }

  // Large trade check (>$10k USD)
  if (inPrice) {
    const usdValue = parseFloat(amount) * inPrice.price;
    if (usdValue > 10000) {
      warnings.push('Large trade detected - consider splitting into smaller trades');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }
  }

  return { level: riskLevel, warnings };
}

/**
 * Generate suggested next actions after swap
 */
export function generateSuggestedActions(
  tokenOut: string,
  amount: string,
  marketContext: MarketContext
): string[] {
  const suggestions: string[] = [];

  const outPrice = marketContext.prices[tokenOut];

  if (tokenOut === 'USDC' || tokenOut === 'USDBC') {
    suggestions.push('Want to stake your USDC on Aave to earn yield?');
    suggestions.push('Set a price alert to swap back when conditions are favorable?');
  } else if (tokenOut === 'ETH' || tokenOut === 'WETH') {
    suggestions.push('Consider staking your ETH for passive rewards');
    if (outPrice && outPrice.change24h < -5) {
      suggestions.push('ETH is down today - might be a good time to hold or buy more');
    }
  }

  // Generic suggestions
  suggestions.push('Want to swap another token?');
  suggestions.push('Need help understanding the transaction details?');

  return suggestions.slice(0, 3); // Return top 3
}
