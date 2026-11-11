// ─────────────────────────────────────────────────────────────────────────────
// Applications — live backend adapter.
//
// Maps the backend's Application (+ ApplicationTimeline) records onto the
// Explorer's `App` / `AppStep` shapes so the coral/cream Tracker + detail screens
// can render real data from GET /applications, /applications/:id and
// /applications/:id/timeline. The backend has no hero imagery, so we synthesize a
// per-country `dest` via `countryArt()` (reused from the Explore adapter).
// ─────────────────────────────────────────────────────────────────────────────

import { agoFrom, fmtDate } from './liveDate';
import { countryArt } from './liveExplore';
import { App, AppStep, Dest } from '@/types/explorer.type';
import {
  Application,
  ApplicationStatus,
  ApplicationTimeline,
} from '@/types/applications.type';

// Backend ApplicationStatus → one of the Explorer STATUS keys
// ('documents' | 'review' | 'interview' | 'submitted' | 'approved').
// Anything without a natural Explorer bucket (draft, pending_payment, rejected,
// withdrawn, expired) falls back to 'review' so the row still renders a pill.
const STATUS_MAP: Record<ApplicationStatus, string> = {
  draft: 'review',
  pending_payment: 'review',
  pending_documents: 'documents', // *_documents → documents
  under_review: 'review', // *review → review
  submitted_to_embassy: 'submitted', // submitted → submitted
  interview_scheduled: 'interview', // interview* → interview
  approved: 'approved', // approved / completed → approved
  rejected: 'review',
  withdrawn: 'review',
  expired: 'review',
};

// Normalize a backend progress value to the Explorer's 0–1 scale. The backend may
// send either a fraction (0–1) or a percentage (0–100); anything > 1 is treated
// as a percentage and divided by 100. Clamped to [0, 1].
function normalizeProgress(progress: number): number {
  const p = progress > 1 ? progress / 100 : progress;
  return Math.max(0, Math.min(1, p || 0));
}

// One backend Application → the Explorer's `App`. Builds a self-contained `dest`
// (via countryArt → the `@/assets/countries` module) so the row/detail renders
// from the case alone. `agentSeed` is accepted for call-site parity only.
/**
 * The case's visa title (japa#106). A case on an agency-only visa must show
 * the visa's real name, never "Visa" / "unknown visa":
 *   1. `visaTypeName`, denormalised on the case by the backend;
 *   2. else the name fetched from the visa detail (`fetchedVisaName`; the
 *      applicant may read it because they have a case on it, #102);
 *   3. else, while that fetch runs, the country name (design spec).
 */
export function resolveVisaTitle(
  app: Pick<Application, 'visaTypeName' | 'countryName' | 'countryCode'>,
  fetchedVisaName?: string | null,
): string {
  const denorm = app.visaTypeName?.trim();
  if (denorm) return denorm;
  const fetched = fetchedVisaName?.trim();
  if (fetched) return fetched;
  return app.countryName ?? app.countryCode;
}

export function mapApplication(
  app: Application,
  agentSeed?: number,
  fetchedVisaName?: string | null,
): App {
  void agentSeed; // reserved for call-site parity; not used

  const art = countryArt(app.countryCode);
  const dest: Dest = {
    id: app.visaTypeId,
    country: app.countryName ?? app.countryCode,
    city: art.city,
    flag: app.countryCode.toLowerCase(),
    // japa#106: real visa name (see resolveVisaTitle), never a bare "Visa".
    visa: resolveVisaTitle(app, fetchedVisaName),
    cat: '',
    blurb: '',
    img: art.img,
    tone: art.tone,
    processing: '',
    price: Math.round(app.totalCost ?? 0),
    approval: '',
    applied: 0,
  };

  return {
    id: app.id,
    destId: app.visaTypeId,
    status: STATUS_MAP[app.status] ?? 'review',
    progress: normalizeProgress(app.progress),
    step: 0,
    ref: app.id.slice(0, 8).toUpperCase(),
    updated: agoFrom(app.lastUpdated, { addSuffix: true }),
    agentId: app.agentId ?? '',
    next: {
      label: app.nextStep ?? 'No action needed',
      // A CTA appears only when documents are still outstanding.
      cta:
        app.documentsRequired > app.documentsUploaded
          ? 'Upload document'
          : null,
    },
    steps: [], // list rows carry no steps; the detail screen fetches the timeline
    dest,
  };
}

// Backend timeline events → the detail screen's vertical Timeline stepper.
export function mapTimeline(events: ApplicationTimeline[]): AppStep[] {
  return events.map((e) => ({
    t: e.title,
    desc: e.description,
    d: fmtDate(e.date, 'MMM d, yyyy'),
    s:
      e.status === 'completed'
        ? 'done'
        : e.status === 'current'
          ? 'current'
          : 'next',
    by:
      e.responsibility === 'user'
        ? 'you'
        : e.responsibility === 'agent'
          ? 'agent'
          : 'system',
  }));
}
