// ─────────────────────────────────────────────────────────────────────────────
// Refusal-letter analysis — response shapes (backend issue #122).
//
// GET /ai/refusal-letters/:id returns `{ meta, data }`. `data` is null until the
// job has finished. Nothing here carries a score, an internal call or a
// suspicious-content flag: the backend never sends them (#42 rule).
// ─────────────────────────────────────────────────────────────────────────────

export type RefusalJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type RefusalOutcome = 'analysed' | 'unreadable' | 'not_a_refusal_letter';

export interface RefusalMeta {
  analysisId: string;
  applicationId: string;
  status: RefusalJobStatus;
  rubricVersion: number | null;
  error: { code: string; message: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** A published rule matched in the backend by its reference. Quote and URL are the rubric's own. */
export interface RefusalRule {
  criterionId: string;
  title: string;
  ruleRef: string;
  sourceQuote: string;
  sourceUrl: string;
  // 'strengthen' = a point where the whole picture is weighed (never a restated refusal).
  framing: 'requirement' | 'strengthen';
  note: string | null;
}

export interface RefusalReasonView {
  reasonId: string;
  // The letter's own words.
  letterQuote: string;
  citedRefs: string[];
  page: number | null;
  status: 'matched' | 'not_matched';
  rules: RefusalRule[];
  // Set for a deception ground: a pointer to a human, and no fix list.
  adviserNote: string | null;
}

export interface RefusalChecklistItemView {
  checklistItemId: string;
  title: string;
  holder: 'applicant' | 'sponsor';
  required: boolean;
  reason: string;
  citation: { quote: string; url: string; ruleRef: string | null };
  addressesCriterionIds: string[];
}

export interface RefusalDisclosureNotice {
  title: string;
  body: string;
  rule: { ruleRef: string; quote: string; url: string; context: string };
  help: string;
}

export interface RefusalData {
  outcome: RefusalOutcome;
  stateMessage: string | null;
  extracted: { decisionDate: string | null; visaTypeNamed: string | null } | null;
  noRubricMessage: string | null;
  reasons: RefusalReasonView[];
  checklist: {
    state: 'ready' | 'intake_needed' | 'no_checklist' | 'not_built';
    emptyReason: string | null;
    items: RefusalChecklistItemView[];
  };
  warnings: { code: 'name_mismatch' | 'dob_mismatch'; message: string }[];
  disclosureNotice: RefusalDisclosureNotice;
}

export interface RefusalEnvelope {
  meta: RefusalMeta;
  data: RefusalData | null;
}

/** 202 body from POST (the job was queued or is running). */
export interface RefusalStarted {
  analysisId: string;
  status: RefusalJobStatus;
}
