/**
 * Conversations List Screen
 *
 * Shows all messaging conversations between the user and agents.
 * Includes a "New Message" button that lets users start a conversation
 * with an agent from one of their applications.
 *
 * Backend endpoints:
 * - GET /conversations          → list conversations
 * - POST /conversations         → create or get existing conversation
 * - GET /applications           → user's apps (to find agents to message)
 */

import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  MessageSquare,
  ChevronRight,
  Plus,
  X,
  User,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations, useCreateConversation } from '@/hooks/useMessaging';
import { useApplications } from '@/hooks/useApplications';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen } from '@/components/ui/themed';
import { analyticsService } from '@/services/analytics.service';

export default function ConversationsScreen() {
  const { isDark, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const queryClient = useQueryClient();

  analyticsService.trackScreenView('ConversationsScreen');

  const { data: conversations, isLoading } = useConversations();
  const { data: applications } = useApplications();
  const createConversation = useCreateConversation();

  // Build a deduplicated list of agents from the user's applications
  // that they can start a conversation with
  const agentOptions = (() => {
    if (!applications) return [];
    const seen = new Set<string>();
    return applications
      .filter(
        (app) => app.agentId && !seen.has(app.agentId) && seen.add(app.agentId),
      )
      .map((app) => ({
        agentId: app.agentId!,
        agentName: app.agentNotes ? undefined : undefined, // no agent name on Application type
        applicationId: app.id,
        label: app.visaTypeName ?? app.currentStep ?? 'Application',
      }));
  })();

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    setRefreshing(false);
  };

  const handleConversationPress = (conversationId: string) => {
    router.push({
      pathname: '/me/chat/[conversationId]',
      params: { conversationId },
    });
  };

  /**
   * Start a new conversation with an agent.
   * Backend uses getOrCreate — if one exists, it returns the existing one.
   */
  const handleStartConversation = (agentId: string, applicationId: string) => {
    setShowNewChat(false);
    createConversation.mutate(
      { participantId: agentId, applicationId },
      {
        onSuccess: (conversation) => {
          if (conversation?.id) {
            router.push({
              pathname: '/me/chat/[conversationId]',
              params: { conversationId: conversation.id },
            });
          }
        },
        onError: () => {
          Alert.alert(
            'Error',
            'Failed to create conversation. Please try again.',
          );
        },
      },
    );
  };

  return (
    <Screen>
      {/* Header */}
      <View
        className={cn('px-4 pb-2 pt-1', isDark ? 'bg-gray-800' : 'bg-white')}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 p-1"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <View>
              <Text
                className={cn(
                  'text-xl font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                Messages
              </Text>
              <Text
                className={cn(
                  'text-sm',
                  isDark ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                Your conversations with agents
              </Text>
            </View>
          </View>

          {/* New conversation button */}
          {agentOptions.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowNewChat(true)}
              className="h-9 w-9 items-center justify-center rounded-full bg-blue-600"
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conversation List */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.primary} />
            <Text
              className={cn(
                'mt-2 text-sm',
                isDark ? 'text-gray-400' : 'text-gray-500',
              )}
            >
              Loading conversations...
            </Text>
          </View>
        ) : !conversations || conversations.length === 0 ? (
          <View className="items-center py-16">
            <MessageSquare size={48} color={colors.iconMuted} />
            <Text
              className={cn(
                'mt-3 text-center text-base',
                isDark ? 'text-gray-400' : 'text-gray-500',
              )}
            >
              No conversations yet
            </Text>
            <Text
              className={cn(
                'mt-1 px-8 text-center text-sm',
                isDark ? 'text-gray-500' : 'text-gray-400',
              )}
            >
              Start a conversation with one of your agents
            </Text>
            {agentOptions.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowNewChat(true)}
                className="mt-4 flex-row items-center rounded-lg bg-blue-600 px-4 py-2.5"
              >
                <Plus size={18} color="#fff" />
                <Text className="ml-2 font-medium text-white">New Message</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          conversations.map((conversation) => {
            const hasUnread = conversation.unreadCountUser > 0;
            // Get agent initial for avatar
            const initial = (conversation.agentName ?? 'A')
              .charAt(0)
              .toUpperCase();

            return (
              <TouchableOpacity
                key={conversation.id}
                onPress={() => handleConversationPress(conversation.id)}
                activeOpacity={0.7}
                className={cn(
                  'flex-row items-center border-b px-4 py-3',
                  isDark ? 'border-gray-800' : 'border-gray-100',
                  hasUnread && (isDark ? 'bg-gray-800/50' : 'bg-blue-50/30'),
                )}
              >
                {/* Avatar with agent initial */}
                <View
                  className={cn(
                    'mr-3 h-12 w-12 items-center justify-center rounded-full',
                    isDark ? 'bg-blue-900/50' : 'bg-blue-100',
                  )}
                >
                  <Text
                    className={cn(
                      'text-lg font-bold',
                      isDark ? 'text-blue-300' : 'text-blue-600',
                    )}
                  >
                    {initial}
                  </Text>
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={cn(
                        'text-base',
                        hasUnread ? 'font-bold' : 'font-medium',
                        isDark ? 'text-white' : 'text-gray-900',
                      )}
                      numberOfLines={1}
                    >
                      {conversation.agentName ?? 'Agent'}
                    </Text>
                    <Text
                      className={cn(
                        'text-xs',
                        hasUnread
                          ? 'font-semibold text-blue-600'
                          : isDark
                            ? 'text-gray-500'
                            : 'text-gray-400',
                      )}
                    >
                      {formatConversationTime(conversation.lastMessageAt)}
                    </Text>
                  </View>

                  <View className="mt-0.5 flex-row items-center justify-between">
                    <Text
                      className={cn(
                        'flex-1 text-sm',
                        hasUnread
                          ? isDark
                            ? 'font-medium text-gray-300'
                            : 'font-medium text-gray-700'
                          : isDark
                            ? 'text-gray-400'
                            : 'text-gray-500',
                      )}
                      numberOfLines={1}
                    >
                      {conversation.lastMessage ?? 'No messages yet'}
                    </Text>

                    {hasUnread && (
                      <View className="ml-2 h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5">
                        <Text className="text-xs font-bold text-white">
                          {conversation.unreadCountUser > 9
                            ? '9+'
                            : conversation.unreadCountUser}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <ChevronRight
                  size={16}
                  color={colors.iconMuted}
                  className="ml-2"
                />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* New Conversation Modal — pick an agent from your applications */}
      <Modal
        visible={showNewChat}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewChat(false)}
      >
        <View className="flex-1 justify-end">
          {/* Backdrop */}
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setShowNewChat(false)}
          />

          {/* Bottom sheet */}
          <View
            className={cn(
              'rounded-t-2xl px-4 pb-10 pt-4',
              isDark ? 'bg-gray-800' : 'bg-white',
            )}
          >
            {/* Header */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text
                className={cn(
                  'text-lg font-bold',
                  isDark ? 'text-white' : 'text-gray-900',
                )}
              >
                New Conversation
              </Text>
              <TouchableOpacity
                onPress={() => setShowNewChat(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors.iconMuted} />
              </TouchableOpacity>
            </View>

            <Text
              className={cn(
                'mb-3 text-sm',
                isDark ? 'text-gray-400' : 'text-gray-500',
              )}
            >
              Choose an agent from your applications to start a chat
            </Text>

            {/* Agent list */}
            {agentOptions.length === 0 ? (
              <View className="items-center py-6">
                <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                  No agents found. Start an application first.
                </Text>
              </View>
            ) : (
              agentOptions.map((option) => (
                <TouchableOpacity
                  key={`${option.agentId}-${option.applicationId}`}
                  onPress={() =>
                    handleStartConversation(
                      option.agentId,
                      option.applicationId,
                    )
                  }
                  disabled={createConversation.isPending}
                  className={cn(
                    'mb-2 flex-row items-center rounded-xl border p-3',
                    isDark
                      ? 'border-gray-700 bg-gray-700/50'
                      : 'border-gray-200 bg-gray-50',
                  )}
                >
                  <View
                    className={cn(
                      'mr-3 h-10 w-10 items-center justify-center rounded-full',
                      isDark ? 'bg-blue-900/50' : 'bg-blue-100',
                    )}
                  >
                    <User size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={cn(
                        'font-medium',
                        isDark ? 'text-white' : 'text-gray-900',
                      )}
                    >
                      Agent for {option.label}
                    </Text>
                    <Text
                      className={cn(
                        'text-sm',
                        isDark ? 'text-gray-400' : 'text-gray-500',
                      )}
                    >
                      Tap to start a conversation
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.iconMuted} />
                </TouchableOpacity>
              ))
            )}

            {createConversation.isPending && (
              <View className="items-center py-3">
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function formatConversationTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
