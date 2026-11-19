// ─────────────────────────────────────────────────────────────────────────────
// "Do I need a visa?" card (japa#237, P8b) — first section of the destination
// page. Reads the person's holdings, asks GET /entry-requirements, and shows
// the answer WITH its official sources. Never a bare yes or no, never a guess.
//
//   • free for everyone signed in: no plan gate, no upgrade prompt
//   • visa-free / on-arrival / transit-free / authorisation answers do NOT
//     offer to start an application: the card links to the official page and
//     tells the page to hide its Start bar (`onHideStartBar`)
//   • unknown answers say so plainly and link the destination's own page
//   • offline: the last saved answer for the same inputs, with its age
//   • no nationality on file: the endpoint is not called; the card asks for it
//
// Everything shown that names a country, a rule or a source is API data. The
// chrome strings and the logic live in `entryRequirementsLogic.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Card, IconChip, SectionTitle } from '@/components/explorer/primitives';
import { PressableStatic } from '@/components/explorer/PressableStatic';
import { InfoNote, InlineError } from '@/components/explorer/AccountForm';
import {
  OutlineButton,
  StateError,
  StateLoading,
} from '@/components/explorer/states';
import { TextLink, useCountryNames } from '@/components/explorer/HoldingsParts';
import { RuleQuote } from '@/components/explorer/review/ReviewParts';
import { useHoldings } from '@/hooks/useHoldings';
import {
  isRateLimited,
  useEntryRequirements,
} from '@/hooks/useEntryRequirements';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { analyticsService } from '@/services/analytics.service';
import {
  NEED_VISA_COPY as C,
  PURPOSE_OPTIONS,
  STALE_EXTRA,
  buildEntryQuery,
  nextStepFor,
  outcomeHeadline,
  outcomeIcon,
  outcomeShort,
  parseStayDays,
  sourceAge,
  startBarHidden,
  unknownHeadline,
  unknownOpensDetails,
} from '@/components/explorer/entryRequirementsLogic';
import type {
  EntryAnswer,
  EntryPurpose,
  EntryResult,
  EntrySource,
  EntryUnknown,
} from '@/types/entry-requirements.type';
import type { HoldingsView } from '@/types/holdings.type';

// ── Small pieces ─────────────────────────────────────────────────────────────

/** Opens an official page and counts the tap (name only). */
function openOfficial(url: string) {
  void analyticsService.trackNeedAVisaEvent('need_a_visa_official_link_opened');
  Linking.openURL(url).catch(() => undefined);
}

/** "Source" link: coral-dark text, external-link icon, 44px touch height. */
function SourceLink({ url }: { url: string }) {
  return (
    <PressableStatic
      accessibilityRole="link"
      accessibilityLabel="Source, opens in browser"
      onPress={() => openOfficial(url)}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        minHeight: 44,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: '600',
          color: EX.color.primaryDark,
        }}
      >
        {C.source}
      </Text>
      <Ic.arrowUR size={14} color={EX.color.primaryDark} strokeWidth={2} />
    </PressableStatic>
  );
}

/** A filter chip: ink fill when selected, 44px tall. */
function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableStatic
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: EX.radius.pill,
        backgroundColor: selected ? EX.color.ink : EX.color.cardWhite,
        borderWidth: 1,
        borderColor: selected ? EX.color.ink : EX.color.line16,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: selected ? '#fff' : EX.color.ink,
        }}
      >
        {label}
      </Text>
    </PressableStatic>
  );
}

/** One official source: the quote (4 lines, then "Read more"), link, age. */
function SourceBlock({ source }: { source: EntrySource }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const age = sourceAge(source.fetchedAt);
  return (
    <View style={{ marginTop: 10 }}>
      {/* Quote: same look as RuleQuote (cream, hairline), but truncating. */}
      <View
        style={{
          backgroundColor: EX.color.cream,
          borderWidth: 1,
          borderColor: EX.color.line08,
          borderRadius: EX.radius.chip,
          padding: 12,
        }}
      >
        <Text
          style={{ fontSize: 13, lineHeight: 19, color: EX.color.ink2 }}
          numberOfLines={open ? undefined : 4}
          onTextLayout={(e) => setLong(e.nativeEvent.lines.length > 4)}
        >
          {`“${source.quote}”`}
        </Text>
        {long || open ? (
          <TextLink
            label={open ? C.hideWording : C.readMore}
            onPress={() => setOpen((v) => !v)}
            size={13.5}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SourceLink url={source.url} />
        {age ? (
          <Text style={{ fontSize: 12.5, color: EX.color.inkMuted }}>
            {C.checked(age)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Body text in ink-2. */
function Body({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 14.5,
        lineHeight: 21,
        color: EX.color.ink2,
        marginTop: 10,
      }}
    >
      {children}
    </Text>
  );
}

/** Headline row: IconChip + headline (header role) + optional sub line. */
function Headline({
  icon,
  title,
  sub,
  muted = false,
}: {
  icon: React.ElementType;
  title: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconChip icon={icon} color={muted ? EX.color.muted : EX.color.primary} />
      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: EX.color.ink,
            letterSpacing: -0.18,
          }}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            style={{ fontSize: 13.5, color: EX.color.inkMuted, marginTop: 2 }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** A row asking for something missing, with a coral "Add". */
function NeedRow({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
      }}
    >
      <IconChip icon={Ic.user} size={34} />
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: EX.color.ink,
        }}
      >
        {label}
      </Text>
      <TextLink label={C.add} icon={Ic.plus} onPress={onAdd} />
    </View>
  );
}

// ── The answer ───────────────────────────────────────────────────────────────

function AnswerBody({
  a,
  onSomethingElse,
}: {
  a: EntryAnswer;
  onSomethingElse: () => void;
}) {
  const step = nextStepFor(a.outcome, a.disagree);
  const Icon = Ic[outcomeIcon(a.outcome)];
  const authName = a.authorisation?.name ?? null;
  return (
    <>
      {a.disagree ? (
        <>
          <Headline icon={Ic.help} title={C.disagreeHeadline} />
          <Body>{a.message}</Body>
          <View style={{ marginTop: 12 }}>
            <InfoNote>{C.disagreeNote}</InfoNote>
          </View>
        </>
      ) : (
        <>
          <Headline
            icon={Icon}
            title={outcomeHeadline(a.outcome)}
            sub={a.outcome === 'travel_authorisation' ? C.notAVisa : undefined}
          />
          {/* The authorisation's own name, exactly as the source writes it. */}
          {a.outcome === 'travel_authorisation' && authName ? (
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: EX.color.ink,
                marginTop: 10,
              }}
            >
              {authName}
            </Text>
          ) : null}
          <Body>{a.message}</Body>
        </>
      )}

      {/* Stay */}
      {a.stay ? (
        <Body>
          {a.stay.periodDays
            ? `You can stay up to ${a.stay.maxDays} days in any ${a.stay.periodDays} days.`
            : `You can stay up to ${a.stay.maxDays} days.`}
        </Body>
      ) : null}

      {/* Conditions (the verbatim wording is folded away) */}
      {a.conditions.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.inkMuted,
            }}
          >
            {C.conditions}
          </Text>
          {a.conditions.map((c, i) => (
            <ConditionRow key={i} text={c.text} quote={c.quote} />
          ))}
        </View>
      ) : null}

      {/* Why an authorisation isn't a visa (the source's own words) */}
      {a.authorisation?.notAVisa ? (
        <View style={{ marginTop: 14 }}>
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.inkMuted,
            }}
          >
            {C.whyNotVisa}
          </Text>
          <RuleQuote
            ruleRef={null}
            quote={a.authorisation.notAVisa.quote}
            url=""
          />
          <SourceLink url={a.authorisation.notAVisa.url} />
        </View>
      ) : null}

      {/* Sources: every one that backs the answer */}
      {a.sources.map((s, i) => (
        <SourceBlock key={`${s.url}-${i}`} source={s} />
      ))}

      {/* "This could change if" */}
      {a.mightAlsoApply.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text
            style={{ fontSize: 15, fontWeight: '700', color: EX.color.ink }}
          >
            {C.couldChange}
          </Text>
          {a.mightAlsoApply.map((m) => (
            <View key={m.ruleId} style={{ marginTop: 8 }}>
              <Text
                style={{ fontSize: 15, fontWeight: '600', color: EX.color.ink }}
              >
                {m.needs}
              </Text>
              <Text style={{ fontSize: 13.5, color: EX.color.inkMuted }}>
                {outcomeShort(m.outcome)}
              </Text>
              <SourceLink url={m.source.url} />
            </View>
          ))}
        </View>
      ) : null}

      {/* Next step */}
      {step === 'authorisation' && a.authorisation ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          <OutlineButton
            label={C.applyOfficial}
            onPress={() => openOfficial(a.authorisation!.applyUrl)}
          />
          <Text style={{ fontSize: 13.5, color: EX.color.inkMuted }}>
            {C.seliNotApplying}
          </Text>
        </View>
      ) : null}
      {step === 'official' && a.sources[0] ? (
        <View style={{ marginTop: 14 }}>
          <OutlineButton
            label={C.readOfficial}
            onPress={() => openOfficial(a.sources[0].url)}
          />
        </View>
      ) : null}
      {step === 'authorisation' || step === 'official' ? (
        <TextLink
          label={C.somethingElse}
          onPress={onSomethingElse}
          size={13.5}
        />
      ) : null}
    </>
  );
}

/** One condition: bullet text, with the verbatim wording folded behind a row. */
function ConditionRow({ text, quote }: { text: string; quote?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 6 }}>
      <Text
        style={{ fontSize: 14, lineHeight: 20, color: EX.color.ink2 }}
      >{`•  ${text}`}</Text>
      {quote ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((v) => !v)}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: '600',
                color: EX.color.primaryDark,
              }}
            >
              {C.seeWording}
            </Text>
          </Pressable>
          {open ? <RuleQuote ruleRef={null} quote={quote} url="" /> : null}
        </>
      ) : null}
    </View>
  );
}

// ── The unknown answer ───────────────────────────────────────────────────────

function UnknownBody({
  u,
  holdings,
  onAdd,
}: {
  u: EntryUnknown;
  holdings: HoldingsView;
  onAdd: () => void;
}) {
  // The backend's `needs` is plain words, not keys, so the "Add" rows come from
  // what is missing in the person's own holdings.
  const gaps: Array<{ key: string; label: string }> = [];
  if (u.code === 'missing_fact') {
    if (!holdings.residentialCountry)
      gaps.push({ key: 'res', label: C.needResidence });
    if (holdings.heldDocuments === null)
      gaps.push({ key: 'holds', label: C.needHolds });
  }
  return (
    <>
      <Headline icon={Ic.help} muted title={unknownHeadline(u.code)} />
      {u.reason ? <Body>{u.reason}</Body> : null}
      {u.code === 'stale' ? <Body>{STALE_EXTRA}</Body> : null}
      {gaps.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.inkMuted,
            }}
          >
            {C.weNeed}
          </Text>
          {gaps.map((g) => (
            <NeedRow key={g.key} label={g.label} onAdd={onAdd} />
          ))}
        </View>
      ) : null}
      {u.destinationAuthorityPage ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          <OutlineButton
            label={C.openOfficial}
            onPress={() => openOfficial(u.destinationAuthorityPage!)}
          />
          <Text style={{ fontSize: 13.5, color: EX.color.inkMuted }}>
            {C.authorityNote}
          </Text>
        </View>
      ) : null}
    </>
  );
}

// ── The card ─────────────────────────────────────────────────────────────────

export function NeedAVisaCard({
  destinationCode,
  onHideStartBar,
}: {
  /** The destination page's country code. */
  destinationCode: string;
  /** Tells the page to hide (or show) its Start bar for the shown answer. */
  onHideStartBar: (hidden: boolean) => void;
}) {
  const router = useRouter();
  const holdingsQ = useHoldings();
  const { nameOf } = useCountryNames();
  useRefetchOnFocus(holdingsQ.refetch); // back from /holdings: re-ask with new facts

  const holdings = holdingsQ.data;
  const nationalities = holdings?.nationalities ?? [];

  // Which passport (first by default; kept in screen state).
  const [pickedNat, setPickedNat] = useState<string | null>(null);
  const nationality =
    pickedNat && nationalities.includes(pickedNat)
      ? pickedNat
      : (nationalities[0] ?? null);

  // Optional travel details (collapsed until asked for).
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [purpose, setPurpose] = useState<EntryPurpose | null>(null);
  const [daysText, setDaysText] = useState('');
  const [stayDays, setStayDays] = useState<number | undefined>();
  // Debounce the days field so typing "30" doesn't ask for "3" first.
  useEffect(() => {
    const t = setTimeout(() => setStayDays(parseStayDays(daysText)), 600);
    return () => clearTimeout(t);
  }, [daysText]);

  const query = useMemo(
    () =>
      holdings
        ? buildEntryQuery({
            destination: destinationCode,
            nationality,
            holdings,
            purpose,
            stayDays,
          })
        : null,
    [holdings, destinationCode, nationality, purpose, stayDays],
  );
  const er = useEntryRequirements(query);

  // What is on screen: this session's answer, or (offline) the saved one.
  const shown: EntryResult | null = er.offline
    ? (er.saved?.result ?? null)
    : er.result;

  // Tell the page whether to hide its Start bar. Shown again if the card goes.
  const hide = startBarHidden(shown);
  useEffect(() => {
    onHideStartBar(hide);
    return () => onHideStartBar(false);
  }, [hide, onHideStartBar]);

  // Open the travel details when the answer needs them.
  useEffect(() => {
    if (shown?.status !== 'unknown') return;
    if (
      unknownOpensDetails(shown.code) ||
      (shown.code === 'missing_fact' && !purpose && !stayDays)
    ) {
      setDetailsOpen(true);
    }
  }, [shown, purpose, stayDays]);

  // Announce a changed answer once (not the first one), and count it (no props).
  const headlineText =
    shown?.status === 'answer'
      ? shown.disagree
        ? C.disagreeHeadline
        : outcomeHeadline(shown.outcome)
      : shown
        ? unknownHeadline(shown.code)
        : null;
  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    if (!headlineText || !shown) return;
    if (lastAnnounced.current === null) {
      void analyticsService.trackNeedAVisaEvent(
        shown.status === 'answer'
          ? 'need_a_visa_answered'
          : 'need_a_visa_unknown',
      );
    } else if (lastAnnounced.current !== headlineText) {
      AccessibilityInfo.announceForAccessibility(headlineText);
    }
    lastAnnounced.current = headlineText;
  }, [headlineText, shown]);

  const goHoldings = () => {
    void analyticsService.trackNeedAVisaEvent('need_a_visa_holdings_opened');
    router.push('/holdings');
  };
  const openDetails = () => {
    void analyticsService.trackNeedAVisaEvent('need_a_visa_details_opened');
    setDetailsOpen(true);
  };

  // ── Which body ─────────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (!holdings) {
    body = holdingsQ.isError ? (
      <StateError
        section
        message={C.fetchError}
        onRetry={() => void holdingsQ.refetch()}
        retrying={holdingsQ.isFetching}
      />
    ) : (
      <StateLoading section />
    );
  } else if (!nationality) {
    // No passport on file: don't ask the backend; ask the person.
    body = (
      <>
        <Headline
          icon={Ic.help}
          muted
          title="We need a little more to answer this"
        />
        <View style={{ marginTop: 14 }}>
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '600',
              color: EX.color.inkMuted,
            }}
          >
            {C.weNeed}
          </Text>
          <NeedRow label={C.needNationality} onAdd={goHoldings} />
        </View>
      </>
    );
  } else if (er.offline && !shown) {
    body = <InlineError message={C.offlineNothing} />;
  } else if (!shown && er.isLoading) {
    body = <StateLoading section />;
  } else if (!shown && er.isError) {
    body = (
      <StateError
        section
        message={isRateLimited(er.error) ? C.rateLimited : C.fetchError}
        onRetry={() => void er.refetch()}
        retrying={er.isRefetching}
      />
    );
  } else if (shown) {
    body = (
      <>
        {er.offline && er.saved ? (
          <View style={{ marginBottom: 12 }}>
            <InfoNote>
              {C.offlineSaved(sourceAge(er.saved.savedAt) || 'earlier')}
            </InfoNote>
          </View>
        ) : null}
        {shown.status === 'answer' ? (
          <AnswerBody a={shown} onSomethingElse={openDetails} />
        ) : (
          <UnknownBody u={shown} holdings={holdings} onAdd={goHoldings} />
        )}
      </>
    );
  } else {
    body = <StateLoading section />;
  }

  // ── "For you" line, passports, details ─────────────────────────────────────
  const natName = nameOf(nationality);
  const resName = nameOf(holdings?.residentialCountry);
  const forYou = natName
    ? resName
      ? C.forPassportLiving(natName, resName)
      : C.forPassport(natName)
    : null;

  return (
    <View>
      <SectionTitle>{C.section}</SectionTitle>
      <Card style={{ padding: 16 }}>
        {holdings && nationality ? (
          <View style={{ marginBottom: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              {forYou ? (
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    lineHeight: 19,
                    color: EX.color.inkMuted,
                  }}
                >
                  {forYou}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <TextLink label={C.change} onPress={goHoldings} size={13.5} />
            </View>

            {nationalities.length > 1 ? (
              <View style={{ marginTop: 6 }}>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                    marginBottom: 6,
                  }}
                >
                  {C.whichPassport}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {nationalities.map((code) => (
                    <FilterChip
                      key={code}
                      label={nameOf(code) ?? ''}
                      selected={code === nationality}
                      onPress={() => setPickedNat(code)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Optional travel details: collapsed into one link. */}
            {detailsOpen ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                  }}
                >
                  {C.daysLabel}
                </Text>
                <TextInput
                  value={daysText}
                  onChangeText={(t) =>
                    setDaysText(t.replace(/[^0-9]/g, '').slice(0, 4))
                  }
                  keyboardType="number-pad"
                  accessibilityLabel={C.daysLabel}
                  placeholderTextColor={EX.color.muted}
                  placeholder="30"
                  editable={!er.offline}
                  style={{
                    minHeight: 48,
                    borderRadius: EX.radius.cardSm,
                    borderWidth: 1,
                    borderColor: EX.color.line16,
                    paddingHorizontal: 14,
                    fontSize: 15,
                    color: EX.color.ink,
                    backgroundColor: EX.color.cardWhite,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: EX.color.inkMuted,
                  }}
                >
                  {C.purposeLabel}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {PURPOSE_OPTIONS.map((p) => (
                    <FilterChip
                      key={p.value}
                      label={p.label}
                      selected={purpose === p.value}
                      onPress={() =>
                        setPurpose(purpose === p.value ? null : p.value)
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : (
              <TextLink
                label={C.detailsLink}
                onPress={openDetails}
                size={13.5}
              />
            )}
          </View>
        ) : null}
        {body}
      </Card>
    </View>
  );
}
