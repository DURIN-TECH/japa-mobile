/**
 * useMessaging Hooks
 *
 * React Query hooks for the client-agent chat system.
 * Provides access to conversations, messages, sending,
 * and marking conversations as read.
 *
 * Backend endpoints used:
 * - GET /conversations                  → list conversations
 * - GET /conversations/:id/messages     → messages in a conversation
 * - POST /conversations/:id/messages    → send a message
 * - PUT /conversations/:id/read         → mark as read
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Conversation, Message } from '@/types/messaging.type';

// ─────────────────────────────────────────────
// QUERY HOOKS
// ─────────────────────────────────────────────

/**
 * Fetch all conversations for the authenticated user.
 * Sorted by lastMessageAt descending (most recent first).
 */
export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await apiService.get<Conversation[]>('/conversations');
      return response.data ?? [];
    },
  });
}

/**
 * Fetch messages for a specific conversation.
 * Returns messages in chronological order (oldest first).
 *
 * @param conversationId - The conversation to fetch messages for
 */
export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const response = await apiService.get<Message[]>(
        `/conversations/${conversationId}/messages`,
      );
      return response.data ?? [];
    },
    enabled: !!conversationId,
  });
}

// ─────────────────────────────────────────────
// MUTATION HOOKS
// ─────────────────────────────────────────────

/**
 * Send a message in a conversation.
 * The message is sent as the authenticated user.
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      const response = await apiService.post<Message>(
        `/conversations/${conversationId}/messages`,
        { content },
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Refresh messages for this conversation
      queryClient.invalidateQueries({
        queryKey: ['messages', variables.conversationId],
      });
      // Refresh conversation list (lastMessage updated)
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * Create or get an existing conversation with an agent.
 * Backend uses getOrCreate semantics — if a conversation already
 * exists between the user and agent, it returns the existing one.
 *
 * @returns The conversation (new or existing)
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      participantId,
      applicationId,
    }: {
      participantId: string;
      applicationId?: string;
    }) => {
      const response = await apiService.post<Conversation>('/conversations', {
        participantId,
        applicationId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * Mark a conversation as read for the current user.
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      await apiService.put(`/conversations/${conversationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
