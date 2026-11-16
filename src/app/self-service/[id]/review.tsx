// ─────────────────────────────────────────────────────────────────────────────
// Review screen — /self-service/[id]/review (issue #43, "the verdict screen").
//
// Cloned from eligibility/result.tsx: hero with a gauge, then sections. It shows
// READINESS and THINGS TO FIX, never a decision. Words such as verdict, refusal,
// approval, likelihood or a score never appear, and no number is drawn.
//
// The tier comes from the response (`meta.tier`), never from the client:
//   free  band + up to three issue titles + (maybe) one blocking-rule flag,
//         then a STATIC upgrade panel. Nothing locked is drawn from data.
//   full  the cited review: rules not met yet, officer questions, statement
//         notes, what we couldn't tell, strengths, what to do next.
//   Both tiers, unless a fixed rule blocks: "Then you apply" (japa#312), the
//   closing words that Seli doesn't send the application.
//
// Route-neutral: every rule string (titles, references, quotes, links) is
// rendered from the data as received.
//
// States: loading · couldn't load · no review yet · no approved rubric ·
// queued/running (waiting, resumes from the server, polls) · failed ·
// result (free / full / blocking rule) · not allowed.
//
// RESERVED SLOTS (render nothing until their issues ship):
//   Slot A  country context card (#116), under the disclaimer
//   Slot B  per-item action (#44), the `footer` of each FindingCard
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { SectionTitle, Card } from '@/components/explorer/primitives';
import {
  BackHeader,
  InfoNote,
  InlineError,
} from '@/components/explorer/AccountForm';
import {
  BlockingRuleCard,
  Caption,
  CountryContextCard,
  CheckRow,
  FindingCard,
  NumberedRow,
  OutlineButton,
  ReviewEmpty,
  ReviewHero,
  RuleQuote,
  SolidButton,
} from '@/components/explorer/review/ReviewParts';
import { CouldntTell } from '@/components/explorer/review/CouldntTell';
import { StickyBar } from '@/components/explorer/StickyBar';
import { LayerPill } from '@/components/explorer/SharedRouteParts';
import {
  SHARED_COPY,
  hasMissingLayer,
  layerLabel,
  missingLayerNote,
} from '@/components/explorer/sharedRouteLogic';
import type { StackLayer } from '@/types/sharedRoute.type';
import { PLANS_ROUTE, UpgradePanel } from '@/components/explorer/UpgradePrompt';
import {
  BAND_SUMMARY,
  DISCLAIMER,
  failedReasonLine,
  failedCanRetry,
  CONTACT_SUPPORT_LABEL,
  SUPPORT_MAILTO,
  fullTierBlocked,
  isFixedRuleFinding,
  nextSteps,
  NO_REVIEW_BODY,
  NO_REVIEW_TITLE,
  showsThenYouApply,
  staleCopy,
  NEEDS_CONTENT_ELSEWHERE,
} from '@/components/explorer/review/reviewCopy';
import { ThenYouApply } from '@/components/explorer/review/ThenYouApply';
import { useApplication } from '@/hooks/useApplications';
import { useVisaType } from '@/hooks/useVisaTypes';
import {
  assessmentKey,
  isForbidden,
  isInFlight,
  isOffline,
  useAssessment,
  useStartReview,
  type StartOutcome,
} from '@/hooks/useCaseOfficer';
import { analyticsService } from '@/services/analytics.service';
// Self-service-only launch flag (japa#334).
import { isSelfServiceOnly } from '@/config/env';
import type {
  AssessmentView,
  FullAssessmentData,
} from '@/types/assessment.type';

/** After this long the waiting line changes to the "still working" copy. */
const STILL_WORKING_MS = 3 * 60 * 1000;

// The fixed-rule check (`isFixedRuleFinding`, `fullTierBlocked`) and
// `nextSteps` ("Fix the rule…" etc.) live in reviewCopy.ts since japa#312, so
// they are unit-tested together with the "Then you apply" rule that depends on
// the same blocking check.

export default function ReviewScreen() {
  // Self-service-only build (japa#334): hides the "Find an agent" buttons and
  // the line pointing at agents. Off = everything as before.
  const selfServiceOnly = isSelfServiceOnly();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const applicationId = id ?? '';

  const appQ = useApplication(applicationId);
  const q = useAssessment(applicationId);
  const { start, isStarting } = useStartReview(applicationId);
  const visaName = appQ.data?.visaTypeName;
  // japa#312: the visa (same query and cache as the self-service screen), only
  // to know whether it has an official link for "Then you apply".
  const vtQ = useVisaType(
    appQ.data?.countryCode ?? '',
    appQ.data?.visaTypeId ?? '',
  );
  const hasOfficialLink: boolean | undefined = vtQ.data
    ? !!vtQ.data.visaType?.applicationUrl?.trim()
    : undefined;

  // Inline error for a failed start (offline / generic), shown above the CTA.
  const [startError, setStartError] = useState<string | null>(null);
  // Ticks while waiting so the "still working" copy can switch after 3 minutes.
  const [now, setNow] = useState(Date.now());

  const result = q.data;
  const view: AssessmentView | null =
    result?.kind === 'review' ? result.view : null;
  const waiting = !!view && isInFlight(view.meta);

  // Coming back from the plans screen: refetch, so an upgrade is picked up and
  // the same stored review is then served in full, with no re-run.
  useFocusEffect(
    React.useCallback(() => {
      queryClient.invalidateQueries({ queryKey: assessmentKey(applicationId) });
    }, [queryClient, applicationId]),
  );

  // Clock for the waiting copy.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [waiting]);

  // Waiting → result: success haptic + screen-reader announcement, once.
  const wasWaiting = useRef(false);
  useEffect(() => {
    if (waiting) {
      wasWaiting.current = true;
    } else if (wasWaiting.current && view?.meta.status === 'succeeded') {
      wasWaiting.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      AccessibilityInfo.announceForAccessibility('Your review is ready');
    }
  }, [waiting, view?.meta.status]);

  // Analytics: the result was viewed (tier and band words only).
  const viewedFor = useRef<string | null>(null);
  useEffect(() => {
    if (
      view?.meta.status === 'succeeded' &&
      viewedFor.current !== view.meta.assessmentId
    ) {
      viewedFor.current = view.meta.assessmentId;
      analyticsService.trackReviewEvent('review_viewed', {
        tier: view.tier,
        band: view.data?.readiness ?? 'none',
      });
    }
  }, [view]);

  const goBackToApplication = () => router.back();
  const goPlans = (source: 'panel' | 'rerun') => {
    analyticsService.trackReviewEvent('review_upgrade_prompt_tapped', {
      source,
    });
    router.push(PLANS_ROUTE);
  };

  /** Start a review and map the outcome to this screen's behaviour. */
  const run = async (source: 'cta' | 'rerun' | 'retry') => {
    setStartError(null);
    const out: StartOutcome = await start(source);
    if (out === 'offline')
      setStartError(
        'You’re offline, so we couldn’t start your review. Reconnect and try again.',
      );
    else if (out === 'error')
      setStartError('We couldn’t start your review. Try again in a moment.');
    // japa#309: nothing to review yet; the application screen lists what.
    else if (out === 'not_enough') setStartError(NEEDS_CONTENT_ELSEWHERE);
    // 'upgrade' is not an error: the refetch shows the free out-of-date state.
  };

  const header = (
    <BackHeader
      title="Your review"
      subtitle={visaName}
      insets={insets}
      onBack={goBackToApplication}
    />
  );
  const pad = { paddingHorizontal: EX.space.screenX } as const;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (q.isLoading) {
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

  // ── Not allowed ──────────────────────────────────────────────────────────────
  if (q.isError && isForbidden(q.error)) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={pad}>
          <ReviewEmpty
            icon={Ic.help}
            title="This review isn’t available on this account."
          />
          <OutlineButton
            label="Back to your application"
            onPress={goBackToApplication}
            height={54}
          />
        </View>
      </View>
    );
  }

  // ── Couldn't load, nothing cached ────────────────────────────────────────────
  if (q.isError && !result) {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={[pad, { paddingTop: 16, gap: 12 }]}>
          <InlineError
            message={
              isOffline(q.error)
                ? 'You’re offline. Reconnect to see your review.'
                : 'We couldn’t load your review. Check your connection and try again.'
            }
          />
          <OutlineButton label="Try again" onPress={() => q.refetch()} />
        </View>
      </View>
    );
  }

  // ── No approved rubric ───────────────────────────────────────────────────────
  if (result?.kind === 'empty' && result.reason === 'no_rubric') {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={pad}>
          <ReviewEmpty
            icon={Ic.help}
            title={NO_REVIEW_TITLE}
            body={NO_REVIEW_BODY}
          />
          <OutlineButton
            label="Back to your application"
            onPress={goBackToApplication}
            height={54}
          />
        </View>
      </View>
    );
  }

  // ── No review yet (deep link) ────────────────────────────────────────────────
  if (result?.kind === 'empty') {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={pad}>
          <ReviewEmpty
            icon={Ic.gauge}
            title="See how ready you are"
            body="Seli checks your answers, statement and documents against the published rules for this visa and shows you what to fix first. It takes a few minutes."
          />
        </View>
        <StickyBar insetBottom={insets.bottom}>
          {startError ? (
            <View style={{ marginBottom: 10 }}>
              <InlineError message={startError} />
            </View>
          ) : null}
          <SolidButton
            label={isStarting ? 'Starting…' : 'Review my application'}
            loading={isStarting}
            onPress={() => run('cta')}
          />
        </StickyBar>
      </View>
    );
  }

  // From here on there is a review record.
  if (!view) return null;
  const meta = view.meta;

  // ── Waiting (queued / running) ───────────────────────────────────────────────
  if (waiting) {
    const startedMs = meta.startedAt ? new Date(meta.startedAt).getTime() : now;
    const stillWorking = now - startedMs > STILL_WORKING_MS;
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <ScrollView
          contentContainerStyle={[
            pad,
            { paddingTop: 20, paddingBottom: 40, gap: 16 },
          ]}
        >
          <View
            style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator size="large" color={EX.color.primary} />
            <Text
              style={[displayText(22, 'semibold'), { textAlign: 'center' }]}
            >
              {meta.status === 'queued'
                ? 'Your review is in the queue'
                : 'Reviewing your application'}
            </Text>
            <Text
              style={{
                fontSize: 14,
                lineHeight: 21,
                color: EX.color.inkMuted,
                textAlign: 'center',
              }}
            >
              {stillWorking
                ? 'Still working. Applications with more documents take a little longer.'
                : 'This usually takes a few minutes.'}
            </Text>
          </View>
          <InfoNote>
            You can leave this screen or close the app. Your review will be here
            when you come back.
          </InfoNote>
          {/* Static: the job only reports queued or running, so no ticks, no fake progress. */}
          <View style={{ gap: 9 }}>
            {[
              'Your details are checked against the fixed rules.',
              'Your documents are read for dates, names and amounts.',
              'Your statement and answers are read together with them.',
            ].map((l, i) => (
              <NumberedRow key={l} n={i + 1} label={l} />
            ))}
          </View>
          <OutlineButton
            label="Back to your application"
            onPress={goBackToApplication}
            height={54}
          />
        </ScrollView>
      </View>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────────────────
  if (meta.status === 'failed') {
    return (
      <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
        {header}
        <View style={pad}>
          <ReviewEmpty
            icon={Ic.alert}
            title="We couldn’t finish your review"
            body={failedReasonLine(meta)}
            note="Nothing you added is lost."
          />
        </View>
        <StickyBar insetBottom={insets.bottom}>
          {startError ? (
            <View style={{ marginBottom: 10 }}>
              <InlineError message={startError} />
            </View>
          ) : null}
          {/* A retry after a failed job is free on both tiers. japa#310: when
              a retry cannot succeed (the application is too big for one
              review), the button opens support instead of failing again. */}
          {failedCanRetry(meta) ? (
            <SolidButton
              label={isStarting ? 'Starting…' : 'Try again'}
              loading={isStarting}
              onPress={() => run('retry')}
            />
          ) : (
            <SolidButton
              label={CONTACT_SUPPORT_LABEL}
              onPress={() =>
                Linking.openURL(SUPPORT_MAILTO).catch(() => undefined)
              }
            />
          )}
        </StickyBar>
      </View>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────────
  const stale = meta.stale || meta.staleReason !== null;
  const offline = q.isError; // refetch failed but a cached review is on screen
  const band = view.data?.readiness ?? null;
  const full = view.tier === 'full' ? view.data : null;
  const free = view.tier === 'free' ? view.data : null;

  // Full tier: a fixed rule blocks the application.
  const barItem = full?.refusalGrounds.find(isFixedRuleFinding) ?? null;
  const fullBlocked = !!full && fullTierBlocked(full);
  // japa#312: closing "Then you apply" words, finished + unblocked only.
  // The ending depends on whether the visa has an official link (the
  // "Where you apply" card has no button without one); unknown until loaded.
  const thenYouApply = showsThenYouApply(view) ? (
    <ThenYouApply hasLink={hasOfficialLink} />
  ) : null;

  const disclaimer = (
    <Text
      style={{
        fontSize: 13,
        lineHeight: 19,
        color: EX.color.inkMuted,
        borderTopWidth: 1,
        borderTopColor: EX.color.line06,
        paddingTop: 14,
        marginTop: 16,
      }}
    >
      {DISCLAIMER}
    </Text>
  );

  const staleNote = stale ? (
    <View style={{ marginTop: 20 }}>
      <InfoNote>{staleCopy(meta.staleReason, view.tier)}</InfoNote>
    </View>
  ) : null;

  // Sticky bar: full tier only. Blocking state and the free result have none.
  const showBar = view.tier === 'full' && !fullBlocked;
  // "Find an agent" opens the Agents tab, hidden in a self-service-only build
  // (japa#334): both placements below then render nothing.
  const findAgent = selfServiceOnly ? null : (
    <SolidButton
      label="Find an agent"
      tone="ink"
      onPress={() => router.push('/(tabs)/agents')}
      style={{ marginTop: 18 }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: showBar ? EX.space.ctaClear : 48,
        }}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          <ReviewHero
            band={band}
            caption={
              hasMissingLayer(meta.stackLayers)
                ? SHARED_COPY.notCheckedCaption
                : undefined
            }
            reviewedAt={meta.finishedAt}
            stale={stale}
            offline={offline}
            insetTop={insets.top}
            onBack={goBackToApplication}
          />

          <View style={pad}>
            {/* ── Blocking rule, full tier: stops here ─────────────────────── */}
            {full && fullBlocked ? (
              <View style={{ marginTop: 20 }}>
                <BlockingRuleCard
                  title="One rule stands in the way"
                  body={`${barItem?.title ? `${barItem.title}. ` : ''}This is a fixed rule, checked from the details on your profile. It isn’t a judgement about you.`}
                >
                  {barItem ? (
                    <RuleQuote
                      ruleRef={barItem.ruleRef}
                      quote={barItem.sourceQuote}
                      url={barItem.sourceUrl}
                      onSurface
                      onOpen={() =>
                        analyticsService.trackReviewEvent(
                          'review_rule_source_opened',
                          { tier: 'full' },
                        )
                      }
                    />
                  ) : null}
                </BlockingRuleCard>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 22,
                    color: EX.color.inkMuted,
                    marginTop: 16,
                  }}
                >
                  We stopped the review here, because this rule comes before
                  everything else.
                </Text>
                <SectionTitle>What to do next</SectionTitle>
                <Card>
                  {[
                    'Read the rule at its source.',
                    'If your details are wrong, correct them and run the review again.',
                    // Points at agents, so it goes with the "Find an agent"
                    // button in a self-service-only build (japa#334).
                    ...(selfServiceOnly
                      ? []
                      : [
                          'If the rule does apply to you, an agent can talk you through other routes.',
                        ]),
                  ].map((s, i) => (
                    <Text
                      key={s}
                      style={{
                        fontSize: 14,
                        lineHeight: 21,
                        color: EX.color.ink2,
                        marginTop: i ? 8 : 0,
                      }}
                    >
                      {i + 1}. {s}
                    </Text>
                  ))}
                </Card>
                {findAgent}
                {disclaimer}
              </View>
            ) : (
              <>
                {staleNote}
                {/* japa#237: part of the stack has no rules yet. */}
                {missingLayerNote(meta.stackLayers) ? (
                  <View style={{ marginTop: 20 }}>
                    <InfoNote icon={Ic.clock}>
                      {missingLayerNote(meta.stackLayers)}
                    </InfoNote>
                  </View>
                ) : null}
                {/* Summary sentence by band */}
                {band ? (
                  <Text
                    style={{
                      fontSize: 14.5,
                      lineHeight: 23,
                      color: EX.color.inkMuted,
                      marginTop: 20,
                    }}
                  >
                    {BAND_SUMMARY[band]}
                  </Text>
                ) : null}
                {disclaimer}
                {/* Slot A: country context card (#116). Full tier only (the free payload never carries it); nothing when unavailable. */}
                <CountryContextCard context={full?.countryContext} />
              </>
            )}

            {/* ── FREE tier ──────────────────────────────────────────────────── */}
            {free ? (
              <>
                {/* A fixed rule blocks the applicant: told plainly, not behind a paywall.
                    The free payload carries no rule text, so this is generic. */}
                {free.hasBlockingRule ? (
                  <View style={{ marginTop: 20 }}>
                    <BlockingRuleCard
                      title="One rule stands in the way"
                      body="One of the fixed rules for this visa applies to your details. It’s checked from the details on your profile and isn’t a judgement about you."
                    />
                    {findAgent}
                  </View>
                ) : null}

                <SectionTitle>Start with these</SectionTitle>
                <View style={{ gap: 9 }}>
                  {free.topIssues.length > 0 ? (
                    free.topIssues
                      .slice(0, 3)
                      .map((t, i) => (
                        <NumberedRow
                          key={`${t.criterionId}:${i}`}
                          n={i + 1}
                          label={t.title}
                        />
                      ))
                  ) : (
                    <CheckRow label="Nothing stood out as a priority in what you’ve given us." />
                  )}
                </View>
                {/* japa#312: below "Start with these", above the upgrade panel */}
                {thenYouApply}
                <View style={{ marginTop: 22 }}>
                  <UpgradePanel onPress={() => goPlans('panel')} />
                </View>
              </>
            ) : null}

            {/* ── FULL tier sections ─────────────────────────────────────────── */}
            {full && !fullBlocked ? (
              <FullSections
                d={full}
                layers={meta.stackLayers}
                onRuleOpened={() =>
                  analyticsService.trackReviewEvent(
                    'review_rule_source_opened',
                    { tier: 'full' },
                  )
                }
                onEditStatement={() =>
                  router.push(`/self-service/${applicationId}/statement`)
                }
              />
            ) : null}
            {/* japa#312: full tier, after "What to do next" (FullSections ends with it) */}
            {full && !fullBlocked ? thenYouApply : null}
          </View>
        </Animated.View>
      </ScrollView>

      {showBar ? (
        <StickyBar insetBottom={insets.bottom}>
          {startError ? (
            <View style={{ marginBottom: 10 }}>
              <InlineError message={startError} />
            </View>
          ) : null}
          {stale ? (
            <SolidButton
              label={isStarting ? 'Starting…' : 'Run review again'}
              loading={isStarting}
              onPress={() => run('rerun')}
            />
          ) : (
            <SolidButton
              label="Back to your application"
              onPress={goBackToApplication}
            />
          )}
        </StickyBar>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-tier sections. Empty sections are omitted, except "Rules not met yet".
// ─────────────────────────────────────────────────────────────────────────────
function FullSections({
  d,
  layers,
  onRuleOpened,
  onEditStatement,
}: {
  d: FullAssessmentData;
  /** japa#237: the stack's layers, for the pill on each finding. */
  layers?: StackLayer[];
  onRuleOpened: () => void;
  onEditStatement: () => void;
}) {
  return (
    <>
      {/* Rules not met yet (refusalGrounds; judgement entries are already routed out) */}
      <SectionTitle>Rules not met yet</SectionTitle>
      <Caption>
        Fixed rules, checked against your answers and documents.
      </Caption>
      <View style={{ gap: 10 }}>
        {d.refusalGrounds.length === 0 ? (
          <CheckRow label="No rule-based issues in what you’ve given us." />
        ) : (
          d.refusalGrounds.map((g, i) => (
            // japa#308: criterionId alone isn't promised unique; add the index.
            <FindingCard
              key={`${g.criterionId}:${i}`}
              kind="rule"
              layer={<LayerPill label={layerLabel(layers, g.layerKey)} />}
              title={g.title}
              body={g.detail}
              // Slot B (#44): per-item action goes in `footer`; nothing renders yet.
            >
              <RuleQuote
                ruleRef={g.ruleRef}
                quote={g.sourceQuote}
                url={g.sourceUrl}
                onOpen={onRuleOpened}
              />
            </FindingCard>
          ))
        )}
      </View>

      {/* What an officer may ask about (credibilityFlags): its own section, no quote */}
      {d.credibilityFlags.length > 0 ? (
        <>
          <SectionTitle>What an officer may ask about</SectionTitle>
          <Caption>
            These aren’t rules you’ve failed. They’re points an officer may want
            to understand better, and you can prepare for them.
          </Caption>
          <View style={{ gap: 10 }}>
            {d.credibilityFlags.map((f, i) => (
              // japa#308: criterionId alone isn't promised unique; add the index.
              <FindingCard
                key={`${f.criterionId}:${i}`}
                kind="question"
                layer={<LayerPill label={layerLabel(layers, f.layerKey)} />}
                title={f.title}
                parts={[
                  { label: 'Why it may come up', text: f.detail },
                  { label: 'What would help', text: f.whatWouldHelp },
                ]}
              />
            ))}
          </View>
        </>
      ) : null}

      {/* In your statement */}
      {d.statementFindings.length > 0 ? (
        <>
          <SectionTitle>In your statement</SectionTitle>
          <View style={{ gap: 10 }}>
            {d.statementFindings.map((s, i) => (
              // Several findings can share a criterion, so the key carries the index.
              <FindingCard
                key={`${s.criterionId}:${i}`}
                kind="statement"
                layer={<LayerPill label={layerLabel(layers, s.layerKey)} />}
                title={s.title}
                body={s.comment || s.detail}
              />
            ))}
          </View>
          <OutlineButton
            label="Edit statement"
            onPress={onEditStatement}
            style={{ marginTop: 12 }}
          />
        </>
      ) : null}

      {/* What we couldn't tell: only what the applicant can act on (japa#308) */}
      <CouldntTell items={d.insufficientInformation} layers={layers} />

      {/* What you've got */}
      {d.strengths.length > 0 ? (
        <>
          <SectionTitle>What you’ve got</SectionTitle>
          <View style={{ gap: 9 }}>
            {/* japa#308: criterionId alone isn't promised unique; add the index. */}
            {d.strengths.map((s, i) => (
              <CheckRow key={`${s.criterionId}:${i}`} label={s.title} />
            ))}
          </View>
        </>
      ) : null}

      {/* What to do next: built in the app from which sections are non-empty */}
      <SectionTitle>What to do next</SectionTitle>
      <Card>
        {nextSteps(d).map((s, i) => (
          <Text
            key={s}
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: EX.color.ink2,
              marginTop: i ? 8 : 0,
            }}
          >
            {i + 1}. {s}
          </Text>
        ))}
      </Card>
    </>
  );
}
