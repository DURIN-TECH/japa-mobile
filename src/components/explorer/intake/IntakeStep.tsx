// ─────────────────────────────────────────────────────────────────────────────
// IntakeStep (issue #113) — the "Step 1" summary card on the self-service
// screen. Shows the intake's state (not started / partly answered / saved /
// read-only / couldn't load) and opens the pushed question screen.
//
// Chrome copy is route-neutral; the step title, card title and intro come
// from the rubric (`meta`) with the design spec's fallbacks.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  displayAnswer,
  displayDate,
  isBlank,
  isKnownType,
  openRequired,
  requiredCount,
  toIsoDate,
  visibleIds,
} from './intakeLogic';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Progress, SectionTitle } from '@/components/explorer/primitives';
import { InfoNote, InlineError } from '@/components/explorer/AccountForm';
import { toDate } from '@/components/explorer/liveDate';
import type { IntakeResponse } from '@/types/intake.type';

/**
 * True when the screen should number the intake as Step 1: the route has an
 * intake, or loading it failed (the error card still takes the Step 1 slot).
 * False for no intake / demo mode, so numbering stays as before.
 */
export function intakeOccupiesStep(q: UseQueryResult<IntakeResponse>): boolean {
  return q.isError || (q.isSuccess && q.data.available);
}

// ── In-card buttons (46px, radius 13) ────────────────────────────────────────
function CardButton({
  label,
  onPress,
  variant,
  arrow,
}: {
  label: string;
  onPress: () => void;
  variant: 'coral' | 'outline';
  arrow?: boolean;
}) {
  const coral = variant === 'coral';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        height: 46,
        borderRadius: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: coral ? EX.color.primary : EX.color.cardWhite,
        borderWidth: coral ? 0 : 1,
        borderColor: EX.color.line10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: coral ? '#fff' : EX.color.ink,
        }}
      >
        {label}
      </Text>
      {arrow ? <Ic.arrow size={16} color="#fff" strokeWidth={2} /> : null}
    </Pressable>
  );
}

/** "Saved just now" for the first minute, else "Saved 12 Mar 2026". */
function savedLine(updatedAt: string | null): string {
  const d = toDate(updatedAt);
  if (!d) return '';
  if (Date.now() - d.getTime() < 60_000) return 'Saved just now';
  return `Saved ${displayDate(toIsoDate(d))}`;
}

const cardStyle = {
  backgroundColor: EX.color.cardWhite,
  borderRadius: EX.radius.card,
  borderWidth: 1,
  borderColor: EX.color.line06,
  padding: 16,
  shadowColor: '#171326',
  shadowOpacity: 0.04,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;

export function IntakeStep({
  query,
  onOpen,
  lastReviewAt,
  stepNumber = 1,
}: {
  query: UseQueryResult<IntakeResponse>;
  onOpen: () => void;
  /**
   * When the latest review finished, from the review hook (#43). Wins over the
   * intake response's own `lastReviewAt`, which the backend does not fill in yet.
   */
  lastReviewAt?: string | null;
  /** Computed by the screen from which steps are present (always 1 today). */
  stepNumber?: number;
}) {
  // ── Couldn't load: the other steps and uploads still work ──────────────────
  if (query.isError) {
    return (
      <>
        <SectionTitle>{`Step ${stepNumber} · Your details`}</SectionTitle>
        <View style={{ gap: 10 }}>
          <InlineError message="We couldn’t load your questions. Check your connection and try again." />
          <CardButton
            label="Try again"
            variant="outline"
            onPress={() => query.refetch()}
          />
        </View>
      </>
    );
  }

  // ── No intake for this route (or still loading, handled by the screen) ──────
  const data = query.data;
  if (!data || !data.available) return null;

  const { questions, answers, meta, editable } = data;
  const total = requiredCount(questions, answers);
  const open = openRequired(questions, answers);
  const answered = total - open.length;
  const started = data.updatedAt !== null;
  const complete = started && open.length === 0;
  const partial = started && open.length > 0;

  // Edited after the last review (#42): only when a review exists.
  // The review hook's finish time is the source; the intake field is a fallback.
  const reviewedAt = lastReviewAt ?? data.lastReviewAt;
  const editedAfterReview =
    !!reviewedAt &&
    !!data.updatedAt &&
    new Date(data.updatedAt) > new Date(reviewedAt);

  // Answered, visible rows for the saved layout (optional blanks are not listed).
  const vis = visibleIds(questions, answers);
  const rows = questions.filter(
    (q) => vis.has(q.id) && isKnownType(q) && !isBlank(answers[q.id]),
  );

  const cardTitle = meta.cardTitle ?? 'A few questions about your plans';
  const intro =
    meta.intro ??
    'Your answers shape your document checklist and your review, so describe things as they are.';

  return (
    <>
      <SectionTitle>{`Step ${stepNumber} · ${meta.title ?? 'Your details'}`}</SectionTitle>
      <View style={cardStyle}>
        {/* Header: status circle · title · counter / saved line */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {complete || (!editable && started) ? (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#D6F2E2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ic.check size={13} color={EX.color.success} strokeWidth={3} />
            </View>
          ) : (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 1.5,
                borderColor: EX.color.line24,
              }}
            />
          )}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 15.5,
              fontWeight: '700',
              color: EX.color.ink,
            }}
          >
            {complete || (!editable && started) ? 'Your answers' : cardTitle}
          </Text>
          {complete || (!editable && started) ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              {savedLine(data.updatedAt)}
            </Text>
          ) : total > 0 ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              {partial
                ? `${answered} of ${total} required`
                : `${total} required`}
            </Text>
          ) : null}
        </View>

        {/* Not started: the rubric's intro + the primary button */}
        {!started && editable ? (
          <View style={{ marginTop: 12, gap: 14 }}>
            <Text
              style={{ fontSize: 13, lineHeight: 19, color: EX.color.inkMuted }}
            >
              {intro}
            </Text>
            <CardButton
              label="Answer questions"
              variant="coral"
              arrow
              onPress={onOpen}
            />
          </View>
        ) : null}

        {/* Partly answered (resume) */}
        {partial && editable ? (
          <View style={{ marginTop: 12, gap: 12 }}>
            <Progress value={total > 0 ? answered / total : 0} />
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              Still to answer
            </Text>
            <View style={{ gap: 6 }}>
              {open.slice(0, 3).map((q) => (
                <View
                  key={q.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: EX.color.amber,
                    }}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: '600',
                      color: EX.color.ink2,
                    }}
                  >
                    {q.label}
                  </Text>
                </View>
              ))}
              {open.length > 3 ? (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                  }}
                >
                  {`and ${open.length - 3} more`}
                </Text>
              ) : null}
            </View>
            <CardButton
              label="Continue"
              variant="coral"
              arrow
              onPress={onOpen}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              {savedLine(data.updatedAt)}
            </Text>
          </View>
        ) : null}

        {/* Saved (complete) or read-only: the answered rows */}
        {complete || (!editable && started) ? (
          <View style={{ marginTop: 12 }}>
            {editedAfterReview ? (
              <View style={{ marginBottom: 12 }}>
                <InfoNote>
                  {`You’ve changed your answers since your review on ${displayDate(
                    toIsoDate(new Date(reviewedAt as string)),
                  )}. Run the review again so it reflects your answers as they are now.`}
                </InfoNote>
              </View>
            ) : null}
            {rows.map((q, i) => (
              <View
                key={q.id}
                style={{
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: EX.color.line06,
                }}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                  }}
                >
                  {q.label}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: EX.color.ink,
                    marginTop: 2,
                  }}
                >
                  {displayAnswer(q, answers[q.id])}
                </Text>
              </View>
            ))}
            {editable ? (
              <View style={{ marginTop: 12 }}>
                <CardButton
                  label="Edit answers"
                  variant="outline"
                  onPress={onOpen}
                />
              </View>
            ) : (
              <View style={{ marginTop: 10, gap: 4 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                  }}
                >
                  Submitted. These answers can no longer be changed.
                </Text>
                {open.length > 0 ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: EX.color.inkMuted,
                    }}
                  >
                    {open.length === 1
                      ? '1 question was left unanswered.'
                      : `${open.length} questions were left unanswered.`}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {/* Read-only and never answered */}
        {!editable && !started ? (
          <View style={{ marginTop: 10, gap: 4 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: EX.color.inkMuted,
              }}
            >
              Submitted. These answers can no longer be changed.
            </Text>
            {total > 0 ? (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: EX.color.inkMuted,
                }}
              >
                {total === 1
                  ? '1 question was left unanswered.'
                  : `${total} questions were left unanswered.`}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  );
}
