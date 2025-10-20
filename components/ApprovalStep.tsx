'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';

interface QuoteToken {
  symbol: string;
  address: string;
  decimals: number;
  poolAddress: string;
  poolDecimals: number;
}

interface ApprovalStepProps {
  token: QuoteToken;
  amount: number;
  spenderName?: string;
  onApprove: (isUnlimited: boolean) => void;
  loading: boolean;
}

export function ApprovalStep({
  token,
  amount,
  spenderName = 'Uniswap Router',
  onApprove,
  loading
}: ApprovalStepProps) {
  const [approvalType, setApprovalType] = useState<'exact' | 'unlimited'>('exact');
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-yellow-300 dark:border-yellow-800 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500 rounded-full">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Token Approval Required</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">One-time permission needed</p>
          </div>
        </div>

        {/* Info Tooltip */}
        <div className="relative">
          <button
            onMouseEnter={() => setShowInfoTooltip(true)}
            onMouseLeave={() => setShowInfoTooltip(false)}
            className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {showInfoTooltip && (
            <div className="absolute right-0 top-8 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-10">
              <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">Why is this needed?</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Token approvals allow smart contracts to transfer tokens on your behalf. This is a standard security feature in DeFi.
                You only need to approve once per token per contract.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Explanation Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3 border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Before swapping <span className="font-semibold">{token.symbol}</span>, you need to give {spenderName} permission to access your tokens.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Token</span>
            <span className="font-semibold text-gray-900 dark:text-white">{token.symbol}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600 dark:text-gray-400">Current Swap Amount</span>
            <span className="font-semibold text-gray-900 dark:text-white">{amount} {token.symbol}</span>
          </div>
        </div>
      </div>

      {/* Approval Type Selection */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-900 dark:text-white">Choose Approval Amount:</label>

        {/* Exact Amount Option */}
        <button
          onClick={() => setApprovalType('exact')}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
            approvalType === 'exact'
              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              approvalType === 'exact' ? 'border-yellow-500' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {approvalType === 'exact' && (
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Exact Amount</span>
                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full font-medium">
                  Recommended
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Approve only {amount} {token.symbol}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-green-700 dark:text-green-400">More secure - limits contract access</span>
              </div>
            </div>
          </div>
        </button>

        {/* Unlimited Option */}
        <button
          onClick={() => setApprovalType('unlimited')}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
            approvalType === 'unlimited'
              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-700'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              approvalType === 'unlimited' ? 'border-yellow-500' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {approvalType === 'unlimited' && (
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Unlimited</span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full font-medium">
                  Convenient
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Approve unlimited {token.symbol}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-blue-700 dark:text-blue-400">No approval needed for future swaps</span>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">Safety Tip</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Approving the exact amount is safer. You can always approve more later if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Approve Button */}
      <button
        onClick={() => onApprove(approvalType === 'unlimited')}
        disabled={loading}
        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-4 px-6 rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Waiting for wallet confirmation...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Approve {approvalType === 'unlimited' ? 'Unlimited' : amount} {token.symbol}
          </span>
        )}
      </button>

      {/* What Happens Next */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">What happens next:</p>
        <ol className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">1.</span>
            <span>Your wallet will ask you to confirm the approval</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">2.</span>
            <span>Wait for the approval transaction to confirm</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">3.</span>
            <span>Automatically proceed to swap simulation</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
