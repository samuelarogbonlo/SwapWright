'use client';

import { useState } from 'react';
import { ChatSession } from '@/lib/chat-storage';

interface ChatSidebarProps {
  chats: ChatSession[];
  activeChatId: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export function ChatSidebar({ chats, activeChatId, onSelectChat, onNewChat, onDeleteChat }: ChatSidebarProps) {
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  // Swipe detection
  const minSwipeDistance = 80;

  const onTouchStart = (chatId: string) => (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (chatId: string) => () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;

    if (isLeftSwipe) {
      setSwipedChatId(chatId);
    } else if (distance < -minSwipeDistance) {
      // Right swipe - close delete button
      setSwipedChatId(null);
    }
  };

  const handleDelete = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteChat(chatId);
    setSwipedChatId(null);
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <button
          onClick={onNewChat}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-lg">+</span>
          <span>New Chat</span>
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No previous chats
          </div>
        ) : (
          <div className="py-2">
            {chats.map((chat) => (
              <div key={chat.id} className="relative overflow-hidden">
                {/* Main chat button */}
                <button
                  onClick={() => {
                    onSelectChat(chat.id);
                    setSwipedChatId(null);
                  }}
                  onTouchStart={onTouchStart(chat.id)}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd(chat.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition-all border-l-2 ${
                    chat.id === activeChatId
                      ? 'bg-gray-800 border-blue-500'
                      : 'border-transparent'
                  } ${
                    swipedChatId === chat.id ? '-translate-x-20' : 'translate-x-0'
                  }`}
                  style={{ transition: 'transform 0.3s ease' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <span className="text-sm font-medium text-white truncate">
                        {chat.summary}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(chat.createdAt)}
                      </span>
                    </div>

                    {/* Desktop delete button */}
                    <button
                      onClick={(e) => handleDelete(chat.id, e)}
                      className="hidden md:block opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity p-1"
                      title="Delete chat"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </button>

                {/* Delete button revealed on swipe */}
                {swipedChatId === chat.id && (
                  <button
                    onClick={(e) => handleDelete(chat.id, e)}
                    className="absolute right-0 top-0 h-full w-20 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 text-center">
          {chats.length} {chats.length === 1 ? 'chat' : 'chats'} saved
        </div>
      </div>
    </div>
  );
}
