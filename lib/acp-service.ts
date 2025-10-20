// SwapWright ACP Service Definition

import { ACPServiceMetadata } from './acp-types';

/**
 * SwapWright service metadata for agent discovery
 */
export const SWAPWRIGHT_SERVICE: ACPServiceMetadata = {
  serviceId: 'swapwright-v1',
  name: 'SwapWright',
  description: 'AI-powered DEX aggregator for Base network. Provides natural language swap execution with quote aggregation, simulation, and MEV protection.',
  version: '1.0.0',
  network: 'base-mainnet',
  entityId: process.env.VIRTUALS_ENTITY_ID || '',
  agentWallet: process.env.VIRTUALS_AGENT_WALLET || '',

  authentication: 'none', // Open for agent-to-agent calls

  capabilities: [
    {
      id: 'swap-quote',
      name: 'Get Swap Quote',
      description: 'Get a quote for swapping tokens on Base network with best route selection',
      inputSchema: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amount'],
        properties: {
          tokenIn: {
            type: 'string',
            enum: ['ETH', 'WETH', 'USDC', 'USDBC'],
            description: 'Input token symbol',
          },
          tokenOut: {
            type: 'string',
            enum: ['ETH', 'WETH', 'USDC', 'USDBC'],
            description: 'Output token symbol',
          },
          amount: {
            type: 'string',
            description: 'Amount to swap (in token decimals)',
          },
          slippage: {
            type: 'number',
            minimum: 0.1,
            maximum: 50,
            default: 0.5,
            description: 'Slippage tolerance percentage',
          },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          expectedOutput: { type: 'string' },
          minOutput: { type: 'string' },
          estimatedGas: { type: 'string' },
          route: { type: 'string' },
          priceImpact: { type: 'number' },
        },
      },
      constraints: {
        supportedTokens: ['ETH', 'WETH', 'USDC', 'USDBC'],
        minSlippage: 0.1,
        maxSlippage: 50,
      },
    },
    {
      id: 'swap-execute',
      name: 'Execute Swap',
      description: 'Execute a token swap on Base network with pre-execution simulation',
      inputSchema: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amount', 'userWallet'],
        properties: {
          tokenIn: { type: 'string' },
          tokenOut: { type: 'string' },
          amount: { type: 'string' },
          userWallet: {
            type: 'string',
            description: 'User wallet address that will execute the swap',
          },
          slippage: { type: 'number', default: 0.5 },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          transactionHash: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'failed'] },
          blockNumber: { type: 'number' },
        },
      },
    },
  ],

  endpoints: [
    {
      path: '/api/acp/metadata',
      method: 'GET',
      description: 'Get service metadata and capabilities',
      requiresAuth: false,
    },
    {
      path: '/api/acp/status',
      method: 'GET',
      description: 'Get service health and operational status',
      requiresAuth: false,
    },
    {
      path: '/api/acp/execute',
      method: 'POST',
      description: 'Execute a swap request from another agent',
      requiresAuth: false,
    },
  ],
};
