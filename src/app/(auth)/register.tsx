import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import {
  Screen,
  Input,
  Button,
  Typography,
  Card,
} from '@/components/ui/themed';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme, cn } from '@/hooks/useTheme';

export default function RegisterScreen() {
  const { isDark, colors } = useTheme();
  const { registerWithEmail, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const handleRegister = async () => {
    clearError();
    setLocalError(null);

    if (!email || !password || !confirmPassword) {
      setLocalError('Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setLocalError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    await registerWithEmail(email, password);
    // Navigation handled by root layout based on auth state
  };

  const displayError = localError || error;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="mb-8">
            <TouchableOpacity onPress={() => router.back()} className="mb-4">
              <Typography color="primary">← Back to Login</Typography>
            </TouchableOpacity>
            <Text
              className={cn(
                'text-3xl font-bold',
                isDark ? 'text-white' : 'text-gray-900',
              )}
            >
              Create Account
            </Text>
            <Typography variant="body" color="muted" className="mt-2">
              Start your visa journey with Seli
            </Typography>
          </View>

          {/* Error Banner */}
          {displayError && (
            <Card className="mb-4 border-red-500/50 bg-red-500/10">
              <Typography color="error">{displayError}</Typography>
            </Card>
          )}

          {/* Registration Form */}
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
                  placeholder="Create a password"
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
              <Typography variant="caption" color="muted" className="mt-1">
                At least 6 characters
              </Typography>
            </View>

            <View>
              <Typography variant="label" color="muted" className="mb-2">
                Confirm Password
              </Typography>
              <Input
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                icon={<Lock size={20} color={colors.iconMuted} />}
              />
            </View>
          </View>

          {/* Register Button */}
          <Button
            onPress={handleRegister}
            disabled={isLoading}
            className="mt-6"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">Create Account</Text>
            )}
          </Button>

          {/* Terms */}
          <Typography
            variant="caption"
            color="muted"
            className="mt-4 text-center"
          >
            By creating an account, you agree to our{' '}
            <Text className="text-blue-600">Terms of Service</Text> and{' '}
            <Text className="text-blue-600">Privacy Policy</Text>
          </Typography>

          {/* Login Link */}
          <View className="mt-6 flex-row justify-center">
            <Typography color="muted">Already have an account? </Typography>
            <TouchableOpacity onPress={() => router.back()}>
              <Typography color="primary">Sign In</Typography>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
