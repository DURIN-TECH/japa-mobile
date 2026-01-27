import { View, TouchableOpacity, Text } from 'react-native';
import { CreditCard, Wallet } from 'lucide-react-native';
import { useTheme, cn } from '@/hooks/useTheme';

interface PaymentMethodSelectorProps {
  selectedMethod: string | null;
  onSelectMethod: (method: string) => void;
}

const PAYMENT_METHODS = [
  {
    id: 'card',
    title: 'Credit Card',
    icon: CreditCard,
  },
  {
    id: 'wallet',
    title: 'Digital Wallet',
    icon: Wallet,
  },
];

export function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
}: Readonly<PaymentMethodSelectorProps>) {
  const { isDark, colors } = useTheme();

  return (
    <View className="gap-3">
      {PAYMENT_METHODS.map((method) => {
        const Icon = method.icon;
        const isSelected = selectedMethod === method.id;

        return (
          <TouchableOpacity
            key={method.id}
            onPress={() => onSelectMethod(method.id)}
            className={cn(
              'flex-row items-center rounded-xl border p-4',
              isSelected
                ? isDark
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-blue-600 bg-blue-50'
                : isDark
                  ? 'border-gray-700 bg-gray-800'
                  : 'border-gray-200 bg-white',
            )}
          >
            <Icon
              size={24}
              color={isSelected ? colors.primary : colors.iconMuted}
            />
            <Text
              className={cn(
                'ml-3 font-medium',
                isSelected
                  ? 'text-blue-600'
                  : isDark
                    ? 'text-white'
                    : 'text-gray-900',
              )}
            >
              {method.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
