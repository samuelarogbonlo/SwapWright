'use client';

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
} from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { UNISWAP_CONTRACTS } from '@/lib/uniswap';
import { TransactionPreview } from './TransactionPreview';
import { TransactionReceipt } from './TransactionReceipt';
import { ApprovalStep } from './ApprovalStep';

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

type SwapStep =
  | 'input'
  | 'parsed'
  | 'quote'
  | 'approval_needed'
  | 'approving'
  | 'simulated'
  | 'executing'
  | 'complete';

export interface SwapInterfaceHandle {
  simulate: () => Promise<void>;
  execute: () => Promise<void>;
}

interface SwapInterfaceProps {
  pendingIntent?: {
    tokenIn: string;
    tokenOut: string;
    amount: string;
  } | null;
  pendingSlippage?: number | null;
  onClearIntent?: () => void;
  onClearSlippage?: () => void;
  onContextUpdate?: (updates: any) => void;
}

export const SwapInterface = forwardRef<SwapInterfaceHandle, SwapInterfaceProps>(function SwapInterface(
  props,
  ref
) {
  const { pendingIntent, pendingSlippage, onClearIntent, onClearSlippage, onContextUpdate } = props;
  const { address, isConnected } = useAccount();
  const { sendTransaction, data: txHash, reset: resetTx } = useSendTransaction();
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [step, setStep] = useState<SwapStep>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsedIntent, setParsedIntent] = useState<ParsedIntent | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [txData, setTxData] = useState<any>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApprovingToken, setIsApprovingToken] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.5);

  const quoteRoute = useMemo(() => {
    if (!parsedIntent) return '';
    return `${parsedIntent.token_in} → ${parsedIntent.token_out}`;
  }, [parsedIntent]);

  const fetchQuoteForIntent = useCallback(
    async (intent: ParsedIntent, slippage: number, clearIntent = false, clearSlippage = false) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/get-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenIn: intent.token_in,
            tokenOut: intent.token_out,
            amountIn: intent.amount_in,
            slippage,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to get quote');
        }

        const data = await response.json();
        setQuote({ ...data, price: Number(data.price) });
        setStep('quote');

        if (onContextUpdate) {
          // Calculate price impact: (expected_price - actual_price) / expected_price * 100
          // Actual price from quote is already calculated in the API response
          // For a swap, price impact can be estimated from the difference between
          // expected output at spot price vs actual output from the AMM
          const priceImpact = data.priceImpact || 0;

          onContextUpdate({
            tokenIn: intent.token_in,
            tokenOut: intent.token_out,
            amount: intent.amount_in.toString(),
            quote: {
              expectedOutput: data.expectedOutput,
              minOutput: data.minOutput,
              estimatedGas: data.estimatedGas,
              feeTier: data.feeTier,
              route: `${intent.token_in} → ${intent.token_out}`,
              priceImpact,
            },
            slippage,
          });
        }

        if (clearIntent && onClearIntent) onClearIntent();
        if (clearSlippage && onClearSlippage) onClearSlippage();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get quote');
      } finally {
        setLoading(false);
      }
    },
    [onClearIntent, onClearSlippage, onContextUpdate]
  );

  // Handle copilot intent
  useEffect(() => {
    if (!pendingIntent) return;
    const intent: ParsedIntent = {
      token_in: pendingIntent.tokenIn,
      token_out: pendingIntent.tokenOut,
      amount_in: parseFloat(pendingIntent.amount),
    };
    setParsedIntent(intent);
    setStep('parsed');

    const incomingSlippage =
      intent.slippage_tolerance ??
      (typeof pendingSlippage === 'number' ? pendingSlippage : slippageTolerance);
    setSlippageTolerance(incomingSlippage);

    fetchQuoteForIntent(intent, incomingSlippage, true, typeof pendingSlippage === 'number');
  }, [pendingIntent, pendingSlippage, fetchQuoteForIntent, slippageTolerance]);

  // Handle slippage-only updates
  useEffect(() => {
    if (pendingSlippage === null || pendingSlippage === undefined) return;
    if (!parsedIntent) return;
    setSlippageTolerance(pendingSlippage);
    fetchQuoteForIntent(parsedIntent, pendingSlippage, false, true);
  }, [pendingSlippage, parsedIntent, fetchQuoteForIntent]);

  // Reset handler
  const handleReset = useCallback(() => {
    setStep('input');
    setParsedIntent(null);
    setQuote(null);
    setSimulation(null);
    setTxData(null);
    setError(null);
    setNeedsApproval(false);
    setIsApprovingToken(false);
    setSlippageTolerance(0.5);
    resetTx(); // Clear txHash from wagmi
  }, [resetTx]);

  // Handle approval transaction success
  useEffect(() => {
    if (isApprovingToken && isTxSuccess && step === 'approving') {
      setIsApprovingToken(false);
      setLoading(false);
      setTimeout(() => {
        handleSimulate();
      }, 3000);
    }
  }, [isTxSuccess, isApprovingToken, step]);

  // Handle swap transaction success - advance to complete and auto-reset
  useEffect(() => {
    if (isTxSuccess && step === 'executing' && !isApprovingToken) {
      setStep('complete');
      setLoading(false);

      // Auto-reset after 5 seconds to allow new swaps
      const resetTimer = setTimeout(() => {
        handleReset();
      }, 5000);

      return () => clearTimeout(resetTimer);
    }
  }, [isTxSuccess, step, isApprovingToken, handleReset]);

  // Update context with transaction status
  useEffect(() => {
    if (!txHash || !onContextUpdate) return;
    const status: 'pending' | 'success' | 'failed' = isTxSuccess
      ? 'success'
      : isTxPending
      ? 'pending'
      : 'failed';

    onContextUpdate({
      transaction: {
        hash: txHash,
        status,
      },
    });
  }, [txHash, isTxPending, isTxSuccess, onContextUpdate]);

  const handleFetchQuote = useCallback(() => {
    if (!parsedIntent) return;
    fetchQuoteForIntent(parsedIntent, slippageTolerance);
  }, [parsedIntent, slippageTolerance, fetchQuoteForIntent]);

  const handleSimulate = useCallback(async () => {
    if (!parsedIntent || !address || !quote) return;

    setLoading(true);
    setError(null);

    try {
      const isSellingERC20 = quote.tokenIn.symbol !== 'ETH';

      if (isSellingERC20) {
        const amountWei = parseUnits(parsedIntent.amount_in.toString(), quote.tokenIn.decimals);

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

      if (onContextUpdate) {
        onContextUpdate({
          simulation: {
            success: simResult.success,
            gasUsed: simResult.gasUsed,
            error: simResult.error,
          },
        });
      }

      if (!simResult.success) {
        throw new Error(`Transaction would fail: ${simResult.error || 'Unknown error'}`);
      }

      setNeedsApproval(false);
      setStep('simulated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Simulation failed';
      setError(message);
      if (onContextUpdate) {
        onContextUpdate({
          simulation: {
            success: false,
            error: message,
          },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [parsedIntent, address, quote, onContextUpdate]);

  const handleApprove = async (isUnlimited: boolean) => {
    if (!parsedIntent || !address || !quote) return;

    setLoading(true);
    setError(null);
    setStep('approving');
    setIsApprovingToken(true);

    try {
      const amountWei = isUnlimited
        ? '115792089237316195423570985008687907853269984665640564039457584007913129639935'
        : parseUnits(parsedIntent.amount_in.toString(), quote.tokenIn.decimals).toString();

      const approvalResponse = await fetch('/api/build-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: quote.tokenIn.poolAddress,
          spenderAddress: UNISWAP_CONTRACTS.SwapRouter02,
          amount: amountWei,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
      setStep('quote');
      setIsApprovingToken(false);
      setLoading(false);
    }
  };

  const handleExecuteSwap = useCallback(async () => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('simulated');
      if (onContextUpdate && txHash) {
        onContextUpdate({
          transaction: {
            hash: txHash,
            status: 'failed',
          },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [txData, sendTransaction, onContextUpdate, txHash]);

  useImperativeHandle(
    ref,
    () => ({
      simulate: () => handleSimulate(),
      execute: () => handleExecuteSwap(),
    }),
    [handleSimulate, handleExecuteSwap]
  );

  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-8 text-center">
        <p className="text-gray-500 text-lg">Connect your wallet to start swapping</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {step === 'input' && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border p-6 space-y-2 text-center">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Waiting for Copilot</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ask the AI Copilot to start a swap. Quote details will appear here automatically.
          </p>
        </div>
      )}

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
            onClick={handleFetchQuote}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 transition-colors"
          >
            Fetch Quote
          </button>
        </div>
      )}

      {quote && step === 'quote' && parsedIntent && (
        <div className="space-y-4">
          <TransactionPreview
            quote={quote}
            amountIn={parsedIntent.amount_in}
            slippage={slippageTolerance}
          />

          <button
            onClick={handleSimulate}
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
            ) : (
              'Simulate & Review'
            )}
          </button>
        </div>
      )}

      {step === 'approval_needed' && quote && parsedIntent && (
        <ApprovalStep
          token={quote.tokenIn}
          amount={parsedIntent.amount_in}
          spenderName="Uniswap Router"
          onApprove={handleApprove}
          loading={loading}
        />
      )}

      {step === 'approving' && isTxPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-900 font-semibold">⏳ Approval Pending...</p>
          <p className="text-sm text-gray-600 mt-2">Waiting for confirmation</p>
        </div>
      )}

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
            ) : (
              'Execute Swap'
            )}
          </button>
        </div>
      )}

      {step === 'executing' && isTxPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-900 font-semibold">⏳ Transaction Pending...</p>
          <p className="text-sm text-gray-600 mt-2">Waiting for confirmation</p>
        </div>
      )}

      {step === 'complete' && isTxSuccess && txHash && quote && parsedIntent && (
        <TransactionReceipt
          quote={quote}
          amountIn={parsedIntent.amount_in}
          txHash={txHash}
          simulation={simulation || undefined}
          onNewSwap={handleReset}
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-red-600 text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-red-900 font-semibold">Something went wrong</p>
              <p className="text-red-800 text-sm mt-1">
                {error.includes('insufficient funds')
                  ? "You don't have enough tokens to complete this swap. Please check your balance."
                  : error.includes('No liquidity pool')
                  ? "This token pair doesn't have enough liquidity. Try a different amount or token pair."
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

      <div className="text-xs text-gray-500 text-center">
        Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
      </div>
    </div>
  );
});
