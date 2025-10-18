# SwapWright

**ChatGPT for DeFi swaps** - Just say what you want to trade in plain English.

## What It Does

SwapWright makes DeFi token swaps as easy as texting. No complex interfaces, no confusing parameters. Just natural language.

**Example:**
```
You: "Swap 0.1 ETH for USDC with low fees"
SwapWright: [Shows preview] → [Simulates for safety] → [Executes swap]
```

## Key Features

- 🗣️ **Natural Language** - Chat interface powered by Claude AI
- 🔒 **Transaction Simulation** - Every swap is simulated before execution via Tenderly
- ⚡ **Best Prices** - Direct Uniswap v3 routing on Base
- 🛡️ **Built-in Security** - Token whitelisting, spending limits, input validation
- 🌐 **Base Mainnet** - Live liquidity with real swaps

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Web3**: Viem, Wagmi, RainbowKit
- **AI**: Claude 3.5 Sonnet (Anthropic)
- **DEX Integration**: Uniswap v3 (Quoter + SwapRouter02)
- **Security**: Tenderly Simulation
- **Network**: Base Mainnet

## Quick Start

```bash
# Install dependencies
npm install

# Add environment variables to .env.local
# (See .env.example)

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Why SwapWright?

- **74%** of users abandon DeFi due to complexity
- **$1.4B+** lost annually to MEV attacks and mistakes
- **89.4%** of internet users don't own crypto yet

We're making DeFi accessible to everyone.

## License

MIT

---

Built for Virtuals Protocol Ethereum AI Hackathon 2025
