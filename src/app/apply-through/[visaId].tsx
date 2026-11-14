// ─────────────────────────────────────────────────────────────────────────────
// "Which country will you apply through?" (japa#237, P8a of #228)
//
// A slide-up sheet shown when a visa belongs to a SHARED route: one
// application, sent through one of the route's countries. Route params:
//   visaId         the visa the person is on (or the application's visa)
//   code           that visa's country code (to read the visa and its route)
//   routeId        the shared route id (optional shortcut; else read from the visa)
//   mode           'start' (default) or 'change'
//   applicationId  change mode only
//
// What it shows, decided from GET|POST /shared-routes/:id/apply-through:
//   ask       the rule needs an answer first (length or purpose, in the data's
//             own words). NEVER decided for the person, no default. The list is
//             dimmed and inert until it is answered or skipped.
//   proposal  the rule's country is preselected with its quote and source; the
//             others sit under "Or pick another". Confirming is explicit: the
//             CTA names the country. A different pick gets a plain note.
//   list      no rule (or skipped): just the countries, nothing preselected.
//   unavailable  not offered yet.
//
// Nothing is saved until the CTA is pressed. Names are all data: no country,
// bloc or nationality is typed in this file.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { Flag, Card } from '@/components/explorer/primitives';
import { InfoNote, InlineError } from '@/components/explorer/AccountForm';
import { SheetFrame, TextLink } from '@/components/explorer/HoldingsParts';
import {
  StateEmpty,
  StateError,
  StateLoading,
} from '@/components/explorer/states';
import { StickyBar } from '@/components/explorer/StickyBar';
import { START_COPY } from '@/components/explorer/StartApplicationBar';
import { UpgradePrompt } from '@/components/explorer/UpgradePrompt';
import { DuplicateApplicationSheet } from '@/components/explorer/DuplicateApplicationSheet';
import { IntakeQuestionList } from '@/components/explorer/intake/IntakeQuestionList';
import {
  NumberedRow,
  RuleQuote,
  SolidButton,
} from '@/components/explorer/review/ReviewParts';
import { SourceLink } from '@/components/explorer/SharedRouteParts';
import {
  SHARED_COPY,
  answeredQuestions,
  answersWithoutFrom,
  changeCountryError,
  choiceNote,
  ctaState,
  fromPrice,
  initialSelection,
  orderedOptions,
  proposedOption,
  questionToAsk,
  sheetState,
  unknownNote,
} from '@/components/explorer/sharedRouteLogic';
import { useApplication } from '@/hooks/useApplications';
import {
  useApplyThrough,
  useChangeThroughCountry,
} from '@/hooks/useSharedRoutes';
import { useStartSharedApplication } from '@/hooks/useStartSharedApplication';
import { useVisaType } from '@/hooks/useVisaTypes';
import { useIsOffline } from '@/utils/networkStatus';
import { analyticsService } from '@/services/analytics.service';
import type { IntakeAnswer, IntakeAnswers } from '@/types/intake.type';
import type {
  ApplyThroughOption,
  ApplyThroughView,
} from '@/types/sharedRoute.type';

// ── One selectable country (radio card) ──────────────────────────────────────
function CountryOptionCard({
  option,
  selected,
  badge,
  disabled,
  onPress,
  children,
}: {
  option: ApplyThroughOption;
  selected: boolean;
  /** "Suggested" / "Current" chip beside the name. */
  badge?: string;
  disabled?: boolean;
  onPress: () => void;
  /** Extra content inside the same card (the rule's reason for the proposal). */
  children?: React.ReactNode;
}) {
  const price = fromPrice(option);
  return (
    <PressableStatic
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={`${option.countryName}${badge ? `, ${badge}` : ''}${price ? `, ${price}` : ''}`}
      style={{
        backgroundColor: selected ? EX.color.primaryTint07 : EX.color.cardWhite,
        borderRadius: EX.radius.card,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? EX.color.primary : EX.color.line10,
        padding: 14,
        minHeight: 44,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Flag code={option.countryCode.toLowerCase()} size={28} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Name on one line; the badge wraps under it on narrow screens. */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 15,
                fontWeight: '600',
                color: EX.color.ink,
              }}
            >
              {option.countryName}
            </Text>
            {badge ? (
              <View
                style={{
                  backgroundColor: EX.color.cream,
                  borderWidth: 1,
                  borderColor: EX.color.line08,
                  borderRadius: EX.radius.pill,
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: EX.color.ink2,
                  }}
                >
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          {price ? (
            <Text
              style={{ fontSize: 13.5, color: EX.color.inkMuted, marginTop: 1 }}
            >
              {price}
            </Text>
          ) : null}
        </View>
        {/* Radio dot: coral when selected */}
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 1.5,
            borderColor: selected ? EX.color.primary : EX.color.line24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View
              style={{
                width: 11,
                height: 11,
                borderRadius: 6,
                backgroundColor: EX.color.primary,
              }}
            />
          ) : null}
        </View>
      </View>
      {children}
    </PressableStatic>
  );
}

// ── Section title (`section-title` 18/700) ───────────────────────────────────
function Title({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontSize: 18,
        fontWeight: '700',
        color: EX.color.ink,
        letterSpacing: -0.18,
        marginTop: 26,
        marginBottom: 13,
      }}
    >
      {children}
    </Text>
  );
}

// ── "How the rule decides": collapsed row, steps when open ───────────────────
function RuleSteps({ view }: { view: ApplyThroughView }) {
  const [open, setOpen] = useState(false);
  if (!view.competence || view.competence.steps.length === 0) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <PressableStatic
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}>
          {SHARED_COPY.howRuleDecides}
        </Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Ic.chevR size={18} color={EX.color.muted} strokeWidth={1.8} />
        </View>
      </PressableStatic>
      {open ? (
        <View style={{ gap: 12, marginTop: 6 }}>
          {view.competence.steps.map((s, i) => (
            <View key={`${s.questionId}:${i}`}>
              <NumberedRow n={i + 1} label={s.restsOn} />
              {/* The quote word for word; the source link is ours (coral-dark). */}
              <RuleQuote ruleRef={null} quote={s.quote} url="" />
              <SourceLink url={s.url} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function ApplyThroughSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const params = useLocalSearchParams<{
    visaId: string;
    code?: string;
    routeId?: string;
    mode?: string;
    applicationId?: string;
  }>();
  const mode: 'start' | 'change' =
    params.mode === 'change' ? 'change' : 'start';
  const applicationId = params.applicationId ?? '';

  // ── Which shared route? From the param, else from the visa's own read ──────
  const visaQ = useVisaType(
    params.routeId ? '' : (params.code ?? ''),
    params.routeId ? '' : (params.visaId ?? ''),
  );
  const routeId = params.routeId ?? visaQ.data?.visaType.sharedRoute?.id;

  // ── Change mode: the country the application goes through now ──────────────
  const appQ = useApplication(mode === 'change' ? applicationId : '');
  const currentCode =
    mode === 'change'
      ? (appQ.data?.throughCountryCode ??
        appQ.data?.throughCountry?.countryCode ??
        null)
      : null;

  // ── The person's answers to the rule's question(s) ─────────────────────────
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [skipped, setSkipped] = useState(false);
  const q = useApplyThrough(routeId, answers);
  // Keep the last good view so a failed re-ask doesn't blank the sheet.
  const lastGood = useRef<ApplyThroughView | undefined>(undefined);
  if (q.data && !q.isPlaceholderData) lastGood.current = q.data;
  const view: ApplyThroughView | undefined = q.data ?? lastGood.current;
  // Round trip for an answer: the previous view is on screen, the new one is loading.
  const asking = q.isFetching && Object.keys(answers).length > 0;
  const answerFailed = q.isError && !!view && Object.keys(answers).length > 0;

  const state = view ? sheetState(view, skipped) : null;

  // ── Selection: the person's tap wins; else the proposal / current country ──
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const selectedCode = useMemo(() => {
    if (!view || !state) return null;
    const options = view.options ?? [];
    if (picked && options.some((o) => o.countryCode === picked)) return picked;
    return initialSelection(view, state, mode, currentCode);
  }, [view, state, picked, mode, currentCode]);
  const selected =
    view?.options.find((o) => o.countryCode === selectedCode) ?? null;

  // ── Starting / changing ────────────────────────────────────────────────────
  const start = useStartSharedApplication(routeId);
  const change = useChangeThroughCountry(applicationId);
  const [changeError, setChangeError] = useState<string | null>(null);

  // Viewed once, names only.
  const viewedOnce = useRef(false);
  useEffect(() => {
    if (view && !viewedOnce.current) {
      viewedOnce.current = true;
      analyticsService.trackSharedRouteEvent('apply_through_viewed');
    }
  }, [view]);

  const close = () => router.back();
  const busy = start.creating || change.isPending;

  const onPick = (code: string) => {
    if (busy) return;
    Haptics.selectionAsync().catch(() => {});
    setPicked(code);
    setChangeError(null);
    start.clearFailure();
  };

  const onAnswer = (qid: string, value: IntakeAnswer | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[qid];
      else next[qid] = value;
      return next;
    });
    // A new answer re-asks, so an earlier pick no longer stands.
    setPicked(undefined);
  };

  const onConfirm = async () => {
    if (!selected || !view) return;
    if (mode === 'change') {
      setChangeError(null);
      try {
        await change.mutateAsync(selected.countryCode);
        analyticsService.trackSharedRouteEvent('apply_through_changed');
        router.back();
      } catch (e) {
        setChangeError(changeCountryError(e));
      }
      return;
    }
    analyticsService.trackSharedRouteEvent('apply_through_confirmed');
    if (
      view.proposal?.offered &&
      view.proposal.countryCode.toUpperCase() !==
        selected.countryCode.toUpperCase()
    ) {
      analyticsService.trackSharedRouteEvent('apply_through_overrode_proposal');
    }
    // Only the answers that were asked are sent (the rule's own questions).
    start.start(selected.countryCode, answers);
  };

  // ── Title and sub ──────────────────────────────────────────────────────────
  const visaName =
    visaQ.data?.visaType.name ??
    view?.options[0]?.visaTypeName ??
    view?.sharedRoute.name ??
    '';
  const sub = visaName
    ? `${visaName} covers more than one country. You send one application, through one of them.`
    : null;

  // ── Body ───────────────────────────────────────────────────────────────────
  let body: React.ReactNode;
  const loadingRoute = !routeId && visaQ.isLoading;
  if (loadingRoute || (!view && q.isLoading)) {
    body = <StateLoading section style={{ marginTop: 12 }} />;
  } else if (!view) {
    // Nothing to show: offline, a failed load, or a visa with no shared route.
    const noRoute = !routeId && !visaQ.isLoading && !visaQ.isError;
    body = noRoute ? (
      <StateEmpty
        icon={Ic.globe}
        title={SHARED_COPY.notAvailableTitle}
        body={SHARED_COPY.notAvailableFallback}
        action={{
          label: SHARED_COPY.close,
          onPress: close,
          variant: 'outline',
        }}
      />
    ) : (
      <StateError
        section
        message={offline ? SHARED_COPY.offlineOpen : SHARED_COPY.loadError}
        onRetry={() => (routeId ? q.refetch() : visaQ.refetch())}
        retrying={q.isRefetching || visaQ.isRefetching}
        style={{ marginTop: 16 }}
      />
    );
  } else if (state === 'unavailable') {
    body = (
      <StateEmpty
        icon={Ic.globe}
        title={SHARED_COPY.notAvailableTitle}
        body={view.message?.trim() || SHARED_COPY.notAvailableFallback}
        action={{
          label: SHARED_COPY.close,
          onPress: close,
          variant: 'outline',
        }}
      />
    );
  } else {
    const options = orderedOptions(view, state!);
    const proposed = state === 'proposal' ? proposedOption(view) : null;
    const asked = state === 'ask' ? questionToAsk(view) : null;
    const done = answeredQuestions(view, answers);
    const unknown = state === 'list' ? unknownNote(view) : null;
    // In the ask state the list waits for the answer (dimmed, inert).
    const inert = state === 'ask';

    const otherOptions = proposed
      ? options.filter((o) => o !== proposed)
      : options;

    body = (
      <>
        {/* Answered questions collapse to one line each, with "Change" */}
        {done.length > 0 && state !== 'list' ? (
          <View style={{ marginTop: 16, gap: 2 }}>
            {done.map(({ question, text }) => (
              <View
                key={question.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    color: EX.color.inkMuted,
                  }}
                >
                  {`${question.label}: ${text}`}
                </Text>
                <TextLink
                  label={SHARED_COPY.change}
                  size={13.5}
                  disabled={busy || asking}
                  onPress={() => {
                    setSkipped(false);
                    setPicked(undefined);
                    setAnswers(
                      answersWithoutFrom(view.questions, answers, question.id),
                    );
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}

        {/* ── The question: asked in the data's own words, never defaulted ──── */}
        {asked ? (
          <View style={{ marginTop: 18 }}>
            <Card>
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '600',
                  color: EX.color.inkMuted,
                  marginBottom: 10,
                }}
              >
                {SHARED_COPY.oneQuestionFirst}
              </Text>
              <IntakeQuestionList
                // The question stands alone here: its own showWhen is not re-judged.
                questions={[{ ...asked, showWhen: undefined }]}
                answers={answers}
                onChange={onAnswer}
                showOpenLines={false}
                disabled={asking || busy}
              />
              {asking ? (
                <View style={{ alignItems: 'center', paddingTop: 10 }}>
                  <ActivityIndicator color={EX.color.primary} />
                </View>
              ) : null}
              <Text
                style={{
                  fontSize: 13.5,
                  color: EX.color.inkMuted,
                  marginTop: 10,
                }}
              >
                {SHARED_COPY.onlyYouCanSay}
              </Text>
            </Card>
            {answerFailed ? (
              <View style={{ marginTop: 10 }}>
                <InlineError message={SHARED_COPY.answerError} />
              </View>
            ) : null}
            <View style={{ alignItems: 'center' }}>
              <PressableStatic
                onPress={() => {
                  analyticsService.trackSharedRouteEvent(
                    'apply_through_skipped',
                  );
                  setSkipped(true);
                  setPicked(undefined);
                }}
                accessibilityRole="button"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                  }}
                >
                  {SHARED_COPY.skip}
                </Text>
              </PressableStatic>
            </View>
          </View>
        ) : null}

        {/* ── Notes for the plain list ──────────────────────────────────────── */}
        {state === 'list' ? (
          <View style={{ marginTop: 18, gap: 10 }}>
            {unknown ? <InfoNote>{unknown}</InfoNote> : null}
            <InfoNote>{SHARED_COPY.noRule}</InfoNote>
          </View>
        ) : null}

        {/* ── The countries ────────────────────────────────────────────────── */}
        <View
          // Inert until the question is answered or skipped.
          pointerEvents={inert ? 'none' : 'auto'}
          accessibilityElementsHidden={inert}
          importantForAccessibility={inert ? 'no-hide-descendants' : 'auto'}
          accessibilityRole="radiogroup"
          style={{ opacity: inert ? 0.6 : 1 }}
        >
          {proposed ? (
            <View style={{ marginTop: 18 }}>
              <CountryOptionCard
                option={proposed}
                selected={selectedCode === proposed.countryCode}
                badge={SHARED_COPY.suggested}
                disabled={busy}
                onPress={() => onPick(proposed.countryCode)}
              >
                {/* Why: the rule's own quote and its official source */}
                <View style={{ marginTop: 12 }}>
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '600',
                      color: EX.color.inkMuted,
                    }}
                  >
                    {SHARED_COPY.ruleBecause}
                  </Text>
                  {view.proposal ? (
                    <>
                      <RuleQuote
                        ruleRef={null}
                        quote={view.proposal.quote}
                        url=""
                      />
                      <SourceLink url={view.proposal.url} />
                    </>
                  ) : null}
                </View>
              </CountryOptionCard>
            </View>
          ) : null}

          <Title>
            {proposed ? SHARED_COPY.orPickAnother : SHARED_COPY.pickACountry}
          </Title>
          <View style={{ gap: 10 }}>
            {otherOptions.map((o) => (
              <CountryOptionCard
                key={o.countryCode}
                option={o}
                selected={selectedCode === o.countryCode}
                badge={
                  mode === 'change' &&
                  currentCode &&
                  currentCode.toUpperCase() === o.countryCode.toUpperCase()
                    ? SHARED_COPY.current
                    : undefined
                }
                disabled={busy}
                onPress={() => onPick(o.countryCode)}
              />
            ))}
          </View>
        </View>

        <RuleSteps view={view} />
      </>
    );
  }

  // ── The sticky CTA (absent when the route can't be offered) ────────────────
  const showCta = !!view && state !== 'unavailable';
  const cta = ctaState(mode, selected, currentCode);
  const note = view && state ? choiceNote(view, selectedCode, state) : null;

  // The start failures, as one InlineError (or the upgrade card).
  const failureText =
    start.failure === 'country'
      ? (start.failureMessage ?? SHARED_COPY.changeError)
      : start.failure && start.failure !== 'upgrade'
        ? START_COPY[start.failure]
        : null;
  const errorLine =
    offline && view ? SHARED_COPY.offlineMid : (changeError ?? failureText);

  return (
    <SheetFrame title={SHARED_COPY.sheetTitle} onClose={close}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 24,
        }}
      >
        {sub ? (
          <Text
            style={{
              fontSize: 13.5,
              lineHeight: 19,
              color: EX.color.inkMuted,
            }}
          >
            {sub}
          </Text>
        ) : null}
        {body}
      </ScrollView>

      {showCta ? (
        <StickyBar insetBottom={insets.bottom} inline>
          {start.failure === 'upgrade' ? (
            <View style={{ marginBottom: 10 }}>
              <UpgradePrompt message={START_COPY.upgrade} />
              <PressableStatic
                onPress={start.clearFailure}
                accessibilityRole="button"
                style={{
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 13.5,
                    fontWeight: '700',
                    color: EX.color.inkMuted,
                  }}
                >
                  Not now
                </Text>
              </PressableStatic>
            </View>
          ) : null}
          {note ? (
            <View accessibilityLiveRegion="polite" style={{ marginBottom: 10 }}>
              <InfoNote>{note}</InfoNote>
            </View>
          ) : null}
          {errorLine ? (
            <View accessibilityLiveRegion="polite" style={{ marginBottom: 10 }}>
              <InlineError message={errorLine} />
            </View>
          ) : null}
          <SolidButton
            label={cta.label}
            onPress={onConfirm}
            loading={busy}
            disabled={cta.disabled || offline || state === 'ask'}
          />
        </StickyBar>
      ) : null}

      {/* A live application for this visa already exists (#253). */}
      <DuplicateApplicationSheet
        duplicate={start.duplicate}
        onContinue={start.continueExisting}
        onStartNew={start.startAnyway}
        onDismiss={start.dismissDuplicate}
      />
    </SheetFrame>
  );
}
