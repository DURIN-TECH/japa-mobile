// ─────────────────────────────────────────────────────────────────────────────
// What you already hold (japa#234) — nationalities, where you live, and the
// visas / permits you already have. Reached from Settings → About you.
//
// Every change saves AT ONCE (no save button) and waits for the server before
// the list changes: nothing is shown as saved that isn't. The control that
// triggered a save shows its own spinner; every other control is disabled while
// one save runs, so two quick taps can't race (the API replaces whole fields).
//
// Three data states for the documents section, read differently on purpose
// because the rules treat them differently:
//   heldDocuments === null → never stated   (Add / "I don't hold any")
//   heldDocuments === []   → said they hold none
//   list                   → rows, valid first then expired
//
// Offline: cached data stays visible, an offline line shows, and every add /
// remove / change control drops to 60% and is disabled. Viewing still works.
// Analytics: event names only, never a country or document value.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import {
  BackHeader,
  InfoNote,
  InlineError,
} from '@/components/explorer/AccountForm';
import {
  Card,
  Flag,
  IconChip,
  SectionTitle,
} from '@/components/explorer/primitives';
import {
  CoralButton,
  OutlineButton,
  StateEmpty,
  StateError,
  StateLoading,
  queryState,
} from '@/components/explorer/states';
import {
  Caption,
  ExpiredPill,
  HoldingRow,
  RemoveButton,
  TextLink,
  useCountryNames,
} from '@/components/explorer/HoldingsParts';
import {
  HOLDINGS_COPY as C,
  KIND_COPY,
  MAX_DOCUMENTS,
  MAX_NATIONALITIES,
  documentSubline,
  documentTitle,
  documentsState,
  isNotFound,
  saveErrorMessage,
  sortDocuments,
  withoutNationality,
} from '@/components/explorer/holdingsLogic';
import {
  HOLDINGS_KEY,
  useHoldings,
  useRemoveHeldDocument,
  useSaveHoldings,
} from '@/hooks/useHoldings';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { useIsOffline } from '@/utils/networkStatus';
import { analyticsService } from '@/services/analytics.service';
import type { HeldDocumentKind, HeldDocumentView } from '@/types/holdings.type';

// Leading icon per document kind (spec: docs / home / pin).
const KIND_ICON: Record<HeldDocumentKind, React.ElementType> = {
  visa: Ic.docs,
  residence_permit: Ic.home,
  travel_authorisation: Ic.pin,
};

export default function HoldingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const offline = useIsOffline();

  const holdingsQ = useHoldings();
  const state = queryState(holdingsQ);
  const view = holdingsQ.data;
  const { nameOf } = useCountryNames();

  const save = useSaveHoldings();
  const remove = useRemoveHeldDocument();

  // Which control is mid-save ('nat:NG' | 'live' | 'none' | 'doc:<id>'), and the
  // last save error (cleared by the next action).
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Everything that would write is off while one save runs or we are offline.
  const locked = !!busyKey || offline;

  // A change made on a sheet (add / pick) shows up when we come back.
  useRefetchOnFocus(holdingsQ.refetch);

  useEffect(() => {
    analyticsService.trackHoldingsEvent('holdings_viewed');
  }, []);

  /** Run one write: spinner on its control, plain-words error on failure. */
  const run = async (
    key: string,
    work: () => Promise<unknown>,
    ctx: 'nationalities' | 'other',
    event?: Parameters<typeof analyticsService.trackHoldingsEvent>[0],
  ) => {
    setError(null);
    setBusyKey(key);
    try {
      await work();
      if (event) analyticsService.trackHoldingsEvent(event);
    } catch (e) {
      // Remove of something already gone: not an error, just refetch.
      if (key.startsWith('doc:') && isNotFound(e)) {
        qc.invalidateQueries({ queryKey: HOLDINGS_KEY });
      } else {
        setError(saveErrorMessage(e, ctx));
      }
    } finally {
      setBusyKey(null);
    }
  };

  const removeNationality = (code: string) =>
    run(
      `nat:${code}`,
      () =>
        save.mutateAsync({
          // The API replaces the whole list, so send the full one.
          nationalities: withoutNationality(view?.nationalities ?? [], code),
        }),
      'nationalities',
    );

  const declareNone = () =>
    run(
      'none',
      () => save.mutateAsync({ heldDocuments: [] }),
      'other',
      'holdings_none_declared',
    );

  /** Removing asks first: documents carry dates and notes. */
  const confirmRemoveDocument = (doc: HeldDocumentView) => {
    const issuer = nameOf(doc.issuerCountryCode);
    const body = `${documentTitle(doc.kind, issuer)}. You can add it again later.`;
    Alert.alert(C.removeTitle, body, [
      { text: C.removeKeep, style: 'cancel' },
      {
        text: C.removeConfirm,
        style: 'destructive',
        onPress: () =>
          run(
            `doc:${doc.id}`,
            () => remove.mutateAsync(doc.id),
            'other',
            'holdings_document_removed',
          ),
      },
    ]);
  };

  const openPicker = (mode: 'add-nationality' | 'residence') =>
    router.push({ pathname: '/holdings/pick-country', params: { mode } });
  const openAddDocument = () => router.push('/holdings/add-document');

  const docs = useMemo(
    () => sortDocuments(view?.heldDocuments ?? []),
    [view?.heldDocuments],
  );
  const anyExpired = docs.some((d) => d.expired);
  const nationalities = view?.nationalities ?? [];
  const residence = view?.residentialCountry ?? null;
  const docsState = documentsState(view?.heldDocuments);

  // Disabled look for the section buttons (the shared buttons have no prop).
  const lockStyle = { opacity: locked ? 0.6 : 1 };
  const guard = (fn: () => void) => () => {
    if (!locked) fn();
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <BackHeader
        title={C.screenTitle}
        insets={insets}
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 12,
          // No sticky bar here, so 40 plus the home indicator.
          paddingBottom: 40 + insets.bottom,
        }}
      >
        {/* Privacy promise (decision 6). Stays in every state. */}
        <InfoNote>
          {C.intro} {C.privacy}
        </InfoNote>

        {/* Offline line first, else the last save error. */}
        {offline && state !== 'error' ? (
          <View style={{ marginTop: 12 }}>
            <InlineError message={C.offline} />
          </View>
        ) : error ? (
          <View style={{ marginTop: 12 }}>
            <InlineError message={error} />
          </View>
        ) : null}

        {state === 'loading' ? (
          <StateLoading section />
        ) : state === 'error' || !view ? (
          // Offline with nothing cached reads as the offline sentence.
          <StateError
            section
            message={offline ? C.offline : C.loadError}
            onRetry={() => holdingsQ.refetch()}
            retrying={holdingsQ.isRefetching}
            style={{ marginTop: 16 }}
          />
        ) : (
          <>
            {/* ── 2a. Nationalities ──────────────────────────────────────── */}
            <SectionTitle>{C.natTitle}</SectionTitle>
            <Card padded={false}>
              {nationalities.length === 0 ? (
                <StateEmpty
                  section
                  icon={Ic.globe}
                  title={C.natEmptyTitle}
                  body={C.natEmptyBody}
                  action={{
                    label: C.natAdd,
                    onPress: guard(() => openPicker('add-nationality')),
                  }}
                  style={lockStyle}
                />
              ) : (
                <>
                  {nationalities.map((code, i) => {
                    const name = nameOf(code);
                    return (
                      <HoldingRow
                        key={code}
                        divider={i > 0}
                        leading={<Flag code={code.toLowerCase()} size={28} />}
                        title={name ?? ''}
                        trailing={
                          <RemoveButton
                            label={`Remove ${name ?? 'nationality'}`}
                            busy={busyKey === `nat:${code}`}
                            disabled={locked}
                            onPress={() => removeNationality(code)}
                          />
                        }
                      />
                    );
                  })}
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: EX.color.line06,
                      paddingHorizontal: 16,
                    }}
                  >
                    {nationalities.length >= MAX_NATIONALITIES ? (
                      <Caption style={{ paddingVertical: 14 }}>
                        {C.natMax}
                      </Caption>
                    ) : (
                      <TextLink
                        icon={Ic.plus}
                        label={C.natAdd}
                        disabled={locked}
                        onPress={() => openPicker('add-nationality')}
                      />
                    )}
                  </View>
                </>
              )}
            </Card>

            {/* ── 2b. Where you live ─────────────────────────────────────── */}
            <SectionTitle>{C.liveTitle}</SectionTitle>
            <Card padded={false}>
              {residence ? (
                <HoldingRow
                  paddingV={10}
                  leading={<Flag code={residence.toLowerCase()} size={28} />}
                  title={nameOf(residence) ?? ''}
                  onPress={() => openPicker('residence')}
                  disabled={locked}
                  trailing={
                    <View
                      style={{ paddingRight: 12, opacity: locked ? 0.6 : 1 }}
                    >
                      <Text
                        style={{
                          fontSize: 13.5,
                          fontWeight: '600',
                          color: EX.color.primaryDark,
                        }}
                      >
                        {C.liveChange}
                      </Text>
                    </View>
                  }
                />
              ) : (
                <StateEmpty
                  section
                  icon={Ic.pin}
                  title={C.liveEmptyTitle}
                  action={{
                    label: C.liveAdd,
                    onPress: guard(() => openPicker('residence')),
                  }}
                  style={lockStyle}
                />
              )}
            </Card>

            {/* ── 2c. Visas and permits ──────────────────────────────────── */}
            <SectionTitle>{C.docsTitle}</SectionTitle>
            <Card padded={false}>
              {docsState === 'unstated' ? (
                // Never stated: the screen's one coral CTA + "I don't hold any".
                <View style={[{ alignItems: 'center' }, lockStyle]}>
                  <StateEmpty
                    section
                    icon={Ic.docs}
                    title={C.docsUnstatedTitle}
                    body={C.docsUnstatedBody}
                    style={{ paddingBottom: 4 }}
                  />
                  <View
                    style={{
                      gap: 10,
                      paddingBottom: 20,
                      alignSelf: 'stretch',
                      paddingHorizontal: 20,
                    }}
                  >
                    <CoralButton
                      label={C.docsAdd}
                      onPress={guard(openAddDocument)}
                    />
                    <OutlineButton
                      label={busyKey === 'none' ? 'Saving…' : C.docsNone}
                      disabled={locked}
                      onPress={declareNone}
                    />
                  </View>
                </View>
              ) : docsState === 'none' ? (
                // Said they hold none: a different message from "never stated".
                <StateEmpty
                  section
                  icon={Ic.check2}
                  title={C.docsNoneTitle}
                  action={{ label: C.docsAdd, onPress: guard(openAddDocument) }}
                  style={lockStyle}
                />
              ) : (
                <>
                  {docs.map((doc, i) => {
                    const issuer = nameOf(doc.issuerCountryCode);
                    const KindIcon = KIND_ICON[doc.kind] ?? Ic.docs;
                    return (
                      <HoldingRow
                        key={doc.id}
                        divider={i > 0}
                        paddingV={15}
                        leading={
                          <IconChip
                            icon={KindIcon}
                            size={36}
                            radius={11}
                            iconSize={19}
                          />
                        }
                        title={documentTitle(doc.kind, issuer)}
                        sub={documentSubline(doc)}
                        subColor={doc.expired ? '#C0453C' : EX.color.inkMuted}
                        note={doc.note}
                        trailing={
                          <View style={{ alignItems: 'flex-end' }}>
                            {doc.expired ? (
                              // Pair is the system's error pair; the word says it too.
                              <View style={{ paddingRight: 8 }}>
                                <ExpiredPill />
                              </View>
                            ) : null}
                            <RemoveButton
                              label={`Remove ${KIND_COPY[doc.kind]?.label ?? 'document'}`}
                              busy={busyKey === `doc:${doc.id}`}
                              disabled={locked}
                              onPress={() => confirmRemoveDocument(doc)}
                            />
                          </View>
                        }
                      />
                    );
                  })}
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: EX.color.line06,
                      paddingHorizontal: 16,
                    }}
                  >
                    {docs.length >= MAX_DOCUMENTS ? (
                      <Caption style={{ paddingVertical: 14 }}>
                        {C.docsMax}
                      </Caption>
                    ) : (
                      <TextLink
                        icon={Ic.plus}
                        label={C.docsAdd}
                        disabled={locked}
                        onPress={openAddDocument}
                      />
                    )}
                  </View>
                </>
              )}
            </Card>
            {anyExpired ? (
              <Caption style={{ marginTop: 10 }}>{C.expiredCaption}</Caption>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
