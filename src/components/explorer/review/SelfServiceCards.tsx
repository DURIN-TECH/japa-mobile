// ─────────────────────────────────────────────────────────────────────────────
// Self-service step cards for the statement and the review (issue #43).
//
// Rendered on /self-service/[id] (live mode only). Each card REPORTS state; the
// screen's sticky bar holds the one action (see `deriveReviewCta`).
//
//   StatementCard   Step "Your statement": not started / saved / couldn't load /
//                   read-only after submission
//   ReviewCard      Step "Your review": never run / running / ready / out of date
//                   / failed / no rubric / offline / still needs content (#309)
//
// Copy is route-neutral and never predicts a decision (see reviewCopy.ts).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { EX, EXShadow } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { InfoNote, InlineError } from '@/components/explorer/AccountForm';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import {
  OutlineButton,
  ReadinessMeter,
  SolidButton,
} from '@/components/explorer/review/ReviewParts';
import {
  bandLabel,
  CONTACT_SUPPORT_LABEL,
  failedCardCopy,
  fmtDate,
  fmtTime,
  NO_REVIEW_BODY,
  NEEDS_CONTENT_BODY,
  NO_REVIEW_TITLE,
  reviewGapLines,
  savedLabel,
  staleCopy,
  type ReviewContent,
  type ReviewGap,
  type ReviewGaps,
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
      <View
        style={{
          width: 22,
          height: 22,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
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
      <Text
        style={{
          flex: 1,
          fontSize: 15.5,
          fontWeight: '700',
          color: EX.color.ink,
        }}
      >
        {title}
      </Text>
      {right ? (
        <Text
          style={{ fontSize: 12, fontWeight: '600', color: EX.color.inkMuted }}
          numberOfLines={1}
        >
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
      <CardHead
        state="done"
        title="Your statement"
        right={savedLabel(statement!.updatedAt)}
      />
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
        <OutlineButton
          label="Edit statement"
          onPress={onOpen}
          style={{ marginTop: 13 }}
        />
      )}
    </View>
  );
}

// ── Review state + sticky CTA derivation ─────────────────────────────────────

/** The single state the review card and the CTA are both drawn from. */
export type ReviewState =
  | 'none' // never run
  | 'checking' // never run; intake or documents still loading (japa#309)
  | 'needs_content' // never run; not enough to review yet (japa#309)
  | 'no_rubric'
  | 'running'
  | 'failed'
  | 'ready'
  | 'stale_full'
  | 'stale_free'
  | 'load_error'; // couldn't load and nothing cached

/**
 * `content` (japa#309) only refines "never run": every other state (running,
 * failed, ready, out of date, offline, no rubric) is unchanged. Omitted, it
 * counts as enough, as before.
 *
 * `submitted` is required with it on purpose: a submitted or closed
 * application (`SUBMITTED_STATUSES`) is view only, so the applicant can no
 * longer add what is missing. Its card stays exactly as before this issue
 * ("See how ready you are", no action), whatever the content check says.
 */
export function deriveReviewState(
  result: AssessmentResult | undefined,
  isError: boolean,
  content?: { check: ReviewContent; submitted: boolean },
): ReviewState {
  const check: ReviewContent =
    content && !content.submitted ? content.check : { status: 'enough' };
  const never = (): ReviewState =>
    check.status === 'loading'
      ? 'checking'
      : check.status === 'missing'
        ? 'needs_content'
        : 'none';
  if (!result) return isError ? 'load_error' : never();
  if (result.kind === 'empty')
    return result.reason === 'no_rubric' ? 'no_rubric' : never();
  const { meta, tier } = result.view;
  if (isInFlight(meta)) return 'running';
  if (meta.status === 'failed') return 'failed';
  if (meta.stale || meta.staleReason)
    return tier === 'full' ? 'stale_full' : 'stale_free';
  return 'ready';
}

/** What the sticky bar shows for a review state. `null` = no bar. */
export interface ReviewCta {
  label: string;
  /** What a tap does. */
  /** `contact` (japa#310): open support, for a failure a retry cannot fix. */
  action: 'run' | 'open' | 'upgrade' | 'retry' | 'contact';
  disabled?: boolean;
  withArrow?: boolean;
}

/**
 * `canRetry` (japa#310) only matters for `failed`: false when the failure is
 * one a retry cannot fix (see `failedCanRetry` in reviewCopy.ts), and the bar
 * then offers "Contact support" instead of "Try again". Omitted, it is true.
 */
export function deriveReviewCta(
  state: ReviewState,
  submitted: boolean,
  canRetry = true,
): ReviewCta | null {
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
    // japa#309: not offered until the inputs are known, and not at all while
    // something is still needed (the card lists what, and each line opens it).
    case 'checking':
      return { label: 'Review my application', action: 'run', disabled: true };
    case 'needs_content':
    case 'no_rubric':
      return null;
    case 'running':
      return { label: 'Reviewing…', action: 'open', disabled: true };
    case 'failed':
      return canRetry
        ? { label: 'Try again', action: 'retry' }
        : { label: CONTACT_SUPPORT_LABEL, action: 'contact' };
    case 'ready':
      return { label: 'See my review', action: 'open', withArrow: true };
    case 'stale_full':
      return { label: 'Run review again', action: 'run', withArrow: true };
    case 'stale_free':
      return {
        label: 'Upgrade to run it again',
        action: 'upgrade',
        withArrow: true,
      };
  }
}

// ── Review card ──────────────────────────────────────────────────────────────
export function ReviewCard({
  state,
  result,
  offlineCached,
  onSeeLast,
  onRetryLoad,
  gaps,
  intakeStep = 0,
  onOpenGap,
}: {
  state: ReviewState;
  result?: AssessmentResult;
  /** A refetch failed but a cached review is shown. */
  offlineCached: boolean;
  onSeeLast: () => void;
  onRetryLoad: () => void;
  /** japa#309: what is still needed, for the `needs_content` state. */
  gaps?: ReviewGaps | null;
  /** The intake's step number on the screen (0 = no intake step shown). */
  intakeStep?: number;
  /** Opens the step a "still needed" line names. */
  onOpenGap?: (gap: ReviewGap) => void;
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
        <CardHead state="empty" title={NO_REVIEW_TITLE} />
        <Text style={body}>{NO_REVIEW_BODY}</Text>
      </View>
    );
  }

  // japa#309: one line per missing part, each opening its step.
  if (state === 'needs_content' && gaps) {
    return (
      <View style={cardStyle}>
        <CardHead state="empty" title="See how ready you are" />
        <Text style={body}>{NEEDS_CONTENT_BODY}</Text>
        <View style={{ marginTop: 10, gap: 8 }}>
          {reviewGapLines(gaps, intakeStep).map(({ gap, text }) => (
            <PressableStatic
              key={gap}
              onPress={() => onOpenGap?.(gap)}
              accessibilityRole="button"
              accessibilityLabel={text}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: EX.color.line06,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  lineHeight: 19,
                  fontWeight: '600',
                  color: EX.color.ink,
                }}
              >
                {text}
              </Text>
              <Ic.chevR size={16} color={EX.color.faint} strokeWidth={1.8} />
            </PressableStatic>
          ))}
        </View>
      </View>
    );
  }

  // 'checking' looks like 'none'; only the sticky bar differs (disabled).
  // `needs_content` without gaps cannot happen from the screen; it falls back
  // here too rather than drawing an empty list.
  if (state === 'none' || state === 'checking' || state === 'needs_content') {
    return (
      <View style={cardStyle}>
        <CardHead state="empty" title="See how ready you are" />
        <Text style={body}>
          Seli checks your answers, statement and documents against the
          published rules for this visa and shows you what to fix first. It
          takes a few minutes.
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
          <Text
            style={{ fontSize: 12, color: EX.color.inkMuted, marginTop: 6 }}
          >
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
        right={
          meta?.finishedAt ? `Reviewed ${fmtDate(meta.finishedAt)}` : undefined
        }
      />
      <ReadinessMeter band={band} />
      <Text style={body}>
        Your review is ready. It shows what to fix first.
      </Text>
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
