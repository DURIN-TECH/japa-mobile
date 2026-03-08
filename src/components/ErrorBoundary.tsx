/**
 * ErrorBoundary Component
 *
 * A React class component that catches JavaScript errors anywhere in its
 * child component tree and displays a fallback UI instead of crashing.
 *
 * React does NOT have a hooks-based error boundary API, so we must use
 * a class component. This is the recommended approach from React docs.
 *
 * Features:
 * - Catches rendering errors in any descendant component
 * - Shows a user-friendly error screen with a "Try Again" button
 * - In __DEV__ mode, also displays the actual error message for debugging
 * - Reports errors to Firebase Analytics via analyticsService
 * - Accepts an optional custom `fallback` prop for alternative error UI
 *
 * Usage in _layout.tsx:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Note: Error boundaries do NOT catch errors in:
 * - Event handlers (use try/catch instead)
 * - Async code (use .catch() or try/catch)
 * - Server-side rendering
 * - Errors in the error boundary itself
 */

import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { analyticsService } from '@/services/analytics.service';

/** Props for ErrorBoundary */
interface Props {
  /** Child components to render (the entire app tree usually) */
  children: React.ReactNode;
  /** Optional custom fallback UI to show instead of the default error screen */
  fallback?: React.ReactNode;
}

/** Internal state tracking whether an error has been caught */
interface State {
  /** Whether an error has been caught by this boundary */
  hasError: boolean;
  /** The actual error object, if one was caught */
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // Start with no error state
    this.state = { hasError: false, error: null };
  }

  /**
   * Called by React when a descendant component throws during rendering.
   * Returns new state so the next render shows the fallback UI.
   * This is a static lifecycle method — it cannot access `this`.
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Called after an error has been thrown by a descendant component.
   * Used for side effects like logging — the error is already caught
   * by getDerivedStateFromError above, so this is purely for reporting.
   *
   * We log to console for dev visibility and to analytics for production
   * monitoring. The componentStack tells us which component tree caused it.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Report to Firebase Analytics so we can track error rates in production
    analyticsService.trackError(error.message, {
      componentStack: errorInfo.componentStack ?? 'unknown',
    });
  }

  /**
   * Reset the error state so the child tree re-renders.
   * This is the "Try Again" button handler — it clears the error
   * and lets React attempt to render the children again.
   */
  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    // If an error was caught, show the fallback UI
    if (this.state.hasError) {
      // If a custom fallback was provided, use that instead of our default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error screen with warning icon, message, and retry button
      return (
        <View className="flex-1 items-center justify-center bg-white px-6">
          {/* Warning triangle icon */}
          <AlertTriangle size={48} color="#ef4444" />

          <Text className="mt-4 text-center text-xl font-bold text-gray-900">
            Something went wrong
          </Text>
          <Text className="mt-2 text-center text-base text-gray-500">
            An unexpected error occurred. Please try again.
          </Text>

          {/*
           * In development mode only, show the actual error message.
           * This helps developers debug without checking console logs.
           * Never shown in production builds.
           */}
          {__DEV__ && this.state.error && (
            <ScrollView className="mt-4 max-h-40 w-full rounded-lg bg-gray-100 p-3">
              <Text className="font-mono text-xs text-red-600">
                {this.state.error.message}
              </Text>
            </ScrollView>
          )}

          {/* Retry button — resets error state to re-attempt rendering */}
          <TouchableOpacity
            onPress={this.handleRetry}
            className="mt-6 flex-row items-center rounded-xl bg-blue-600 px-6 py-3"
          >
            <RefreshCw size={18} color="white" />
            <Text className="ml-2 font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // No error — render children normally
    return this.props.children;
  }
}
