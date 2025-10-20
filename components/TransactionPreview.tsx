'use client';

import { formatUnits } from 'viem';

interface QuoteToken {
  symbol: string;
  address: string;
  decimals: number;
  poolAddress: string;
  poolDecimals: number;
}

interface Quote {
  expectedOutput: string;
  minOutput: string;
  estimatedGas: string;
  feeTier: number;
  price: number;
  tokenIn: QuoteToken;
  tokenOut: QuoteToken;
}

interface TransactionPreviewProps {
  quote: Quote;
  amountIn: number;
  slippage?: number;
}

export function TransactionPreview({ quote, amountIn, slippage = 0.5 }: TransactionPreviewProps) {
  const expectedOutput = parseFloat(
    formatUnits(BigInt(quote.expectedOutput), quote.tokenOut.poolDecimals)
  );
  const minOutput = parseFloat(
    formatUnits(BigInt(quote.minOutput), quote.tokenOut.poolDecimals)
  );

  const priceImpact = ((expectedOutput - minOutput) / expectedOutput) * 100;

  // Convert gas to ETH (assuming ~2 gwei gas price on Base)
  const gasInEth = (parseInt(quote.estimatedGas) * 2) / 1e9;
  // Rough ETH price estimate - could fetch from oracle in production
  const ethPriceUsd = quote.tokenIn.symbol === 'ETH' ? quote.price :
                      quote.tokenOut.symbol === 'ETH' ? (1 / quote.price) : 3800;
  const gasInUsd = gasInEth * ethPriceUsd;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-blue-200 dark:border-blue-800 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Transaction Preview</h3>
        <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-full">
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
            Uniswap V3
          </span>
        </div>
      </div>

      {/* Main Swap Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 shadow-sm">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">You Pay</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {amountIn} {quote.tokenIn.symbol}
            </span>
          </div>

          <div className="flex justify-center py-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">You Receive</span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              ~{expectedOutput.toFixed(6)} {quote.tokenOut.symbol}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
            <span className="font-mono text-gray-900 dark:text-white">
              1 {quote.tokenIn.symbol} = {quote.price.toFixed(2)} {quote.tokenOut.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* Route & Liquidity Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 shadow-sm">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Route Details</h4>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full h-2"></div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded font-medium text-blue-800 dark:text-blue-200">
            {quote.tokenIn.symbol}
          </span>
          <span className="text-gray-500 dark:text-gray-400">Direct Swap</span>
          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 rounded font-medium text-purple-800 dark:text-purple-200">
            {quote.tokenOut.symbol}
          </span>
        </div>

        <div className="pt-2 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Pool Fee Tier</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {(quote.feeTier / 10000).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Liquidity Source</span>
            <span className="font-medium text-gray-900 dark:text-white">Uniswap V3 Pool</span>
          </div>
        </div>
      </div>

      {/* Slippage & Gas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 shadow-sm">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-2">Transaction Costs</h4>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Slippage Tolerance</span>
            <span className="font-medium text-gray-900 dark:text-white">{slippage}%</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Minimum Received</span>
            <span className="font-medium text-orange-600 dark:text-orange-400">
              {minOutput.toFixed(6)} {quote.tokenOut.symbol}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Estimated Gas</span>
            <div className="text-right">
              <span className="font-mono text-gray-900 dark:text-white">
                {gasInEth.toFixed(6)} ETH
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                (${gasInUsd.toFixed(2)})
              </span>
            </div>
          </div>

          {priceImpact > 0.1 && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Price Impact</span>
              <span className={`font-medium ${
                priceImpact > 5 ? 'text-red-600' : priceImpact > 1 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                ~{priceImpact.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Security Status */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-900 dark:text-green-100">Transaction Secured</p>
            <p className="text-xs text-green-700 dark:text-green-300">
              Simulation will verify before execution
            </p>
          </div>
        </div>
      </div>

      {/* Warning for high slippage or price impact */}
      {(priceImpact > 5 || slippage > 1) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                {priceImpact > 5 ? 'High Price Impact' : 'High Slippage'}
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                {priceImpact > 5
                  ? 'This trade may significantly affect the token price'
                  : 'Consider reducing slippage tolerance for better execution'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
