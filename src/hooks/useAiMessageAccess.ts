/**
 * useAiMessageAccess hooks (issue #172)
 *
 * React Query hooks for the AI message access gate: the signed-in person's
 * approval and account-wide setting, the one-time notice, and the per-chat
 * switch on a conversation.
 *
 * Backend endpoints used:
 * - GET    /users/me/ai-message-access                      → state
 * - POST   /users/me/ai-message-access/approval             → approve
 * - DELETE /users/me/ai-message-access/approval             → withdraw
 * - PUT    /users/me/ai-message-access/account-wide-off     → "keep AI out of all my chats"
 * - POST   /users/me/ai-message-access/notice-dismissed     → one-time notice seen
 * - GET    /conversations/:id                               → conversation + aiAccess
 * - PUT    /conversations/:id/ai-access                     → my side of the chat switch
 *
 * Rules (from the issue and the contract):
 * - NOT optimistic: every switch moves only after the server answers, and the
 *   screens render the state the server returned.
 * - `aiAccess === null` is unknown, never "on".
 * - Every write returns the fresh state, which we put straight into the cache.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { tracked, useIsOffline } from '@/utils/networkStatus';
import type { AiMessageAccessState } from '@/types/ai-message-access.type';
import type { Conversation } from '@/types/messaging.type';

export const AI_ACCESS_KEY = ['ai-message-access'] as const;
export const conversationKey = (id: string) => ['conversation', id] as const;

// ─────────────────────────────────────────────
// USER STATE (approval, plan, account-wide setting, notice)
// ─────────────────────────────────────────────

/** The caller's AI message access state, plus the wording an approval would record now. */
export function useAiMessageAccessState(enabled = true) {
  return useQuery({
    enabled,
    queryKey: AI_ACCESS_KEY,
    queryFn: async () => {
      const res = await tracked(() =>
        apiService.get<AiMessageAccessState>('/users/me/ai-message-access'),
      );
      if (!res.data) throw new Error('Empty AI message access response');
      return res.data;
    },
  });
}

/**
 * Shared onSuccess for the four user writes: store the returned state, then
 * refetch every conversation (their `aiAccess` depends on approval, plan and the
 * account-wide setting).
 */
function useAfterStateWrite() {
  const qc = useQueryClient();
  return (state?: AiMessageAccessState) => {
    if (state) qc.setQueryData(AI_ACCESS_KEY, state);
    qc.invalidateQueries({ queryKey: ['conversations'] });
    qc.invalidateQueries({ queryKey: ['conversation'] });
  };
}

/** Approve with the wording version the screen is showing (the server stores its own text). */
export function useApproveAiAccess() {
  const qc = useQueryClient();
  const after = useAfterStateWrite();
  return useMutation({
    mutationFn: async (wordingVersion: string) => {
      const res = await tracked(() =>
        apiService.post<AiMessageAccessState>(
          '/users/me/ai-message-access/approval',
          { wordingVersion },
        ),
      );
      return res.data;
    },
    onSuccess: after,
    // 409 WORDING_VERSION_MISMATCH: the wording moved on. Refetch so the screen
    // shows the new text before the person tries again.
    onError: (e: { code?: string }) => {
      if (e?.code === 'WORDING_VERSION_MISMATCH')
        qc.invalidateQueries({ queryKey: AI_ACCESS_KEY });
    },
  });
}

/** Withdraw the approval. */
export function useWithdrawAiAccess() {
  const after = useAfterStateWrite();
  return useMutation({
    mutationFn: async () => {
      const res = await tracked(() =>
        apiService.delete<AiMessageAccessState>(
          '/users/me/ai-message-access/approval',
        ),
      );
      return res.data;
    },
    onSuccess: after,
  });
}

/** "Keep AI out of all my chats". `off: true` = AI kept out. */
export function useSetAccountWideOff() {
  const after = useAfterStateWrite();
  return useMutation({
    mutationFn: async (off: boolean) => {
      const res = await tracked(() =>
        apiService.put<AiMessageAccessState>(
          '/users/me/ai-message-access/account-wide-off',
          { off },
        ),
      );
      return res.data;
    },
    onSuccess: after,
  });
}

// ─────────────────────────────────────────────
// PER-CHAT SWITCH
// ─────────────────────────────────────────────

/**
 * One conversation, with `aiAccess`. While offline it re-checks every 10 s so
 * the offline state clears itself once the connection is back (a success
 * clears the flag in `networkStatus`).
 */
export function useConversation(conversationId: string) {
  const offline = useIsOffline();
  return useQuery({
    queryKey: conversationKey(conversationId),
    queryFn: async () => {
      const res = await tracked(() =>
        apiService.get<Conversation>(`/conversations/${conversationId}`),
      );
      if (!res.data) throw new Error('Empty conversation response');
      return res.data;
    },
    enabled: !!conversationId,
    refetchInterval: offline ? 10_000 : false,
  });
}

/**
 * Switch MY side of the chat off or on. `off: true` = AI kept out. Any
 * participant may do this, qualifying or not. Returns the updated conversation,
 * which we cache; the switch only moves once that comes back.
 */
export function useSetChatAiAccess(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (off: boolean) => {
      const res = await tracked(() =>
        apiService.put<Conversation>(
          `/conversations/${conversationId}/ai-access`,
          { off },
        ),
      );
      return res.data;
    },
    onSuccess: (conv) => {
      if (conv) qc.setQueryData(conversationKey(conversationId), conv);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
