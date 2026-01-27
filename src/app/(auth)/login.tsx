import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Mail, Lock, Phone, Eye, EyeOff } from 'lucide-react-native';
import { Screen, Input, Button, Typography, Card } from '@/components/ui/themed';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme, cn } from '@/hooks/useTheme';

type LoginMethod = 'email' | 'phone';

export default function LoginScreen() {
  const { isDark, colors } = useTheme();
  const { loginWithEmail, sendOtp, isLoading, error, clearError } = useAuthStore();

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    clearError();

    if (loginMethod === 'email') {
      if (!email || !password) return;
      await loginWithEmail(email, password);
      // Navigation handled by root layout based on auth state
    } else {
      if (!phoneNumber) return;
      const success = await sendOtp(phoneNumber);
      if (success) {
        router.push('/verify-otp');
      }
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Logo/Header */}
          <View className="mb-10 items-center">
            <Text className={cn('text-4xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              JAPA
            </Text>
            <Typography variant="body" color="muted" className="mt-2">
              Your visa journey starts here
            </Typography>
          </View>

          {/* Login Method Toggle */}
          <View className={cn(
            'mb-6 flex-row rounded-xl p-1',
            isDark ? 'bg-gray-800' : 'bg-gray-100'
          )}>
            <TouchableOpacity
              onPress={() => { setLoginMethod('email'); clearError(); }}
              className={cn(
                'flex-1 items-center rounded-lg py-3',
                loginMethod === 'email' && (isDark ? 'bg-gray-700' : 'bg-white')
              )}
            >
              <Text className={cn(
                'font-medium',
                loginMethod === 'email'
                  ? isDark ? 'text-white' : 'text-gray-900'
                  : isDark ? 'text-gray-400' : 'text-gray-500'
              )}>
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setLoginMethod('phone'); clearError(); }}
              className={cn(
                'flex-1 items-center rounded-lg py-3',
                loginMethod === 'phone' && (isDark ? 'bg-gray-700' : 'bg-white')
              )}
            >
              <Text className={cn(
                'font-medium',
                loginMethod === 'phone'
                  ? isDark ? 'text-white' : 'text-gray-900'
                  : isDark ? 'text-gray-400' : 'text-gray-500'
              )}>
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {error && (
            <Card className="mb-4 border-red-500/50 bg-red-500/10">
              <Typography color="error">{error}</Typography>
            </Card>
          )}

          {/* Login Form */}
          {loginMethod === 'email' ? (
            <View className="gap-4">
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

              <View>
                <Typography variant="label" color="muted" className="mb-2">
                  Password
                </Typography>
                <View className="relative">
                  <Input
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    icon={<Lock size={20} color={colors.iconMuted} />}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={colors.iconMuted} />
                    ) : (
                      <Eye size={20} color={colors.iconMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/forgot-password')}
                className="self-end"
              >
                <Typography color="primary">Forgot password?</Typography>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Typography variant="label" color="muted" className="mb-2">
                Phone Number
              </Typography>
              <Input
                placeholder="+234 XXX XXX XXXX"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
                icon={<Phone size={20} color={colors.iconMuted} />}
              />
              <Typography variant="caption" color="muted" className="mt-2">
                We&apos;ll send you a verification code
              </Typography>
            </View>
          )}

          {/* Login Button */}
          <Button
            onPress={handleLogin}
            disabled={isLoading}
            className="mt-6"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">
                {loginMethod === 'email' ? 'Sign In' : 'Send Code'}
              </Text>
            )}
          </Button>

          {/* Sign Up Link */}
          <View className="mt-6 flex-row justify-center">
            <Typography color="muted">Don&apos;t have an account? </Typography>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Typography color="primary">Sign Up</Typography>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
