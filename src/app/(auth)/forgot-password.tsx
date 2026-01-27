import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Mail, CheckCircle } from 'lucide-react-native';
import { Screen, Input, Button, Typography, Card } from '@/components/ui/themed';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme, cn } from '@/hooks/useTheme';

export default function ForgotPasswordScreen() {
  const { isDark, colors } = useTheme();
  const { resetPassword, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    clearError();
    if (!email) return;

    const success = await resetPassword(email);
    if (success) {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <Screen>
        <View className="flex-1 justify-center px-6">
          <View className="items-center">
            <View className={cn(
              'mb-6 h-20 w-20 items-center justify-center rounded-full',
              isDark ? 'bg-green-900/30' : 'bg-green-100'
            )}>
              <CheckCircle size={40} color={isDark ? '#4ade80' : '#16a34a'} />
            </View>
            <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Check Your Email
            </Text>
            <Typography variant="body" color="muted" className="mt-2 text-center">
              We&apos;ve sent a password reset link to
            </Typography>
            <Typography variant="body" className="mt-1 text-center font-medium">
              {email}
            </Typography>
          </View>

          <Button
            onPress={() => router.back()}
            className="mt-8"
          >
            <Text className="font-semibold text-white">Back to Login</Text>
          </Button>

          <TouchableOpacity
            onPress={() => setEmailSent(false)}
            className="mt-4 self-center"
          >
            <Typography color="primary">Try a different email</Typography>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Header */}
          <View className="mb-8">
            <TouchableOpacity onPress={() => router.back()} className="mb-4">
              <Typography color="primary">← Back to Login</Typography>
            </TouchableOpacity>
            <Text className={cn('text-3xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Reset Password
            </Text>
            <Typography variant="body" color="muted" className="mt-2">
              Enter your email and we&apos;ll send you a link to reset your password
            </Typography>
          </View>

          {/* Error Banner */}
          {error && (
            <Card className="mb-4 border-red-500/50 bg-red-500/10">
              <Typography color="error">{error}</Typography>
            </Card>
          )}

          {/* Email Input */}
          <View>
            <Typography variant="label" color="muted" className="mb-2">
              Email
            </Typography>
            <Input
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              icon={<Mail size={20} color={colors.iconMuted} />}
            />
          </View>

          {/* Reset Button */}
          <Button
            onPress={handleResetPassword}
            disabled={isLoading || !email}
            className="mt-6"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">Send Reset Link</Text>
            )}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
