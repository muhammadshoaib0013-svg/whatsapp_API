'use client';

import React, { useEffect, useState, useCallback } from 'react';

/**
 * TypeScript interfaces for Message objects
 */
export interface Message {
  id: string;
  tenantId: string;
  whatsappAccountId: string;
  chatSessionId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'LOCATION' | 'CONTACT' | 'TEMPLATE';
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  metaMessageId?: string | null;
  errorMessage?: string | null;
  sentAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  metadata?: any;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  customerPhoneNumber: string;
  customerName?: string | null;
  status: string;
}

export interface MessagesResponse {
  messages: Message[];
  chatSession: ChatSession;
}

interface MessageListProps {
  chatSessionId: string;
}

/**
 * MessageList Component
 * Phase 11: Inbox View
 * 
 * Displays WhatsApp messages in a chat-like bubble format.
 * Distinguishes between INBOUND (User) and OUTBOUND (Bot/Agent) messages.
 * Handles loading states and empty states.
 */
export default function MessageList({ chatSessionId }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/messages?chatSessionId=${chatSessionId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: MessagesResponse = await response.json();
      setMessages(data.messages);
      setChatSession(data.chatSession);
    } catch (err) {
      console.error('[MessageList] Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [chatSessionId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-2">{error}</p>
          <button
            onClick={fetchMessages}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No messages yet</p>
          <p className="text-gray-400 text-xs mt-1">
            {chatSession?.customerPhoneNumber || 'Unknown number'}
          </p>
        </div>
      </div>
    );
  }

  let lastDate: string | null = null;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Session Header */}
      {chatSession && (
        <div className="border-b border-gray-200 p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {chatSession.customerName || chatSession.customerPhoneNumber}
              </h3>
              <p className="text-sm text-gray-500">{chatSession.customerPhoneNumber}</p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              chatSession.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {chatSession.status}
            </span>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message) => {
          const messageDate = formatDate(message.createdAt);
          const showDateDivider = messageDate !== lastDate;
          lastDate = messageDate;

          const isInbound = message.direction === 'INBOUND';

          return (
            <React.Fragment key={message.id}>
              {/* Date Divider */}
              {showDateDivider && (
                <div className="flex items-center justify-center">
                  <span className="text-xs text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                    {messageDate}
                  </span>
                </div>
              )}

              {/* Message Bubble */}
              <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[70%] ${isInbound ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isInbound
                        ? 'bg-white text-gray-900 border border-gray-200'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <p className="text-sm break-words">{message.content}</p>
                  </div>

                  {/* Message Metadata */}
                  <div className={`flex items-center mt-1 space-x-2 text-xs ${
                    isInbound ? 'justify-start text-gray-500' : 'justify-end text-blue-200'
                  }`}>
                    <span>{formatTime(message.sentAt)}</span>
                    {message.status === 'FAILED' && (
                      <span className="text-red-500">✗ Failed</span>
                    )}
                    {message.status === 'READ' && (
                      <span className="text-blue-400">✓✓ Read</span>
                    )}
                    {message.status === 'DELIVERED' && (
                      <span>✓✓ Delivered</span>
                    )}
                    {message.status === 'SENT' && (
                      <span>✓ Sent</span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
