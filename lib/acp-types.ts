// ACP (Agent Communication Protocol) Types for Virtuals Protocol Integration

/**
 * Service metadata for agent discovery
 */
export interface ACPServiceMetadata {
  serviceId: string;
  name: string;
  description: string;
  version: string;
  capabilities: ACPCapability[];
  endpoints: ACPEndpoint[];
  authentication: ACPAuthMethod;
  network: string;
  entityId?: string;
  agentWallet?: string;
}

/**
 * Service capability definition
 */
export interface ACPCapability {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  constraints?: {
    maxAmount?: string;
    supportedTokens?: string[];
    minSlippage?: number;
    maxSlippage?: number;
  };
}

/**
 * API endpoint definition
 */
export interface ACPEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  requiresAuth: boolean;
}

/**
 * Authentication method
 */
export type ACPAuthMethod = 'none' | 'bearer' | 'wallet-signature' | 'api-key';

/**
 * Agent request to execute a swap
 */
export interface ACPSwapRequest {
  requestId: string;
  agentId: string;
  agentWallet: string;
  timestamp: string;
  action: 'swap';
  parameters: {
    tokenIn: string;
    tokenOut: string;
    amount: string;
    slippage?: number;
    userWallet?: string; // Optional: execute on behalf of user
  };
  metadata?: {
    reason?: string; // Why the agent is requesting this swap
    priority?: 'low' | 'normal' | 'high';
    timeout?: number; // Max time to execute (ms)
  };
}

/**
 * Response from SwapWright to the requesting agent
 */
export interface ACPSwapResponse {
  requestId: string;
  status: 'success' | 'error' | 'pending';
  timestamp: string;
  data?: {
    quote?: {
      expectedOutput: string;
      minOutput: string;
      estimatedGas: string;
      route: string;
      priceImpact?: number;
    };
    transaction?: {
      hash: string;
      status: 'pending' | 'confirmed' | 'failed';
      blockNumber?: number;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Service status response
 */
export interface ACPServiceStatus {
  service: string;
  status: 'online' | 'offline' | 'degraded';
  version: string;
  uptime: number;
  network: string;
  supportedTokens: string[];
  limits: {
    maxSwapAmount: string;
    minSwapAmount: string;
    rateLimit: {
      requests: number;
      window: string;
    };
  };
}
