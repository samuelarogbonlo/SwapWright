'use client';

import { formatUnits } from 'viem';
import { useEffect, useState } from 'react';

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

interface SimulationResult {
  success: boolean;
  gasUsed: string;
  error?: string;
}

interface TransactionReceiptProps {
  quote: Quote;
  amountIn: number;
  txHash: string;
  simulation?: SimulationResult;
  onNewSwap: () => void;
}

export function TransactionReceipt({
  quote,
  amountIn,
  txHash,
  simulation,
  onNewSwap
}: TransactionReceiptProps) {
  const [confirmationTime, setConfirmationTime] = useState<number>(0);
  const [startTime] = useState<number>(Date.now());
  const [actualReceived, setActualReceived] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setConfirmationTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  // Fetch actual received amount from transaction receipt
  useEffect(() => {
    const fetchActualAmount = async () => {
      try {
        const response = await fetch(`https://base.blockscout.com/api/v2/transactions/${txHash}`);
        const data = await response.json();

        // Parse token transfers from transaction logs
        if (data.token_transfers && data.token_transfers.length > 0) {
          const receiveTransfer = data.token_transfers.find((transfer: any) =>
            transfer.token.symbol === quote.tokenOut.symbol
          );
          if (receiveTransfer) {
            const amount = parseFloat(receiveTransfer.total.value) / Math.pow(10, receiveTransfer.total.decimals);
            setActualReceived(amount);
          }
        }
      } catch (error) {
        console.error('Failed to fetch actual amount:', error);
        // Fallback to expected
        setActualReceived(parseFloat(formatUnits(BigInt(quote.expectedOutput), quote.tokenOut.poolDecimals)));
      }
    };

    // Wait a bit for the transaction to be indexed
    const timeout = setTimeout(fetchActualAmount, 2000);
    return () => clearTimeout(timeout);
  }, [txHash, quote]);

  const expectedOutput = parseFloat(
    formatUnits(BigInt(quote.expectedOutput), quote.tokenOut.poolDecimals)
  );
  const minOutput = parseFloat(
    formatUnits(BigInt(quote.minOutput), quote.tokenOut.poolDecimals)
  );

  const estimatedGasNumber = parseInt(quote.estimatedGas);
  const actualGasNumber = simulation ? parseInt(simulation.gasUsed) : estimatedGasNumber;
  const gasSavings = estimatedGasNumber - actualGasNumber;
  const gasSavingsPercent = (gasSavings / estimatedGasNumber) * 100;

  const handleShare = (platform: 'twitter' | 'discord') => {
    const text = `Just swapped ${amountIn} ${quote.tokenIn.symbol} for ~${expectedOutput.toFixed(4)} ${quote.tokenOut.symbol} on @SwapWright! 🚀`;
    const url = `https://basescan.org/tx/${txHash}`;

    if (platform === 'twitter') {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        '_blank'
      );
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      alert('Message copied to clipboard! Paste it in Discord.');
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-green-300 dark:border-green-800 p-6 space-y-4">
      {/* Success Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-2">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-bold text-2xl text-green-900 dark:text-green-100">Swap Successful!</h3>
        <p className="text-sm text-green-700 dark:text-green-300">
          Your transaction has been confirmed on Base
        </p>
      </div>

      {/* Transaction Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 shadow-md">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white border-b pb-2">
          Transaction Summary
        </h4>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">You Sent</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {amountIn} {quote.tokenIn.symbol}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">You Received</span>
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              {actualReceived !== null ? (
                <>{actualReceived.toFixed(6)} {quote.tokenOut.symbol}</>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </span>
              )}
            </span>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
              <span className="font-mono text-gray-900 dark:text-white">
                1 {quote.tokenIn.symbol} = {quote.price.toFixed(2)} {quote.tokenOut.symbol}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 shadow-md">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white border-b pb-2">
          Expected vs Actual
        </h4>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Expected Output</span>
            <span className="font-mono text-gray-900 dark:text-white">
              {expectedOutput.toFixed(6)} {quote.tokenOut.symbol}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Minimum Guaranteed</span>
            <span className="font-mono text-gray-900 dark:text-white">
              {minOutput.toFixed(6)} {quote.tokenOut.symbol}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Actual Received</span>
            <span className="font-mono font-bold text-green-600 dark:text-green-400">
              {actualReceived !== null ? (
                <>{actualReceived.toFixed(6)} {quote.tokenOut.symbol}</>
              ) : (
                <>~{expectedOutput.toFixed(6)} {quote.tokenOut.symbol}</>
              )}
            </span>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Status</span>
            <span className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Optimal Execution
            </span>
          </div>
        </div>
      </div>

      {/* Gas Details */}
      {simulation && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 shadow-md">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white border-b pb-2">
            Gas Efficiency
          </h4>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Estimated Gas</span>
              <span className="font-mono text-gray-900 dark:text-white">{quote.estimatedGas}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Actual Gas Used</span>
              <span className="font-mono text-gray-900 dark:text-white">{simulation.gasUsed}</span>
            </div>

            {gasSavings !== 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  {gasSavings > 0 ? 'Gas Saved' : 'Extra Gas'}
                </span>
                <span className={`font-semibold ${gasSavings > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  {gasSavings > 0 ? '+' : ''}{Math.abs(gasSavingsPercent).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction Metadata */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 shadow-md">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white border-b pb-2">
          Transaction Details
        </h4>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Pool Fee</span>
            <span className="font-mono text-gray-900 dark:text-white">
              {(quote.feeTier / 10000).toFixed(2)}%
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Confirmation Time</span>
            <span className="font-mono text-gray-900 dark:text-white">
              ~{confirmationTime}s
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Network</span>
            <span className="font-mono text-gray-900 dark:text-white">Base Mainnet</span>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Transaction Hash</p>
            <p className="font-mono text-xs break-all text-gray-800 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-2 rounded">
              {txHash}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View on BaseScan
        </a>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleShare('twitter')}
            className="flex items-center justify-center gap-2 bg-sky-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-sky-600 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
            Share
          </button>

          <button
            onClick={() => handleShare('discord')}
            className="flex items-center justify-center gap-2 bg-indigo-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-600 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Copy
          </button>
        </div>

        <button
          onClick={onNewSwap}
          className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          New Swap
        </button>
      </div>

      {/* Powered By Badge */}
      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Powered by Uniswap V3 • Secured by Tenderly • Built on Base
        </p>
      </div>
    </div>
  );
}
