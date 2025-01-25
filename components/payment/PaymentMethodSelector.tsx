import { View, TouchableOpacity, Text } from "react-native";
import { CreditCard, Wallet } from "lucide-react-native";

interface PaymentMethodSelectorProps {
  selectedMethod: string | null;
  onSelectMethod: (method: string) => void;
}

const PAYMENT_METHODS = [
  {
    id: "card",
    title: "Credit Card",
    icon: CreditCard,
  },
  {
    id: "wallet",
    title: "Digital Wallet",
    icon: Wallet,
  },
];

export function PaymentMethodSelector({ selectedMethod, onSelectMethod }: Readonly<PaymentMethodSelectorProps>) {
  return (
    <View className="space-y-3">
      {PAYMENT_METHODS.map((method) => {
        const Icon = method.icon;
        return (
          <TouchableOpacity
            key={method.id}
            onPress={() => onSelectMethod(method.id)}
            className={`
              flex-row items-center p-4 rounded-xl border
              ${selectedMethod === method.id 
                ? 'border-blue-600 bg-blue-50' 
                : 'border-gray-200 bg-white'
              }
            `}
          >
            <Icon 
              size={24} 
              color={selectedMethod === method.id ? "#2563eb" : "#6b7280"} 
            />
            <Text 
              className={`
                ml-3 font-medium
                ${selectedMethod === method.id ? 'text-blue-600' : 'text-gray-900'}
              `}
            >
              {method.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
} 