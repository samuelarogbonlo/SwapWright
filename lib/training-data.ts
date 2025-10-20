// Training data for AI model improvements
// Labeled examples for intent recognition and risk assessment

export interface LabeledExample {
  input: string;
  intent: 'swap' | 'modify_params' | 'explain' | 'execute' | 'unknown';
  expectedAction?: {
    type: string;
    params?: Record<string, any>;
  };
  riskLevel?: 'low' | 'medium' | 'high';
  notes?: string;
}

/**
 * Labeled dataset for swap intent recognition
 * Used for few-shot learning and prompt engineering
 */
export const INTENT_EXAMPLES: LabeledExample[] = [
  // Basic swap intents
  {
    input: 'swap 1 ETH to USDC',
    intent: 'swap',
    expectedAction: { type: 'fetch_quote', params: { tokenIn: 'ETH', tokenOut: 'USDC', amount: '1' } },
    riskLevel: 'low',
  },
  {
    input: 'exchange 0.5 WETH for USDC',
    intent: 'swap',
    expectedAction: { type: 'fetch_quote', params: { tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.5' } },
    riskLevel: 'low',
  },
  {
    input: 'I want to trade 100 USDC for ETH',
    intent: 'swap',
    expectedAction: { type: 'fetch_quote', params: { tokenIn: 'USDC', tokenOut: 'ETH', amount: '100' } },
    riskLevel: 'low',
  },

  // Edge cases - relative amounts
  {
    input: 'swap half my ETH to USDC',
    intent: 'swap',
    notes: 'Requires wallet balance check - ask user for specific amount',
    riskLevel: 'medium',
  },
  {
    input: 'use all my USDC to buy ETH',
    intent: 'swap',
    notes: 'Max swap - should prompt for confirmation',
    riskLevel: 'medium',
  },
  {
    input: 'swap 25% of my ETH',
    intent: 'swap',
    notes: 'Percentage-based - need to calculate from balance',
    riskLevel: 'medium',
  },

  // Parameter modifications
  {
    input: 'actually make it 2 ETH',
    intent: 'modify_params',
    expectedAction: { type: 'modify_params', params: { amount: '2' } },
    riskLevel: 'low',
  },
  {
    input: 'change to 0.1 ETH',
    intent: 'modify_params',
    expectedAction: { type: 'modify_params', params: { amount: '0.1' } },
    riskLevel: 'low',
  },
  {
    input: 'use 1% slippage instead',
    intent: 'modify_params',
    expectedAction: { type: 'modify_params', params: { slippage: 1 } },
    riskLevel: 'low',
  },
  {
    input: 'increase slippage to 2%',
    intent: 'modify_params',
    expectedAction: { type: 'modify_params', params: { slippage: 2 } },
    riskLevel: 'medium',
    notes: 'Higher slippage - warn user',
  },

  // Execution confirmations
  {
    input: 'yes',
    intent: 'execute',
    expectedAction: { type: 'execute_swap' },
    riskLevel: 'medium',
  },
  {
    input: 'confirm',
    intent: 'execute',
    expectedAction: { type: 'execute_swap' },
    riskLevel: 'medium',
  },
  {
    input: 'do it',
    intent: 'execute',
    expectedAction: { type: 'execute_swap' },
    riskLevel: 'medium',
  },
  {
    input: 'simulate first',
    intent: 'execute',
    expectedAction: { type: 'simulate' },
    riskLevel: 'low',
  },
  {
    input: 'let me see a simulation',
    intent: 'execute',
    expectedAction: { type: 'simulate' },
    riskLevel: 'low',
  },

  // Explanation requests
  {
    input: 'why is gas so high?',
    intent: 'explain',
    notes: 'Explain current gas prices and network congestion',
  },
  {
    input: 'what does slippage mean?',
    intent: 'explain',
    notes: 'Educational - explain slippage concept',
  },
  {
    input: 'explain the route',
    intent: 'explain',
    notes: 'Parse and explain the swap route',
  },
  {
    input: 'is this a good price?',
    intent: 'explain',
    notes: 'Market analysis - compare to recent prices',
  },
  {
    input: 'how much will I receive?',
    intent: 'explain',
    notes: 'Explain expected output from quote',
  },

  // Complex/multi-step requests
  {
    input: 'swap 1 ETH to USDC then stake it on Aave',
    intent: 'swap',
    notes: 'Multi-step - handle swap first, mention staking not supported',
    riskLevel: 'medium',
  },
  {
    input: 'get me the best price for 5 ETH to USDC',
    intent: 'swap',
    expectedAction: { type: 'fetch_quote', params: { tokenIn: 'ETH', tokenOut: 'USDC', amount: '5' } },
    riskLevel: 'high',
    notes: 'Large trade - warn about price impact',
  },

  // Ambiguous/unknown intents
  {
    input: 'what can you do?',
    intent: 'unknown',
    notes: 'Explain capabilities',
  },
  {
    input: 'hello',
    intent: 'unknown',
    notes: 'Greeting - provide helpful intro',
  },
  {
    input: 'help',
    intent: 'unknown',
    notes: 'Show usage examples',
  },

  // Invalid requests
  {
    input: 'swap ETH to BTC',
    intent: 'swap',
    notes: 'Unsupported token - explain supported tokens only',
    riskLevel: 'low',
  },
  {
    input: 'buy me 1000 ETH',
    intent: 'swap',
    notes: 'Unrealistic amount - clarify or reject',
    riskLevel: 'high',
  },
];

/**
 * Risk assessment training data
 * Historical patterns that indicate high-risk swaps
 */
export interface RiskPattern {
  pattern: string;
  indicators: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export const RISK_PATTERNS: RiskPattern[] = [
  {
    pattern: 'Large trade',
    indicators: ['amount > $10,000 USD', 'significant portion of liquidity pool'],
    riskLevel: 'high',
    recommendation: 'Consider splitting into smaller trades to reduce price impact',
  },
  {
    pattern: 'High volatility',
    indicators: ['token price change > 10% in 24h', 'market volatility spike'],
    riskLevel: 'medium',
    recommendation: 'Increase slippage tolerance or wait for market to stabilize',
  },
  {
    pattern: 'Low liquidity',
    indicators: ['pool TVL < $100k', 'wide bid-ask spread'],
    riskLevel: 'high',
    recommendation: 'Expect significant price impact, verify route carefully',
  },
  {
    pattern: 'High slippage tolerance',
    indicators: ['slippage > 5%', 'user requested high slippage'],
    riskLevel: 'medium',
    recommendation: 'High slippage increases sandwich attack risk',
  },
  {
    pattern: 'Extreme price impact',
    indicators: ['price impact > 5%', 'expected vs actual output variance'],
    riskLevel: 'critical',
    recommendation: 'Trade will significantly move the market - strongly recommend reducing amount',
  },
  {
    pattern: 'Network congestion',
    indicators: ['gas price > 50 gwei', 'pending tx backlog'],
    riskLevel: 'medium',
    recommendation: 'High gas fees detected - consider waiting or increasing gas limit',
  },
  {
    pattern: 'New/unverified token',
    indicators: ['token not in whitelist', 'low trading volume'],
    riskLevel: 'critical',
    recommendation: 'Only whitelisted tokens supported for security',
  },
];

/**
 * Few-shot examples for prompt engineering
 * Best examples to include in system prompt
 */
export const FEW_SHOT_EXAMPLES = `
**Example Interactions:**

User: "swap 1 ETH to USDC"
Assistant: "I'll get a quote for swapping 1 ETH to USDC. ETH is currently up 2.1% today."
Action: { "type": "fetch_quote", "params": { "tokenIn": "ETH", "tokenOut": "USDC", "amount": "1" } }

User: "actually make it 0.5 ETH"
Assistant: "I've updated the amount to 0.5 ETH. Fetching new quote..."
Action: { "type": "modify_params", "params": { "amount": "0.5" } }

User: "why is gas so high?"
Assistant: "Gas is currently 0.00015 ETH (~$0.60 USD). This is normal for Base network during peak hours."
Action: none

User: "yes, do it"
Assistant: "Executing your swap now. Please sign the transaction in your wallet..."
Action: { "type": "execute_swap" }

User: "swap 100 ETH to USDC"
Assistant: "That's a large trade ($398,000 USD). This will have significant price impact (est. 3.2%). Consider splitting into smaller trades?"
Action: { "type": "fetch_quote", "params": { "tokenIn": "ETH", "tokenOut": "USDC", "amount": "100" } }
`;
