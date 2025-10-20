// ACP Service Status Endpoint

import { ACPServiceStatus } from '@/lib/acp-types';

const startTime = Date.now();

export async function GET() {
  const status: ACPServiceStatus = {
    service: 'SwapWright',
    status: 'online',
    version: '1.0.0',
    uptime: Date.now() - startTime,
    network: 'base-mainnet',
    supportedTokens: ['ETH', 'WETH', 'USDC', 'USDBC'],
    limits: {
      maxSwapAmount: '1000', // ETH equivalent
      minSwapAmount: '0.0001',
      rateLimit: {
        requests: 20,
        window: '1m',
      },
    },
  };

  return Response.json(status);
}
