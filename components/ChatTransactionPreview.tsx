'use client';

import { ArrowDown } from 'lucide-react';

export interface TransactionData {
  youPay: string;
  youPayToken: string;
  youReceive: string;
  youReceiveToken: string;
  exchangeRate: string;
  route: string;
  poolFeeTier: string;
  liquiditySource: string;
  slippageTolerance: string;
  minReceived: string;
  estimatedGas: string;
  gasUSD?: string;
  priceImpact: string;
  secured: boolean;
}

interface ChatTransactionPreviewProps {
  data: TransactionData;
  onSimulate?: () => void;
  onExecute?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
  simulationPassed?: boolean;
}

export function ChatTransactionPreview({
  data,
  onSimulate,
  onExecute,
  onCancel,
  showActions = true,
  simulationPassed = false,
}: ChatTransactionPreviewProps) {
  return (
    <div className="my-4 rounded-xl border border-blue-500/30 bg-gray-800/40 p-6 backdrop-blur-sm max-w-md">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Transaction Preview</h3>
        <span className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-400">
          {data.liquiditySource}
        </span>
      </div>

      {/* Amounts */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">You Pay</span>
          <span className="text-xl font-bold text-white">
            {data.youPay} {data.youPayToken}
          </span>
        </div>

        <div className="flex justify-center">
          <div className="rounded-full bg-gray-700/50 p-2">
            <ArrowDown className="h-5 w-5 text-blue-400" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">You Receive</span>
          <span className="text-xl font-bold text-green-400">
            ~{data.youReceive} {data.youReceiveToken}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-gray-700/50 pt-3">
          <span className="text-xs text-gray-500">Exchange Rate</span>
          <span className="text-sm text-gray-300">{data.exchangeRate}</span>
        </div>
      </div>

      {/* Route Details */}
      <div className="mb-6 rounded-lg bg-gray-900/50 p-4">
        <div className="mb-3 text-xs font-medium text-gray-400">Route Details</div>

        {/* Route visualization */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-600/20 px-2 py-1 text-sm font-medium text-blue-400">
              {data.youPayToken}
            </span>
            <div className="h-[2px] w-24 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            <span className="text-xs text-gray-500">Direct Swap</span>
            <div className="h-[2px] w-24 bg-gradient-to-r from-purple-500 to-pink-500"></div>
            <span className="rounded-md bg-purple-600/20 px-2 py-1 text-sm font-medium text-purple-400">
              {data.youReceiveToken}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Pool Fee Tier</span>
            <span className="text-gray-300">{data.poolFeeTier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Liquidity Source</span>
            <span className="text-gray-300">{data.liquiditySource}</span>
          </div>
        </div>
      </div>

      {/* Transaction Costs */}
      <div className="mb-6 space-y-2 text-sm">
        <div className="text-xs font-medium text-gray-400 mb-2">Transaction Costs</div>
        <div className="flex justify-between">
          <span className="text-gray-500">Slippage Tolerance</span>
          <span className="text-gray-300">{data.slippageTolerance}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Minimum Received</span>
          <span className="text-orange-400">{data.minReceived} {data.youReceiveToken}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Estimated Gas</span>
          <span className="text-gray-300">
            {data.estimatedGas} {data.gasUSD && `($${data.gasUSD})`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Price Impact</span>
          <span className={`${parseFloat(data.priceImpact) > 1 ? 'text-red-400' : 'text-green-400'}`}>
            ~{data.priceImpact}
          </span>
        </div>
      </div>

      {/* Security Badge */}
      {data.secured && (
        <div className="mb-4 rounded-lg bg-green-900/20 border border-green-500/30 p-3 flex items-center gap-2">
          <div className="rounded-full bg-green-500/20 p-1">
            <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-green-400">Transaction Secured</div>
            <div className="text-xs text-green-400/70">
              {simulationPassed ? 'Simulation passed successfully' : 'Simulation will verify before execution'}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {showActions && (
        <div className="flex gap-3">
          {!simulationPassed && onSimulate && (
            <button
              onClick={onSimulate}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Simulate & Review
            </button>
          )}
          {onExecute && (
            <button
              onClick={onExecute}
              className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors ${
                simulationPassed
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {simulationPassed ? 'Execute Now' : 'Execute Swap'}
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-gray-600 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700/50"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
