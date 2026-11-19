// ─────────────────────────────────────────────────────────────────────────────
// Country picker sheet (japa#234) — slides up from the holdings screen (and from
// the add-document sheet for the issuer). One list, three modes:
//
//   add-nationality  already-added countries are checked + disabled ("Added").
//                    Tap a free row → PUT the full list (existing + new) → close.
//   residence        single select, checks the current one. Tap saves
//                    `residentialCountry` and closes. "Clear" (only when a value
//                    exists) sends residentialCountry: null.
//   issuer           single select; hands the choice back to the add-document
//                    sheet through a tiny store and closes. Saves nothing.
//
// A save failure keeps the sheet open with an InlineError at the top of the list.
// Offline: rows are disabled and the offline line shows.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EX } from '@/components/explorer/theme';
import {
  CountryPickerList,
  SheetFrame,
} from '@/components/explorer/HoldingsParts';
import {
  HOLDINGS_COPY as C,
  saveErrorMessage,
  withNationality,
} from '@/components/explorer/holdingsLogic';
import { useHoldings, useSaveHoldings } from '@/hooks/useHoldings';
import { useHoldingsPick } from '@/stores/holdings-pick.store';
import { useIsOffline } from '@/utils/networkStatus';
import { analyticsService } from '@/services/analytics.service';

type Mode = 'add-nationality' | 'residence' | 'issuer';

export default function PickCountrySheet() {
  const router = useRouter();
  const { mode: raw } = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode =
    raw === 'residence' || raw === 'issuer' ? raw : 'add-nationality';

  const offline = useIsOffline();
  const holdings = useHoldings().data;
  const save = useSaveHoldings();
  const setIssuer = useHoldingsPick((s) => s.setIssuer);
  const issuer = useHoldingsPick((s) => s.issuer);

  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nationalities = holdings?.nationalities ?? [];
  const residence = holdings?.residentialCountry ?? null;
  // Writes need a connection; choosing an issuer saves nothing.
  const writes = mode !== 'issuer';

  const title =
    mode === 'add-nationality'
      ? C.pickAddNationality
      : mode === 'residence'
        ? C.pickResidence
        : C.pickIssuer;

  /** Save one change, close on success, stay open with an error on failure. */
  const saveAndClose = async (
    key: string,
    patch: Parameters<typeof save.mutateAsync>[0],
    event: 'holdings_nationality_added' | 'holdings_residence_saved',
    ctx: 'nationalities' | 'other',
  ) => {
    setError(null);
    setBusyCode(key);
    try {
      await save.mutateAsync(patch);
      analyticsService.trackHoldingsEvent(event);
      router.back();
    } catch (e) {
      setError(saveErrorMessage(e, ctx));
      setBusyCode(null);
    }
  };

  const onPick = (code: string) => {
    if (mode === 'issuer') {
      setIssuer(code);
      router.back();
    } else if (mode === 'residence') {
      saveAndClose(
        code,
        { residentialCountry: code },
        'holdings_residence_saved',
        'other',
      );
    } else {
      // The API replaces the whole list: send existing + the new one.
      saveAndClose(
        code,
        { nationalities: withNationality(nationalities, code) },
        'holdings_nationality_added',
        'nationalities',
      );
    }
  };

  // "Clear" only when there is something to clear.
  const clear =
    mode === 'residence' && residence ? (
      <Pressable
        onPress={() =>
          saveAndClose(
            'clear',
            { residentialCountry: null },
            'holdings_residence_saved',
            'other',
          )
        }
        disabled={offline || !!busyCode}
        accessibilityRole="button"
        accessibilityLabel={C.pickClear}
        style={{
          minHeight: 44,
          justifyContent: 'center',
          opacity: offline ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: EX.color.primaryDark,
          }}
        >
          {C.pickClear}
        </Text>
      </Pressable>
    ) : null;

  return (
    <SheetFrame title={title} onClose={() => router.back()} headerRight={clear}>
      <CountryPickerList
        selected={
          mode === 'add-nationality'
            ? []
            : mode === 'residence'
              ? residence
                ? [residence]
                : []
              : issuer
                ? [issuer]
                : []
        }
        disabledCodes={mode === 'add-nationality' ? nationalities : []}
        disabledSub={C.pickAdded}
        busyCode={busyCode}
        disabled={writes && offline}
        errorMessage={writes && offline ? C.offline : error}
        onPick={onPick}
        contentBottom={40}
      />
    </SheetFrame>
  );
}
