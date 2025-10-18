import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { getBaseRpcUrl } from "@/lib/uniswap";

const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(getBaseRpcUrl()),
});

export async function POST(req: Request) {
  try {
    const { tokenAddress, ownerAddress, spenderAddress, amount } = await req.json();

    if (!tokenAddress || !ownerAddress || !spenderAddress || !amount) {
      return Response.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const allowance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`],
    });

    const needsApproval = allowance < BigInt(amount);

    return Response.json({
      allowance: allowance.toString(),
      needsApproval,
    });
  } catch (error) {
    console.error("check-approval failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to check approval" },
      { status: 500 }
    );
  }
}
