// ─────────────────────────────────────────────────────────────────────────────
// Ask-anywhere chat hooks (issue #45).
//
//   GET    /ai/applications/:id/chat   → history (oldest first)
//   POST   /ai/applications/:id/chat   → one turn (non-streaming)
//   DELETE /ai/applications/:id/chat   → clear the conversation
//
// All calls go through the shared `apiService` (no second HTTP client). The
// POST is non-streaming: the screen shows a pending bubble until it resolves.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService, type ApiError } from '@/services/api.service';
import type { ChatHistory, ChatReply } from '@/types/ai-chat.type';

// Query key for one application's conversation.
export const aiChatKey = (applicationId: string) =>
  ['aiChat', applicationId] as const;

/** Stored conversation for the signed-in user on this application. */
export function useAiChatHistory(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: aiChatKey(applicationId),
    queryFn: async () => {
      const res = await apiService.get<ChatHistory>(
        `/ai/applications/${applicationId}/chat`,
      );
      return res.data?.messages ?? [];
    },
    enabled: enabled && !!applicationId,
    // A 402/403 won't fix itself on retry.
    retry: false,
  });
}

/** Send one message. Resolves with the assistant's reply. */
export function useSendAiChat(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const res = await apiService.post<ChatReply>(
        `/ai/applications/${applicationId}/chat`,
        { message },
      );
      if (!res.data) throw new Error('Empty chat reply');
      return res.data;
    },
    // The server stored both turns; refetch so history is the source of truth.
    onSuccess: () => qc.invalidateQueries({ queryKey: aiChatKey(applicationId) }),
  });
}

/** Clear the conversation (also frees a CONVERSATION_FULL chat). */
export function useClearAiChat(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiService.delete<{ cleared: boolean }>(
        `/ai/applications/${applicationId}/chat`,
      );
    },
    onSuccess: () => qc.setQueryData(aiChatKey(applicationId), []),
  });
}

/**
 * Map a failed chat call to what the screen should do. 402 → upgrade prompt;
 * everything else → one line of text (the server's message where it is
 * user-facing, our own where it is not).
 */
export function describeChatError(e: unknown): {
  upgrade: boolean;
  text: string;
} {
  const err = e as Partial<ApiError> | undefined;
  const status = err?.status ?? 0;
  const code = err?.code ?? '';
  if (status === 402 || code === 'UPGRADE_REQUIRED') {
    return { upgrade: true, text: 'Chat is part of a paid plan.' };
  }
  if (status === 429) {
    return {
      upgrade: false,
      text: "You've reached the chat limit for now. Please try again later.",
    };
  }
  if (code === 'CONVERSATION_FULL') {
    return {
      upgrade: false,
      text: err?.message || 'This conversation is full. Clear it to start again.',
    };
  }
  if (status === 403) {
    return {
      upgrade: false,
      text: err?.message || "You can't use chat on this application.",
    };
  }
  if (status === 400) {
    return { upgrade: false, text: err?.message || 'That message cannot be sent.' };
  }
  return {
    upgrade: false,
    text: "We couldn't get an answer just now. Please try again.",
  };
}
