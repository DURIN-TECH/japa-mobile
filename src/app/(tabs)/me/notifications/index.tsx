/**
 * Notifications Screen
 *
 * Displays the user's notification history, with mark-as-read and
 * mark-all-as-read functionality. Tapping a notification navigates
 * to the relevant screen (application, consultation, etc.).
 *
 * Backend endpoints:
 * - GET /notifications          → paginated notification list
 * - PUT /notifications/:id/read → mark single notification as read
 * - PUT /notifications/read-all → mark all as read
 */

import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Bell,
  ChevronLeft,
  FileText,
  Calendar,
  CreditCard,
  MessageSquare,
  AlertCircle,
  CheckCheck,
  Inbox,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type ApiNotification,
} from '@/hooks/useNotifications';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen } from '@/components/ui/themed';
import { analyticsService } from '@/services/analytics.service';

// ─────────────────────────────────────────────
// NOTIFICATION TYPE CONFIGURATION
// Maps each notification type to an icon and color
// for consistent visual treatment in the list.
// ─────────────────────────────────────────────
const NOTIFICATION_CONFIG: Record<
  ApiNotification['type'],
  { icon: typeof Bell; color: string; label: string }
> = {
  application_update: {
    icon: FileText,
    color: '#3b82f6', // blue
    label: 'Application',
  },
  document_status: {
    icon: FileText,
    color: '#8b5cf6', // purple
    label: 'Document',
  },
  consultation_reminder: {
    icon: Calendar,
    color: '#10b981', // green
    label: 'Consultation',
  },
  payment_received: {
    icon: CreditCard,
    color: '#10b981', // green
    label: 'Payment',
  },
  payment_request: {
    icon: CreditCard,
    color: '#f59e0b', // amber
    label: 'Payment Request',
  },
  payment_request_rejected: {
    icon: AlertCircle,
    color: '#ef4444', // red
    label: 'Payment Rejected',
  },
  message_received: {
    icon: MessageSquare,
    color: '#3b82f6', // blue
    label: 'Message',
  },
  system: {
    icon: Bell,
    color: '#6b7280', // gray
    label: 'System',
  },
};

/**
 * Navigate to the relevant screen based on notification type.
 * Each notification type maps to a specific deep-link target.
 */
function handleNotificationPress(notification: ApiNotification) {
  const { type } = notification;
  // Support both relatedEntityId (correct) and referenceId (legacy)
  const entityId = notification.relatedEntityId ?? notification.referenceId;

  if (!entityId) return;

  switch (type) {
    case 'application_update':
    case 'payment_request':
    case 'payment_request_rejected':
    case 'document_status':
      router.push({
        pathname: '/me/applications/[id]',
        params: { id: entityId },
      });
      break;
    case 'consultation_reminder':
      router.push({
        pathname: '/me/consultations/[id]',
        params: { id: entityId },
      });
      break;
    case 'message_received':
      router.push({
        pathname: '/me/chat/[conversationId]',
        params: { conversationId: entityId },
      });
      break;
    case 'payment_received':
    case 'system':
    default:
      break;
  }
}

export default function NotificationsScreen() {
  const { isDark, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Track screen view
  analyticsService.trackScreenView('NotificationsScreen');

  // Fetch notifications from backend
  const { data: notifications, isLoading } = useNotifications(50);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Count unread for the "Mark all" button
  const unreadCount = (notifications ?? []).filter((n) => !n.isRead).length;

  const handlePress = (notification: ApiNotification) => {
    // Mark as read if not already
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    // Navigate to the relevant screen
    handleNotificationPress(notification);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    setRefreshing(false);
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
                Notifications
              </Text>
              {unreadCount > 0 && (
                <Text
                  className={cn(
                    'text-sm',
                    isDark ? 'text-gray-400' : 'text-gray-500',
                  )}
                >
                  {unreadCount} unread
                </Text>
              )}
            </View>
          </View>

          {/* Mark All as Read button — only show when there are unread items */}
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              disabled={markAllRead.isPending}
              className="flex-row items-center rounded-lg bg-blue-600 px-3 py-1.5"
            >
              <CheckCheck size={16} color="#fff" />
              <Text className="ml-1 text-sm font-medium text-white">
                Read All
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Notification List */}
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
              Loading notifications...
            </Text>
          </View>
        ) : !notifications || notifications.length === 0 ? (
          /* Empty state */
          <View className="items-center py-16">
            <Inbox size={48} color={colors.iconMuted} />
            <Text
              className={cn(
                'mt-3 text-center text-base',
                isDark ? 'text-gray-400' : 'text-gray-500',
              )}
            >
              No notifications yet
            </Text>
            <Text
              className={cn(
                'mt-1 text-center text-sm',
                isDark ? 'text-gray-500' : 'text-gray-400',
              )}
            >
              We'll notify you about updates to your applications
            </Text>
          </View>
        ) : (
          /* Notification items */
          notifications.map((notification) => {
            const config =
              NOTIFICATION_CONFIG[notification.type] ??
              NOTIFICATION_CONFIG.system;
            const IconComponent = config.icon;
            const isUnread = !notification.isRead;

            return (
              <TouchableOpacity
                key={notification.id}
                onPress={() => handlePress(notification)}
                activeOpacity={0.7}
                className={cn(
                  'flex-row border-b px-4 py-3',
                  isDark ? 'border-gray-800' : 'border-gray-100',
                  // Subtle background highlight for unread notifications
                  isUnread && (isDark ? 'bg-gray-800/50' : 'bg-blue-50/50'),
                )}
              >
                {/* Icon circle */}
                <View
                  className="mr-3 mt-0.5 h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${config.color}20` }}
                >
                  <IconComponent size={20} color={config.color} />
                </View>

                {/* Content */}
                <View className="flex-1">
                  <View className="flex-row items-start justify-between">
                    <Text
                      className={cn(
                        'flex-1 text-base',
                        isUnread ? 'font-semibold' : 'font-normal',
                        isDark ? 'text-white' : 'text-gray-900',
                      )}
                      numberOfLines={2}
                    >
                      {notification.title}
                    </Text>
                    {/* Unread indicator dot */}
                    {isUnread && (
                      <View className="ml-2 mt-2 h-2.5 w-2.5 rounded-full bg-blue-600" />
                    )}
                  </View>

                  <Text
                    className={cn(
                      'mt-0.5 text-sm',
                      isDark ? 'text-gray-400' : 'text-gray-600',
                    )}
                    numberOfLines={2}
                  >
                    {notification.body || notification.message}
                  </Text>

                  {/* Timestamp + type label */}
                  <View className="mt-1 flex-row items-center">
                    <Text
                      className={cn(
                        'text-xs',
                        isDark ? 'text-gray-500' : 'text-gray-400',
                      )}
                    >
                      {formatNotificationDate(notification.createdAt)}
                    </Text>
                    <Text
                      className={cn(
                        'ml-2 text-xs',
                        isDark ? 'text-gray-500' : 'text-gray-400',
                      )}
                    >
                      • {config.label}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * Format notification date for display.
 * Shows relative time for recent notifications, absolute date for older ones.
 */
function formatNotificationDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
