/**
 * Analytics Service
 *
 * Centralized Firebase Analytics wrapper for the JAPA mobile app.
 * All analytics events go through this service so we have a single
 * source of truth for event names, parameters, and error handling.
 *
 * Usage:
 *   import { analyticsService } from '@/services/analytics.service';
 *   analyticsService.trackLogin('email');
 *   analyticsService.trackScreenView('HomeScreen');
 *
 * Every method is wrapped in try/catch so analytics failures never
 * crash the app. In __DEV__ mode, failures are logged as warnings.
 */

import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  // ─────────────────────────────────────────────
  // SCREEN TRACKING
  // Called when a user navigates to a new screen.
  // Firebase Analytics uses this for automatic screen reporting.
  // ─────────────────────────────────────────────
  async trackScreenView(screenName: string, screenClass?: string) {
    try {
      await analytics().logScreenView({
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
      await analytics().logLogin({ method });
    } catch (error) {
      if (__DEV__) console.warn('Analytics login error:', error);
    }
  }

  async trackSignUp(method: 'email' | 'phone' | 'google') {
    try {
      await analytics().logSignUp({ method });
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
      await analytics().logEvent('application_created', params);
    } catch (error) {
      if (__DEV__) console.warn('Analytics app created error:', error);
    }
  }

  async trackApplicationStatusChange(params: {
    applicationId: string;
    status: string;
  }) {
    try {
      await analytics().logEvent('application_status_change', params);
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
      await analytics().logEvent('consultation_booked', {
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
      await analytics().logEvent('document_uploaded', params);
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
      await analytics().logEvent('eligibility_check', params);
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
      await analytics().logEvent('agent_viewed', { agent_id: agentId });
    } catch (error) {
      if (__DEV__) console.warn('Analytics agent view error:', error);
    }
  }

  async trackVisaViewed(params: { visaTypeId: string; countryCode: string }) {
    try {
      await analytics().logEvent('visa_viewed', params);
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
      await analytics().logEvent('onboarding_step', { step });
    } catch (error) {
      if (__DEV__) console.warn('Analytics onboarding error:', error);
    }
  }

  async trackOnboardingCompleted() {
    try {
      await analytics().logEvent('onboarding_completed');
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
      await analytics().logSearch({ search_term: query });
      // If a category filter was applied, log a separate detailed event
      if (category) {
        await analytics().logEvent('search_with_category', {
          search_term: query,
          category,
        });
      }
    } catch (error) {
      if (__DEV__) console.warn('Analytics search error:', error);
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
      await analytics().logEvent('app_error', {
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
        await analytics().setUserId(params.userId);
      }
      if (params.country) {
        await analytics().setUserProperty('country', params.country);
      }
      if (params.hasPassport !== undefined) {
        await analytics().setUserProperty(
          'has_passport',
          String(params.hasPassport),
        );
      }
      if (params.onboardingCompleted !== undefined) {
        await analytics().setUserProperty(
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
