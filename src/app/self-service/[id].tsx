// ─────────────────────────────────────────────────────────────────────────────
// Self-service flow (prototype flows.jsx SelfServiceView).
//
// A DIY visa-application checklist. Mirrors the destination-detail pattern:
// a short parallax photo hero (210) with a rounded content sheet rising over it
// and a sticky dark CTA. The sheet holds an application-progress card, the two
// numbered steps (official portal + document upload) and per-requirement cards
// with individual DocRows.
//
// LIVE ONLY (japa#145): opened with a real backend APPLICATION id (created by
// the visa breakdown's "Start application", or from the case's next step).
// The hero + sheet come from the backend: `useApplication` → `useVisaType`
// (requirements) → `useApplicationDocuments`, with real document upload.
// States (#145 + #174 design spec, self-service rows):
//   • loading      → coral spinner
//   • not found    → CenteredState "We couldn’t find this application" → Tracker
//     (404 OR 403: an unknown id, a visa id, someone else's application; the
//     same screen so it never confirms another account's application exists)
//   • load error   → CenteredState with InlineError + Outline "Try again"
//   • Step 1       → official link only when the visa has an `applicationUrl`;
//     otherwise a plain "we don't have the link yet" body (never a guessed host)
//   • Step 2       → no requirements and no checklist → ONE empty state with an
//     "Upload a document" button; a failed upload → InlineError + Try again
// Nothing here is ever drawn from a fixture (no IRCC, no Canada, no demo rows).
//
// Every measurement below is quoted from the prototype (flows.jsx). All hooks are
// called unconditionally before any early return; the mode branch happens in the
// render only.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { EX } from '@/components/explorer/theme';
import { countryArt } from '@/components/explorer/liveExplore';
import { Ic } from '@/components/explorer/icons';
import {
  Flag,
  GlassButton,
  Pill,
  Progress,
  SectionTitle,
} from '@/components/explorer/primitives';
// Live data hooks + document upload helper.
import { useApplication } from '@/hooks/useApplications';
import { isNotFoundError } from '@/hooks/queryErrors';
import { CenteredState } from '@/components/explorer/CenteredState';
import {
  OutlineButton,
  StateEmpty,
  StateError,
  StateLoading,
  loadErrorCopy,
} from '@/components/explorer/states';
import { useVisaType } from '@/hooks/useVisaTypes';
import {
  useApplicationDocuments,
  useGetUploadUrl,
  useCreateDocument,
  uploadToStorage,
} from '@/hooks/useDocuments';
import {
  Document,
  DocumentStatus,
  documentDisplayName,
} from '@/types/documents.type';
import { VisaRequirement } from '@/types/visas.type';
// Visitor intake (#113): Step 1 card driven by the approved rubric's questions.
import { useIntake } from '@/hooks/useIntake';
import {
  IntakeStep,
  intakeOccupiesStep,
} from '@/components/explorer/intake/IntakeStep';
// Personal document checklist (#114): built server-side from the verified record.
import { useChecklist } from '@/hooks/useChecklist';
import {
  DocumentChecklist,
  isChecklistDocument,
} from '@/components/explorer/DocumentChecklist';
import type { ChecklistItem } from '@/types/checklist.type';
// Per-upload document check (#115).
import {
  useDocumentChecks,
  useRetryDocumentCheck,
} from '@/hooks/useDocumentChecks';
// Review (issue #43): statement + review cards and the wired submit CTA.
import {
  StatementCard,
  ReviewCard,
  deriveReviewState,
  deriveReviewCta,
} from '@/components/explorer/review/SelfServiceCards';
import { InlineError } from '@/components/explorer/AccountForm';
import {
  assessmentKey,
  lastReviewFinishedAt,
  useAssessment,
  useStartReview,
} from '@/hooks/useCaseOfficer';
import { PLANS_ROUTE } from '@/components/explorer/UpgradePrompt';
import {
  SUBMITTED_STATUSES,
  isStatementLocked,
  useStatement,
} from '@/hooks/useStatement';

// japa#174: requirement key for an upload tied to no requirement or checklist
// item (the "upload what you already have" buttons). The backend only needs a
// requirementId to be present (it does not check it against the visa), and the
// screen's "Other documents" card shows every document whose requirementId is
// not a listed requirement and not a checklist item, so these land there.
const GENERAL_REQUIREMENT_ID = 'general';

// japa#174: the one upload-failure line (replaces the old Alert).
const uploadErrorCopy = (fileName: string) =>
  `We couldn’t upload ${fileName}. Check your connection and try again.`;

// Hero height for this flow — shorter than the destination detail (376) so the
// checklist content dominates the screen (prototype: `const HERO = 210`).
const HERO = 210;

// Map a backend Document status → a chip using the same palette as DOC_STATUS.
// `kind` drives the row icon (verified→check2, rejected→x, else→docs).
function liveDocChip(status: DocumentStatus): {
  kind: 'verified' | 'review' | 'rejected' | 'pending';
  label: string;
  fg: string;
  bg: string;
} {
  switch (status) {
    case 'verified':
      return {
        kind: 'verified',
        label: 'Verified',
        fg: '#1E8E55',
        bg: '#D6F2E2',
      };
    case 'uploaded':
    case 'under_review':
      return {
        kind: 'review',
        label: 'In review',
        fg: '#2F62A0',
        bg: '#DCEBF7',
      };
    case 'rejected':
    case 'resubmission_required':
      return {
        kind: 'rejected',
        label: 'Rejected',
        fg: '#C0453C',
        bg: '#FBE3E1',
      };
    default:
      // pending_upload | uploading — grey "missing" chip.
      return {
        kind: 'pending',
        label: status === 'uploading' ? 'Uploading' : 'Pending',
        fg: '#8B8499',
        bg: 'rgba(23,19,38,0.06)',
      };
  }
}

// ── LiveDocRow — one real backend Document row ────────────────────────────────
// Read-only row (upload happens at the requirement level): status chip + name +
// status Pill, plus a red rejection-reason band when the doc was rejected.
function LiveDocRow({ doc, first }: { doc: Document; first: boolean }) {
  const s = liveDocChip(doc.status);
  return (
    <View
      style={{ borderTopWidth: first ? 0 : 1, borderTopColor: EX.color.line06 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 13,
        }}
      >
        {/* Status icon chip — 34px, palette from liveDocChip */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: s.bg,
          }}
        >
          {s.kind === 'verified' ? (
            <Ic.check2 size={19} color={s.fg} strokeWidth={1.8} />
          ) : s.kind === 'rejected' ? (
            <Ic.x size={17} color={s.fg} strokeWidth={1.8} />
          ) : (
            <Ic.docs size={17} color={s.fg} strokeWidth={1.8} />
          )}
        </View>

        {/* File name + status label */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 14, fontWeight: '600', color: EX.color.ink }}
            numberOfLines={1}
          >
            {documentDisplayName(doc)}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: s.fg,
              marginTop: 1,
            }}
            numberOfLines={1}
          >
            {s.label}
          </Text>
          {/* Provenance — the client must be able to tell a document their
              agency filed for them from one they submitted themselves. */}
          {doc.uploadedOnBehalf ? (
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '600',
                color: EX.color.muted,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              Added by {doc.uploadedByName || 'your agency'}
            </Text>
          ) : null}
        </View>

        <Pill label={s.label} fg={s.fg} bg={s.bg} small />
      </View>

      {/* Rejected → indented red reason band (rejectionReason from backend) */}
      {s.kind === 'rejected' && doc.rejectionReason ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginTop: 8,
            marginLeft: 46,
            paddingVertical: 8,
            paddingHorizontal: 11,
            borderRadius: 10,
            backgroundColor: '#FBE3E1',
          }}
        >
          <Ic.help size={14} color="#C0453C" strokeWidth={1.8} />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              lineHeight: 16.5,
              color: '#9E3630',
              fontWeight: '600',
            }}
          >
            {doc.rejectionReason}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── LiveOtherDocsCard — documents not tied to any listed requirement ──────────
// Same card chrome as LiveRequirementCard, minus the upload button (there's no
// requirement to upload against). Read-only by design: these documents were
// either filed by the agency or already answered a specific ask.
function LiveOtherDocsCard({ docs }: { docs: Document[] }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: EX.radius.card, // 20
        borderWidth: 1,
        borderColor: 'rgba(23,19,38,0.07)',
        paddingHorizontal: 16,
        paddingVertical: 15,
        marginBottom: 13,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(23,19,38,0.06)',
          }}
        >
          <Ic.docs size={12} color={EX.color.muted} strokeWidth={2} />
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: 15.5,
            fontWeight: '700',
            color: EX.color.ink,
          }}
          numberOfLines={1}
        >
          Other documents
        </Text>
      </View>

      <Text
        style={{
          fontSize: 13,
          lineHeight: 19,
          color: EX.color.inkMuted,
          marginTop: 8,
          marginBottom: 2,
        }}
      >
        Also on file for this application.
      </Text>

      <View style={{ marginTop: 6 }}>
        {docs.map((doc, i) => (
          <LiveDocRow key={doc.id} doc={doc} first={i === 0} />
        ))}
      </View>
    </View>
  );
}

// ── LiveRequirementCard — a backend VisaRequirement + its Documents ───────────
// Requirement card chrome; the DocRows come from the
// live documents filtered to this requirement, and it exposes a coral Upload
// button (per-requirement) with an in-flight spinner state.
function LiveRequirementCard({
  req,
  docs,
  uploading,
  onUpload,
  uploadError,
  onRetryUpload,
}: {
  req: VisaRequirement;
  docs: Document[];
  uploading: boolean;
  onUpload: (requirementId: string) => void;
  /** japa#174: message of the last failed upload made from THIS card. */
  uploadError?: string | null;
  onRetryUpload?: () => void;
}) {
  // Done when every uploaded doc has reached verified / in-review (and at least
  // one exists) — "every verified || uploaded" heuristic.
  const done =
    docs.length > 0 &&
    docs.every(
      (d) =>
        d.status === 'verified' ||
        d.status === 'uploaded' ||
        d.status === 'under_review',
    );

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: EX.radius.card, // 20
        borderWidth: 1,
        borderColor: 'rgba(23,19,38,0.07)',
        paddingHorizontal: 16,
        paddingVertical: 15,
        marginBottom: 13,
        shadowColor: '#171326',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      {/* Header: done-check (22px) · title · estimatedTime (clock) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? '#D6F2E2' : 'rgba(23,19,38,0.06)',
          }}
        >
          {done ? (
            <Ic.check size={12} color="#1E8E55" strokeWidth={3.4} />
          ) : null}
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: 15.5,
            fontWeight: '700',
            color: EX.color.ink,
          }}
          numberOfLines={1}
        >
          {req.title}
        </Text>
        {req.estimatedTime ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ic.clock size={13} color={EX.color.muted} strokeWidth={1.8} />
            <Text
              style={{ fontSize: 12, color: EX.color.muted, fontWeight: '600' }}
            >
              {req.estimatedTime}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Description — full width */}
      {req.description ? (
        <Text
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: EX.color.inkMuted,
            marginTop: 8,
            marginBottom: 2,
          }}
        >
          {req.description}
        </Text>
      ) : null}

      {/* Uploaded documents for this requirement */}
      {docs.length > 0 ? (
        <View style={{ marginTop: 6 }}>
          {docs.map((doc, i) => (
            <LiveDocRow key={doc.id} doc={doc} first={i === 0} />
          ))}
        </View>
      ) : null}

      {/* Failed upload from this card: InlineError + outline Try again (#174) */}
      {uploadError ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <InlineError message={uploadError} />
          {onRetryUpload ? (
            <OutlineButton label="Try again" onPress={onRetryUpload} />
          ) : null}
        </View>
      ) : null}

      {/* Coral Upload button (per-requirement) with in-flight spinner */}
      <PressableStatic
        onPress={() => onUpload(req.id)}
        disabled={uploading}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          backgroundColor: EX.color.primary,
          borderRadius: 13,
          height: 46,
          marginTop: 13,
          opacity: uploading ? 0.7 : 1,
        }}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ic.upload size={16} color="#fff" strokeWidth={2} />
        )}
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
          {uploading ? 'Uploading…' : 'Upload document'}
        </Text>
      </PressableStatic>
    </View>
  );
}

export default function SelfServiceView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ── Live data hooks (ALL called unconditionally) ────────────────────────────
  // The route id must be a real application id; anything else is the backend
  // 404 → not-found below.
  const appQ = useApplication(id ?? '');
  const app = appQ.data;
  const vtQ = useVisaType(
    app ? app.countryCode : '',
    app ? app.visaTypeId : '',
  );
  const requirements = vtQ.data?.requirements ?? [];
  const visaType = vtQ.data?.visaType;
  const docsQ = useApplicationDocuments(app ? app.id : '');
  const docs = docsQ.data ?? [];

  // Intake questions (#113). Enabled as soon as the application resolves and
  // never on the demo path, so demo mode makes no request and shows no card.
  const intakeQ = useIntake(app ? app.id : '', !!app);
  // When the route has an intake it is the first step and shifts the others
  // down by one (see `stepNo` in the render below).
  const intakeStep = intakeOccupiesStep(intakeQ);
  // Checklist (#114): self-service applications only; off on the demo path.
  const checklistQ = useChecklist(
    app ? app.id : '',
    !!app && app.mode === 'self',
  );
  const checklist = checklistQ.data;
  // Per-upload document checks (#115): polled while one is running.
  const checksQ = useDocumentChecks(
    app ? app.id : '',
    !!app && app.mode === 'self',
  );
  const retryCheck = useRetryDocumentCheck(app?.id ?? '');
  // documentRequestId currently uploading from a checklist item.
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  // ── Review + statement (issue #43). Disabled on the demo path (empty id). ────
  // The review query polls itself while a job is queued/running and refetches on
  // app foreground, so a run survives backgrounding. The tier it carries comes
  // from the server response.
  const reviewId = app ? app.id : '';
  const reviewQ = useAssessment(reviewId);
  const stmtQ = useStatement(reviewId);
  const { start: startReview, isStarting } = useStartReview(reviewId);
  // Inline error for the sticky bar when a start fails (offline / generic).
  const [ctaError, setCtaError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Returning to this screen (from the statement, the review or the plans screen)
  // refetches the review: the inputs or the plan may have changed meanwhile.
  useFocusEffect(
    useCallback(() => {
      if (reviewId)
        queryClient.invalidateQueries({ queryKey: assessmentKey(reviewId) });
    }, [queryClient, reviewId]),
  );

  // Upload mutation hooks (createDoc invalidates the documents query → list refreshes).
  const getUploadUrl = useGetUploadUrl();
  const createDoc = useCreateDocument();

  // Per-requirement upload-in-flight tracking (holds the requirement id).
  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);
  // Uploading from the Step 2 empty state (no requirement, no checklist item).
  const [uploadingGeneral, setUploadingGeneral] = useState(false);
  // japa#174: the last failed upload, replacing the old Alert. `key` says which
  // card it came from: a requirement id, a checklist request id, or 'general'.
  const [uploadFailure, setUploadFailure] = useState<{
    key: string;
    requirementId: string | null;
    documentRequestId?: string;
    fileName: string;
  } | null>(null);

  // Parallax driven by the sheet's scroll offset. The prototype translated the
  // hero at `py * -0.3` (no image zoom) — matched exactly here.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * -0.3 }],
  }));

  // ── Upload flow (pick → signed URL → PUT to storage → register doc) ──────────
  // `uploadToStorage(uploadUrl, { uri, type, name })` fetches the file as a blob
  // internally and PUTs it — so we hand it the picked file descriptor, not a
  // pre-fetched blob (matching the helper's actual signature in useDocuments.ts).
  const handleUpload = useCallback(
    async (requirementId: string | null, documentRequestId?: string) => {
      if (!app) return;
      // Where the upload comes from (for the in-card error) and the file's name
      // once it is known.
      const failureKey = documentRequestId ?? requirementId ?? 'general';
      let fileName = 'your file';
      setUploadFailure(null);
      try {
        const res = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });
        if (res.canceled) return;
        const f = res.assets[0];
        fileName = f.name;
        const contentType = f.mimeType ?? 'application/octet-stream';

        // Checklist uploads track the request id; requirement uploads the req id.
        if (documentRequestId) setUploadingItemId(documentRequestId);
        else if (requirementId) setUploadingReqId(requirementId);
        else setUploadingGeneral(true);

        // 1) Signed upload URL for this file.
        const up = await getUploadUrl.mutateAsync({
          applicationId: app.id,
          fileName: f.name,
          contentType,
        });
        if (!up) throw new Error('Failed to get upload URL');

        // 2) PUT the file bytes to Firebase Storage (helper fetches the blob).
        await uploadToStorage(up.uploadUrl, {
          uri: f.uri,
          type: contentType,
          name: f.name,
        });

        // 3) Register the document — invalidates the documents query on success.
        await createDoc.mutateAsync({
          applicationId: app.id,
          // A checklist upload carries `documentRequestId`: the backend fulfils
          // the request and derives the requirement id (`docreq:<id>`).
          ...(documentRequestId
            ? { documentRequestId }
            : { requirementId: requirementId ?? GENERAL_REQUIREMENT_ID }),
          fileName: f.name,
          fileType: contentType,
          fileSizeMb: (f.size ?? 0) / 1e6,
          storagePath: up.storagePath,
        });
        // A new document changes the review's inputs: refresh the review state
        // so the card can show it as out of date.
        queryClient.invalidateQueries({ queryKey: assessmentKey(app.id) });
      } catch {
        // Signed URL, storage PUT or register failed: show it in the card the
        // upload came from (never an Alert), with a retry for the same target.
        setUploadFailure({
          key: failureKey,
          requirementId,
          documentRequestId,
          fileName,
        });
      } finally {
        setUploadingReqId(null);
        setUploadingItemId(null);
        setUploadingGeneral(false);
      }
    },
    [app, getUploadUrl, createDoc, queryClient],
  );

  // ── Live loading — initial application fetch in flight ───────────────────────
  // Waits for the intake (#113), statement and review (#43) queries too (once the
  // application is known) so step cards don't pop in and shift the numbering.
  if (
    appQ.isLoading ||
    (!!app && (intakeQ.isLoading || reviewQ.isLoading || stmtQ.isLoading))
  ) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: EX.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={EX.color.primary} />
      </View>
    );
  }

  // ── Load failed (not a 404) with nothing cached → error + retry ────────────
  if (appQ.isError && !app && !isNotFoundError(appQ.error)) {
    return (
      <CenteredState
        icon={Ic.docs}
        title="We couldn’t load your application"
        errorMessage={loadErrorCopy('your application')}
        onRetry={() => appQ.refetch()}
        retrying={appQ.isRefetching}
        actionLabel="Back to your journey"
        onAction={() => router.replace('/(tabs)/tracker')}
      />
    );
  }

  // ── LIVE VIEW — real application resolved ────────────────────────────────────
  if (app) {
    const art = countryArt(app.countryCode); // { city, img, tone }
    const flag = app.countryCode.toLowerCase();
    const country = app.countryName ?? app.countryCode;
    const visa = app.visaTypeName ?? 'Visa';
    const ref = app.id.slice(0, 8).toUpperCase();

    // Progress: backend may send a fraction (0–1) or a percentage (0–100).
    const frac = app.progress > 1 ? app.progress / 100 : app.progress;
    const livePct = Math.round((frac || 0) * 100);

    // Requirements ordered by their orderIndex (backend sort key).
    const orderedReqs = [...requirements].sort(
      (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
    );

    // Documents that belong to no listed requirement.
    //
    // WHY THIS EXISTS: the requirement cards below render
    // `docs.filter(d => d.requirementId === req.id)`, so anything whose
    // requirementId isn't a real requirement id was silently dropped from the
    // screen — the client simply never saw it. That covers documents an agency
    // filed on the client's behalf and uploads answering an ad-hoc agent ask
    // (`docreq:<id>`). Collecting the leftovers guarantees every document on the
    // application is visible somewhere.
    const reqIds = new Set(orderedReqs.map((r) => r.id));
    // A document uploaded against a checklist item is shown in the checklist,
    // so it is left out here: nothing is listed twice (#114).
    const otherDocs = docs.filter(
      (d) => !reqIds.has(d.requirementId) && !isChecklistDocument(d, checklist),
    );
    // With a checklist on screen, requirement cards that hold no document yet
    // are hidden (the checklist already asks for the documents); cards with
    // documents stay, so nothing already uploaded disappears.
    const hasChecklist = !!checklist && checklist.items.length > 0;
    const shownReqs = hasChecklist
      ? orderedReqs.filter((r) => docs.some((d) => d.requirementId === r.id))
      : orderedReqs;

    // ── Step 2 states (japa#174) ─────────────────────────────────────────────
    // Requirements (or documents) still loading / failed with nothing cached.
    const reqsLoading =
      (vtQ.isLoading && !vtQ.data) || (docsQ.isLoading && !docsQ.data);
    const reqsError =
      (vtQ.isError && !vtQ.data) || (docsQ.isError && !docsQ.data);
    // The checklist has settled (not loading, not failed) for self-service.
    const checklistSettled = !checklistQ.isLoading && !checklistQ.isError;
    // Waiting on the visit details: the checklist keeps its own prompt.
    const intakeWaiting =
      orderedReqs.length === 0 && checklist?.state === 'intake_needed';
    // Nothing published at all: no requirements and no personal checklist items.
    const noRequirements =
      orderedReqs.length === 0 &&
      !hasChecklist &&
      !intakeWaiting &&
      (app.mode !== 'self' || checklistSettled);

    // japa#174: when the visa lists requirements but the personal checklist is
    // empty (e.g. "There is no document list for this visa yet."), showing that
    // line above the requirement cards contradicts them. Hide the checklist
    // section then; keep it while loading / failed / waiting on intake / filled.
    const showChecklist =
      checklistQ.isLoading ||
      checklistQ.isError ||
      hasChecklist ||
      checklist?.state === 'intake_needed' ||
      orderedReqs.length === 0;

    // ── Review state (issue #43) ─────────────────────────────────────────────
    const submitted = SUBMITTED_STATUSES.includes(app.status as string);
    const reviewState = deriveReviewState(reviewQ.data, reviewQ.isError);
    const reviewCta = deriveReviewCta(reviewState, submitted);
    // Step numbers are computed from the steps that are present: the intake
    // (#113) only exists for routes with questions, and it shifts the rest. The
    // statement and review steps (#43) are always there on this live path.
    const presentSteps = [
      intakeStep ? 'intake' : null,
      'official',
      'documents',
      'statement',
      'review',
    ].filter(Boolean) as string[];
    const stepNo = (key: string) => presentSteps.indexOf(key) + 1;
    // A refetch failed but a cached review is on screen → offline note.
    const offlineCached = reviewQ.isError && !!reviewQ.data;
    const openReview = () => router.push(`/self-service/${app.id}/review`);
    const openStatement = () =>
      router.push(`/self-service/${app.id}/statement`);

    // Sticky CTA tap. Disabled while a start is in flight (no double jobs).
    const onReviewCta = async () => {
      if (!reviewCta || reviewCta.disabled || isStarting) return;
      setCtaError(null);
      if (reviewCta.action === 'open') return openReview();
      if (reviewCta.action === 'upgrade') return router.push(PLANS_ROUTE);
      const out = await startReview(
        reviewCta.action === 'retry' ? 'retry' : 'cta',
      );
      if (out === 'started') return openReview();
      if (out === 'offline')
        setCtaError(
          'You’re offline, so we couldn’t start your review. Reconnect and try again.',
        );
      else if (out === 'error')
        setCtaError('We couldn’t start your review. Try again in a moment.');
      // 'upgrade' (402) is not an error: the refetch shows the free out-of-date
      // state. 'no_rubric': the refetch shows the no-rubric card.
    };

    // Official application URL → button host label (strip protocol + path).
    // japa#174: no URL → no button and no guessed host (never a search link).
    const officialUrl = visaType?.applicationUrl?.trim() || undefined;
    const officialHost = officialUrl
      ? officialUrl.replace(/^https?:\/\//, '').split('/')[0]
      : '';

    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {/* HERO — fixed behind, parallaxes as the sheet scrolls over it */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: HERO,
              overflow: 'hidden',
              backgroundColor: art.tone,
            },
            heroStyle,
          ]}
        >
          <Image
            source={{ uri: art.img }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
            }}
            contentFit="cover"
            transition={200}
          />
          {/* Scrim — prototype: .82 → .2 @55% → .34, bottom→top */}
          <LinearGradient
            colors={[
              'rgba(12,10,8,0.82)',
              'rgba(12,10,8,0.2)',
              'rgba(12,10,8,0.34)',
            ]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
            }}
          />

          {/* Bottom hero content: glass "Self-service" badge · flag+country·ref · visa */}
          <View
            style={{ position: 'absolute', left: 22, right: 22, bottom: 42 }}
          >
            <BlurView
              intensity={20}
              tint="light"
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.26)',
                backgroundColor: 'rgba(255,255,255,0.16)',
                paddingHorizontal: 11,
                paddingVertical: 5,
                marginBottom: 8,
              }}
            >
              <Ic.docs size={13} color="#fff" strokeWidth={2} />
              <Text
                style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}
              >
                Self-service
              </Text>
            </BlurView>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Flag code={flag} size={18} radius={5} />
              <Text
                style={{
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: '600',
                  opacity: 0.95,
                }}
              >
                {country} · Ref {ref}
              </Text>
            </View>
            <Text
              style={{
                color: '#fff',
                fontFamily: EX.font.display.semibold,
                fontSize: 26,
                lineHeight: 28,
                letterSpacing: -0.26,
                textShadowColor: 'rgba(0,0,0,0.3)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 14,
              }}
            >
              {visa}
            </Text>
          </View>
        </Animated.View>

        {/* Top glass back control (prototype top:54 → safe-area inset + 6) */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 6,
            left: 18,
            zIndex: 50,
          }}
        >
          <GlassButton icon={Ic.chevL} onPress={() => router.back()} />
        </View>

        {/* Scrolling content sheet */}
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {/* Spacer revealing the hero (sheet overlaps ~26px) */}
          <View style={{ height: HERO - 26 }} pointerEvents="none" />

          <View
            style={{
              backgroundColor: EX.color.bg,
              borderTopLeftRadius: EX.radius.sheet, // 28
              borderTopRightRadius: EX.radius.sheet,
              minHeight: 620,
              paddingTop: 20,
              paddingHorizontal: 22,
              paddingBottom: EX.space.ctaClear, // 130
              shadowColor: '#171326',
              shadowOpacity: 0.26,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: -8 },
            }}
          >
            {/* ── Progress card (radius 22, padding 18) ───────────────────────── */}
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 22,
                borderWidth: 1,
                borderColor: 'rgba(23,19,38,0.07)',
                padding: 18,
                shadowColor: '#171326',
                shadowOpacity: 0.04,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  Application progress
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: EX.color.primary,
                  }}
                >
                  {livePct}%
                </Text>
              </View>
              <Progress value={frac || 0} height={7} />

              {/* 3 counts with dividers: Uploaded · Verified (green) · Required */}
              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: EX.color.ink,
                      letterSpacing: -0.2,
                    }}
                  >
                    {app.documentsUploaded}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: EX.color.muted,
                      fontWeight: '500',
                    }}
                  >
                    Uploaded
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: EX.color.line08 }} />
                <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: EX.color.success,
                      letterSpacing: -0.2,
                    }}
                  >
                    {app.documentsVerified}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: EX.color.muted,
                      fontWeight: '500',
                    }}
                  >
                    Verified
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: EX.color.line08 }} />
                <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: EX.color.ink,
                      letterSpacing: -0.2,
                    }}
                  >
                    {app.documentsRequired}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: EX.color.muted,
                      fontWeight: '500',
                    }}
                  >
                    Required
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Intake summary card (#113), only when the route has an intake ──
                It is the first step when present. Every step number below comes
                from `stepNo`, so the numbering is right whichever steps exist. */}
            <IntakeStep
              query={intakeQ}
              onOpen={() => router.push(`/self-service/${app.id}/intake`)}
              lastReviewAt={lastReviewFinishedAt(reviewQ.data)}
              stepNumber={stepNo('intake')}
            />
            {/* ── Official application ────────────────────────────────────────── */}
            <SectionTitle>{`Step ${stepNo('official')} · Official application`}</SectionTitle>
            <View
              style={{
                backgroundColor: EX.color.cream, // #FFF6EC
                borderRadius: EX.radius.card, // 20
                borderWidth: 1,
                borderColor: 'rgba(178,106,20,0.2)',
                padding: 16,
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FCEAC8',
                  }}
                >
                  <Ic.docs size={20} color={EX.color.amber} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: '#7A5A2E',
                    }}
                  >
                    Complete the online form
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 19,
                      color: '#8A6A38',
                      marginTop: 2,
                    }}
                  >
                    {officialUrl
                      ? 'Fill in your application on the official government portal before uploading documents here.'
                      : `Fill in your application on the ${country} government’s official site, then upload your documents here. We don’t have the link for this visa yet.`}
                  </Text>
                </View>
              </View>
              {/* Only render the open-portal button when the backend supplies a URL */}
              {officialUrl ? (
                <PressableStatic
                  onPress={() => Linking.openURL(officialUrl)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    backgroundColor: EX.color.amber, // #B26A14
                    borderRadius: 13,
                    height: 46,
                    marginTop: 14,
                  }}
                >
                  <Ic.arrowUR size={17} color="#fff" strokeWidth={2} />
                  <Text
                    style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                  >
                    Open {officialHost}
                  </Text>
                </PressableStatic>
              ) : null}
            </View>

            {/* ── Upload documents: the personal checklist (#114) with each item's
                upload-check result (#115), then any leftover requirement cards.
                japa#174: the empty / loading / error states of this step. ── */}
            <SectionTitle>{`Step ${stepNo('documents')} · Upload documents`}</SectionTitle>
            {reqsLoading ? (
              <StateLoading section />
            ) : reqsError ? (
              <StateError
                section
                message={loadErrorCopy('your checklist')}
                onRetry={() => {
                  vtQ.refetch();
                  docsQ.refetch();
                }}
                retrying={vtQ.isRefetching || docsQ.isRefetching}
              />
            ) : noRequirements ? (
              // ONE empty state (replaces both "Nothing to upload yet" and the
              // checklist's own "no document list" line). Uploads still work.
              <View
                style={{
                  backgroundColor: EX.color.cardWhite,
                  borderRadius: EX.radius.card,
                  borderWidth: 1,
                  borderColor: EX.color.line06,
                }}
              >
                <StateEmpty
                  section
                  icon={Ic.docs}
                  title="No requirements published for this visa yet."
                  body="You can still upload documents you already have."
                />
                <View
                  style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 8 }}
                >
                  {uploadFailure?.key === 'general' ? (
                    <InlineError
                      message={uploadErrorCopy(uploadFailure.fileName)}
                    />
                  ) : null}
                  {uploadingGeneral ? (
                    <ActivityIndicator color={EX.color.primary} />
                  ) : (
                    <OutlineButton
                      label={
                        uploadFailure?.key === 'general'
                          ? 'Try again'
                          : 'Upload a document'
                      }
                      onPress={() => handleUpload(null)}
                    />
                  )}
                </View>
              </View>
            ) : app.mode === 'self' && showChecklist ? (
              <>
                <DocumentChecklist
                  checklist={checklist}
                  loading={checklistQ.isLoading}
                  error={checklistQ.isError}
                  onRetry={() => checklistQ.refetch()}
                  docs={docs}
                  uploadingId={uploadingItemId}
                  // A failed item upload shows inside that item's card (#174);
                  // its button becomes Try again.
                  uploadFailure={
                    uploadFailure?.documentRequestId
                      ? {
                          documentRequestId: uploadFailure.documentRequestId,
                          message: uploadErrorCopy(uploadFailure.fileName),
                        }
                      : null
                  }
                  // Before the visit questions are answered the list points at them.
                  onOpenIntake={
                    intakeStep
                      ? () => router.push(`/self-service/${app.id}/intake`)
                      : undefined
                  }
                  checksProps={{
                    checks: checksQ.data,
                    checksLoading: checksQ.isLoading,
                    checksError: checksQ.isError,
                    onReloadChecks: () => checksQ.refetch(),
                    onRetryCheck: (documentId: string) =>
                      retryCheck.mutate(documentId),
                    retryingDocId: retryCheck.isPending
                      ? (retryCheck.variables ?? null)
                      : null,
                  }}
                  onUpload={(item: ChecklistItem) =>
                    item.documentRequestId
                      ? handleUpload(null, item.documentRequestId)
                      : undefined
                  }
                />
                {/* Waiting on the visit details with no requirements: uploading
                    what you already have must still be possible. */}
                {intakeWaiting ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {/* Error above the button; label becomes Try again (#174). */}
                    {uploadFailure?.key === 'general' ? (
                      <InlineError
                        message={uploadErrorCopy(uploadFailure.fileName)}
                      />
                    ) : null}
                    {uploadingGeneral ? (
                      <ActivityIndicator color={EX.color.primary} />
                    ) : (
                      <OutlineButton
                        label={
                          uploadFailure?.key === 'general'
                            ? 'Try again'
                            : 'Upload a document'
                        }
                        onPress={() => handleUpload(null)}
                      />
                    )}
                  </View>
                ) : null}
              </>
            ) : null}
            {shownReqs.map((req) => (
              <LiveRequirementCard
                key={req.id}
                req={req}
                docs={docs.filter((d) => d.requirementId === req.id)}
                uploading={uploadingReqId === req.id}
                onUpload={handleUpload}
                uploadError={
                  uploadFailure?.key === req.id
                    ? uploadErrorCopy(uploadFailure.fileName)
                    : null
                }
                onRetryUpload={() => handleUpload(req.id)}
              />
            ))}

            {/* Documents on this application that map to no requirement —
                typically ones the agency filed for the client, or uploads
                answering an ad-hoc request. Without this they'd be invisible. */}
            {otherDocs.length > 0 ? (
              <LiveOtherDocsCard docs={otherDocs} />
            ) : null}

            {/* ── Your statement (issue #43) ──────────────────────────────────── */}
            <SectionTitle>{`Step ${stepNo('statement')} · Your statement`}</SectionTitle>
            <StatementCard
              statement={stmtQ.data}
              loadFailed={stmtQ.isError}
              // The statement locks once the application is under review (server: 409).
              readOnly={isStatementLocked(app.status as string)}
              onOpen={openStatement}
              onRetry={() => stmtQ.refetch()}
            />

            {/* ── Your review (issue #43; country context #116 shows on the review
                screen it opens) ────────────────────────────────────────────── */}
            <SectionTitle>{`Step ${stepNo('review')} · Your review`}</SectionTitle>
            <ReviewCard
              state={reviewState}
              result={reviewQ.data}
              offlineCached={offlineCached}
              onSeeLast={openReview}
              onRetryLoad={() => reviewQ.refetch()}
            />
            {/* ── Ask about your review (issue #45) ─────────────────────────────
                A clearly separated entry to the ask-anywhere chat. */}
            <SectionTitle>Questions?</SectionTitle>
            <PressableStatic
              onPress={() => router.push(`/ai-chat/${app.id}`)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: '#fff',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: EX.color.line06,
                padding: 14,
              }}
            >
              <Ic.msg size={20} color={EX.color.primary} strokeWidth={1.8} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  Ask about your review
                </Text>
                <Text style={{ fontSize: 12.5, color: EX.color.muted }}>
                  Get answers from your saved review.
                </Text>
              </View>
              <Ic.chevR size={18} color={EX.color.faint} strokeWidth={1.8} />
            </PressableStatic>

            {/* ── Been refused before? (issue #122) ─────────────────────────────
                Entry to the refusal-letter analysis. Opens the static route
                `self-service/refusal-letter`, which uploads the letter and shows
                the mapped reasons, the checklist and the disclosure notice. */}
            <SectionTitle>Been refused before?</SectionTitle>
            <PressableStatic
              onPress={() =>
                router.push({
                  pathname: '/self-service/refusal-letter',
                  params: { applicationId: app.id },
                })
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: EX.color.cardWhite,
                borderRadius: EX.radius.cardLg,
                borderWidth: 1,
                borderColor: EX.color.line06,
                padding: 15,
              }}
            >
              <Ic.docs size={22} color={EX.color.primary} strokeWidth={1.8} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: EX.color.ink,
                    fontSize: 15,
                    fontWeight: '700',
                  }}
                >
                  Refusal letter
                </Text>
                <Text
                  style={{
                    color: EX.color.inkMuted,
                    fontSize: 13,
                    lineHeight: 18,
                    marginTop: 2,
                  }}
                >
                  See what it says next to the published rule.
                </Text>
              </View>
              <Ic.chevR size={18} color={EX.color.faint} strokeWidth={1.8} />
            </PressableStatic>
          </View>
        </Animated.ScrollView>

        {/* ── Sticky dark CTA (prototype glass bar → BlurView) ─────────────────── */}
        {/* Wired to the review (issue #43). It starts a review and sends nothing
            to anyone. Not rendered when there is no action (no approved rubric,
            or a submitted application that was never reviewed). */}
        {reviewCta ? (
          <BlurView
            intensity={30}
            tint="light"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingTop: 15,
              paddingHorizontal: 22,
              paddingBottom: Math.max(insets.bottom, 16) + 6,
              backgroundColor: EX.color.glassWarm,
              borderTopWidth: 1,
              borderTopColor: EX.color.line06,
            }}
          >
            {ctaError ? (
              <View style={{ marginBottom: 10 }}>
                <InlineError message={ctaError} />
              </View>
            ) : null}
            <PressableStatic
              onPress={onReviewCta}
              disabled={reviewCta.disabled || isStarting}
              accessibilityRole="button"
              accessibilityLabel={isStarting ? 'Starting' : reviewCta.label}
              accessibilityState={{
                disabled: !!reviewCta.disabled || isStarting,
                busy: isStarting || !!reviewCta.disabled,
              }}
              style={({ pressed }) => ({
                height: 54,
                borderRadius: EX.radius.button, // 16
                backgroundColor: EX.color.ink,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity:
                  reviewCta.disabled || isStarting ? 0.6 : pressed ? 0.85 : 1,
                shadowColor: '#171326',
                shadowOpacity: 0.5,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 14 },
                elevation: 8,
              })}
            >
              {isStarting || reviewCta.disabled ? (
                <ActivityIndicator color="#fff" />
              ) : null}
              <Text
                style={{ color: '#fff', fontSize: 15.5, fontWeight: '700' }}
              >
                {isStarting ? 'Starting…' : reviewCta.label}
              </Text>
              {reviewCta.withArrow && !isStarting ? (
                <Ic.arrow size={18} color="#fff" strokeWidth={1.8} />
              ) : null}
            </PressableStatic>
          </BlurView>
        ) : null}
      </View>
    );
  }

  // ── Not found: unknown id, a non-application id, or another account's ──────
  // japa#145/#174: 404 and 403 both land here; never the static demo checklist.
  return (
    <CenteredState
      icon={Ic.docs}
      title="We couldn’t find this application"
      body="Check the link, or open it from your journey."
      actionLabel="Back to your journey"
      onAction={() => router.replace('/(tabs)/tracker')}
    />
  );
}
