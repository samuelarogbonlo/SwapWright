# SwapWright ACP Agent Integration Guide

## Overview

SwapWright exposes an **Agent Communication Protocol (ACP)** interface allowing other AI agents to discover, interact with, and utilize SwapWright's swap execution capabilities programmatically.

This enables autonomous agents to:
- 🔍 **Discover** SwapWright's capabilities via metadata API
- 📊 **Get Quotes** for token swaps on Base network
- ⚡ **Execute Swaps** on behalf of users or other agents
- 🔗 **Compose** SwapWright into larger agent workflows

---

## Quick Start

### 1. Discover Service Capabilities

```bash
curl http://localhost:3000/api/acp/metadata
```

**Response:**
```json
{
  "serviceId": "swapwright-v1",
  "name": "SwapWright",
  "description": "AI-powered DEX aggregator for Base network...",
  "version": "1.0.0",
  "network": "base-mainnet",
  "capabilities": [
    {
      "id": "swap-quote",
      "name": "Get Swap Quote",
      "inputSchema": { ... },
      "outputSchema": { ... }
    }
  ],
  "endpoints": [...]
}
```

### 2. Check Service Status

```bash
curl http://localhost:3000/api/acp/status
```

**Response:**
```json
{
  "service": "SwapWright",
  "status": "online",
  "version": "1.0.0",
  "uptime": 123456,
  "network": "base-mainnet",
  "supportedTokens": ["ETH", "WETH", "USDC", "USDBC"],
  "limits": {
    "maxSwapAmount": "1000",
    "minSwapAmount": "0.0001",
    "rateLimit": { "requests": 20, "window": "1m" }
  }
}
```

### 3. Execute a Swap Request

```bash
curl -X POST http://localhost:3000/api/acp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_abc123",
    "agentId": "portfolio-manager-v1",
    "agentWallet": "0x1234...",
    "timestamp": "2025-10-19T20:00:00Z",
    "action": "swap",
    "parameters": {
      "tokenIn": "ETH",
      "tokenOut": "USDC",
      "amount": "1.0",
      "slippage": 0.5
    },
    "metadata": {
      "reason": "Portfolio rebalancing",
      "priority": "normal"
    }
  }'
```

**Response:**
```json
{
  "requestId": "req_abc123",
  "status": "success",
  "timestamp": "2025-10-19T20:00:01Z",
  "data": {
    "quote": {
      "expectedOutput": "3987.23",
      "minOutput": "3967.28",
      "estimatedGas": "0.00015",
      "route": "ETH → WETH → USDC (Uniswap V3 0.05%)",
      "priceImpact": 0.12
    }
  }
}
```

---

## Use Cases

### Use Case 1: Portfolio Rebalancing Agent

**Scenario:** An autonomous portfolio manager needs to rebalance a user's assets.

```typescript
// Portfolio Manager Agent Code

async function rebalancePortfolio(userWallet: string) {
  // 1. Discover SwapWright
  const metadata = await fetch('http://localhost:3000/api/acp/metadata').then(r => r.json());
  console.log(`Found service: ${metadata.name}`);

  // 2. Request swap quote
  const swapRequest = {
    requestId: `rebalance_${Date.now()}`,
    agentId: 'portfolio-manager-v1',
    agentWallet: userWallet,
    timestamp: new Date().toISOString(),
    action: 'swap',
    parameters: {
      tokenIn: 'USDC',
      tokenOut: 'ETH',
      amount: '5000', // Rebalance $5000 USDC → ETH
      slippage: 0.5,
    },
    metadata: {
      reason: 'Portfolio rebalancing - increase ETH allocation',
      priority: 'normal',
    },
  };

  const response = await fetch('http://localhost:3000/api/acp/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swapRequest),
  });

  const result = await response.json();

  if (result.status === 'success') {
    console.log(`Quote received: ${result.data.quote.expectedOutput} ETH`);
    // Agent can now present quote to user or execute automatically
  }
}
```

### Use Case 2: Trading Bot Agent

**Scenario:** A trading bot detects arbitrage opportunity and needs to execute quickly.

```typescript
// Trading Bot Agent Code

async function executeArbitrage() {
  const statusCheck = await fetch('http://localhost:3000/api/acp/status').then(r => r.json());

  if (statusCheck.status !== 'online') {
    console.log('SwapWright offline, using backup DEX');
    return;
  }

  const arbRequest = {
    requestId: `arb_${Date.now()}`,
    agentId: 'arbitrage-bot-v2',
    agentWallet: process.env.BOT_WALLET,
    timestamp: new Date().toISOString(),
    action: 'swap',
    parameters: {
      tokenIn: 'WETH',
      tokenOut: 'USDC',
      amount: '10',
      slippage: 1.0, // Higher slippage for speed
    },
    metadata: {
      reason: 'Arbitrage opportunity detected',
      priority: 'high',
      timeout: 10000, // 10s max
    },
  };

  const result = await fetch('http://localhost:3000/api/acp/execute', {
    method: 'POST',
    body: JSON.stringify(arbRequest),
    headers: { 'Content-Type': 'application/json' },
  });

  const quote = await result.json();
  console.log(`Arbitrage quote: ${quote.data.quote.expectedOutput} USDC`);
}
```

### Use Case 3: DeFi Assistant Agent

**Scenario:** A conversational AI assistant helping users with DeFi tasks.

```typescript
// DeFi Assistant Agent Code

class DeFiAssistant {
  private swapwrightUrl = 'http://localhost:3000';

  async handleUserRequest(userMessage: string, userWallet: string) {
    if (userMessage.includes('swap') || userMessage.includes('exchange')) {
      // Parse intent
      const intent = this.parseSwapIntent(userMessage);

      // Delegate to SwapWright
      const swapRequest = {
        requestId: `assist_${Date.now()}`,
        agentId: 'defi-assistant-v1',
        agentWallet: userWallet,
        timestamp: new Date().toISOString(),
        action: 'swap',
        parameters: intent,
        metadata: {
          reason: 'User requested swap via assistant',
          priority: 'normal',
        },
      };

      const result = await fetch(`${this.swapwrightUrl}/api/acp/execute`, {
        method: 'POST',
        body: JSON.stringify(swapRequest),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await result.json();

      if (response.status === 'success') {
        return `I found a quote for you: ${response.data.quote.expectedOutput} ${intent.tokenOut}. Would you like me to proceed?`;
      } else {
        return `Sorry, I couldn't get a quote: ${response.error.message}`;
      }
    }
  }

  private parseSwapIntent(message: string) {
    // Intent parsing logic...
    return {
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      amount: '1.0',
      slippage: 0.5,
    };
  }
}
```

---

## API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/acp/metadata` | GET | Get service capabilities and schemas |
| `/api/acp/status` | GET | Check service health and limits |
| `/api/acp/execute` | POST | Execute a swap request |

### Request Schema (`/api/acp/execute`)

```typescript
interface ACPSwapRequest {
  requestId: string;          // Unique request identifier
  agentId: string;            // Your agent's identifier
  agentWallet: string;        // Wallet address
  timestamp: string;          // ISO 8601 timestamp
  action: 'swap';             // Action type
  parameters: {
    tokenIn: string;          // Input token (ETH, WETH, USDC, USDBC)
    tokenOut: string;         // Output token
    amount: string;           // Amount to swap
    slippage?: number;        // Slippage % (default: 0.5)
    userWallet?: string;      // Optional: user's wallet if different
  };
  metadata?: {
    reason?: string;          // Why this swap is needed
    priority?: 'low' | 'normal' | 'high';
    timeout?: number;         // Max execution time (ms)
  };
}
```

### Response Schema

```typescript
interface ACPSwapResponse {
  requestId: string;
  status: 'success' | 'error' | 'pending';
  timestamp: string;
  data?: {
    quote?: {
      expectedOutput: string;
      minOutput: string;
      estimatedGas: string;
      route: string;
      priceImpact?: number;
    };
    transaction?: {
      hash: string;
      status: 'pending' | 'confirmed' | 'failed';
      blockNumber?: number;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `RATE_LIMIT_EXCEEDED` | Too many requests, retry after 60s |
| `INVALID_REQUEST` | Missing required fields |
| `INVALID_PARAMETERS` | Invalid swap parameters |
| `UNSUPPORTED_TOKEN` | Token not supported on Base |
| `QUOTE_FAILED` | Unable to get quote |
| `INTERNAL_ERROR` | Server error |

---

## Security & Rate Limiting

- **Rate Limit:** 10 requests per minute per agent
- **Authentication:** Currently open (no auth required)
- **Validation:** All requests validated for structure and parameters
- **Logging:** All agent requests logged for security auditing

---

## Integration Checklist

- [ ] Fetch service metadata to discover capabilities
- [ ] Check service status before critical operations
- [ ] Include unique `requestId` for request tracking
- [ ] Handle error responses gracefully
- [ ] Respect rate limits (10 req/min)
- [ ] Log all swap requests for audit trail
- [ ] Test with small amounts first
- [ ] Monitor transaction status after execution

---

## Support & Documentation

- **GitHub:** [SwapWright Repository]
- **Virtuals Protocol:** Entity ID `1bmholb3f5spq3pxn1naedr`
- **Agent Wallet:** `0x97cA1a0aCA9E29d916C096EE7EEBDFf9c9c3CE13`
- **Network:** Base Mainnet (Chain ID: 8453)

---

## Example: Complete Agent Integration

```typescript
// example-agent.ts - Complete working example

import fetch from 'node-fetch';

const SWAPWRIGHT_URL = 'http://localhost:3000';

async function main() {
  // 1. Discover service
  console.log('🔍 Discovering SwapWright service...');
  const metadata = await fetch(`${SWAPWRIGHT_URL}/api/acp/metadata`).then(r => r.json());
  console.log(`✅ Found: ${metadata.name} v${metadata.version}`);
  console.log(`   Network: ${metadata.network}`);
  console.log(`   Tokens: ${metadata.capabilities[0].constraints.supportedTokens.join(', ')}`);

  // 2. Check status
  console.log('\n📊 Checking service status...');
  const status = await fetch(`${SWAPWRIGHT_URL}/api/acp/status`).then(r => r.json());
  console.log(`✅ Status: ${status.status}`);
  console.log(`   Uptime: ${(status.uptime / 1000).toFixed(0)}s`);

  // 3. Request swap quote
  console.log('\n💱 Requesting swap quote...');
  const swapRequest = {
    requestId: `demo_${Date.now()}`,
    agentId: 'example-agent-v1',
    agentWallet: '0x1234567890123456789012345678901234567890',
    timestamp: new Date().toISOString(),
    action: 'swap',
    parameters: {
      tokenIn: 'ETH',
      tokenOut: 'USDC',
      amount: '1.0',
      slippage: 0.5,
    },
    metadata: {
      reason: 'Demo integration test',
      priority: 'normal',
    },
  };

  const response = await fetch(`${SWAPWRIGHT_URL}/api/acp/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swapRequest),
  });

  const result = await response.json();

  if (result.status === 'success') {
    console.log('✅ Quote received!');
    console.log(`   Expected Output: ${result.data.quote.expectedOutput} USDC`);
    console.log(`   Min Output: ${result.data.quote.minOutput} USDC`);
    console.log(`   Gas: ${result.data.quote.estimatedGas} ETH`);
    console.log(`   Route: ${result.data.quote.route}`);
    console.log(`   Price Impact: ${result.data.quote.priceImpact}%`);
  } else {
    console.log('❌ Error:', result.error.message);
  }
}

main().catch(console.error);
```

**Run the example:**
```bash
npx ts-node docs/example-agent.ts
```

---

**Built for Virtuals Protocol Ethereum AI Hackathon 2025** 🚀
