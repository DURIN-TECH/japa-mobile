// ─────────────────────────────────────────────────────────────────────────────
// Seli Explorer — static product content (japa#145).
//
// What used to be explorer/data.ts, minus every demo fixture. data.ts shipped
// a whole fake persona with destinations, agents,
// agencies, applications, messages, payments and more, which screens fell back
// to whenever a query was empty or failing. Those are gone: screens now render
// backend data or a loading / empty / error state (see states.tsx).
//
// What stays is product content, not data:
//   • NAIRA                     currency formatter
//   • STATUS / DOC_STATUS /     display maps (label + colours) for application,
//     PAY_STATUS                document and payment statuses
//   • CATS                      Explore category chips
//   • CONSULT_TOPICS            topics offered when booking a consultation
//   • PLAN_FEATURES             plan feature copy, keyed by catalogue key
//   • ONBOARD                   the welcome carousel slides
// View-model types live in src/types/explorer.type.ts; country / location
// imagery lives in src/assets/countries.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { IMG } from '@/assets/countries';
import type { OnboardSlide } from '@/types/explorer.type';

// ── Currency ─────────────────────────────────────────────────────────────────
// Whole naira → "₦12,500".
export const NAIRA = (n: number) => '₦' + n.toLocaleString();

// ── Explore category chips ───────────────────────────────────────────────────
export const CATS = ['All', 'Work', 'Study', 'PR', 'Family'];

// ── Status display maps ──────────────────────────────────────────────────────
// Application status (Explorer bucket) → pill label + colours.
export const STATUS: Record<string, { label: string; fg: string; bg: string }> =
  {
    // japa#174: a started, unsubmitted application is a Draft, not "Under review".
    draft: { label: 'Draft', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
    documents: { label: 'Documents required', fg: '#B26A14', bg: '#FCEAC8' },
    review: { label: 'Under review', fg: '#2F62A0', bg: '#DCEBF7' },
    interview: { label: 'Interview scheduled', fg: '#5A49C4', bg: '#ECE9FB' },
    submitted: { label: 'Submitted', fg: '#1F8A7A', bg: '#D6F0EC' },
    approved: { label: 'Approved', fg: '#1E8E55', bg: '#D6F2E2' },
  };

// Document status → chip label + colours.
export const DOC_STATUS: Record<
  string,
  { label: string; fg: string; bg: string }
> = {
  verified: { label: 'Verified', fg: '#1E8E55', bg: '#D6F2E2' },
  uploaded: { label: 'In review', fg: '#2F62A0', bg: '#DCEBF7' },
  rejected: { label: 'Rejected', fg: '#C0453C', bg: '#FBE3E1' },
  missing: { label: 'Not uploaded', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

// Payment status → pill label + colours.
export const PAY_STATUS: Record<
  string,
  { label: string; fg: string; bg: string }
> = {
  paid: { label: 'Paid', fg: '#1E8E55', bg: '#D6F2E2' },
  pending: { label: 'Pending', fg: '#B26A14', bg: '#FCEAC8' },
  refunded: { label: 'Refunded', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

// ── Consultation topics offered when booking ─────────────────────────────────
export const CONSULT_TOPICS = [
  'Visa eligibility',
  'Document review',
  'Application strategy',
  'Interview prep',
  'General questions',
];

// ── Plan feature copy (catalogue key → sentence) ─────────────────────────────
// Live plans (GET /plans) are the source of names and prices; this is copy.
export const PLAN_FEATURES: Record<string, string> = {
  create: 'Create applications',
  messaging: 'Agent messaging',
  consults: 'Book consultations',
  docs: 'Document uploads',
  self: 'Self-service flow',
  priority: 'Priority support',
  alerts: 'Visa news alerts',
};

// ── Auth onboarding carousel slides ──────────────────────────────────────────
export const ONBOARD: OnboardSlide[] = [
  {
    id: 'o1',
    img: IMG('1436491865332-7a61a109cc05'),
    tone: '#1E2A44',
    kicker: 'Your move, made simple',
    title: 'Every visa,\none clear path',
    body: 'Explore hand-picked routes to 30+ countries with real processing times and costs.',
  },
  {
    id: 'o2',
    img: IMG('1521737604893-d14cc237f11d'),
    tone: '#2A2036',
    kicker: 'Guided by experts',
    title: 'Vetted agents\nby your side',
    body: 'Message government-licensed specialists who’ve done it hundreds of times.',
  },
  {
    id: 'o3',
    img: IMG('1526304640581-d334cdbbf45e'),
    tone: '#243A44',
    kicker: 'Always in the loop',
    title: 'Track it all,\nstart to visa',
    body: 'Live status, document checklists and reminders — from application to approval.',
  },
];
