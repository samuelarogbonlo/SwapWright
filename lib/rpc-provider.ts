/**
 * Multi-RPC Provider with automatic failover
 * Handles RPC failures gracefully by trying backup providers
 */

interface RPCConfig {
  url: string;
  priority: number;
  name: string;
}

const RPC_PROVIDERS: RPCConfig[] = [
  {
    url: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : '',
    priority: 1,
    name: 'Alchemy',
  },
  {
    url: 'https://mainnet.base.org',
    priority: 2,
    name: 'Base Public RPC',
  },
  {
    url: 'https://base.llamarpc.com',
    priority: 3,
    name: 'LlamaRPC',
  },
].filter(provider => provider.url); // Remove empty providers

/**
 * Fetch with automatic RPC failover
 * Tries providers in priority order until one succeeds
 */
export async function fetchWithFailover(
  path: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (const provider of RPC_PROVIDERS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = `${provider.url}${path}`;
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (response.ok) {
          return response;
        }

        // If response is not ok, throw to try next provider
        throw new Error(`${provider.name} returned ${response.status}`);
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `RPC attempt ${attempt}/${maxRetries} failed for ${provider.name}:`,
          error
        );

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }
  }

  // All providers failed
  throw new Error(
    `All RPC providers failed. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Get the best available RPC URL
 */
export function getPrimaryRPCUrl(): string {
  if (RPC_PROVIDERS.length === 0) {
    throw new Error('No RPC providers configured');
  }
  return RPC_PROVIDERS[0].url;
}

/**
 * Health check for RPC providers
 */
export async function checkRPCHealth(): Promise<{
  provider: string;
  status: 'healthy' | 'unhealthy';
  latency: number;
}[]> {
  const results = await Promise.all(
    RPC_PROVIDERS.map(async provider => {
      const start = Date.now();
      try {
        const response = await fetch(provider.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        });

        const latency = Date.now() - start;
        return {
          provider: provider.name,
          status: response.ok ? ('healthy' as const) : ('unhealthy' as const),
          latency,
        };
      } catch {
        return {
          provider: provider.name,
          status: 'unhealthy' as const,
          latency: Date.now() - start,
        };
      }
    })
  );

  return results;
}
