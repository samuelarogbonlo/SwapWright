// Risk Classifier for Swap Assessment
// Analyzes swap parameters and market conditions to assess risk

import { RISK_PATTERNS, RiskPattern } from './training-data';

export interface SwapRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: RiskFactor[];
  recommendations: string[];
  shouldProceed: boolean;
}

export interface RiskFactor {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  weight: number; // Contribution to overall risk score
}

export interface SwapParameters {
  tokenIn: string;
  tokenOut: string;
  amountUSD: number;
  slippage: number;
  priceImpact?: number;
  gasEstimateUSD?: number;
  marketVolatility?: number; // 24h price change %
  poolLiquidityUSD?: number;
}

/**
 * Comprehensive risk assessment for a swap
 */
export function assessSwapRisk(params: SwapParameters): SwapRiskAssessment {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // Factor 1: Trade size risk
  const tradeSizeRisk = assessTradeSize(params.amountUSD);
  if (tradeSizeRisk) {
    factors.push(tradeSizeRisk);
    totalScore += tradeSizeRisk.weight;
  }

  // Factor 2: Price impact risk
  if (params.priceImpact !== undefined) {
    const priceImpactRisk = assessPriceImpact(params.priceImpact);
    if (priceImpactRisk) {
      factors.push(priceImpactRisk);
      totalScore += priceImpactRisk.weight;
    }
  }

  // Factor 3: Slippage tolerance risk
  const slippageRisk = assessSlippage(params.slippage);
  if (slippageRisk) {
    factors.push(slippageRisk);
    totalScore += slippageRisk.weight;
  }

  // Factor 4: Market volatility risk
  if (params.marketVolatility !== undefined) {
    const volatilityRisk = assessVolatility(params.marketVolatility);
    if (volatilityRisk) {
      factors.push(volatilityRisk);
      totalScore += volatilityRisk.weight;
    }
  }

  // Factor 5: Pool liquidity risk
  if (params.poolLiquidityUSD !== undefined) {
    const liquidityRisk = assessLiquidity(params.poolLiquidityUSD, params.amountUSD);
    if (liquidityRisk) {
      factors.push(liquidityRisk);
      totalScore += liquidityRisk.weight;
    }
  }

  // Factor 6: Gas cost risk (for small trades)
  if (params.gasEstimateUSD !== undefined && params.amountUSD > 0) {
    const gasRisk = assessGasCost(params.gasEstimateUSD, params.amountUSD);
    if (gasRisk) {
      factors.push(gasRisk);
      totalScore += gasRisk.weight;
    }
  }

  // Determine overall risk level
  const riskLevel = getRiskLevel(totalScore);

  // Generate recommendations
  const recommendations = generateRecommendations(factors, params);

  // Determine if swap should proceed
  const shouldProceed = riskLevel !== 'critical';

  return {
    riskLevel,
    score: Math.min(100, totalScore),
    factors,
    recommendations,
    shouldProceed,
  };
}

function assessTradeSize(amountUSD: number): RiskFactor | null {
  if (amountUSD > 50000) {
    return {
      name: 'Very large trade',
      severity: 'critical',
      description: `Trade size of $${amountUSD.toLocaleString()} is extremely large`,
      weight: 40,
    };
  } else if (amountUSD > 10000) {
    return {
      name: 'Large trade',
      severity: 'high',
      description: `Trade size of $${amountUSD.toLocaleString()} may impact market significantly`,
      weight: 25,
    };
  } else if (amountUSD > 1000) {
    return {
      name: 'Moderate trade size',
      severity: 'medium',
      description: `Trade size of $${amountUSD.toLocaleString()} is moderate`,
      weight: 10,
    };
  }
  return null;
}

function assessPriceImpact(priceImpact: number): RiskFactor | null {
  if (priceImpact > 10) {
    return {
      name: 'Extreme price impact',
      severity: 'critical',
      description: `${priceImpact.toFixed(2)}% price impact will significantly move the market`,
      weight: 50,
    };
  } else if (priceImpact > 5) {
    return {
      name: 'High price impact',
      severity: 'high',
      description: `${priceImpact.toFixed(2)}% price impact detected`,
      weight: 30,
    };
  } else if (priceImpact > 2) {
    return {
      name: 'Moderate price impact',
      severity: 'medium',
      description: `${priceImpact.toFixed(2)}% price impact`,
      weight: 15,
    };
  } else if (priceImpact > 1) {
    return {
      name: 'Minor price impact',
      severity: 'low',
      description: `${priceImpact.toFixed(2)}% price impact`,
      weight: 5,
    };
  }
  return null;
}

function assessSlippage(slippage: number): RiskFactor | null {
  if (slippage > 10) {
    return {
      name: 'Very high slippage tolerance',
      severity: 'high',
      description: `${slippage}% slippage tolerance increases MEV/sandwich attack risk`,
      weight: 25,
    };
  } else if (slippage > 5) {
    return {
      name: 'High slippage tolerance',
      severity: 'medium',
      description: `${slippage}% slippage tolerance is higher than recommended`,
      weight: 15,
    };
  } else if (slippage > 2) {
    return {
      name: 'Elevated slippage',
      severity: 'low',
      description: `${slippage}% slippage tolerance`,
      weight: 5,
    };
  }
  return null;
}

function assessVolatility(volatility: number): RiskFactor | null {
  const absVolatility = Math.abs(volatility);

  if (absVolatility > 15) {
    return {
      name: 'Extreme market volatility',
      severity: 'high',
      description: `Token price moved ${volatility.toFixed(2)}% in 24h`,
      weight: 30,
    };
  } else if (absVolatility > 10) {
    return {
      name: 'High market volatility',
      severity: 'medium',
      description: `Token price moved ${volatility.toFixed(2)}% in 24h`,
      weight: 20,
    };
  } else if (absVolatility > 5) {
    return {
      name: 'Moderate volatility',
      severity: 'low',
      description: `Token price moved ${volatility.toFixed(2)}% in 24h`,
      weight: 10,
    };
  }
  return null;
}

function assessLiquidity(poolLiquidityUSD: number, tradeAmountUSD: number): RiskFactor | null {
  const tradeRatio = (tradeAmountUSD / poolLiquidityUSD) * 100;

  if (poolLiquidityUSD < 50000) {
    return {
      name: 'Very low pool liquidity',
      severity: 'critical',
      description: `Pool has only $${poolLiquidityUSD.toLocaleString()} liquidity`,
      weight: 40,
    };
  } else if (tradeRatio > 10) {
    return {
      name: 'Trade size vs liquidity mismatch',
      severity: 'high',
      description: `Trade is ${tradeRatio.toFixed(1)}% of pool liquidity`,
      weight: 30,
    };
  } else if (tradeRatio > 5) {
    return {
      name: 'Moderate liquidity concern',
      severity: 'medium',
      description: `Trade is ${tradeRatio.toFixed(1)}% of pool liquidity`,
      weight: 15,
    };
  }
  return null;
}

function assessGasCost(gasUSD: number, tradeAmountUSD: number): RiskFactor | null {
  const gasRatio = (gasUSD / tradeAmountUSD) * 100;

  if (gasRatio > 10) {
    return {
      name: 'Very high gas cost',
      severity: 'high',
      description: `Gas ($${gasUSD.toFixed(2)}) is ${gasRatio.toFixed(1)}% of trade value`,
      weight: 20,
    };
  } else if (gasRatio > 5) {
    return {
      name: 'High gas cost',
      severity: 'medium',
      description: `Gas ($${gasUSD.toFixed(2)}) is ${gasRatio.toFixed(1)}% of trade value`,
      weight: 10,
    };
  }
  return null;
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function generateRecommendations(
  factors: RiskFactor[],
  params: SwapParameters
): string[] {
  const recommendations: string[] = [];

  // Check for critical factors
  const hasCritical = factors.some(f => f.severity === 'critical');
  if (hasCritical) {
    recommendations.push('⚠️ Critical risk detected - strongly recommend not proceeding with this swap');
  }

  // Specific recommendations based on factors
  factors.forEach(factor => {
    const pattern = RISK_PATTERNS.find(p =>
      p.pattern.toLowerCase().includes(factor.name.toLowerCase().split(' ')[0])
    );
    if (pattern && !recommendations.includes(pattern.recommendation)) {
      recommendations.push(pattern.recommendation);
    }
  });

  // Trade size recommendations
  if (params.amountUSD > 10000) {
    recommendations.push('Consider splitting into multiple smaller trades to reduce market impact');
  }

  // Price impact recommendations
  if (params.priceImpact && params.priceImpact > 5) {
    recommendations.push('Reduce trade amount to lower price impact below 5%');
  }

  // Slippage recommendations
  if (params.slippage > 5) {
    recommendations.push('Lower slippage tolerance to reduce MEV risk (0.5-1% recommended)');
  }

  // Volatility recommendations
  if (params.marketVolatility && Math.abs(params.marketVolatility) > 10) {
    recommendations.push('Consider waiting for market to stabilize before executing');
  }

  // Always include a safety reminder for high-risk swaps
  if (factors.some(f => f.severity === 'high' || f.severity === 'critical')) {
    recommendations.push('Double-check all parameters before confirming transaction');
  }

  return recommendations;
}

/**
 * Quick risk check - returns true if swap is safe to proceed
 */
export function isSwapSafe(params: SwapParameters): boolean {
  const assessment = assessSwapRisk(params);
  return assessment.shouldProceed && assessment.riskLevel !== 'critical';
}

/**
 * Get human-readable risk summary
 */
export function getRiskSummary(assessment: SwapRiskAssessment): string {
  const emoji = {
    low: '✅',
    medium: '⚠️',
    high: '🔴',
    critical: '🚨',
  };

  const lines = [
    `${emoji[assessment.riskLevel]} Risk Level: ${assessment.riskLevel.toUpperCase()} (Score: ${assessment.score}/100)`,
  ];

  if (assessment.factors.length > 0) {
    lines.push('\nRisk Factors:');
    assessment.factors.forEach(factor => {
      lines.push(`• ${factor.name}: ${factor.description}`);
    });
  }

  if (assessment.recommendations.length > 0) {
    lines.push('\nRecommendations:');
    assessment.recommendations.forEach(rec => {
      lines.push(`• ${rec}`);
    });
  }

  return lines.join('\n');
}
