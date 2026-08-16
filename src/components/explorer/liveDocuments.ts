// ─────────────────────────────────────────────────────────────────────────────
// My documents — live backend adapter.
//
// Maps the backend's `Document` records (aggregated across the user's
// applications by `useMyDocuments`) onto the Explorer's `Doc` shape so the
// coral/cream "My documents" screen can render real data. Backend document
// statuses collapse into the four demo statuses the UI knows how to draw.
// ─────────────────────────────────────────────────────────────────────────────

import { Doc } from './data';
import { fmtDate } from './liveDate';
import {
  Document,
  DocumentStatus,
  documentDisplayName,
} from '@/types/documents.type';
import { Application } from '@/types/applications.type';

// Backend DocumentStatus → the four demo statuses the screen renders:
//   verified                      → verified   (green check chip)
//   uploaded | under_review       → uploaded   ("In review" blue chip)
//   rejected | resubmission_required → rejected (red x chip)
//   pending_upload | uploading    → missing    (coral Upload button)
const STATUS_MAP: Record<DocumentStatus, Doc['status']> = {
  verified: 'verified',
  uploaded: 'uploaded',
  under_review: 'uploaded',
  rejected: 'rejected',
  resubmission_required: 'rejected',
  pending_upload: 'missing',
  uploading: 'missing',
};

// One backend document (+ optional parent application) → the screen's `Doc`.
export function mapDocument(d: Document, appCtx?: Application): Doc {
  // Category = the parent application's label when available, else a generic
  // fallback. Prefer the visa type name, falling back to the country.
  const category = appCtx?.visaTypeName ?? appCtx?.countryName ?? 'Document';

  return {
    id: d.id,
    // Prefer the agency-supplied label over the raw file name — a document
    // filed for the client would otherwise show as e.g. "scan_0043.pdf".
    name: documentDisplayName(d),
    category,
    status: STATUS_MAP[d.status] ?? 'missing',
    file: d.fileName,
    // Size only shown when the backend reported one (missing docs have none).
    size:
      typeof d.fileSizeMb === 'number'
        ? `${d.fileSizeMb.toFixed(1)} MB`
        : undefined,
    // Upload date formatted like the demo ("Mar 14"); em-dash when unknown.
    date: fmtDate(d.uploadedAt, 'MMM d', '—'),
    // Link the row to its destination country for consistency with the demo.
    destId: appCtx?.countryCode ? appCtx.countryCode.toLowerCase() : undefined,
  };
}
