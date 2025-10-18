export async function POST(req: Request) {
  try {
    const { from, to, data, value } = await req.json();

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
      return Response.json({ error: "Simulation failed" }, { status: 500 });
    }

    const result = await response.json();

    return Response.json({
      success: result.transaction.status,
      gasUsed: result.transaction.gas_used,
      error: result.transaction.error_message
    });
  } catch (error) {
    console.error('simulate failed:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Simulation failed' },
      { status: 500 }
    );
  }
}
