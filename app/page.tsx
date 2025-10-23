'use client';

import { useState, useRef, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { SwapInterface, SwapInterfaceHandle } from '@/components/SwapInterface';
import { PortfolioWatchdog } from '@/components/PortfolioWatchdog';
import { SwapCopilot } from '@/components/SwapCopilot';
import { ChatSidebar } from '@/components/ChatSidebar';
import { SwapContext, Message } from '@/lib/ai-copilot-enhanced';
import {
  loadChatStorage,
  saveChatStorage,
  createNewSession,
  updateSessionSummary,
  loadSidebarState,
  saveSidebarState,
  ChatSession,
} from '@/lib/chat-storage';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [swapContext, setSwapContext] = useState<SwapContext>({});
  const [pendingSwapIntent, setPendingSwapIntent] = useState<{
    tokenIn: string;
    tokenOut: string;
    amount: string;
  } | null>(null);
  const [pendingSlippage, setPendingSlippage] = useState<number | null>(null);
  const swapInterfaceRef = useRef<SwapInterfaceHandle | null>(null);

  // Chat state
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => loadSidebarState());

  // Update context with wallet connection status
  useEffect(() => {
    setSwapContext(prev => ({ ...prev, isWalletConnected: isConnected }));
  }, [isConnected]);

  // Auto-generate AI response when quote is fetched (ONLY ONCE)
  const hasShownQuoteRef = useRef<string | null>(null);

  useEffect(() => {
    const autoRespondToQuote = async () => {
      const quoteKey = swapContext.quote ? JSON.stringify(swapContext.quote) : null;

      // Early exit if we've already processed this quote
      if (!swapContext.quote || !quoteKey || hasShownQuoteRef.current === quoteKey) {
        return;
      }

      // Check if we have a valid assistant message to update
      if (messages.length === 0 || messages[messages.length - 1].role !== 'assistant') {
        return;
      }

      // Mark this quote as processed IMMEDIATELY to prevent re-entry during fetch
      hasShownQuoteRef.current = quoteKey;

      try {
        const response = await fetch('/api/ai-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'show quote',
            conversationHistory: messages,
            swapContext,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let messageContent = data.message;
          if (data.riskWarnings && data.riskWarnings.length > 0) {
            messageContent += `\n\n⚠️ **Risk Warnings:**\n${data.riskWarnings.map((w: string) => `• ${w}`).join('\n')}`;
          }
          if (data.suggestions && data.suggestions.length > 0) {
            messageContent += `\n\n💡 **What's next?**\n${data.suggestions.map((s: string) => `• ${s}`).join('\n')}`;
          }

          // Update last message with transaction preview (one-time only)
          setMessages(prev => {
            const updatedMessages = [...prev];
            const lastMessage = updatedMessages[updatedMessages.length - 1];

            if (lastMessage && lastMessage.role === 'assistant') {
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                content: messageContent,
                transactionData: data.transactionData,
                showActions: data.showActions,
              };
            }

            return updatedMessages;
          });
        } else {
          // Reset ref on failure so user can retry
          hasShownQuoteRef.current = null;
        }
      } catch (error) {
        console.error('Auto-response error:', error);
        // Reset ref on error so user can retry
        hasShownQuoteRef.current = null;

        setMessages(prev => {
          if (prev.length === 0) return prev;

          const updated = [...prev];
          const last = updated[updated.length - 1];

          if (last.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: `${last.content}\n\n_I couldn't refresh the quote preview. Please wait a moment and try again._`,
            };
          } else {
            updated.push({
              role: 'assistant',
              content: "I'm having trouble refreshing the quote preview. Give me a few seconds and ask again.",
              timestamp: new Date(),
            });
          }

          return updated;
        });
      }
    };

    autoRespondToQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapContext.quote]); // ONLY depend on quote, not messages (prevents infinite loop)

  // Monitor transaction status and show success message when complete
  useEffect(() => {
    if (swapContext.transaction?.status === 'success' && swapContext.transaction.hash) {
      // Only show success message once per transaction
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.content?.includes('swap was successful')) return;

      setTimeout(async () => {
        try {
          const response = await fetch('/api/ai-copilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'transaction result',
              conversationHistory: messages,
              swapContext,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const assistantMessage: Message = {
              role: 'assistant',
              content: data.message,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
          }
        } catch (error) {
          console.error('Transaction response error:', error);
        }
      }, 500);
    }
  }, [swapContext.transaction?.status, swapContext.transaction?.hash]);

  // Load chat history when wallet connects
  useEffect(() => {
    if (!address) {
      const newSession = createNewSession();
      setActiveChatId(newSession.id);
      setChats([newSession]);
      setMessages([
        {
          role: 'assistant',
          content: "I'll help you execute your swap. What tokens would you like to trade?",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const storage = loadChatStorage(address);

    if (storage && storage.chats.length > 0) {
      setChats(storage.chats);
      setActiveChatId(storage.activeChatId);

      const activeChat = storage.chats.find(c => c.id === storage.activeChatId);
      if (activeChat) {
        setMessages(activeChat.messages);
        if (activeChat.lastSwapContext) {
          setSwapContext(prev => ({
            ...prev,
            ...activeChat.lastSwapContext,
            isWalletConnected: isConnected
          }));
        }
      }
    } else {
      const newSession = createNewSession();
      setActiveChatId(newSession.id);
      setChats([newSession]);
      setMessages([
        {
          role: 'assistant',
          content: "I'll help you execute your swap. What tokens would you like to trade?",
          timestamp: new Date(),
        },
      ]);
    }
  }, [address, isConnected]);

  // Save chat to localStorage whenever messages change
  useEffect(() => {
    if (!address || !activeChatId || messages.length === 0) return;

    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;

    const { isWalletConnected, ...swapContextToSave } = swapContext;
    const updatedSession = updateSessionSummary(activeChat, messages, swapContextToSave);
    const updatedChats = chats.map(c => (c.id === activeChatId ? updatedSession : c));
    setChats(updatedChats);

    saveChatStorage(address, {
      activeChatId,
      chats: updatedChats,
    });
  }, [messages, address, activeChatId, swapContext, chats]);

  const handleSwapIntent = (tokenIn: string, tokenOut: string, amount: string) => {
    setPendingSwapIntent({ tokenIn, tokenOut, amount });
    setSwapContext(prev => ({ ...prev, tokenIn, tokenOut, amount }));
    setPendingSlippage(null);
  };

  const handleModifyParams = (params: { amount?: string; slippage?: number }) => {
    if (params.amount && swapContext.tokenIn && swapContext.tokenOut) {
      setPendingSwapIntent({
        tokenIn: swapContext.tokenIn,
        tokenOut: swapContext.tokenOut,
        amount: params.amount,
      });
    }
    if (params.slippage !== undefined) {
      setSwapContext(prev => ({ ...prev, slippage: params.slippage }));
      setPendingSlippage(params.slippage);
    }
  };

  const handleSimulate = async () => {
    if (!swapInterfaceRef.current) return;
    await swapInterfaceRef.current.simulate();

    setTimeout(async () => {
      try {
        const response = await fetch('/api/ai-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'simulation result',
            conversationHistory: messages,
            swapContext,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // Add text message confirming simulation (AI won't return transactionData for simulation)
          const assistantMessage: Message = {
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } catch (error) {
        console.error('Simulation response error:', error);
      }
    }, 1000);
  };

  const handleExecute = async () => {
    if (!swapInterfaceRef.current) return;

    // Show "waiting for confirmation" message immediately
    const waitingMessage: Message = {
      role: 'assistant',
      content: 'Please confirm the transaction in your wallet. Once confirmed, I\'ll monitor the transaction and let you know when it\'s complete.',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, waitingMessage]);

    await swapInterfaceRef.current.execute();
  };

  const updateSwapContext = (updates: Partial<SwapContext>) => {
    setSwapContext(prev => ({ ...prev, ...updates }));
  };

  const handleNewChat = () => {
    const newSession = createNewSession();
    setActiveChatId(newSession.id);
    setChats(prev => [newSession, ...prev]);
    setMessages([
      {
        role: 'assistant',
        content: "I'll help you execute your swap. What tokens would you like to trade?",
        timestamp: new Date(),
      },
    ]);
    setSwapContext({ isWalletConnected: isConnected });
    setPendingSwapIntent(null);
    setPendingSlippage(null);
  };

  const handleSelectChat = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    setActiveChatId(chatId);
    setMessages(chat.messages);
    if (chat.lastSwapContext) {
      setSwapContext({ ...chat.lastSwapContext, isWalletConnected: isConnected });
    } else {
      setSwapContext({ isWalletConnected: isConnected });
    }
    setPendingSwapIntent(null);
    setPendingSlippage(null);

    if (address) {
      saveChatStorage(address, {
        activeChatId: chatId,
        chats,
      });
    }
  };

  const handleMessagesChange = (newMessages: Message[]) => {
    setMessages(newMessages);
  };

  const handleDeleteChat = (chatId: string) => {
    const updatedChats = chats.filter(c => c.id !== chatId);
    setChats(updatedChats);

    if (chatId === activeChatId) {
      if (updatedChats.length > 0) {
        const mostRecent = updatedChats[0];
        setActiveChatId(mostRecent.id);
        setMessages(mostRecent.messages);
        if (mostRecent.lastSwapContext) {
          setSwapContext({ ...mostRecent.lastSwapContext, isWalletConnected: isConnected });
        } else {
          setSwapContext({ isWalletConnected: isConnected });
        }
      } else {
        handleNewChat();
        return;
      }
    }

    if (address) {
      saveChatStorage(address, {
        activeChatId: chatId === activeChatId ? updatedChats[0]?.id || activeChatId : activeChatId,
        chats: updatedChats,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">SwapWright</h1>
        <ConnectButton />
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-4xl font-bold text-white">ChatGPT for DeFi Swaps</h2>
            <p className="text-lg text-gray-400">
              Ask your AI copilot to execute swaps, explain quotes, and optimize your trades
            </p>
          </div>

          {/* Portfolio Watchdog */}
          <div className="mb-6">
            <PortfolioWatchdog />
          </div>

          {/* Main layout: Chat-first with hidden swap interface */}
          <div className="grid grid-cols-1 gap-6">
            {/* AI Copilot with Sidebar */}
            <div className="flex gap-4">
              {/* Chat Sidebar */}
              {sidebarOpen && address && (
                <ChatSidebar
                  chats={chats}
                  activeChatId={activeChatId}
                  onSelectChat={handleSelectChat}
                  onNewChat={handleNewChat}
                  onDeleteChat={handleDeleteChat}
                />
              )}

              {/* Chat Interface - Primary experience */}
              <div className="flex-1 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <span>💬</span>
                    <span>SwapWright AI</span>
                  </h3>
                  {address && (
                    <button
                      onClick={() => {
                        const newState = !sidebarOpen;
                        setSidebarOpen(newState);
                        saveSidebarState(newState);
                      }}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {sidebarOpen ? '← Hide' : '→ History'}
                    </button>
                  )}
                </div>
                <SwapCopilot
                  messages={messages}
                  onMessagesChange={handleMessagesChange}
                  onSwapIntent={handleSwapIntent}
                  onModifyParams={handleModifyParams}
                  onSimulate={handleSimulate}
                  onExecute={handleExecute}
                  onNewChat={handleNewChat}
                  swapContext={swapContext}
                />
              </div>
            </div>

            {/* Hidden Swap Interface (runs in background for API calls) */}
            <div className="hidden">
              <SwapInterface
                ref={swapInterfaceRef}
                pendingIntent={pendingSwapIntent}
                pendingSlippage={pendingSlippage}
                onClearIntent={() => setPendingSwapIntent(null)}
                onClearSlippage={() => setPendingSlippage(null)}
                onContextUpdate={updateSwapContext}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 p-4 text-center text-sm text-gray-500">
        Built with Claude AI • Uniswap v3 • Tenderly • Base • Virtuals Protocol
      </footer>
    </div>
  );
}
