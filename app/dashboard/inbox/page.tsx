'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MessageSquare, Send, Search, MoreVertical, Phone, Plus, ArrowLeft } from 'lucide-react';
import { InteractiveMessageBuilder } from '@/components/chat/InteractiveMessageBuilder';

interface ChatSession {
  id: string;
  customerPhoneNumber: string;
  customerName: string | null;
  status: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  assignedToUserId: string | null;
  assignedToUser?: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
  whatsappAccount: {
    id: string;
    displayName: string;
    businessPhoneNumber: string;
  };
}

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Message {
  id: string;
  direction: string;
  content: string;
  messageType: string;
  status: string;
  sentAt: string;
  chatSession: {
    id: string;
    customerPhoneNumber: string;
    customerName: string | null;
  };
}

export default function InboxPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showInteractiveBuilder, setShowInteractiveBuilder] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch chat sessions
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inbox/sessions?limit=50');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch team members for agent assignment
  const fetchTeamMembers = async () => {
    try {
      setTeamMembersLoading(true);
      const res = await fetch('/api/team-members');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.teamMembers || []);
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setTeamMembersLoading(false);
    }
  };

  // Assign agent to chat session
  const assignAgent = async (agentId: string) => {
    if (!selectedSession) return;

    try {
      setAssigningAgent(true);
      const res = await fetch(`/api/inbox/sessions/${selectedSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToUserId: agentId }),
      });

      if (res.ok) {
        const updatedSession = await res.json();
        setSelectedSession(updatedSession);
        // Refresh sessions list to update assigned agent display
        await fetchSessions();
      }
    } catch (error) {
      console.error('Failed to assign agent:', error);
    } finally {
      setAssigningAgent(false);
    }
  };

  // Fetch messages for a session
  const fetchMessages = async (sessionId: string) => {
    try {
      setMessageLoading(true);
      const res = await fetch(`/api/inbox/messages?chatSessionId=${sessionId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setMessageLoading(false);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSession) return;

    try {
      const res = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatSessionId: selectedSession.id,
          content: newMessage,
          messageType: 'TEXT',
        }),
      });

      if (res.ok) {
        setNewMessage('');
        // Refresh messages
        await fetchMessages(selectedSession.id);
        // Refresh sessions to update preview
        await fetchSessions();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Handle session selection
  const handleSessionSelect = (session: ChatSession) => {
    setSelectedSession(session);
    fetchMessages(session.id);
  };

  // Setup SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/inbox/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[INBOX_SSE] Connected');
      setIsConnected(true);
    };

    eventSource.onerror = (error) => {
      console.error('[INBOX_SSE] Error:', error);
      setIsConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[INBOX_SSE] Received:', data);

        if (data.type === 'new_message') {
          // If the message is for the selected session, add it to messages
          if (selectedSession && data.data.chatSessionId === selectedSession.id) {
            setMessages((prev) => [...prev, data.data]);
          }
          // Refresh sessions to update preview
          fetchSessions();
        } else if (data.type === 'session_update') {
          // Update session in the list
          setSessions((prev) =>
            prev.map((s) => (s.id === data.data.id ? { ...s, ...data.data } : s))
          );
        } else if (data.type === 'new_session') {
          // Add new session to the list
          setSessions((prev) => [data.data, ...prev]);
        }
      } catch (error) {
        console.error('[INBOX_SSE] Failed to parse message:', error);
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [selectedSession]);

  // Filter sessions based on search
  const filteredSessions = sessions.filter((session) =>
    session.customerPhoneNumber.includes(searchQuery) ||
    (session.customerName && session.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    fetchSessions();
    fetchTeamMembers();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Chat Sessions */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">{isConnected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No conversations found</div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSessionSelect(session)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedSession?.id === session.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate">
                        {session.customerName || session.customerPhoneNumber}
                      </h3>
                      {session.unreadCount > 0 && (
                        <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          {session.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{session.customerPhoneNumber}</p>
                  </div>
                  <span className="text-xs text-gray-400 ml-2">{formatTime(session.lastMessageAt)}</span>
                </div>
                <p className="text-sm text-gray-600 truncate mt-1">
                  {session.lastMessagePreview || 'No messages yet'}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Messages */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedSession.customerName || selectedSession.customerPhoneNumber}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedSession.customerPhoneNumber}</p>
                  {selectedSession.assignedToUser && (
                    <p className="text-xs text-gray-600 mt-1">
                      Assigned to: <span className="font-medium">{selectedSession.assignedToUser.user.name}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={selectedSession.assignedToUserId || ''}
                      onChange={(e) => assignAgent(e.target.value)}
                      disabled={assigningAgent || teamMembersLoading}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value="">Assign Agent</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Phone className="h-5 w-5 text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <MoreVertical className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messageLoading ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500">No messages yet</div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'INBOUND' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.direction === 'INBOUND'
                            ? 'bg-white border border-gray-200 text-gray-900'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs opacity-70">{formatTime(message.sentAt)}</span>
                          {message.direction === 'OUTBOUND' && (
                            <span className="text-xs opacity-70">
                              {message.status === 'SENT' && '✓'}
                              {message.status === 'DELIVERED' && '✓✓'}
                              {message.status === 'READ' && '✓✓'}
                              {message.status === 'FAILED' && '✗'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              {showInteractiveBuilder && selectedSession ? (
                <div className="mb-4">
                  <button
                    onClick={() => setShowInteractiveBuilder(false)}
                    className="text-sm text-gray-600 hover:text-gray-900 mb-2"
                  >
                    ← Back to text message
                  </button>
                  <InteractiveMessageBuilder
                    chatSessionId={selectedSession.id}
                    onSend={() => {
                      setShowInteractiveBuilder(false);
                      fetchMessages(selectedSession.id);
                      fetchSessions();
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInteractiveBuilder(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Send interactive message"
                  >
                    <Plus className="h-5 w-5 text-gray-600" />
                  </button>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
