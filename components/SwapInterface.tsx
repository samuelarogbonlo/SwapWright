'use client';

import { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { UNISWAP_CONTRACTS } from '@/lib/uniswap';

interface ParsedIntent {
  token_in: string;
  token_out: string;
  amount_in: number;
  slippage_tolerance?: number;
}

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

type SwapStep = 'input' | 'parsed' | 'quote' | 'approval_needed' | 'approving' | 'simulated' | 'executing' | 'complete';

export function SwapInterface() {
  const { address, isConnected } = useAccount();
  const { sendTransaction, data: txHash } = useSendTransaction();
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [input, setInput] = useState('');
  const [step, setStep] = useState<SwapStep>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [txData, setTxData] = useState<any>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

  const handleParseIntent = async () => {
    if (!input.trim()) {
      setError('Please enter a swap request');
      return;
    }

    setLoading(true);
    setError(null);
    setParsedIntent(null);

    try {
      const response = await fetch('/api/parse-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to parse intent');
      }

      const data = await response.json();

      if (!data.intent) {
        throw new Error('Could not understand your request. Try: "Swap 0.1 ETH for USDC"');
      }

      setParsedIntent(data.intent);
      setStep('parsed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleGetQuote = async () => {
    if (!parsedIntent) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/get-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn: parsedIntent.token_in,
          tokenOut: parsedIntent.token_out,
          amountIn: parsedIntent.amount_in,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get quote');
      }

      const data = await response.json();
      setQuote({ ...data, price: Number(data.price) });
      setStep('quote');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateAndExecute = async () => {
    if (!parsedIntent || !address || !quote) return;

    setLoading(true);
    setError(null);

    try {
      // Check if selling ERC-20 token (not ETH) - needs approval
      const isSellingERC20 = quote.tokenIn.symbol !== 'ETH';

      if (isSellingERC20) {
        // Check approval for ERC-20 token
        const amountWei = parseUnits(
          parsedIntent.amount_in.toString(),
          quote.tokenIn.decimals
        );

        const approvalCheck = await fetch('/api/check-approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: quote.tokenIn.poolAddress,
            ownerAddress: address,
            spenderAddress: UNISWAP_CONTRACTS.SwapRouter02,
            amount: amountWei.toString(),
          }),
        });

        if (!approvalCheck.ok) {
          throw new Error('Failed to check approval');
        }

        const approvalData = await approvalCheck.json();

        if (approvalData.needsApproval) {
          setNeedsApproval(true);
          setStep('approval_needed');
          setLoading(false);
          return;
        }
      }

      // 1. Build swap transaction
      const buildResponse = await fetch('/api/build-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn: quote.tokenIn,
          tokenOut: quote.tokenOut,
          amountIn: parsedIntent.amount_in,
          feeTier: quote.feeTier,
          minOutput: quote.minOutput,
          from: address,
        }),
      });

      if (!buildResponse.ok) {
        const data = await buildResponse.json();
        throw new Error(data.error || 'Failed to build transaction');
      }

      const txDataResponse = await buildResponse.json();
      setTxData(txDataResponse);

      // 2. Simulate transaction
      const simResponse = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: address,
          to: txDataResponse.to,
          data: txDataResponse.data,
          value: txDataResponse.value || '0',
        }),
      });

      if (!simResponse.ok) {
        const data = await simResponse.json();
        throw new Error(data.error || 'Simulation failed');
      }

      const simResult = await simResponse.json();
      setSimulation(simResult);

      if (!simResult.success) {
        throw new Error(`Transaction would fail: ${simResult.error || 'Unknown error'}`);
      }

      setStep('simulated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!parsedIntent || !address || !quote) return;

    setLoading(true);
    setError(null);
    setStep('approving');

    try {
      const amountWei = parseUnits(
        parsedIntent.amount_in.toString(),
        quote.tokenIn.decimals
      );

      const approvalResponse = await fetch('/api/build-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: quote.tokenIn.poolAddress,
          spenderAddress: UNISWAP_CONTRACTS.SwapRouter02,
          amount: amountWei.toString(),
        }),
      });

      if (!approvalResponse.ok) {
        throw new Error('Failed to build approval');
      }

      const approvalTx = await approvalResponse.json();

      await sendTransaction({
        to: approvalTx.to as `0x${string}`,
        data: approvalTx.data as `0x${string}`,
        value: 0n,
      });

      // Wait for approval, then retry simulation
      setTimeout(() => {
        handleSimulateAndExecute();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
      setStep('quote');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!txData) return;

    setLoading(true);
    setError(null);
    setStep('executing');

    try {
      await sendTransaction({
        to: txData.to as `0x${string}`,
        data: txData.data as `0x${string}`,
        value: BigInt(txData.value || '0'),
      });

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('simulated');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setStep('input');
    setParsedIntent(null);
    setQuote(null);
    setSimulation(null);
    setTxData(null);
    setError(null);
  };

  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-8 text-center">
        <p className="text-gray-500 text-lg">Connect your wallet to start swapping</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Input Step */}
      {step === 'input' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border p-6 space-y-4">
          <div>
            <label htmlFor="swap-input" className="block text-sm font-medium mb-2 text-gray-700">
              What would you like to swap?
            </label>
            <textarea
              id="swap-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleParseIntent();
                }
              }}
              placeholder='Try: "Swap 0.1 ETH for USDC"'
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-black dark:text-white bg-white dark:bg-gray-800"
              rows={3}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">Press Enter to submit</p>
          </div>
          <button
            onClick={handleParseIntent}
            disabled={loading || !input.trim()}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Parsing with Claude AI...
              </span>
            ) : 'Parse Intent'}
          </button>
        </div>
      )}

      {/* Parsed Intent */}
      {parsedIntent && step === 'parsed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-3">
          <h3 className="font-semibold text-green-900 text-lg">✓ Intent Parsed</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700 font-medium">From:</span>
              <span className="font-mono font-semibold text-gray-900">{parsedIntent.token_in}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700 font-medium">To:</span>
              <span className="font-mono font-semibold text-gray-900">{parsedIntent.token_out}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700 font-medium">Amount:</span>
              <span className="font-mono font-semibold text-gray-900">{parsedIntent.amount_in}</span>
            </div>
          </div>
          <button
            onClick={handleGetQuote}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Finding best price via Uniswap V3...
              </span>
            ) : 'Get Quote'}
          </button>
        </div>
      )}

      {/* Quote Display */}
      {quote && step === 'quote' && parsedIntent && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-blue-900 text-lg">✓ Quote Ready</h3>

          <div className="bg-white rounded-lg p-4 border space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">You Pay:</span>
              <span className="font-semibold text-lg">{parsedIntent.amount_in} {quote.tokenIn.symbol}</span>
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">You Receive:</span>
                <span className="font-semibold text-lg text-blue-700">
                  ~{parseFloat(
                    formatUnits(BigInt(quote.expectedOutput), quote.tokenOut.poolDecimals)
                  ).toFixed(4)} {quote.tokenOut.symbol}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">
                Rate: 1 {quote.tokenIn.symbol} = {quote.price.toFixed(2)} {quote.tokenOut.symbol}
              </p>
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-600">
            <span>Pool Fee:</span>
            <span>{(quote.feeTier / 10000).toFixed(2)}%</span>
          </div>

          <div className="text-xs text-gray-600 bg-white rounded p-2 border">
            <span className="font-medium">💱 Powered by Uniswap V3</span> on Base
          </div>

          <button
            onClick={handleSimulateAndExecute}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Simulating via Tenderly...
              </span>
            ) : 'Simulate & Review'}
          </button>
        </div>
      )}

      {/* Approval Needed */}
      {step === 'approval_needed' && quote && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 space-y-3">
          <h3 className="font-semibold text-yellow-900 text-lg">⚠️ Approval Required</h3>
          <p className="text-sm text-gray-700">
            You need to approve {quote.tokenIn.symbol} before swapping. This is a one-time step.
          </p>
          <div className="text-xs text-gray-600 bg-white rounded p-2 border">
            This allows Uniswap to swap your {quote.tokenIn.symbol} tokens.
          </div>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="w-full bg-yellow-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-yellow-700 disabled:bg-gray-300 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Approving...
              </span>
            ) : 'Approve Token'}
          </button>
        </div>
      )}

      {/* Approving */}
      {step === 'approving' && isTxPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-900 font-semibold">⏳ Approval Pending...</p>
          <p className="text-sm text-gray-600 mt-2">Waiting for confirmation</p>
        </div>
      )}

      {/* Simulation Result */}
      {simulation && step === 'simulated' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 space-y-3">
          <h3 className="font-semibold text-purple-900 text-lg">✓ Simulation Passed</h3>
          <p className="text-sm text-gray-700">Transaction is safe to execute</p>
          <div className="text-xs text-gray-600 bg-white rounded p-2 border">
            <span className="font-medium">🛡️ Secured by Tenderly</span> • Gas Used: {simulation.gasUsed}
          </div>
          <button
            onClick={handleExecuteSwap}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Executing swap...
              </span>
            ) : 'Execute Swap'}
          </button>
        </div>
      )}

      {/* Executing */}
      {step === 'executing' && isTxPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-900 font-semibold">⏳ Transaction Pending...</p>
          <p className="text-sm text-gray-600 mt-2">Waiting for confirmation</p>
        </div>
      )}

      {/* Complete */}
      {step === 'complete' && isTxSuccess && txHash && quote && parsedIntent && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <div className="text-center">
            <div className="text-5xl mb-2">🎉</div>
            <h3 className="font-bold text-green-900 text-2xl">Swap Complete!</h3>
          </div>

          <div className="bg-white rounded-lg p-4 border space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">You Sent:</span>
              <span className="font-semibold text-lg">{parsedIntent.amount_in} {quote.tokenIn.symbol}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">You Received:</span>
              <span className="font-semibold text-lg text-green-700">
                ~{parseFloat(
                  formatUnits(BigInt(quote.expectedOutput), quote.tokenOut.poolDecimals)
                ).toFixed(4)} {quote.tokenOut.symbol}
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-600 bg-white rounded p-3 border">
            <p className="font-medium mb-1">Transaction Hash:</p>
            <p className="font-mono break-all text-gray-800">{txHash}</p>
          </div>

          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 text-center transition-colors"
          >
            View on BaseScan →
          </a>

          <button
            onClick={handleReset}
            className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            New Swap
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-red-600 text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-red-900 font-semibold">Something went wrong</p>
              <p className="text-red-800 text-sm mt-1">
                {error.includes('insufficient funds')
                  ? 'You don\'t have enough tokens to complete this swap. Please check your balance.'
                  : error.includes('No liquidity pool')
                  ? 'This token pair doesn\'t have enough liquidity. Try a different amount or token pair.'
                  : error.includes('parse intent')
                  ? 'We couldn\'t understand your request. Try something like: "Swap 0.1 ETH for USDC"'
                  : error.includes('User rejected')
                  ? 'Transaction was cancelled in your wallet.'
                  : error}
              </p>
            </div>
          </div>
          {step !== 'input' && (
            <button
              onClick={handleReset}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors text-sm"
            >
              Start Over
            </button>
          )}
        </div>
      )}

      {/* Wallet Info */}
      <div className="text-xs text-gray-500 text-center">
        Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
      </div>
    </div>
  );
}
