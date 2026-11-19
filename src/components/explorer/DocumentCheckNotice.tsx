// ─────────────────────────────────────────────────────────────────────────────
// DocumentCheckNotice (issue #115) — what a checklist item shows about the
// document the applicant uploaded for it.
//
// The check is decided on the server, in code, against the published rule the
// item cites. This component only RENDERS the result:
//
//   free applicant      an upgrade prompt (the upload itself still succeeded)
//   loading             coral spinner
//   error / offline     the document is uploaded; the check is unavailable
//                       until reconnected (InlineError + try again)
//   pending             "Checking…" with a spinner; the screen polls
//   done                the five checks: right type, readable, in date, right
//                       name, covers the period. A fix names what to change in
//                       the applicant's terms. Not-applicable checks are shown
//                       as such, never as passed
//   could not check     a plain reason, "Try again", and "Keep this document
//                       anyway"
//   not checked         a small "Check this document" action
//
// Every result carries the rule's own quote and a link to the official page.
// The wording is about the DOCUMENT; nothing here says how the application will
// be decided. Generic: no destination, route or document is named here.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import { UpgradeLink } from '@/components/explorer/UpgradePrompt';
import { EX } from '@/components/explorer/theme';
import { InlineError } from '@/components/explorer/AccountForm';
import {
  CHECK_KEYS,
  CheckKey,
  CheckOutcome,
  DocumentCheck,
} from '@/types/documentCheck.type';

/** Applicant-facing name of each check. */
const CHECK_LABEL: Record<CheckKey, string> = {
  type: 'Right document',
  readable: 'Readable',
  inDate: 'In date',
  name: 'Name',
  period: 'Period covered',
};

/** Icon colours per outcome (design-system tokens / the checklist's state palette). */
const OUTCOME_STYLE: Record<CheckOutcome, { fg: string; mark: string }> = {
  pass: { fg: '#1E8E55', mark: '✓' },
  fix: { fg: '#C0453C', mark: '!' },
  could_not_tell: { fg: '#B26A14', mark: '?' },
  not_applicable: { fg: EX.color.muted, mark: '–' },
};

/** Props: the check (if any), the screen's query state, and the actions. */
export interface DocumentCheckNoticeProps {
  /** The latest check for this item's document; undefined when there is none yet. */
  check?: DocumentCheck;
  /** The checks query is on its first load. */
  loading: boolean;
  /** The checks query failed (offline or a server error) and holds no data. */
  error: boolean;
  /** The caller is on the free plan (the server sent no results). */
  upgradeRequired: boolean;
  /** Re-read the checks (after an error). */
  onReload: () => void;
  /** Run the check again for this document. */
  onRetryCheck: () => void;
  /** A retry request is in flight. */
  retrying: boolean;
}

// ── The rule behind the item: quote + official page ───────────────────────────
function RuleSource({ check }: { check: DocumentCheck }) {
  if (!check.citation) return null;
  return (
    <View
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 10,
        backgroundColor: EX.color.cream,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: EX.color.muted }}>
        The rule
      </Text>
      <Text
        style={{
          fontSize: 12.5,
          lineHeight: 18,
          color: EX.color.ink,
          fontStyle: 'italic',
          marginTop: 2,
        }}
      >
        “{check.citation.quote}”
      </Text>
      <Pressable
        onPress={() => Linking.openURL(check.citation!.url)}
        style={{ marginTop: 6 }}
      >
        <Text
          style={{ fontSize: 12.5, fontWeight: '700', color: EX.color.primary }}
        >
          Read the official page
        </Text>
      </Pressable>
    </View>
  );
}

// ── Small shared pieces ───────────────────────────────────────────────────────
function Box({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: EX.color.line06,
        backgroundColor: '#fff',
      }}
    >
      {children}
    </View>
  );
}

function LinkButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{ opacity: disabled ? 0.6 : 1, paddingVertical: 4 }}
    >
      <Text
        style={{ fontSize: 13, fontWeight: '700', color: EX.color.primary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── The notice ────────────────────────────────────────────────────────────────
export function DocumentCheckNotice({
  check,
  loading,
  error,
  upgradeRequired,
  onReload,
  onRetryCheck,
  retrying,
}: DocumentCheckNoticeProps) {
  // "Keep this document anyway": a local, per-screen choice. It only hides the
  // notice's actions; the document was never removed or rejected by the check.
  const [kept, setKept] = useState(false);

  // Free plan: an upgrade prompt instead of results. The upload still succeeded.
  if (upgradeRequired) {
    return (
      <Box>
        <Text
          style={{ fontSize: 13, lineHeight: 19, color: EX.color.inkMuted }}
        >
          Your document is uploaded. Upgrade and Seli will check it for you:
          right document, readable, in date and in the right name.
        </Text>
        <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
          <UpgradeLink />
        </View>
      </Box>
    );
  }

  // First load.
  if (loading) {
    return (
      <Box>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={EX.color.primary} size="small" />
          <Text style={{ fontSize: 13, color: EX.color.inkMuted }}>
            Looking for your document check…
          </Text>
        </View>
      </Box>
    );
  }

  // Error or offline: the document is uploaded, only the check is unavailable.
  if (error) {
    return (
      <Box>
        <InlineError message="Your document is uploaded. The check is unavailable until you're back online." />
        <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
          <LinkButton label="Try again" onPress={onReload} />
        </View>
      </Box>
    );
  }

  // No check exists for this document (for example it was uploaded before upgrading).
  if (!check || check.state === 'not_checked') {
    return (
      <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
        <LinkButton
          label="Check this document"
          onPress={onRetryCheck}
          disabled={retrying}
        />
      </View>
    );
  }

  // Running.
  if (check.state === 'pending') {
    return (
      <Box>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={EX.color.primary} size="small" />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              lineHeight: 19,
              color: EX.color.inkMuted,
            }}
          >
            Checking your document. This usually takes under a minute.
          </Text>
        </View>
      </Box>
    );
  }

  // Could not check: a plain reason, a retry, and the option to keep it.
  if (check.state === 'could_not_check') {
    return (
      <Box>
        <Text
          style={{ fontSize: 13.5, fontWeight: '700', color: EX.color.ink }}
        >
          We could not tell
        </Text>
        <Text
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: EX.color.inkMuted,
            marginTop: 3,
          }}
        >
          {check.reason?.message ??
            'We could not check this document. Your upload is saved.'}
        </Text>
        {kept ? (
          <Text style={{ fontSize: 12.5, color: EX.color.muted, marginTop: 6 }}>
            Kept as uploaded. Your agent can still look at it.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 6 }}>
            <LinkButton
              label={retrying ? 'Trying…' : 'Try again'}
              onPress={onRetryCheck}
              disabled={retrying}
            />
            <LinkButton
              label="Keep this document anyway"
              onPress={() => setKept(true)}
            />
          </View>
        )}
        <RuleSource check={check} />
      </Box>
    );
  }

  // Done: the five checks.
  const checks = check.checks;
  if (!checks) return null;
  const anyFix = CHECK_KEYS.some((k) => checks[k].outcome === 'fix');
  const anyUnsure = CHECK_KEYS.some(
    (k) => checks[k].outcome === 'could_not_tell',
  );
  return (
    <Box>
      <Text
        style={{
          fontSize: 13.5,
          fontWeight: '700',
          color: anyFix ? '#C0453C' : '#1E8E55',
        }}
      >
        {anyFix
          ? 'One thing to fix'
          : anyUnsure
            ? 'Looks fine so far'
            : 'This looks right'}
      </Text>
      <View style={{ marginTop: 6, gap: 6 }}>
        {CHECK_KEYS.map((k) => {
          const r = checks[k];
          const s = OUTCOME_STYLE[r.outcome];
          return (
            <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
              <Text
                style={{
                  width: 14,
                  fontSize: 13,
                  fontWeight: '800',
                  color: s.fg,
                }}
              >
                {s.mark}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  {CHECK_LABEL[k]}
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    lineHeight: 18,
                    color: EX.color.inkMuted,
                  }}
                >
                  {r.outcome === 'not_applicable'
                    ? 'Not applicable to this document.'
                    : r.message}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {anyFix || anyUnsure ? (
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <LinkButton
            label={retrying ? 'Checking…' : 'Check again'}
            onPress={onRetryCheck}
            disabled={retrying}
          />
        </View>
      ) : null}
      <RuleSource check={check} />
    </Box>
  );
}
