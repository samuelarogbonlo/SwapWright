import { checkRateLimit, logSecurityEvent } from "@/lib/security";

function parseSimulationError(errorMessage: string): string {
  // Parse common Tenderly/EVM errors into user-friendly messages
  if (errorMessage.includes('insufficient funds')) {
    return 'Insufficient balance. You don\'t have enough ETH to complete this swap.';
  }
  if (errorMessage.includes('execution reverted')) {
    return 'Transaction would fail. This swap cannot be executed at the current price.';
  }
  if (errorMessage.includes('slippage')) {
    return 'Price moved too much. Try increasing your slippage tolerance.';
  }
  if (errorMessage.includes('liquidity')) {
    return 'Insufficient liquidity in the pool. Try a smaller amount.';
  }
  if (errorMessage.includes('deadline')) {
    return 'Transaction deadline exceeded. Please try again.';
  }
  if (errorMessage.includes('allowance') || errorMessage.includes('approve')) {
    return 'Token approval required. Please approve the token first.';
  }

  return 'Simulation failed. The transaction would not succeed on-chain.';
}

export async function POST(req: Request) {
  try {
    const { from, to, data, value } = await req.json();

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || from || 'anonymous';
    const rateLimit = checkRateLimit(ip, 15, 60000); // 15 simulations per minute
    if (!rateLimit.allowed) {
      logSecurityEvent({
        type: 'rate_limit',
        identifier: ip,
        reason: 'Simulation rate limit exceeded',
      });
      return Response.json(
        { error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s` },
        { status: 429 }
      );
    }

    const response = await fetch(
      `https://api.tenderly.co/api/v1/account/${process.env.TENDERLY_ACCOUNT}/project/${process.env.TENDERLY_PROJECT}/simulate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Key": process.env.TENDERLY_ACCESS_KEY || ""
        },
        body: JSON.stringify({
          network_id: "8453", // Base Mainnet
          from,
          to,
          input: data,
          value,
          save: false,
          simulation_type: "quick"
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tenderly API error:', errorText);

      // Try to parse the error for user-friendly message
      let userError = 'Simulation failed';
      try {
        const errorData = JSON.parse(errorText);
        const rawError = errorData?.error?.message || '';
        userError = parseSimulationError(rawError);
      } catch {
        // If parsing fails, check the raw text
        userError = parseSimulationError(errorText);
      }

      return Response.json({ error: userError }, { status: 500 });
    }

    const result = await response.json();

    // Check if simulation succeeded
    if (!result.transaction.status) {
      const errorMsg = result.transaction.error_message || 'Transaction would fail';
      logSecurityEvent({
        type: 'simulation_failure',
        identifier: ip,
        reason: 'Transaction simulation failed',
        metadata: { error: errorMsg }
      });
      return Response.json({
        success: false,
        gasUsed: result.transaction.gas_used || '0',
        error: parseSimulationError(errorMsg)
      });
    }

    return Response.json({
      success: true,
      gasUsed: result.transaction.gas_used,
      error: undefined
    });
  } catch (error) {
    console.error('simulate failed:', error);
    return Response.json(
      { error: 'Unable to simulate transaction. Please try again.' },
      { status: 500 }
    );
  }
}
