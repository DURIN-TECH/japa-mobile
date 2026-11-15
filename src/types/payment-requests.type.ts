/**
 * Payment Request Types
 *
 * Types for the payment request approve/reject flow.
 * Agents request funds from clients for specific services;
 * clients approve or reject each request via the mobile app.
 *
 * MONEY (japa#183 / backend #181): a request is priced in US dollars.
 * `amount` is minor units of `currency` (US cents with `currency: "USD"` for
 * a #181 request; a pre-#181 `legacy` request keeps its own naira amount).
 * The local amount only exists once a checkout priced it (`charge`, set on
 * approve), so a pending request shows dollars only: the app never converts.
 */

import type { Money } from './money.type';

// Status of a payment request in its lifecycle
export type PaymentRequestStatus =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'expired'
  | 'approved'
  | 'rejected';

// Category classifying what the payment is for
export type PaymentRequestCategory =
  | 'visa_fee'
  | 'health_check'
  | 'document_creation'
  | 'document_review'
  | 'translation'
  | 'government_fee'
  | 'other';

// Payment request as returned by the API
export interface PaymentRequest {
  id: string;
  applicationId: string;
  agentId: string;
  agencyId?: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  /** Minor units of `currency` (US cents on a #181 request). */
  amount: number;
  /** "USD" on a #181 request; a legacy request's own currency. */
  currency: string;
  /** The dollar price; null on a legacy request. */
  priceUsd: Money | null;
  /** True for a pre-#181 naira request (shows its own amount + currency). */
  legacy: boolean;
  /**
   * The local amount the client pays, once a checkout priced it (approve);
   * null on a pending request.
   */
  charge: Money | null;
  /** Server-made display text, e.g. "USD 100.00 (NGN 150,000.00)". */
  amountDisplay: string;
  /** The stored charge snapshot, once priced. */
  priceUsdCents?: number;
  chargedCurrency?: string;
  chargedAmountMinor?: number;
  /**
   * Local units per 1 USD the client effectively pays once priced: amount
   * charged ÷ dollar price, markup included (japa#332). Absent on a pending
   * (not yet priced) or legacy request. The raw rate is never sent.
   */
  effectiveRate?: number;
  description: string;
  category: PaymentRequestCategory;
  status: PaymentRequestStatus;
  paidAt?: string;
  cancelledAt?: string;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  // Paystack reference minted at approve time (japa#145); needed to verify.
  paystackReference?: string;
  createdAt: string;
  updatedAt: string;
}

// PUT /payment-requests/:id/approve response: the approved request plus the
// Paystack checkout to open (backend approvePaymentRequest).
export type ApprovePaymentRequestResult = PaymentRequest & {
  authorizationUrl?: string;
};

// POST /payment-requests/:id/verify response: the request (status 'paid' once
// settled), or the request plus Paystack's `paymentStatus` when not paid yet.
export type VerifyPaymentRequestResult = PaymentRequest & {
  paymentStatus?: string;
};

// Human-readable labels for each category
export const CATEGORY_LABELS: Record<PaymentRequestCategory, string> = {
  visa_fee: 'Visa Fee',
  health_check: 'Health Check',
  document_creation: 'Document Creation',
  document_review: 'Document Review',
  translation: 'Translation',
  government_fee: 'Government Fee',
  other: 'Other',
};
