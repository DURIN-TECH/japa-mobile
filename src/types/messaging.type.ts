/**
 * Messaging Types
 *
 * Types for the agent-client chat system.
 * Conversations are created automatically when a payment request
 * is rejected, allowing the client and agent to discuss the issue.
 */

// A conversation between a client and an agent
export interface Conversation {
  id: string;
  userId: string;
  agentId: string;
  applicationId?: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCountUser: number;
  unreadCountAgent: number;
  // Enriched by the backend controller (from user/agent docs)
  userName?: string;
  userEmail?: string;
  agentName?: string;
  createdAt: string;
  updatedAt: string;
}

// A single message within a conversation
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'user' | 'agent';
  content: string;
  attachmentUrls?: string[];
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}
