/**
 * Security utilities for input validation and attack prevention
 */

// Prompt injection patterns to block
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
  /system\s*:\s*/i,
  /you\s+are\s+(now|a)\s+/i,
  /assistant\s*:\s*/i,
  /<\s*script[^>]*>/i,
  /javascript\s*:/i,
  /on\w+\s*=\s*['"]/i,
  /eval\s*\(/i,
  /execute\s+code/i,
  /bypass\s+filter/i,
  /override\s+instructions/i,
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\bor\b|\band\b)\s+['"0-9]/i,
  /union\s+select/i,
  /drop\s+table/i,
  /--\s*$/,
  /\/\*.*\*\//,
  /xp_cmdshell/i,
];

// Suspicious unicode and control characters
const SUSPICIOUS_UNICODE_PATTERNS = [
  /[\u200B-\u200D\uFEFF]/g, // Zero-width characters
  /[\u202A-\u202E]/g, // Text direction override
  /[\u0000-\u001F]/g, // Control characters (except newline/tab)
];

/**
 * Validate user input for security threats
 */
export function validateInput(input: string): {
  valid: boolean;
  reason?: string;
  sanitized: string;
} {
  // Check length
  if (input.length > 500) {
    return {
      valid: false,
      reason: 'Input too long (max 500 characters)',
      sanitized: input.substring(0, 500),
    };
  }

  // Remove suspicious unicode
  let sanitized = input;
  for (const pattern of SUSPICIOUS_UNICODE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Check for prompt injection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        valid: false,
        reason: 'Potential prompt injection detected',
        sanitized,
      };
    }
  }

  // Check for SQL injection
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        valid: false,
        reason: 'Potential SQL injection detected',
        sanitized,
      };
    }
  }

  // Block direct addresses/URLs (already in parse-intent but double-check)
  if (/0x[a-fA-F0-9]{40}/.test(sanitized)) {
    return {
      valid: false,
      reason: 'Direct addresses not allowed',
      sanitized,
    };
  }

  if (/https?:\/\//.test(sanitized)) {
    return {
      valid: false,
      reason: 'URLs not allowed',
      sanitized,
    };
  }

  return {
    valid: true,
    sanitized,
  };
}

/**
 * Rate limiting using in-memory store
 * In production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 20,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired entries periodically
  if (Math.random() < 0.1) {
    // 10% chance to cleanup
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || record.resetAt < now) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  };
}

/**
 * Validate contract addresses against whitelist
 */
const WHITELISTED_CONTRACTS = [
  '0x2626664c2603336E57B271c5C0b26F421741e481', // SwapRouter02
  '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // QuoterV2
  '0x4200000000000000000000000000000000000006', // WETH
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
  '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDBC
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH sentinel
];

export function validateContractAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  return WHITELISTED_CONTRACTS.some(
    whitelisted => whitelisted.toLowerCase() === normalized
  );
}

/**
 * Server-side token symbol to address mapping (source of truth)
 * Never trust client-provided addresses - always re-derive from symbol
 */
const TOKEN_ADDRESS_MAP: Record<string, string> = {
  'WETH': '0x4200000000000000000000000000000000000006',
  'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'USDBC': '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
};

/**
 * Validate and derive token addresses from symbols
 * This prevents malicious clients from injecting arbitrary contract addresses
 */
export function deriveTokenAddress(symbol: string): string {
  const address = TOKEN_ADDRESS_MAP[symbol.toUpperCase()];
  if (!address) {
    throw new Error(`Unknown token symbol: ${symbol}`);
  }
  return address;
}

/**
 * Validate all addresses in a swap transaction
 * Ensures to, tokenIn, tokenOut, and spender are all whitelisted
 */
export function validateSwapAddresses(params: {
  to: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  spender?: string;
}): void {
  // Validate router contract
  if (!validateContractAddress(params.to)) {
    throw new Error(`Invalid router address: ${params.to}`);
  }

  // Validate spender if provided
  if (params.spender && !validateContractAddress(params.spender)) {
    throw new Error(`Invalid spender address: ${params.spender}`);
  }

  // Derive and validate token addresses
  const tokenInAddress = deriveTokenAddress(params.tokenInSymbol);
  const tokenOutAddress = deriveTokenAddress(params.tokenOutSymbol);

  if (!validateContractAddress(tokenInAddress)) {
    throw new Error(`Token ${params.tokenInSymbol} not whitelisted`);
  }

  if (!validateContractAddress(tokenOutAddress)) {
    throw new Error(`Token ${params.tokenOutSymbol} not whitelisted`);
  }
}

/**
 * Log blocked attempts for security monitoring
 */
export function logSecurityEvent(event: {
  type: 'blocked_input' | 'rate_limit' | 'invalid_contract' | 'simulation_failure' | 'copilot_error' | 'acp_request' | 'acp_error';
  identifier: string;
  reason: string;
  metadata?: Record<string, any>;
}) {
  // In production, send to monitoring service (Sentry, DataDog, etc.)
  console.warn('[SECURITY]', {
    timestamp: new Date().toISOString(),
    ...event,
  });

  // Could also store in database for analysis
  // await db.securityEvents.create({ data: event });
}

/**
 * Sanitize error messages to avoid leaking sensitive info
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Don't expose internal error details to users
    if (error.message.includes('API key') || error.message.includes('secret')) {
      return 'An internal error occurred. Please try again.';
    }

    if (error.message.includes('insufficient funds')) {
      return 'Insufficient balance to complete this transaction.';
    }

    if (error.message.includes('network') || error.message.includes('RPC')) {
      return 'Network error. Please check your connection and try again.';
    }

    return error.message;
  }

  return 'An unexpected error occurred.';
}
