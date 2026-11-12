// ─────────────────────────────────────────────────────────────────────────────
// Self-service step cards for the statement and the review (issue #43).
//
// Rendered on /self-service/[id] (live mode only). Each card REPORTS state; the
// screen's sticky bar holds the one action (see `deriveReviewCta`).
//
//   StatementCard   Step "Your statement": not started / saved / couldn't load /
//                   read-only after submission
//   ReviewCard      Step "Your review": never run / running / ready / out of date
//                   / failed / no rubric / offline
//
// Copy is route-neutral and never predicts a decision (see reviewCopy.ts).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { EX, EXShadow } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { InfoNote, InlineError } from '@/components/explorer/AccountForm';
import {
  OutlineButton,
  ReadinessMeter,
  SolidButton,
} from '@/components/explorer/review/ReviewParts';
import {
  bandLabel,
  failedCardCopy,
  fmtDate,
  fmtTime,
  savedLabel,
  staleCopy,
} from '@/components/explorer/review/reviewCopy';
import { isInFlight } from '@/hooks/useCaseOfficer';
import { wordCount, type Statement } from '@/hooks/useStatement';
import type { AssessmentResult } from '@/types/assessment.type';

// Requirement-card chrome used by the existing self-service cards.
const cardStyle = {
  backgroundColor: EX.color.cardWhite,
  borderRadius: EX.radius.card,
  borderWidth: 1,
  borderColor: EX.color.line06,
  paddingVertical: 15,
  paddingHorizontal: 16,
  marginBottom: 10,
  ...EXShadow.card,
} as const;

/** 22px status circle: empty, done check, or a coral spinner. */
function Circle22({ state }: { state: 'empty' | 'done' | 'busy' }) {
  if (state === 'busy') {
    return (
      <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={EX.color.primary} />
      </View>
    );
  }
  const done = state === 'done';
  return (
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
      {done ? <Ic.check size={12} color="#1E8E55" strokeWidth={3.4} /> : null}
    </View>
  );
}

/** Title row: circle · title (gives way) · right-hand tag (never wraps). */
function CardHead({
  state,
  title,
  right,
}: {
  state: 'empty' | 'done' | 'busy';
  title: string;
  right?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Circle22 state={state} />
      <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '700', color: EX.color.ink }}>
        {title}
      </Text>
      {right ? (
        <Text style={{ fontSize: 12, fontWeight: '600', color: EX.color.inkMuted }} numberOfLines={1}>
          {right}
        </Text>
      ) : null}
    </View>
  );
}

const body = {
  fontSize: 13,
  lineHeight: 19,
  color: EX.color.inkMuted,
  marginTop: 8,
} as const;

// ── Statement card ────────────────────────────────────────────────────────────
export function StatementCard({
  statement,
  loadFailed,
  readOnly,
  onOpen,
  onRetry,
}: {
  statement?: Statement;
  loadFailed: boolean;
  readOnly: boolean;
  onOpen: () => void;
  onRetry: () => void;
}) {
  // Couldn't load: the rest of the screen still works.
  if (loadFailed) {
    return (
      <View style={cardStyle}>
        <CardHead state="empty" title="Your statement" />
        <View style={{ marginTop: 10, gap: 10 }}>
          <InlineError message="We couldn’t load your statement. Check your connection and try again." />
          <OutlineButton label="Try again" onPress={onRetry} />
        </View>
      </View>
    );
  }

  const saved = !!statement && statement.text.trim().length > 0;

  if (!saved) {
    return (
      <View style={cardStyle}>
        <CardHead state="empty" title="Your statement" right="Optional" />
        <Text style={body}>
          Explain your plans in your own words. The review reads your statement
          alongside your answers and documents.
        </Text>
        {!readOnly ? (
          <SolidButton
            label="Write your statement"
            onPress={onOpen}
            style={{ height: 46, borderRadius: 13, marginTop: 13 }}
          />
        ) : null}
      </View>
    );
  }

  const words = wordCount(statement!.text);
  return (
    <View style={cardStyle}>
      <CardHead state="done" title="Your statement" right={savedLabel(statement!.updatedAt)} />
      <Text style={body} numberOfLines={3}>
        {statement!.text}
      </Text>
      <Text style={{ fontSize: 12, color: EX.color.inkMuted, marginTop: 6 }}>
        {words} {words === 1 ? 'word' : 'words'}
      </Text>
      {readOnly ? (
        <Text style={{ fontSize: 12, color: EX.color.inkMuted, marginTop: 6 }}>
          Submitted. Your statement can no longer be changed.
        </Text>
      ) : (
        <OutlineButton label="Edit statement" onPress={onOpen} style={{ marginTop: 13 }} />
      )}
    </View>
  );
}

// ── Review state + sticky CTA derivation ─────────────────────────────────────

/** The single state the review card and the CTA are both drawn from. */
export type ReviewState =
  | 'none' // never run
  | 'no_rubric'
  | 'running'
  | 'failed'
  | 'ready'
  | 'stale_full'
  | 'stale_free'
  | 'load_error'; // couldn't load and nothing cached

export function deriveReviewState(
  result: AssessmentResult | undefined,
  isError: boolean,
): ReviewState {
  if (!result) return isError ? 'load_error' : 'none';
  if (result.kind === 'empty') return result.reason === 'no_rubric' ? 'no_rubric' : 'none';
  const { meta, tier } = result.view;
  if (isInFlight(meta)) return 'running';
  if (meta.status === 'failed') return 'failed';
  if (meta.stale || meta.staleReason) return tier === 'full' ? 'stale_full' : 'stale_free';
  return 'ready';
}

/** What the sticky bar shows for a review state. `null` = no bar. */
export interface ReviewCta {
  label: string;
  /** What a tap does. */
  action: 'run' | 'open' | 'upgrade' | 'retry';
  disabled?: boolean;
  withArrow?: boolean;
}

export function deriveReviewCta(state: ReviewState, submitted: boolean): ReviewCta | null {
  // After submission: view only. A review that was never run has no CTA.
  if (submitted) {
    return state === 'ready' || state === 'stale_full' || state === 'stale_free'
      ? { label: 'See my review', action: 'open', withArrow: true }
      : null;
  }
  switch (state) {
    case 'none':
    case 'load_error':
      return { label: 'Review my application', action: 'run', withArrow: true };
    case 'no_rubric':
      return null;
    case 'running':
      return { label: 'Reviewing…', action: 'open', disabled: true };
    case 'failed':
      return { label: 'Try again', action: 'retry' };
    case 'ready':
      return { label: 'See my review', action: 'open', withArrow: true };
    case 'stale_full':
      return { label: 'Run review again', action: 'run', withArrow: true };
    case 'stale_free':
      return { label: 'Upgrade to run it again', action: 'upgrade', withArrow: true };
  }
}

// ── Review card ──────────────────────────────────────────────────────────────
export function ReviewCard({
  state,
  result,
  offlineCached,
  onSeeLast,
  onRetryLoad,
}: {
  state: ReviewState;
  result?: AssessmentResult;
  /** A refetch failed but a cached review is shown. */
  offlineCached: boolean;
  onSeeLast: () => void;
  onRetryLoad: () => void;
}) {
  const view = result?.kind === 'review' ? result.view : null;
  const meta = view?.meta ?? null;

  if (state === 'load_error') {
    return (
      <View style={cardStyle}>
        <CardHead state="empty" title="Your review" />
        <View style={{ marginTop: 10, gap: 10 }}>
          <InlineError message="You’re offline. Reconnect to see your review." />
          <OutlineButton label="Try again" onPress={onRetryLoad} />
        </View>
      </View>
    );
  }

  if (state === 'no_rubric') {
    return (
      <View style={cardStyle}>
        <CardHead state="empty" title="No review for this visa yet" />
        <Text style={body}>
          Seli hasn’t finished checking the published rules for this visa, so
          there’s nothing to review against yet. You can still prepare and upload
          your documents here.
        </Text>
      </View>
    );
  }

  if (state === 'none') {
    return (
      <View style={cardStyle}>
        <CardHead state="empty" title="See how ready you are" />
        <Text style={body}>
          Seli checks your answers, statement and documents against the published
          rules for this visa and shows you what to fix first. It takes a few
          minutes.
        </Text>
      </View>
    );
  }

  if (state === 'running') {
    return (
      <View style={cardStyle}>
        <CardHead state="busy" title="Reviewing your application" />
        <Text style={body}>
          This usually takes a few minutes. You can leave this screen. Your
          review will be here when you come back.
        </Text>
        {meta?.startedAt ? (
          <Text style={{ fontSize: 12, color: EX.color.inkMuted, marginTop: 6 }}>
            Started at {fmtTime(meta.startedAt)}
          </Text>
        ) : null}
      </View>
    );
  }

  if (state === 'failed') {
    return (
      <View style={cardStyle}>
        <CardHead state="empty" title="Your review" />
        <View style={{ marginTop: 10 }}>
          <InlineError message={failedCardCopy(meta)} />
        </View>
      </View>
    );
  }

  // ready / stale_*: the band label as the title, the meter, one line.
  const stale = state === 'stale_full' || state === 'stale_free';
  const band = view?.data?.readiness ?? null;
  return (
    <View style={cardStyle}>
      <CardHead
        state="done"
        title={bandLabel(band)}
        right={meta?.finishedAt ? `Reviewed ${fmtDate(meta.finishedAt)}` : undefined}
      />
      <ReadinessMeter band={band} />
      <Text style={body}>Your review is ready. It shows what to fix first.</Text>
      {offlineCached ? (
        <Text style={{ fontSize: 12, color: EX.color.inkMuted, marginTop: 6 }}>
          You’re offline. Showing your last saved review.
        </Text>
      ) : null}
      {stale && view ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <InfoNote>{staleCopy(view.meta.staleReason, view.tier)}</InfoNote>
          <OutlineButton label="See the last review" onPress={onSeeLast} />
        </View>
      ) : null}
    </View>
  );
}
