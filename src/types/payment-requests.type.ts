/**
 * Payment Request Types
 *
 * Types for the payment request approve/reject flow.
 * Agents request funds from clients for specific services;
 * clients approve or reject each request via the mobile app.
 */

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
  amount: number; // In smallest currency unit (kobo)
  currency: string;
  description: string;
  category: PaymentRequestCategory;
  status: PaymentRequestStatus;
  paidAt?: string;
  cancelledAt?: string;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

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
