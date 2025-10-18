import { encodeFunctionData, maxUint256 } from "viem";

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export async function POST(req: Request) {
  try {
    const { tokenAddress, spenderAddress, amount } = await req.json();

    if (!tokenAddress || !spenderAddress) {
      return Response.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Use max approval for simplicity (user only approves once)
    const approvalAmount = amount ? BigInt(amount) : maxUint256;

    const approvalCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spenderAddress as `0x${string}`, approvalAmount],
    });

    return Response.json({
      to: tokenAddress,
      data: approvalCalldata,
      value: "0",
    });
  } catch (error) {
    console.error("build-approval failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to build approval" },
      { status: 500 }
    );
  }
}
