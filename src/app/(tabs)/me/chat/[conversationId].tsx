/**
 * Chat Screen
 *
 * Minimal chat interface for client-agent conversations.
 * Auto-created when a payment request is rejected, showing
 * the rejection reason as the first message.
 *
 * This is a minimal viable chat — full messaging feature
 * can be expanded later with attachments, typing indicators, etc.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { format } from 'date-fns';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header } from '@/components/ui/themed';
import {
  useMessages,
  useSendMessage,
  useMarkConversationRead,
} from '@/hooks/useMessaging';
import { Message } from '@/types/messaging.type';
import { useAuthStore } from '@/stores/auth.store';

// ─────────────────────────────────────────────
// HELPER: Parse date from various formats
// ─────────────────────────────────────────────

function parseDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return new Date(value as string | number);
}

// ─────────────────────────────────────────────
// MESSAGE BUBBLE COMPONENT
// ─────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  isDark,
}: {
  message: Message;
  isOwn: boolean;
  isDark: boolean;
}) {
  return (
    <View className={cn('mb-3 max-w-[80%]', isOwn ? 'self-end' : 'self-start')}>
      <View
        className={cn(
          'rounded-2xl px-4 py-2.5',
          isOwn
            ? 'bg-blue-600 rounded-br-sm'
            : isDark
              ? 'bg-gray-700 rounded-bl-sm'
              : 'bg-gray-100 rounded-bl-sm',
        )}
      >
        <Text
          className={cn(
            'text-base',
            isOwn ? 'text-white' : isDark ? 'text-white' : 'text-gray-900',
          )}
        >
          {message.content}
        </Text>
      </View>
      <Text
        className={cn(
          'text-xs mt-1',
          isOwn ? 'text-right' : 'text-left',
          isDark ? 'text-gray-500' : 'text-gray-400',
        )}
      >
        {format(parseDate(message.createdAt), 'h:mm a')}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// CHAT SCREEN
// ─────────────────────────────────────────────

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { isDark, colors } = useTheme();
  const { user } = useAuthStore();
  // Get the tab bar height so we can pad the input bar above it
  const tabBarHeight = useBottomTabBarHeight();

  // Data hooks
  const { data: messages, isLoading } = useMessages(conversationId ?? '');
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();

  // Local state
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Mark conversation as read on mount
  useEffect(() => {
    if (conversationId) {
      markRead.mutate(conversationId);
    }
  }, [conversationId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages?.length) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages?.length]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || !conversationId) return;

    sendMessage.mutate({ conversationId, content: trimmed });
    setInputText('');
  };

  const currentUserId = user?.uid;

  return (
    <Screen>
      <Header title="Chat" showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : 0}
      >
        {/* Message List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwn={item.senderId === currentUserId}
                isDark={isDark}
              />
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-8">
                <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  No messages yet
                </Text>
              </View>
            }
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* Input Bar — padded above the tab bar */}
        <View
          className={cn(
            'flex-row items-center px-4 py-3 border-t',
            isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white',
          )}
          style={{ paddingBottom: tabBarHeight + 8 }}
        >
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            multiline
            maxLength={1000}
            className={cn(
              'flex-1 rounded-full px-4 py-2 mr-2 max-h-[100px] text-base',
              isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900',
            )}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sendMessage.isPending}
            className={cn(
              'w-10 h-10 rounded-full items-center justify-center',
              inputText.trim()
                ? 'bg-blue-600'
                : isDark
                  ? 'bg-gray-700'
                  : 'bg-gray-200',
            )}
          >
            <Send size={18} color={inputText.trim() ? 'white' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
