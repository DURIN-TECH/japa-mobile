import { ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ViewProps,
  TextProps,
  ScrollViewProps,
  TouchableOpacityProps,
  TextInputProps,
  RefreshControl,
} from 'react-native';
import {
  SafeAreaView,
  SafeAreaViewProps,
} from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme, cn } from '@/hooks/useTheme';

// ============================================
// Screen Container
// ============================================
interface ScreenProps extends SafeAreaViewProps {
  children: ReactNode;
}

export function Screen({ children, className, ...props }: ScreenProps) {
  const { isDark } = useTheme();
  return (
    <SafeAreaView
      className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50', className)}
      {...props}
    >
      {children}
    </SafeAreaView>
  );
}

// ============================================
// Header
// ============================================
interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightElement?: ReactNode;
}

export function Header({
  title,
  showBack = false,
  rightElement,
}: Readonly<HeaderProps>) {
  const { isDark, colors } = useTheme();

  return (
    <View
      className={cn(
        'flex-row items-center justify-between border-b px-4 py-3',
        isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white',
      )}
    >
      <View className="flex-row items-center">
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 p-1"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text
          className={cn(
            'text-2xl font-bold',
            isDark ? 'text-white' : 'text-gray-900',
          )}
        >
          {title}
        </Text>
      </View>
      {rightElement}
    </View>
  );
}

// ============================================
// ScrollContainer
// ============================================
interface ScrollContainerProps extends ScrollViewProps {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function ScrollContainer({
  children,
  className,
  refreshing,
  onRefresh,
  ...props
}: ScrollContainerProps) {
  const { isDark } = useTheme();

  return (
    <ScrollView
      className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50', className)}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
          />
        ) : undefined
      }
      {...props}
    >
      {children}
    </ScrollView>
  );
}

// ============================================
// Card
// ============================================
interface CardProps extends ViewProps {
  children: ReactNode;
  variant?: 'default' | 'highlight';
  onPress?: () => void;
}

export function Card({
  children,
  className,
  variant = 'default',
  onPress,
  ...props
}: CardProps) {
  const { isDark } = useTheme();

  const baseClass = cn(
    'rounded-xl border p-4',
    variant === 'highlight'
      ? isDark
        ? 'bg-blue-900/30 border-blue-800'
        : 'bg-blue-50 border-blue-100'
      : isDark
        ? 'bg-gray-800 border-gray-700'
        : 'bg-white border-gray-200',
    className,
  );

  if (onPress) {
    return (
      <TouchableOpacity
        className={baseClass}
        onPress={onPress}
        {...(props as TouchableOpacityProps)}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View className={baseClass} {...props}>
      {children}
    </View>
  );
}

// ============================================
// Typography
// ============================================
interface TypographyProps extends TextProps {
  children: ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
  color?: 'default' | 'secondary' | 'muted' | 'primary' | 'success' | 'error';
}

export function Typography({
  children,
  className,
  variant = 'body',
  color = 'default',
  ...props
}: TypographyProps) {
  const { isDark } = useTheme();

  const variantClasses: Record<string, string> = {
    h1: 'text-2xl font-bold',
    h2: 'text-xl font-bold',
    h3: 'text-lg font-semibold',
    body: 'text-base',
    caption: 'text-sm',
    label: 'text-xs font-medium uppercase',
  };

  const getColorClass = () => {
    switch (color) {
      case 'secondary':
        return isDark ? 'text-gray-300' : 'text-gray-700';
      case 'muted':
        return isDark ? 'text-gray-400' : 'text-gray-500';
      case 'primary':
        return 'text-blue-600';
      case 'success':
        return isDark ? 'text-green-400' : 'text-green-600';
      case 'error':
        return isDark ? 'text-red-400' : 'text-red-600';
      default:
        return isDark ? 'text-white' : 'text-gray-900';
    }
  };

  return (
    <Text
      className={cn(variantClasses[variant], getColorClass(), className)}
      {...props}
    >
      {children}
    </Text>
  );
}

// ============================================
// Input
// ============================================
interface InputProps extends TextInputProps {
  icon?: ReactNode;
}

export function Input({ className, icon, ...props }: InputProps) {
  const { isDark, colors } = useTheme();

  return (
    <View className="relative">
      <TextInput
        className={cn(
          'w-full rounded-xl border py-3 pr-4',
          icon ? 'pl-10' : 'pl-4',
          isDark
            ? 'border-gray-700 bg-gray-800 text-white'
            : 'border-gray-200 bg-white text-gray-900',
          className,
        )}
        placeholderTextColor={colors.placeholder}
        {...props}
      />
      {icon && (
        <View className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</View>
      )}
    </View>
  );
}

// ============================================
// Button
// ============================================
interface ButtonProps extends TouchableOpacityProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  const { isDark } = useTheme();

  const sizeClasses = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };

  const variantClasses = {
    primary: 'bg-blue-600',
    secondary: isDark ? 'bg-gray-700' : 'bg-gray-100',
    outline: cn(
      'border',
      isDark ? 'border-gray-600' : 'border-gray-300',
      'bg-transparent',
    ),
    ghost: 'bg-transparent',
  };

  const textColor =
    variant === 'primary'
      ? 'text-white'
      : isDark
        ? 'text-white'
        : 'text-gray-900';

  return (
    <TouchableOpacity
      className={cn(
        'items-center justify-center rounded-xl',
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className={cn('font-semibold', textColor)}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

// ============================================
// Badge
// ============================================
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ children, variant = 'default' }: Readonly<BadgeProps>) {
  const { isDark } = useTheme();

  const variantClasses: Record<string, string> = {
    default: isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800',
    success: isDark
      ? 'bg-green-900/50 text-green-300'
      : 'bg-green-100 text-green-800',
    warning: isDark
      ? 'bg-yellow-900/50 text-yellow-300'
      : 'bg-yellow-100 text-yellow-800',
    error: isDark ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-800',
    info: isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800',
  };

  return (
    <View className={cn('rounded-full px-2 py-1', variantClasses[variant])}>
      {typeof children === 'string' ? (
        <Text className="text-xs font-medium capitalize">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

// ============================================
// Section
// ============================================
interface SectionProps {
  title?: string;
  children: ReactNode;
  rightElement?: ReactNode;
  className?: string;
}

export function Section({
  title,
  children,
  rightElement,
  className,
}: Readonly<SectionProps>) {
  const { isDark } = useTheme();

  return (
    <View className={cn('px-4 py-4', className)}>
      {title && (
        <View className="mb-3 flex-row items-center justify-between">
          <Text
            className={cn(
              'text-lg font-bold',
              isDark ? 'text-white' : 'text-gray-900',
            )}
          >
            {title}
          </Text>
          {rightElement}
        </View>
      )}
      {children}
    </View>
  );
}

// ============================================
// Divider
// ============================================
interface DividerProps {
  className?: string;
}

export function Divider({ className }: Readonly<DividerProps>) {
  const { isDark } = useTheme();

  return (
    <View
      className={cn('h-px', isDark ? 'bg-gray-700' : 'bg-gray-200', className)}
    />
  );
}

// ============================================
// ListItem
// ============================================
interface ListItemProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: ReactNode;
  showChevron?: boolean;
}

export function ListItem({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
}: Readonly<ListItemProps>) {
  const { isDark, colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        'flex-row items-center px-4 py-3',
        isDark ? 'bg-gray-800' : 'bg-white',
      )}
    >
      {icon && (
        <View
          className={cn(
            'mr-3 h-9 w-9 items-center justify-center rounded-lg',
            isDark ? 'bg-gray-700' : 'bg-gray-100',
          )}
        >
          {icon}
        </View>
      )}
      <View className="flex-1">
        <Text
          className={cn(
            'text-base font-medium',
            isDark ? 'text-white' : 'text-gray-900',
          )}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            className={cn(
              'text-sm',
              isDark ? 'text-gray-400' : 'text-gray-500',
            )}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement}
      {showChevron && onPress && (
        <ChevronRight size={20} color={colors.iconMuted} />
      )}
    </TouchableOpacity>
  );
}

// ============================================
// Stats Card
// ============================================
interface StatItemProps {
  icon: ReactNode;
  value: string | number;
  label: string;
}

interface StatsCardProps {
  items: StatItemProps[];
}

export function StatsCard({ items }: Readonly<StatsCardProps>) {
  const { isDark } = useTheme();

  return (
    <View
      className={cn(
        'flex-row justify-between rounded-xl p-4',
        isDark ? 'bg-blue-900/30' : 'bg-blue-50',
      )}
    >
      {items.map((item, index) => (
        <View key={index} className="items-center">
          {item.icon}
          <Text
            className={cn(
              'mt-1 font-bold',
              isDark ? 'text-blue-300' : 'text-blue-600',
            )}
          >
            {item.value}
          </Text>
          <Text
            className={cn(
              'text-xs',
              isDark ? 'text-gray-400' : 'text-gray-600',
            )}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ============================================
// Chip
// ============================================
interface ChipProps extends TouchableOpacityProps {
  children: ReactNode;
  selected?: boolean;
}

export function Chip({ children, selected, className, ...props }: ChipProps) {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity
      className={cn(
        'rounded-full border px-4 py-2',
        selected
          ? 'border-blue-600 bg-blue-600'
          : isDark
            ? 'border-gray-700 bg-gray-800'
            : 'border-gray-200 bg-white',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text
          className={cn(
            'font-medium',
            selected
              ? 'text-white'
              : isDark
                ? 'text-gray-300'
                : 'text-gray-800',
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

// ============================================
// Avatar
// ============================================
interface AvatarProps {
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({
  initials,
  size = 'md',
  className,
}: Readonly<AvatarProps>) {
  const { isDark } = useTheme();

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  return (
    <View
      className={cn(
        'items-center justify-center rounded-full',
        sizeClasses[size],
        isDark ? 'bg-gray-700' : 'bg-gray-100',
        className,
      )}
    >
      {initials && (
        <Text
          className={cn(
            'font-semibold',
            textSizes[size],
            isDark ? 'text-gray-300' : 'text-gray-600',
          )}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

// ============================================
// ProgressBar
// ============================================
interface ProgressBarProps {
  progress: number;
  className?: string;
}

export function ProgressBar({
  progress,
  className,
}: Readonly<ProgressBarProps>) {
  const { isDark } = useTheme();

  return (
    <View
      className={cn(
        'h-2 rounded-full',
        isDark ? 'bg-gray-700' : 'bg-gray-100',
        className,
      )}
    >
      <View
        className="h-full rounded-full bg-blue-600"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </View>
  );
}

// ============================================
// Empty State
// ============================================
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: Readonly<EmptyStateProps>) {
  const { isDark } = useTheme();

  return (
    <View className="flex-1 items-center justify-center p-8">
      {icon && <View className="mb-4">{icon}</View>}
      <Text
        className={cn(
          'mb-2 text-center text-lg font-semibold',
          isDark ? 'text-white' : 'text-gray-900',
        )}
      >
        {title}
      </Text>
      {description && (
        <Text
          className={cn(
            'mb-4 text-center',
            isDark ? 'text-gray-400' : 'text-gray-500',
          )}
        >
          {description}
        </Text>
      )}
      {action}
    </View>
  );
}
