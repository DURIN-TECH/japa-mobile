/**
 * Platform-specific theme values that can't be defined in Tailwind
 * These are specifically for React Native features and programmatic usage
 */

// React Native specific shadows
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
} as const;

// Layout values for programmatic calculations
export const Layout = {
  contentSpacing: {
    tabBar: 100, // Bottom padding for tab bar
  },
} as const;

// Gradients for React Native LinearGradient
export const Gradients = {
  primary: ['#3b82f6', '#2563eb'],
  secondary: ['#4f46e5', '#4338ca'],
  success: ['#10b981', '#059669'],
  warning: ['#f59e0b', '#d97706'],
  error: ['#ef4444', '#dc2626'],
} as const;

// Component Specific
export const Components = {
  card: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  button: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
} as const;
