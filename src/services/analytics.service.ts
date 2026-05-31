/**
 * Analytics Service
 *
 * Centralized Firebase Analytics wrapper for the JAPA mobile app.
 * All analytics events go through this service so we have a single
 * source of truth for event names, parameters, and error handling.
 *
 * Uses the modular Firebase API (not the deprecated namespaced API).
 *
 * Usage:
 *   import { analyticsService } from '@/services/analytics.service';
 *   analyticsService.trackLogin('email');
 *   analyticsService.trackScreenView('HomeScreen');
 *
 * Every method is wrapped in try/catch so analytics failures never
 * crash the app. In __DEV__ mode, failures are logged as warnings.
 */

import { getApp } from '@react-native-firebase/app';
import {
  getAnalytics,
  logEvent,
  logScreenView,
  logLogin,
  logSignUp,
  logSearch,
  setUserId,
  setUserProperty,
} from '@react-native-firebase/analytics';

class AnalyticsService {
  // ─────────────────────────────────────────────
  // Cached analytics instance — lazily initialised
  // so we don't call getApp() at import time.
  // ─────────────────────────────────────────────
  private _analytics: ReturnType<typeof getAnalytics> | null = null;

  private get analytics() {
    if (!this._analytics) {
      this._analytics = getAnalytics(getApp());
    }
    return this._analytics;
  }

  // ─────────────────────────────────────────────
  // SCREEN TRACKING
  // Called when a user navigates to a new screen.
  // Firebase Analytics uses this for automatic screen reporting.
  // ─────────────────────────────────────────────
  async trackScreenView(screenName: string, screenClass?: string) {
    try {
      await logScreenView(this.analytics, {
        screen_name: screenName,
        screen_class: screenClass ?? screenName,
      });
    } catch (error) {
      if (__DEV__) console.warn('Analytics screen view error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // AUTH EVENTS
  // Track how users authenticate (email, phone, google).
  // Firebase has built-in `login` and `sign_up` event types.
  // ─────────────────────────────────────────────
  async trackLogin(method: 'email' | 'phone' | 'google') {
    try {
      await logLogin(this.analytics, { method });
    } catch (error) {
      if (__DEV__) console.warn('Analytics login error:', error);
    }
  }

  async trackSignUp(method: 'email' | 'phone' | 'google') {
    try {
      await logSignUp(this.analytics, { method });
    } catch (error) {
      if (__DEV__) console.warn('Analytics signup error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // APPLICATION EVENTS
  // Track when users create applications or when status changes.
  // Useful for funnel analysis (draft → submitted → approved).
  // ─────────────────────────────────────────────
  async trackApplicationCreated(params: {
    visaTypeId: string;
    countryCode: string;
    mode: 'self' | 'agent'; // self-service vs agent-assisted
  }) {
    try {
      await logEvent(this.analytics, 'application_created', params);
    } catch (error) {
      if (__DEV__) console.warn('Analytics app created error:', error);
    }
  }

  async trackApplicationStatusChange(params: {
    applicationId: string;
    status: string;
  }) {
    try {
      await logEvent(this.analytics, 'application_status_change', params);
    } catch (error) {
      if (__DEV__) console.warn('Analytics status change error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // CONSULTATION EVENTS
  // Track when users book consultations with agents.
  // Includes fee as `value` for revenue tracking in Firebase.
  // ─────────────────────────────────────────────
  async trackConsultationBooked(params: {
    agentId: string;
    type: string; // e.g. 'initial', 'document_review', 'interview_prep'
    fee: number; // consultation fee in base currency units
  }) {
    try {
      await logEvent(this.analytics, 'consultation_booked', {
        ...params,
        value: params.fee, // Firebase uses `value` for revenue
        currency: 'NGN', // Nigerian Naira — primary currency
      });
    } catch (error) {
      if (__DEV__) console.warn('Analytics consultation error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // DOCUMENT EVENTS
  // Track document uploads for completion funnel analysis.
  // ─────────────────────────────────────────────
  async trackDocumentUploaded(params: {
    applicationId: string;
    fileType: string;
  }) {
    try {
      await logEvent(this.analytics, 'document_uploaded', params);
    } catch (error) {
      if (__DEV__) console.warn('Analytics doc upload error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // ELIGIBILITY EVENTS
  // Track when users complete eligibility checks.
  // Result and score help us understand conversion likelihood.
  // ─────────────────────────────────────────────
  async trackEligibilityCheck(params: {
    visaTypeId: string;
    result: string; // 'high', 'medium', 'low', 'not_applicable'
    score: number; // 0-100 eligibility score
  }) {
    try {
      await logEvent(this.analytics, 'eligibility_check', params);
    } catch (error) {
      if (__DEV__) console.warn('Analytics eligibility error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // NAVIGATION / CONTENT VIEW EVENTS
  // Track when users view specific content (agents, visas).
  // Helps understand which agents/visas get the most interest.
  // ─────────────────────────────────────────────
  async trackAgentViewed(agentId: string) {
    try {
      await logEvent(this.analytics, 'agent_viewed', { agent_id: agentId });
    } catch (error) {
      if (__DEV__) console.warn('Analytics agent view error:', error);
    }
  }

  async trackVisaViewed(params: { visaTypeId: string; countryCode: string }) {
    try {
      await logEvent(this.analytics, 'visa_viewed', params);
    } catch (error) {
      if (__DEV__) console.warn('Analytics visa view error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // ONBOARDING EVENTS
  // Track onboarding funnel: which steps users complete,
  // where they drop off, and when they finish.
  // ─────────────────────────────────────────────
  async trackOnboardingStep(step: string) {
    try {
      await logEvent(this.analytics, 'onboarding_step', { step });
    } catch (error) {
      if (__DEV__) console.warn('Analytics onboarding error:', error);
    }
  }

  async trackOnboardingCompleted() {
    try {
      await logEvent(this.analytics, 'onboarding_completed');
    } catch (error) {
      if (__DEV__) console.warn('Analytics onboarding complete error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // SEARCH EVENTS
  // Track search queries to understand what users are looking for.
  // Uses Firebase's built-in `search` event type.
  // ─────────────────────────────────────────────
  async trackSearch(query: string, category?: string) {
    try {
      await logSearch(this.analytics, { search_term: query });
      // If a category filter was applied, log a separate detailed event
      if (category) {
        await logEvent(this.analytics, 'search_with_category', {
          search_term: query,
          category,
        });
      }
    } catch (error) {
      if (__DEV__) console.warn('Analytics search error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // PAYMENT REQUEST EVENTS
  // Track when clients approve or reject payment requests.
  // Amount is tracked as `value` for revenue analysis.
  // ─────────────────────────────────────────────
  async trackPaymentRequestApproved(params: {
    requestId: string;
    amount: number; // In kobo/cents
  }) {
    try {
      await logEvent(this.analytics, 'payment_request_approved', {
        request_id: params.requestId,
        value: params.amount,
        currency: 'NGN',
      });
    } catch (error) {
      if (__DEV__) console.warn('Analytics payment approved error:', error);
    }
  }

  async trackPaymentRequestRejected(params: {
    requestId: string;
    amount: number; // In kobo/cents
  }) {
    try {
      await logEvent(this.analytics, 'payment_request_rejected', {
        request_id: params.requestId,
        value: params.amount,
        currency: 'NGN',
      });
    } catch (error) {
      if (__DEV__) console.warn('Analytics payment rejected error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // ERROR TRACKING
  // Log app errors to analytics for monitoring.
  // Truncates error message to 100 chars (Firebase limit).
  // For crash reporting, Firebase Crashlytics is used separately.
  // ─────────────────────────────────────────────
  async trackError(errorMessage: string, context?: Record<string, string>) {
    try {
      await logEvent(this.analytics, 'app_error', {
        error_message: errorMessage.substring(0, 100),
        ...context,
      });
    } catch (error) {
      if (__DEV__) console.warn('Analytics error tracking error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // USER PROPERTIES
  // Set user-level properties for audience segmentation.
  // These persist across sessions until changed.
  // - userId: links analytics to a specific user
  // - country: user's residential country for geo analysis
  // - hasPassport: useful for eligibility funnel segmentation
  // - onboardingCompleted: tracks conversion from signup to active
  // ─────────────────────────────────────────────
  async setUserProperties(params: {
    userId?: string;
    country?: string;
    hasPassport?: boolean;
    onboardingCompleted?: boolean;
  }) {
    try {
      if (params.userId) {
        await setUserId(this.analytics, params.userId);
      }
      if (params.country) {
        await setUserProperty(this.analytics, 'country', params.country);
      }
      if (params.hasPassport !== undefined) {
        await setUserProperty(
          this.analytics,
          'has_passport',
          String(params.hasPassport),
        );
      }
      if (params.onboardingCompleted !== undefined) {
        await setUserProperty(
          this.analytics,
          'onboarding_completed',
          String(params.onboardingCompleted),
        );
      }
    } catch (error) {
      if (__DEV__) console.warn('Analytics user properties error:', error);
    }
  }
}

/**
 * Singleton instance — import this throughout the app.
 * Example: analyticsService.trackLogin('email');
 */
export const analyticsService = new AnalyticsService();
