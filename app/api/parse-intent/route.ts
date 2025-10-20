import Anthropic from "@anthropic-ai/sdk";
import { SWAP_TOOL } from "@/lib/intent-schema";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import { validateInput, checkRateLimit, logSecurityEvent } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // Get IP for rate limiting (use x-forwarded-for in production)
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';

    // Rate limiting
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      logSecurityEvent({
        type: 'rate_limit',
        identifier: ip,
        reason: 'Rate limit exceeded',
        metadata: { resetAt: new Date(rateLimit.resetAt).toISOString() }
      });
      return Response.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s` },
        { status: 429 }
      );
    }

    // Security validation
    const validation = validateInput(message);
    if (!validation.valid) {
      logSecurityEvent({
        type: 'blocked_input',
        identifier: ip,
        reason: validation.reason || 'Invalid input',
        metadata: { originalInput: message.substring(0, 100) }
      });
      return Response.json({ error: validation.reason || "Invalid input" }, { status: 400 });
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [SWAP_TOOL],
      messages: [{ role: "user", content: validation.sanitized }]
    });

    // Extract tool use
    const toolUse = response.content.find(c => c.type === "tool_use");

    if (!toolUse) {
      return Response.json({
        error: "Could not parse intent. Please try: 'Swap 0.1 ETH for USDC'"
      }, { status: 400 });
    }

    return Response.json({ intent: toolUse.input });
  } catch (error) {
    console.error('parse-intent failed:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Intent parsing failed' },
      { status: 500 }
    );
  }
}
