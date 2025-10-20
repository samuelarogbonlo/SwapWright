import { NextRequest } from 'next/server';
import { getEnhancedCopilotResponse, Message, SwapContext } from '@/lib/ai-copilot-enhanced';
import { checkRateLimit, logSecurityEvent } from '@/lib/security';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Rate limiting
  const rateLimit = checkRateLimit(ip, 20, 60000);
  if (!rateLimit.allowed) {
    logSecurityEvent({
      type: 'rate_limit',
      identifier: ip,
      reason: 'AI copilot rate limit exceeded',
    });
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { message, conversationHistory, swapContext } = body;

    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Invalid message' }, { status: 400 });
    }

    // Limit message length
    if (message.length > 500) {
      return Response.json({ error: 'Message too long (max 500 characters)' }, { status: 400 });
    }

    // Validate conversation history
    const history: Message[] = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-10) // Keep last 10 messages for context
      : [];

    // Validate swap context
    const context: SwapContext = swapContext || {};

    const response = await getEnhancedCopilotResponse(message, history, context);

    return Response.json(response);
  } catch (error) {
    console.error('AI copilot error:', error);
    logSecurityEvent({
      type: 'copilot_error',
      identifier: ip,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}
