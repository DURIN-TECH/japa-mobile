import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Screen, Button, Typography, Card } from '@/components/ui/themed';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme, cn } from '@/hooks/useTheme';

const OTP_LENGTH = 6;

export default function VerifyOtpScreen() {
  const { isDark } = useTheme();
  const { verifyOtp, sendOtp, phoneNumber, isLoading, error, clearError } =
    useAuthStore();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const pastedOtp = value.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      pastedOtp.forEach((char, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + pastedOtp.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    clearError();
    const otpString = otp.join('');
    if (otpString.length !== OTP_LENGTH) return;

    await verifyOtp(otpString);
    // Navigation handled by root layout based on auth state
  };

  const handleResend = async () => {
    if (!phoneNumber || resendTimer > 0) return;
    clearError();
    const success = await sendOtp(phoneNumber);
    if (success) {
      setResendTimer(30);
      setOtp(Array(OTP_LENGTH).fill(''));
    }
  };

  const isOtpComplete = otp.every((digit) => digit !== '');

  return (
    <Screen>
      <View className="flex-1 justify-center px-6">
        {/* Header */}
        <View className="mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Typography color="primary">← Back</Typography>
          </TouchableOpacity>
          <Text
            className={cn(
              'text-3xl font-bold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            Verify Phone
          </Text>
          <Typography variant="body" color="muted" className="mt-2">
            Enter the 6-digit code sent to
          </Typography>
          <Typography variant="body" className="mt-1">
            {phoneNumber || 'your phone'}
          </Typography>
        </View>

        {/* Error Banner */}
        {error && (
          <Card className="mb-4 border-red-500/50 bg-red-500/10">
            <Typography color="error">{error}</Typography>
          </Card>
        )}

        {/* OTP Input */}
        <View className="mb-6 flex-row justify-between">
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
              keyboardType="number-pad"
              maxLength={index === 0 ? OTP_LENGTH : 1}
              className={cn(
                'h-14 w-12 rounded-xl border text-center text-xl font-bold',
                isDark
                  ? 'border-gray-700 bg-gray-800 text-white'
                  : 'border-gray-200 bg-white text-gray-900',
                digit && 'border-blue-500',
              )}
              style={{ color: isDark ? '#fff' : '#111' }}
            />
          ))}
        </View>

        {/* Verify Button */}
        <Button
          onPress={handleVerify}
          disabled={isLoading || !isOtpComplete}
          className={!isOtpComplete ? 'opacity-50' : ''}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="font-semibold text-white">Verify</Text>
          )}
        </Button>

        {/* Resend */}
        <View className="mt-6 items-center">
          {resendTimer > 0 ? (
            <Typography color="muted">Resend code in {resendTimer}s</Typography>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={isLoading}>
              <Typography color="primary">Resend Code</Typography>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Screen>
  );
}
