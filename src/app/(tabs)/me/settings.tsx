import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Moon,
  Sun,
  Smartphone,
  Bell,
  Shield,
  CircleHelp,
  FileText,
  MessageSquare,
  LogOut,
  ChevronLeft,
  CreditCard,
} from 'lucide-react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';

import { useSettingsStore, ThemePreference } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { useMySubscription } from '@/hooks/useSubscription';

/** Short plan-tier label for the settings subtitle, e.g. "client_pro" → "Pro". */
function tierLabel(
  sub:
    | { unlimited?: boolean; entitlements: { planId: string } | null }
    | null
    | undefined,
): string {
  if (sub?.unlimited) return 'Unlimited';
  const planId = sub?.entitlements?.planId;
  if (!planId) return 'Free';
  const seg = planId.split('_').pop() ?? planId;
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const COMPANY_NAME = 'Durin Technologies';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  isDark: boolean;
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
  isDark,
}: Readonly<SettingItemProps>) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      className={`flex-row items-center px-4 py-3 ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`}
    >
      <View
        className={`mr-3 h-9 w-9 items-center justify-center rounded-lg ${
          isDark ? 'bg-gray-700' : 'bg-gray-100'
        }`}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement}
      {showChevron && onPress && (
        <ChevronRight size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
      )}
    </TouchableOpacity>
  );
}

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}

function SettingSection({
  title,
  children,
  isDark,
}: Readonly<SettingSectionProps>) {
  return (
    <View className="mb-6">
      <Text
        className={`mb-2 px-4 text-sm font-semibold uppercase ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        {title}
      </Text>
      <View
        className={`overflow-hidden rounded-xl ${
          isDark ? 'bg-gray-800' : 'bg-white'
        }`}
      >
        {children}
      </View>
    </View>
  );
}

function Divider({ isDark }: Readonly<{ isDark: boolean }>) {
  return (
    <View className={`ml-16 h-px ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} />
  );
}

export default function Settings() {
  const {
    themePreference,
    setThemePreference,
    notificationsEnabled,
    setNotificationsEnabled,
    isDark: getIsDark,
  } = useSettingsStore();

  const isDark = getIsDark();
  const { data: subscription } = useMySubscription();

  const handleThemeSelect = () => {
    Alert.alert(
      'Appearance',
      'Choose your preferred theme',
      [
        {
          text: 'System Default',
          onPress: () => setThemePreference('system'),
        },
        {
          text: 'Light',
          onPress: () => setThemePreference('light'),
        },
        {
          text: 'Dark',
          onPress: () => setThemePreference('dark'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true },
    );
  };

  const getThemeLabel = (preference: ThemePreference): string => {
    switch (preference) {
      case 'system':
        return 'System';
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
    }
  };

  const getThemeIcon = () => {
    const iconColor = isDark ? '#9ca3af' : '#6b7280';
    switch (themePreference) {
      case 'light':
        return <Sun size={20} color={iconColor} />;
      case 'dark':
        return <Moon size={20} color={iconColor} />;
      default:
        return <Smartphone size={20} color={iconColor} />;
    }
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://durintech.com/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://durintech.com/terms');
  };

  const handleHelpCenter = () => {
    Linking.openURL('https://durintech.com/help');
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@durintech.com');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          useAuthStore.getState().logout();
        },
      },
    ]);
  };

  const iconColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
      edges={['top']}
    >
      {/* Header */}
      <View
        className={`flex-row items-center border-b px-4 py-3 ${
          isDark ? 'border-gray-800' : 'border-gray-200'
        }`}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 p-1"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text
          className={`text-xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Appearance */}
        <SettingSection title="Appearance" isDark={isDark}>
          <SettingItem
            icon={getThemeIcon()}
            title="Theme"
            subtitle={getThemeLabel(themePreference)}
            onPress={handleThemeSelect}
            isDark={isDark}
          />
        </SettingSection>

        {/* Notifications */}
        <SettingSection title="Notifications" isDark={isDark}>
          <SettingItem
            icon={<Bell size={20} color={iconColor} />}
            title="Push Notifications"
            subtitle="Receive updates about your applications"
            showChevron={false}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                thumbColor="#fff"
              />
            }
            isDark={isDark}
          />
        </SettingSection>

        {/* Billing */}
        <SettingSection title="Billing" isDark={isDark}>
          <SettingItem
            icon={<CreditCard size={20} color={iconColor} />}
            title="Subscription"
            subtitle={`${tierLabel(subscription)} plan`}
            // Cast: typed-route table regenerates on `expo start` (route is valid).
            onPress={() => router.push('/me/subscription' as Href)}
            isDark={isDark}
          />
        </SettingSection>

        {/* Legal */}
        <SettingSection title="Legal" isDark={isDark}>
          <SettingItem
            icon={<Shield size={20} color={iconColor} />}
            title="Privacy Policy"
            onPress={handlePrivacyPolicy}
            isDark={isDark}
          />
          <Divider isDark={isDark} />
          <SettingItem
            icon={<FileText size={20} color={iconColor} />}
            title="Terms of Service"
            onPress={handleTermsOfService}
            isDark={isDark}
          />
        </SettingSection>

        {/* Support */}
        <SettingSection title="Support" isDark={isDark}>
          <SettingItem
            icon={<CircleHelp size={20} color={iconColor} />}
            title="Help Center"
            onPress={handleHelpCenter}
            isDark={isDark}
          />
          <Divider isDark={isDark} />
          <SettingItem
            icon={<MessageSquare size={20} color={iconColor} />}
            title="Contact Support"
            subtitle="support@durintech.com"
            onPress={handleContactSupport}
            isDark={isDark}
          />
        </SettingSection>

        {/* Account */}
        <SettingSection title="Account" isDark={isDark}>
          <SettingItem
            icon={<LogOut size={20} color="#ef4444" />}
            title="Sign Out"
            onPress={handleSignOut}
            showChevron={false}
            isDark={isDark}
          />
        </SettingSection>

        {/* App Info */}
        <View className="items-center py-6">
          <Text
            className={`text-lg font-semibold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Seli
          </Text>
          <Text
            className={`mt-1 text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            Version {APP_VERSION}
          </Text>
          <Text
            className={`mt-2 text-xs ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            Made with care by {COMPANY_NAME}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
