'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, SwapContext } from '@/lib/ai-copilot-enhanced';
import { ChatTransactionPreview } from './ChatTransactionPreview';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { Mic, MicOff } from 'lucide-react';

const formatTimestamp = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

interface SwapCopilotProps {
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  onSwapIntent?: (tokenIn: string, tokenOut: string, amount: string) => void;
  onModifyParams?: (params: { amount?: string; slippage?: number }) => void;
  onSimulate?: () => void;
  onExecute?: () => void;
  onNewChat?: () => void;
  swapContext: SwapContext;
}

export function SwapCopilot({
  messages,
  onMessagesChange,
  onSwapIntent,
  onModifyParams,
  onSimulate,
  onExecute,
  onNewChat,
  swapContext
}: SwapCopilotProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice input hook
  const { isListening, transcript, startListening, stopListening, isSupported } = useVoiceInput();

  // Initialize mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update input when voice transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const updatedHistory = [...messages, userMessage];
    onMessagesChange(updatedHistory);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          conversationHistory: updatedHistory,
          swapContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      // Build assistant message with optional suggestions and warnings
      let messageContent = data.message;

      // Add risk warnings if present
      if (data.riskWarnings && data.riskWarnings.length > 0) {
        messageContent += `\n\n⚠️ **Risk Warnings:**\n${data.riskWarnings.map((w: string) => `• ${w}`).join('\n')}`;
      }

      // Add suggestions if present
      if (data.suggestions && data.suggestions.length > 0) {
        messageContent += `\n\n💡 **What's next?**\n${data.suggestions.map((s: string) => `• ${s}`).join('\n')}`;
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: messageContent,
        timestamp: new Date(),
        transactionData: data.transactionData,
        showActions: data.showActions,
      };

      onMessagesChange([...updatedHistory, assistantMessage]);

      // Handle actions
      if (data.action) {
        handleAction(data.action);
      }
    } catch (error) {
      console.error('Copilot error:', error);
      const message =
        error instanceof Error ? error.message : 'I encountered an unexpected error. Please try again.';

      const errorMessage: Message = {
        role: 'assistant',
        content: message.startsWith('Rate limit')
          ? 'You are sending requests too quickly. Give me a few seconds before trying again.'
          : 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };

      onMessagesChange([...updatedHistory, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: { type: string; params?: Record<string, any> }) => {
    // Block swap-related actions if wallet not connected
    if (!swapContext.isWalletConnected) {
      if (['fetch_quote', 'simulate', 'execute_swap'].includes(action.type)) {
        console.log('[SwapCopilot] Action blocked: wallet not connected');

        const blockMessage: Message = {
          role: 'assistant',
          content: 'Please connect your wallet first by clicking the Connect Wallet button in the top right corner.',
          timestamp: new Date(),
        };

        onMessagesChange([...messages, blockMessage]);
        return;
      }
    }

    if (action.type === 'fetch_quote' && action.params && onSwapIntent) {
      const { tokenIn, tokenOut, amount } = action.params;
      onSwapIntent(tokenIn, tokenOut, amount);
    } else if (action.type === 'modify_params' && action.params && onModifyParams) {
      onModifyParams(action.params);
    } else if (action.type === 'simulate' && onSimulate) {
      onSimulate();
    } else if (action.type === 'execute_swap' && onExecute) {
      onExecute();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[900px] card rounded-xl overflow-hidden">
      {/* Header with New Chat button */}
      {onNewChat && (
        <div className="border-b border-[var(--border)] px-5 py-3.5 flex items-center justify-between bg-[var(--input-bg)]">
          <span className="text-sm font-medium text-[var(--foreground)]">Messages</span>
          <button
            onClick={onNewChat}
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            title="Start a new chat"
          >
            + New
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages?.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`${msg.role === 'user' ? 'max-w-[75%]' : 'max-w-full'} ${
                msg.role === 'user' ? 'rounded-lg px-4 py-2.5 bg-[var(--accent)] text-white' : ''
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="max-w-[85%]">
                  <div className="card rounded-lg px-4 py-3 bg-[var(--input-bg)]">
                    <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {mounted && (
                      <span className="text-xs opacity-60 mt-1 block">
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    )}
                  </div>
                  {msg.transactionData && (
                    <div className="mt-2">
                      <ChatTransactionPreview
                        data={msg.transactionData}
                        showActions={msg.showActions}
                        onSimulate={onSimulate}
                        onExecute={onExecute}
                        simulationPassed={swapContext.simulation?.success}
                      />
                    </div>
                  )}
                </div>
              )}
              {msg.role === 'user' && (
                <>
                  <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {mounted && (
                    <span className="text-xs opacity-60 mt-1 block">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="card rounded-lg px-4 py-3 bg-[var(--input-bg)]">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-[var(--muted)] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[var(--muted)] rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-[var(--muted)] rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening..." : "Message..."}
              className="w-full bg-[var(--input-bg)] border border-[var(--border)] rounded-lg px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-all placeholder:text-[var(--muted)] text-sm"
              rows={1}
              disabled={loading}
              style={{ maxHeight: '120px', minHeight: '44px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            {/* Voice Input Button */}
            {isSupported && (
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={loading}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md transition-all ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'btn-secondary text-[var(--foreground)]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isListening ? "Stop recording" : "Start voice input"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--muted)] disabled:cursor-not-allowed text-white rounded-lg px-5 py-3 font-medium transition-all text-sm"
          >
            <span>{loading ? 'Sending...' : 'Send'}</span>
            {!loading && (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Powered by SwapWright AI • Press Enter to send
        </p>
      </div>
    </div>
  );
}
