/**
 * Aave V3 Integration for Base Mainnet
 * Health Factor Monitoring and Risk Assessment
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { getPrimaryRPCUrl } from './rpc-provider';

// Aave V3 Pool Contract on Base Mainnet
export const AAVE_CONTRACTS = {
  Pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
  PoolAddressesProvider: '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D',
} as const;

// Pool ABI - getUserAccountData method
export const POOL_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getUserAccountData',
    outputs: [
      { internalType: 'uint256', name: 'totalCollateralBase', type: 'uint256' },
      { internalType: 'uint256', name: 'totalDebtBase', type: 'uint256' },
      { internalType: 'uint256', name: 'availableBorrowsBase', type: 'uint256' },
      { internalType: 'uint256', name: 'currentLiquidationThreshold', type: 'uint256' },
      { internalType: 'uint256', name: 'ltv', type: 'uint256' },
      { internalType: 'uint256', name: 'healthFactor', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface UserAccountData {
  totalCollateralUSD: number;
  totalDebtUSD: number;
  availableBorrowsUSD: number;
  currentLiquidationThreshold: number;
  ltv: number;
  healthFactor: number;
}

export type HealthTier = 'safe' | 'caution' | 'warning' | 'critical' | 'none';

export interface HealthAlert {
  tier: HealthTier;
  healthFactor: number;
  message: string;
  color: string;
  suggestedAction?: string;
  actionAmount?: number;
}

/**
 * Fetch user's Aave position data
 */
export async function getUserAccountData(userAddress: string): Promise<UserAccountData> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(getPrimaryRPCUrl()),
  });

  const result = await publicClient.readContract({
    address: AAVE_CONTRACTS.Pool as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'getUserAccountData',
    args: [userAddress as `0x${string}`],
  });

  const [
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactor,
  ] = result;

  // Aave returns values in 8 decimals for USD amounts, 4 decimals for basis points (10000 = 100%), 18 decimals for health factor
  // formatUnits(x, 4) on basis points gives us decimal form: 8250 -> 0.8250 which is already 82.5%
  return {
    totalCollateralUSD: Number(formatUnits(totalCollateralBase, 8)),
    totalDebtUSD: Number(formatUnits(totalDebtBase, 8)),
    availableBorrowsUSD: Number(formatUnits(availableBorrowsBase, 8)),
    currentLiquidationThreshold: Number(formatUnits(currentLiquidationThreshold, 4)), // Already decimal (0.825 for 82.5%)
    ltv: Number(formatUnits(ltv, 4)), // Already decimal (0.75 for 75%)
    healthFactor: Number(formatUnits(healthFactor, 18)),
  };
}

/**
 * Determine health tier based on health factor
 * - Green (Safe): HF > 2.0
 * - Yellow (Caution): HF 1.5-2.0
 * - Orange (Warning): HF 1.2-1.5
 * - Red (Critical): HF < 1.2
 * - None: No position
 */
export function getHealthTier(healthFactor: number, hasPosition: boolean): HealthTier {
  if (!hasPosition) return 'none';
  if (healthFactor >= 2.0) return 'safe';
  if (healthFactor >= 1.5) return 'caution';
  if (healthFactor >= 1.2) return 'warning';
  return 'critical';
}

/**
 * Generate health alert with suggested actions
 */
export function generateHealthAlert(accountData: UserAccountData): HealthAlert {
  const hasPosition = accountData.totalDebtUSD > 0;
  const tier = getHealthTier(accountData.healthFactor, hasPosition);

  if (!hasPosition || accountData.totalDebtUSD === 0) {
    return {
      tier: 'none',
      healthFactor: 0,
      message: 'No active Aave position',
      color: '#6B7280',
    };
  }

  const alerts: Record<Exclude<HealthTier, 'none'>, HealthAlert> = {
    safe: {
      tier: 'safe',
      healthFactor: accountData.healthFactor,
      message: 'Your position is safe',
      color: '#10B981',
    },
    caution: {
      tier: 'caution',
      healthFactor: accountData.healthFactor,
      message: 'Monitor your position carefully',
      color: '#FBBF24',
      suggestedAction: 'Consider adding collateral to improve health factor',
    },
    warning: {
      tier: 'warning',
      healthFactor: accountData.healthFactor,
      message: 'Your position is at risk',
      color: '#F97316',
      suggestedAction: 'Add collateral urgently or repay debt',
      actionAmount: calculateMinCollateralNeeded(accountData, 1.5),
    },
    critical: {
      tier: 'critical',
      healthFactor: accountData.healthFactor,
      message: '⚠️ LIQUIDATION RISK - Act immediately!',
      color: '#EF4444',
      suggestedAction: 'Add collateral NOW or close position',
      actionAmount: calculateMinCollateralNeeded(accountData, 2.0),
    },
  };

  return alerts[tier as Exclude<HealthTier, 'none'>];
}

/**
 * Calculate minimum collateral needed to reach target health factor
 * Formula: requiredCollateral = (targetHF * totalDebt / liquidationThreshold) - currentCollateral
 */
function calculateMinCollateralNeeded(
  accountData: UserAccountData,
  targetHealthFactor: number
): number {
  const { totalCollateralUSD, totalDebtUSD, currentLiquidationThreshold } = accountData;

  if (totalDebtUSD === 0) return 0;

  // Required collateral to achieve target HF
  // currentLiquidationThreshold is already decimal (e.g., 0.825 for 82.5%)
  const requiredCollateral =
    (targetHealthFactor * totalDebtUSD) / currentLiquidationThreshold;

  // Additional collateral needed
  const additionalNeeded = Math.max(0, requiredCollateral - totalCollateralUSD);

  return Math.ceil(additionalNeeded * 100) / 100; // Round up to 2 decimals
}

/**
 * Calculate minimum debt to repay to reach target health factor
 */
export function calculateMinRepaymentNeeded(
  accountData: UserAccountData,
  targetHealthFactor: number
): number {
  const { totalCollateralUSD, totalDebtUSD, currentLiquidationThreshold } = accountData;

  if (totalDebtUSD === 0) return 0;

  // Maximum debt allowed for target HF
  // currentLiquidationThreshold is already decimal (e.g., 0.825 for 82.5%)
  const maxAllowedDebt =
    (totalCollateralUSD * currentLiquidationThreshold) / targetHealthFactor;

  // Amount to repay
  const repaymentNeeded = Math.max(0, totalDebtUSD - maxAllowedDebt);

  return Math.ceil(repaymentNeeded * 100) / 100; // Round up to 2 decimals
}
