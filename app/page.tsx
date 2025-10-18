'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { SwapInterface } from '@/components/SwapInterface';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">SwapWright</h1>
        <ConnectButton />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-bold">ChatGPT for DeFi Swaps</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Just say what you want to trade in plain English
            </p>
          </div>

          {/* Swap Interface */}
          <SwapInterface />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t p-4 text-center text-sm text-gray-600">
        Built with Claude AI • Uniswap v3 • Tenderly • Base
      </footer>
    </div>
  );
}
