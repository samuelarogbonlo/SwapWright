import { Message, SwapContext } from './ai-copilot-enhanced';

export interface ChatSession {
  id: string;
  createdAt: string;
  summary: string;
  messages: Message[];
  lastSwapContext?: SwapContext;
}

export interface ChatStorage {
  activeChatId: string;
  chats: ChatSession[];
}

const MAX_CHATS_PER_WALLET = 20;

function getStorageKey(walletAddress: string): string {
  return `swapwright_sessions_${walletAddress.toLowerCase()}`;
}

export function generateChatId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSummary(messages: Message[], swapContext?: SwapContext): string {
  // Try to generate from first swap
  if (swapContext?.tokenIn && swapContext?.tokenOut && swapContext?.amount) {
    return `Swap ${swapContext.amount} ${swapContext.tokenIn} → ${swapContext.tokenOut}`;
  }

  // Fallback: Use first user message if available
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const preview = firstUserMessage.content.slice(0, 40);
    return preview.length < firstUserMessage.content.length ? `${preview}...` : preview;
  }

  // Last resort: timestamp
  return `Chat started ${new Date().toLocaleDateString()}`;
}

export function loadChatStorage(walletAddress: string): ChatStorage | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = getStorageKey(walletAddress);
    const data = localStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data) as ChatStorage;

    // Restore Date objects for messages
    parsed.chats = parsed.chats.map(chat => ({
      ...chat,
      messages: chat.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    }));

    return parsed;
  } catch (error) {
    console.error('[ChatStorage] Failed to load:', error);
    return null;
  }
}

export function saveChatStorage(walletAddress: string, storage: ChatStorage): void {
  if (typeof window === 'undefined') return;

  try {
    const key = getStorageKey(walletAddress);

    // Clone to avoid mutating caller's data
    const sanitized = {
      ...storage,
      chats: [...storage.chats],
    };

    // Prune old chats if needed (keep last MAX_CHATS_PER_WALLET)
    if (sanitized.chats.length > MAX_CHATS_PER_WALLET) {
      sanitized.chats = sanitized.chats
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_CHATS_PER_WALLET);
    }

    localStorage.setItem(key, JSON.stringify(sanitized));
  } catch (error) {
    console.error('[ChatStorage] Failed to save:', error);
  }
}

export function createNewSession(): ChatSession {
  return {
    id: generateChatId(),
    createdAt: new Date().toISOString(),
    summary: `Chat started ${new Date().toLocaleDateString()}`,
    messages: [],
  };
}

export function updateSessionSummary(
  session: ChatSession,
  messages: Message[],
  swapContext?: SwapContext
): ChatSession {
  // Check if we have a real swap to surface
  const hasSwap = swapContext?.tokenIn && swapContext?.tokenOut && swapContext?.amount;
  const currentSummaryIsSwap = session.summary.startsWith('Swap');

  // Rewrite summary if:
  // 1. It's still a default summary AND we have messages
  // 2. We have a swap AND current summary isn't already a swap
  const isDefaultSummary = session.summary.startsWith('New chat') || session.summary.startsWith('Chat started');
  const shouldRegenerate = (isDefaultSummary && messages.length > 0) || (hasSwap && !currentSummaryIsSwap);

  if (shouldRegenerate) {
    return {
      ...session,
      summary: generateSummary(messages, swapContext),
      messages,
      lastSwapContext: swapContext,
    };
  }

  return {
    ...session,
    messages,
    lastSwapContext: swapContext,
  };
}

export function clearChatStorage(walletAddress: string): void {
  if (typeof window === 'undefined') return;

  try {
    const key = getStorageKey(walletAddress);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[ChatStorage] Failed to clear:', error);
  }
}

// Sidebar state persistence
const SIDEBAR_STATE_KEY = 'swapwright_sidebar_open';

export function loadSidebarState(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    const state = localStorage.getItem(SIDEBAR_STATE_KEY);
    return state === null ? true : state === 'true';
  } catch (error) {
    console.error('[ChatStorage] Failed to load sidebar state:', error);
    return true;
  }
}

export function saveSidebarState(isOpen: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SIDEBAR_STATE_KEY, isOpen.toString());
  } catch (error) {
    console.error('[ChatStorage] Failed to save sidebar state:', error);
  }
}
