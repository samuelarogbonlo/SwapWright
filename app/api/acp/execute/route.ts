// ACP Agent Request Handler - Execute swaps on behalf of other agents

import { NextRequest } from 'next/server';
import { ACPSwapRequest, ACPSwapResponse } from '@/lib/acp-types';
import { checkRateLimit, logSecurityEvent } from '@/lib/security';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Rate limiting
  const rateLimit = checkRateLimit(ip, 10, 60000);
  if (!rateLimit.allowed) {
    logSecurityEvent({
      type: 'rate_limit',
      identifier: ip,
      reason: 'ACP execute rate limit exceeded',
    });

    const errorResponse: ACPSwapResponse = {
      requestId: '',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from your agent. Please retry in 60 seconds.',
      },
    };

    return Response.json(errorResponse, { status: 429 });
  }

  try {
    const acpRequest: ACPSwapRequest = await request.json();

    // Validate request structure
    if (!acpRequest.requestId || !acpRequest.agentId || !acpRequest.parameters) {
      const errorResponse: ACPSwapResponse = {
        requestId: acpRequest.requestId || 'unknown',
        status: 'error',
        timestamp: new Date().toISOString(),
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: requestId, agentId, or parameters',
        },
      };
      return Response.json(errorResponse, { status: 400 });
    }

    const { tokenIn, tokenOut, amount, slippage } = acpRequest.parameters;

    // Validate parameters
    if (!tokenIn || !tokenOut || !amount) {
      const errorResponse: ACPSwapResponse = {
        requestId: acpRequest.requestId,
        status: 'error',
        timestamp: new Date().toISOString(),
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Missing required swap parameters: tokenIn, tokenOut, or amount',
        },
      };
      return Response.json(errorResponse, { status: 400 });
    }

    // Validate tokens
    const SUPPORTED_TOKENS = ['ETH', 'WETH', 'USDC', 'USDBC'];
    if (!SUPPORTED_TOKENS.includes(tokenIn) || !SUPPORTED_TOKENS.includes(tokenOut)) {
      const errorResponse: ACPSwapResponse = {
        requestId: acpRequest.requestId,
        status: 'error',
        timestamp: new Date().toISOString(),
        error: {
          code: 'UNSUPPORTED_TOKEN',
          message: `Unsupported tokens. Supported: ${SUPPORTED_TOKENS.join(', ')}`,
          details: { tokenIn, tokenOut },
        },
      };
      return Response.json(errorResponse, { status: 400 });
    }

    // Log agent request
    logSecurityEvent({
      type: 'acp_request',
      identifier: acpRequest.agentId,
      reason: `Agent swap request: ${amount} ${tokenIn} → ${tokenOut}`,
    });

    // Get quote using existing API
    const quoteResponse = await fetch(`${request.nextUrl.origin}/api/get-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenIn,
        tokenOut,
        amountIn: amount, // API expects 'amountIn' not 'amount'
        slippage: slippage || 0.5,
      }),
    });

    if (!quoteResponse.ok) {
      const errorData = await quoteResponse.json().catch(() => ({ error: 'Quote failed' }));
      const errorResponse: ACPSwapResponse = {
        requestId: acpRequest.requestId,
        status: 'error',
        timestamp: new Date().toISOString(),
        error: {
          code: 'QUOTE_FAILED',
          message: errorData.error || 'Failed to get quote',
        },
      };
      return Response.json(errorResponse, { status: 500 });
    }

    const quoteData = await quoteResponse.json();

    // Return quote to agent (not executing automatically for safety)
    const successResponse: ACPSwapResponse = {
      requestId: acpRequest.requestId,
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        quote: {
          expectedOutput: quoteData.expectedOutput,
          minOutput: quoteData.minOutput,
          estimatedGas: quoteData.estimatedGas,
          route: quoteData.route || `${tokenIn} → ${tokenOut}`,
          priceImpact: quoteData.priceImpact,
        },
      },
    };

    return Response.json(successResponse);

  } catch (error) {
    console.error('ACP execute error:', error);
    logSecurityEvent({
      type: 'acp_error',
      identifier: ip,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });

    const errorResponse: ACPSwapResponse = {
      requestId: 'unknown',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process agent request',
      },
    };

    return Response.json(errorResponse, { status: 500 });
  }
}
