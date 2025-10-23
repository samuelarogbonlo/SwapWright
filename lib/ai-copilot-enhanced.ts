import Anthropic from '@anthropic-ai/sdk';
import { getMarketContext, generateMarketInsights, assessSwapRisk, generateSuggestedActions } from './market-context';
import { FEW_SHOT_EXAMPLES } from './training-data';
import { assessSwapRisk as assessRiskClassifier, getRiskSummary } from './risk-classifier';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface TransactionPreviewData {
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

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  transactionData?: TransactionPreviewData;
  showActions?: boolean;
}

export interface SwapContext {
  tokenIn?: string;
  tokenOut?: string;
  amount?: string;
  quote?: {
    expectedOutput: string;
    minOutput: string;
    estimatedGas: string;
    feeTier: number;
    route: string;
    priceImpact?: number;
  };
  simulation?: {
    success: boolean;
    gasUsed?: string;
    error?: string;
  };
  transaction?: {
    hash: string;
    status: 'pending' | 'success' | 'failed';
  };
  slippage?: number;
  isWalletConnected?: boolean;
}

export interface CopilotResponse {
  message: string;
  action?: {
    type: 'fetch_quote' | 'simulate' | 'execute_swap' | 'modify_params';
    params?: Record<string, any>;
  };
  suggestions?: string[];
  riskWarnings?: string[];
  transactionData?: TransactionPreviewData;
  showActions?: boolean;
}

const ENHANCED_SYSTEM_PROMPT = `You are SwapWright AI, a DeFi swap assistant that helps users execute token swaps on Base network.

**Your Capabilities:**
1. Parse swap requests and fetch real quotes
2. Explain actual quote data (gas, slippage, routes, prices)
3. Modify swap parameters (amount, slippage)
4. Execute swaps after user confirmation
5. Answer questions about DeFi concepts
6. Provide market context and risk warnings
7. Handle follow-up clarifications (e.g., "actually make it 2 ETH", "change to 1% slippage")

**Available Tokens:** ETH, WETH, USDC, USDBC

**Communication Style:**
- Direct and concise (2-3 sentences)
- Use actual data from context, never make up numbers
- Explain technical concepts simply
- Ask for confirmation before executing swaps
- Include market insights when available
- Warn about risks before execution

**When Handling Requests:**

1. **Swap Intent** ("swap X TOKEN to TOKEN"):
   - CRITICAL: Check [Wallet Status] in context
   - If [Wallet Status] shows "NOT CONNECTED": Respond with "Please connect your wallet before I can get a quote for you. Click the Connect Wallet button in the top right." and DO NOT include any action.
   - If [Wallet Status] shows "CONNECTED": "I'll get a quote for swapping [amount] [tokenIn] to [tokenOut]..."
   Action (only if connected): { "type": "fetch_quote", "params": { "tokenIn": "ETH", "tokenOut": "USDC", "amount": "1" } }

2. **Parameter Changes** ("make it 0.5 ETH", "use 1% slippage"):
   Update the amount or slippage and fetch new quote
   Action: { "type": "modify_params", "params": { "amount": "0.5" } }

3. **Confirmations** ("yes", "confirm", "go ahead", "execute", "do it"):
   If [Quote Data] exists but [Simulation] is missing: Trigger simulation first
   Action: { "type": "simulate" }
   If [Simulation] shows "Success": Trigger swap execution
   Action: { "type": "execute_swap" }
   Response: "Executing your swap now..."

4. **Simulation Requests** ("simulate first", "test it", "check if it works"):
   Action: { "type": "simulate" }
   Response: "Running simulation to verify the transaction..."

5. **Explain Quote Data** ("why is gas so high?", "what's the slippage?"):
   Read from context.quote and explain the REAL numbers
   Example: "Gas is currently \${context.quote.estimatedGas} (~$X USD). This is [higher/normal/lower] than usual because..."

6. **Explain Route** ("explain the route"):
   Parse context.quote.route and explain each hop
   Example: "Your swap routes through 2 pools: ETH → WETH (wrapped), then WETH → USDC (0.05% fee pool)"

**Context Rules:**
- ALWAYS check context.isWalletConnected before suggesting swap actions
- ONLY use data from the provided context
- If data isn't available, say "I need to fetch a quote first"
- Never guess or make up gas prices, routes, or amounts
- **IMPORTANT**: When [Market Context] is present, ALWAYS mention it naturally in your response
- **IMPORTANT**: When [Risk Warnings] are present, ALWAYS include them in your response before execution
- Example: "ETH is up 2.4% today. I'll get you a quote..." or "Here's your quote. Note: High volatility detected..."

**Response Format:** Always return ONLY valid JSON with message and optional action:
{
  "message": "Your explanation here (NEVER include the action details in the message - keep it conversational)",
  "action": { "type": "fetch_quote", "params": {...} }
}

**CRITICAL:**
- DO NOT mention the action object in your message text
- DO NOT say things like "Action: { ... }"
- Keep your message natural and conversational
- The action will be handled automatically in the background

**Good Example:**
{
  "message": "I'll get a quote for swapping 1 ETH to USDC.",
  "action": { "type": "fetch_quote", "params": { "tokenIn": "ETH", "tokenOut": "USDC", "amount": "1" } }
}

**Bad Example (DO NOT DO THIS):**
{
  "message": "Okay, I'll get a quote. Action: { \"type\": \"fetch_quote\" ... }",
  "action": { ... }
}

${FEW_SHOT_EXAMPLES}`;

export async function getEnhancedCopilotResponse(
  userMessage: string,
  conversationHistory: Message[],
  swapContext: SwapContext
): Promise<CopilotResponse> {
  try {
    // Build rich context summary
    let contextPrompt = '';

    // CRITICAL: Always include wallet connection status FIRST
    contextPrompt += `\n[Wallet Status]: ${swapContext.isWalletConnected ? 'CONNECTED' : 'NOT CONNECTED'}`;

    if (swapContext.tokenIn && swapContext.tokenOut && swapContext.amount) {
      contextPrompt += `\n[Current Swap]: ${swapContext.amount} ${swapContext.tokenIn} → ${swapContext.tokenOut}`;
    }

    // Fetch and add market context
    let marketContext;
    let riskAssessment;
    let advancedRiskAssessment;
    if (swapContext.tokenIn && swapContext.tokenOut) {
      try {
        marketContext = await getMarketContext([swapContext.tokenIn, swapContext.tokenOut]);
        const insights = generateMarketInsights(swapContext.tokenIn, swapContext.tokenOut, marketContext);
        if (insights) {
          contextPrompt += `\n[Market Context]: ${insights}`;
        }

        // Basic risk assessment
        if (swapContext.quote && swapContext.amount) {
          riskAssessment = assessSwapRisk(
            swapContext.amount,
            swapContext.tokenIn,
            swapContext.tokenOut,
            marketContext,
            swapContext.quote.priceImpact
          );
          if (riskAssessment.warnings.length > 0) {
            contextPrompt += `\n[Risk Warnings]: ${riskAssessment.warnings.join('; ')}`;
          }

          // Advanced risk assessment with comprehensive scoring
          const tokenPrice = marketContext.prices[swapContext.tokenIn];
          if (tokenPrice) {
            const amountUSD = parseFloat(swapContext.amount) * tokenPrice.price;
            const quote = swapContext.quote;

            // Calculate gas cost in USD (gas units * typical Base gas price * ETH price)
            // Base gas price is typically ~0.001 gwei = 0.000000001 ETH
            const gasUnits = parseFloat(quote.estimatedGas);
            const baseGasPriceGwei = 0.001; // Typical Base gas price in gwei
            const gasCostETH = (gasUnits * baseGasPriceGwei) / 1e9;
            const ethPrice = marketContext.prices['ETH']?.price || tokenPrice.price;
            const gasEstimateUSD = gasCostETH * ethPrice;

            advancedRiskAssessment = assessRiskClassifier({
              tokenIn: swapContext.tokenIn,
              tokenOut: swapContext.tokenOut,
              amountUSD,
              slippage: swapContext.slippage || 0.5,
              priceImpact: quote.priceImpact,
              marketVolatility: Math.abs(tokenPrice.change24h || 0),
              poolLiquidityUSD: undefined, // Not available from current quote
              gasEstimateUSD,
            });

            // Add advanced risk summary if significant risk detected
            if (advancedRiskAssessment.score > 20) {
              const summary = getRiskSummary(advancedRiskAssessment);
              contextPrompt += `\n[Advanced Risk Analysis]: ${summary}`;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch market context:', error);
      }
    }

    if (swapContext.quote) {
      const q = swapContext.quote;

      // Format token amounts with proper decimals for human readability
      // expectedOutput and minOutput are raw token amounts (e.g., "39903300" USDC with 6 decimals = "39903.30" USDC)
      // We need to divide by 10^decimals to get the human-readable amount
      const formatTokenAmount = (rawAmount: string, tokenSymbol: string): string => {
        // USDC has 6 decimals, ETH/WETH has 18 decimals
        const decimals = tokenSymbol === 'USDC' ? 6 : 18;
        const amount = Number(rawAmount) / Math.pow(10, decimals);

        // Format with appropriate precision
        if (tokenSymbol === 'USDC') {
          return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
          return amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
        }
      };

      contextPrompt += `\n[Quote Data]:`;
      contextPrompt += `\n- Expected Output: ${formatTokenAmount(q.expectedOutput, swapContext.tokenOut || 'USDC')} ${swapContext.tokenOut}`;
      contextPrompt += `\n- Min Output (with slippage): ${formatTokenAmount(q.minOutput, swapContext.tokenOut || 'USDC')} ${swapContext.tokenOut}`;
      contextPrompt += `\n- Gas Estimate: ${q.estimatedGas} gas`;
      contextPrompt += `\n- Fee Tier: ${q.feeTier / 10000}%`;
      contextPrompt += `\n- Route: ${q.route}`;
      if (q.priceImpact) contextPrompt += `\n- Price Impact: ${q.priceImpact}%`;
    }

    if (swapContext.simulation) {
      contextPrompt += `\n[Simulation]: ${swapContext.simulation.success ? 'Success' : 'Failed'}`;
      if (swapContext.simulation.gasUsed) {
        contextPrompt += ` (Gas: ${swapContext.simulation.gasUsed})`;
      }
      if (swapContext.simulation.error) {
        contextPrompt += ` Error: ${swapContext.simulation.error}`;
      }
    }

    if (swapContext.slippage) {
      contextPrompt += `\n[Slippage Tolerance]: ${swapContext.slippage}%`;
    }

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: contextPrompt
          ? `${contextPrompt}\n\nUser: ${userMessage}`
          : userMessage,
      },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: ENHANCED_SYSTEM_PROMPT,
      messages,
    });

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Attempt to parse the model response once so we can inspect the action and message
    let parsedResponse: any | null = null;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      parsedResponse = null;
    }

    const actionType = parsedResponse?.action?.type;
    const normalizedMessage = userMessage.trim().toLowerCase();
    const isAutoSwapSummary = ['show quote', 'simulation result', 'transaction result'].includes(normalizedMessage);
    const isSwapAction =
      isAutoSwapSummary ||
      (actionType && ['fetch_quote', 'modify_params', 'simulate', 'execute_swap'].includes(actionType));

    // Generate transaction preview data ONLY when we're showing the quote result
    // NOT when fetching/modifying (to avoid showing stale data before new quote arrives)
    // NOT for simulation results (we don't want to create a new card after simulation)
    let transactionData: TransactionPreviewData | undefined;
    let showActions = false;

    const shouldShowTransactionCard =
      normalizedMessage === 'show quote' &&
      swapContext.quote &&
      swapContext.tokenIn &&
      swapContext.tokenOut &&
      swapContext.amount;

    if (shouldShowTransactionCard) {
      const quote = swapContext.quote!; // Already checked in shouldShowTransactionCard
      const tokenIn = swapContext.tokenIn!; // Already checked in shouldShowTransactionCard
      const tokenOut = swapContext.tokenOut!; // Already checked in shouldShowTransactionCard
      const amount = swapContext.amount!; // Already checked in shouldShowTransactionCard

      // Format token amounts with proper decimals
      const formatTokenAmount = (rawAmount: string, tokenSymbol: string): string => {
        const decimals = tokenSymbol === 'USDC' ? 6 : 18;
        const amount = Number(rawAmount) / Math.pow(10, decimals);
        if (tokenSymbol === 'USDC') {
          return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
          return amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
        }
      };

      const expectedOutput = formatTokenAmount(quote.expectedOutput, tokenOut);
      const minOutput = formatTokenAmount(quote.minOutput, tokenOut);
      const exchangeRate = `1 ${tokenIn} = ${(Number(expectedOutput.replace(/,/g, '')) / Number(amount)).toFixed(2)} ${tokenOut}`;

      transactionData = {
        youPay: amount,
        youPayToken: tokenIn,
        youReceive: expectedOutput,
        youReceiveToken: tokenOut,
        exchangeRate,
        route: quote.route,
        poolFeeTier: `${quote.feeTier / 10000}%`,
        liquiditySource: 'Uniswap V3 Pool',
        slippageTolerance: `${swapContext.slippage || 0.5}%`,
        minReceived: minOutput,
        estimatedGas: `${quote.estimatedGas} gas`,
        gasUSD: marketContext ? `${((Number(quote.estimatedGas) * 0.001 / 1e9) * (marketContext.prices['ETH']?.price || 3900)).toFixed(2)}` : undefined,
        priceImpact: `${quote.priceImpact?.toFixed(2) || '0.01'}%`,
        secured: true,
      };

      // Show actions if we have a quote but no simulation yet
      showActions = !swapContext.simulation;
    }

    // Try to parse structured JSON response
    if (parsedResponse) {
      // Add suggestions after successful swap
      let suggestions;
      if (swapContext.transaction?.status === 'success' && marketContext && swapContext.tokenOut && swapContext.amount) {
        suggestions = generateSuggestedActions(swapContext.tokenOut, swapContext.amount, marketContext);
      }

      const cleanMessage = parsedResponse.message || "I've processed your request.";

      return {
        message: cleanMessage,
        action: parsedResponse.action,
        suggestions,
        riskWarnings: riskAssessment?.warnings,
        transactionData,
        showActions,
      };
    }

    try {
      // JSON parsing failed - try to extract message from malformed JSON
      const messageMatch = responseText.match(/"message"\s*:\s*"([^"]+)"/);
      if (messageMatch) {
        return {
          message: messageMatch[1],
          suggestions: undefined,
          riskWarnings: riskAssessment?.warnings,
          transactionData,
          showActions,
        };
      }
      // Fall through to return plain text
    } catch (e) {
      // Ignore parsing errors and fall through
    }

    // Add suggestions for non-JSON responses too
    let suggestions;
    if (
      swapContext.transaction?.status === 'success' &&
      marketContext &&
      swapContext.tokenOut &&
      swapContext.amount
    ) {
      suggestions = generateSuggestedActions(
        swapContext.tokenOut,
        swapContext.amount,
        marketContext
      );
    }

    return {
      message: responseText,
      suggestions,
      riskWarnings: riskAssessment?.warnings,
      transactionData,
      showActions,
    };
  } catch (error) {
    console.error('Enhanced copilot error:', error);
    return {
      message: "I'm having trouble processing that. Could you rephrase or try again?",
    };
  }
}
