import Anthropic from "@anthropic-ai/sdk";
import { SWAP_TOOL } from "@/lib/intent-schema";
import { SYSTEM_PROMPT } from "@/lib/prompts";

export async function POST(req: Request) {
  const { message } = await req.json();

  // Security: Block addresses and URLs
  if (/0x[a-fA-F0-9]{40}/.test(message) || /https?:\/\//.test(message)) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [SWAP_TOOL],
    messages: [{ role: "user", content: message }]
  });

  // Extract tool use
  const toolUse = response.content.find(c => c.type === "tool_use");

  return Response.json({ intent: toolUse?.input });
}
