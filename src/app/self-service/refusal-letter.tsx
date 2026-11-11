// ─────────────────────────────────────────────────────────────────────────────
// Refusal-letter analysis (backend issue #122).
//
// Reached from the self-service checklist ("Been refused before?"), with the
// application id in `?applicationId=`. A static route, so it wins over the
// dynamic `self-service/[id]`.
//
// The applicant uploads the letter through the existing document path (signed
// URL → storage → register), registered against the fixed requirement id
// `refusal-letter`, then asks the backend to read it. The backend does the
// reading and the mapping; this screen only renders what comes back:
//
//   idle → uploading → pending (polled) → one of:
//     • unreadable / not a refusal letter  (icon + one line + upload again)
//     • analysed: what the letter says (quoted), the matching published rule
//       (quote + link), anything we could not match, the reapplication
//       checklist, warnings, and the disclosure notice
//   plus: 402 upgrade panel, no-rubric note, and a network failure with retry.
//
// Never shown here: a score, an internal call, a prediction, or advice to leave
// anything out. The words under each rule are the letter's and the rubric's own.
// A running analysis is remembered on the device (useStoredAnalysisId) and the
// job runs on the server, so leaving the screen or backgrounding the app does
// not lose it.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Card, SectionTitle } from '@/components/explorer/primitives';
import {
  BackHeader,
  CoralSubmit,
  InlineError,
} from '@/components/explorer/AccountForm';
import {
  useGetUploadUrl,
  useCreateDocument,
  uploadToStorage,
} from '@/hooks/useDocuments';
import {
  isNetworkFailure,
  isUpgradeRequired,
  useRefusalAnalysis,
  useStartRefusalAnalysis,
  useStoredAnalysisId,
} from '@/hooks/useRefusalLetter';
import type {
  RefusalData,
  RefusalReasonView,
} from '@/types/refusalLetter.type';

// The requirement id the backend expects a refusal-letter upload to carry.
const REFUSAL_REQUIREMENT_ID = 'refusal-letter';

// ── Small building blocks ────────────────────────────────────────────────────

/** Open a source URL in the browser. */
function openUrl(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

/** "Read the source" link under a quote. */
function SourceLink({ url }: { url: string }) {
  return (
    <Pressable
      onPress={() => openUrl(url)}
      hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}
    >
      <Ic.arrowUR size={14} color={EX.color.primary} strokeWidth={2} />
      <Text style={{ color: EX.color.primary, fontSize: 13, fontWeight: '700' }}>
        Read the source
      </Text>
    </Pressable>
  );
}

/** A quoted passage: cream block with a coral rule on the left. */
function Quote({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: EX.color.cream,
        borderLeftWidth: 3,
        borderLeftColor: EX.color.primary,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: EX.color.ink2, fontSize: 14, lineHeight: 20 }}>
        “{text}”
      </Text>
    </View>
  );
}

/** Small uppercase label above a block. */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: EX.color.muted,
        fontSize: 11.5,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 6,
        marginTop: 12,
      }}
    >
      {children}
    </Text>
  );
}

/** Icon + one line (+ optional action): the empty-state pattern. */
function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
      <Ic.docs size={34} color={EX.color.faint} strokeWidth={1.6} />
      <Text
        style={{
          color: EX.color.inkMuted,
          fontSize: 14.5,
          lineHeight: 21,
          textAlign: 'center',
          paddingHorizontal: 12,
        }}
      >
        {message}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
          <CoralSubmit label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

// ── One reason from the letter ───────────────────────────────────────────────

function ReasonCard({ reason }: { reason: RefusalReasonView }) {
  const matched = reason.status === 'matched';
  return (
    <Card style={{ marginBottom: 12 }}>
      <Label>What your letter says</Label>
      <Quote text={reason.letterQuote} />
      {reason.citedRefs.length > 0 ? (
        <Text style={{ color: EX.color.muted, fontSize: 12.5, marginTop: 6 }}>
          Cited: {reason.citedRefs.join(', ')}
          {reason.page ? ` (page ${reason.page})` : ''}
        </Text>
      ) : null}

      {matched ? (
        reason.rules.map((rule) => (
          <View key={rule.criterionId}>
            <Label>The published rule · {rule.ruleRef}</Label>
            <Text
              style={{
                color: EX.color.ink,
                fontSize: 14.5,
                fontWeight: '700',
                marginBottom: 6,
              }}
            >
              {rule.title}
            </Text>
            <Quote text={rule.sourceQuote} />
            <SourceLink url={rule.sourceUrl} />
            {rule.note ? (
              <Text
                style={{
                  color: EX.color.inkMuted,
                  fontSize: 13.5,
                  lineHeight: 19,
                  marginTop: 8,
                }}
              >
                {rule.note}
              </Text>
            ) : null}
          </View>
        ))
      ) : (
        <>
          <Label>Not matched to our guidance</Label>
          <Text style={{ color: EX.color.inkMuted, fontSize: 13.5, lineHeight: 19 }}>
            We could not match this reason to a published rule we hold, so we
            have not guessed. The words above are your letter’s own.
          </Text>
        </>
      )}

      {reason.adviserNote ? (
        <View
          style={{
            marginTop: 12,
            backgroundColor: EX.color.cream,
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Ic.users size={16} color={EX.color.primary} strokeWidth={2} />
          <Text style={{ flex: 1, color: EX.color.ink2, fontSize: 13.5, lineHeight: 19 }}>
            {reason.adviserNote}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

// ── The finished analysis ────────────────────────────────────────────────────

function Results({ data }: { data: RefusalData }) {
  const notice = data.disclosureNotice;
  const analysed = data.outcome === 'analysed';
  return (
    <View>
      {/* Warnings: shown, never a block. */}
      {data.warnings.map((w) => (
        <View
          key={w.code}
          style={{
            flexDirection: 'row',
            gap: 8,
            backgroundColor: EX.color.cream,
            borderWidth: 1,
            borderColor: EX.color.line10,
            borderRadius: 14,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Ic.help size={16} color={EX.color.primary} strokeWidth={2} />
          <Text style={{ flex: 1, color: EX.color.ink2, fontSize: 13.5, lineHeight: 19 }}>
            {w.message}
          </Text>
        </View>
      ))}

      {analysed ? (
        <>
          {data.extracted &&
          (data.extracted.decisionDate || data.extracted.visaTypeNamed) ? (
            <Card style={{ marginBottom: 12 }}>
              {data.extracted.visaTypeNamed ? (
                <Text style={{ color: EX.color.ink, fontSize: 14.5, fontWeight: '700' }}>
                  {data.extracted.visaTypeNamed}
                </Text>
              ) : null}
              {data.extracted.decisionDate ? (
                <Text style={{ color: EX.color.muted, fontSize: 13, marginTop: 2 }}>
                  Decision dated {data.extracted.decisionDate}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {data.noRubricMessage ? (
            <Text
              style={{
                color: EX.color.inkMuted,
                fontSize: 13.5,
                lineHeight: 19,
                marginBottom: 12,
              }}
            >
              {data.noRubricMessage}
            </Text>
          ) : null}

          <SectionTitle>Reasons in your letter</SectionTitle>
          {data.reasons.length === 0 ? (
            <EmptyState message="We could not find a reason written in this letter." />
          ) : (
            data.reasons.map((r) => <ReasonCard key={r.reasonId} reason={r} />)
          )}

          {/* Reapplication checklist: nothing is added to the to-do list yet. */}
          {data.checklist.state !== 'not_built' ? (
            <>
              <SectionTitle>What to gather before you reapply</SectionTitle>
              {data.checklist.items.length === 0 ? (
                <Text style={{ color: EX.color.inkMuted, fontSize: 13.5, lineHeight: 19, marginBottom: 12 }}>
                  {data.checklist.emptyReason ?? 'Nothing is listed for these points.'}
                </Text>
              ) : (
                data.checklist.items.map((item) => (
                  <Card key={item.checklistItemId} style={{ marginBottom: 10 }}>
                    <Text style={{ color: EX.color.ink, fontSize: 14.5, fontWeight: '700' }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: EX.color.inkMuted, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>
                      {item.reason}
                    </Text>
                    <Quote text={item.citation.quote} />
                    <SourceLink url={item.citation.url} />
                  </Card>
                ))
              )}
              <Text style={{ color: EX.color.muted, fontSize: 12.5, marginBottom: 12 }}>
                Nothing is added to your to-do list until you say so.
              </Text>
            </>
          ) : null}
        </>
      ) : (
        <EmptyState message={data.stateMessage ?? 'We could not read this letter.'} />
      )}

      {/* The disclosure notice is always shown, even when nothing could be matched. */}
      <Card style={{ marginTop: 4 }}>
        <Text style={{ color: EX.color.ink, fontSize: 15, fontWeight: '700' }}>
          {notice.title}
        </Text>
        <Text style={{ color: EX.color.ink2, fontSize: 14, lineHeight: 20, marginTop: 6 }}>
          {notice.body}
        </Text>
        <Label>The published rule · {notice.rule.ruleRef}</Label>
        <Quote text={notice.rule.quote} />
        <Text style={{ color: EX.color.muted, fontSize: 12.5, marginTop: 6 }}>
          {notice.rule.context}
        </Text>
        <SourceLink url={notice.rule.url} />
        <Text style={{ color: EX.color.inkMuted, fontSize: 13.5, lineHeight: 19, marginTop: 10 }}>
          {notice.help}
        </Text>
      </Card>
    </View>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────

export default function RefusalLetterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { applicationId } = useLocalSearchParams<{ applicationId?: string }>();
  const appId = applicationId ?? '';

  // The analysis remembered for this application (survives backgrounding / restart).
  const [analysisId, setAnalysisId, storedReady] = useStoredAnalysisId(appId);
  const analysisQ = useRefusalAnalysis(analysisId);

  const getUploadUrl = useGetUploadUrl();
  const createDoc = useCreateDocument();
  const start = useStartRefusalAnalysis();

  // Local step state: upload in flight, and the last upload / start failure.
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // The uploaded document, kept so "Try again" can re-ask without re-uploading.
  const [documentId, setDocumentId] = useState<string | null>(null);

  /** Ask the backend to read an already-uploaded letter. */
  const startAnalysis = useCallback(
    async (docId: string) => {
      setError(null);
      try {
        const res = await start.mutateAsync(docId);
        setAnalysisId(res.analysisId);
      } catch (e) {
        setError(e);
      }
    },
    [start, setAnalysisId],
  );

  /** Pick → signed URL → storage → register → analyse. */
  const pickAndUpload = useCallback(async () => {
    if (!appId) return;
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const f = res.assets[0];
      const contentType = f.mimeType ?? 'application/octet-stream';

      setUploading(true);
      const up = await getUploadUrl.mutateAsync({
        applicationId: appId,
        fileName: f.name,
        contentType,
      });
      if (!up) throw new Error('Could not start the upload.');
      await uploadToStorage(up.uploadUrl, {
        uri: f.uri,
        type: contentType,
        name: f.name,
      });
      const doc = await createDoc.mutateAsync({
        applicationId: appId,
        requirementId: REFUSAL_REQUIREMENT_ID,
        fileName: f.name,
        fileType: contentType,
        fileSizeMb: (f.size ?? 0) / 1e6,
        storagePath: up.storagePath,
      });
      if (!doc) throw new Error('Could not save the letter.');
      setDocumentId(doc.id);
      setUploading(false);
      await startAnalysis(doc.id);
    } catch (e) {
      setUploading(false);
      setError(e);
    }
  }, [appId, getUploadUrl, createDoc, startAnalysis]);

  /** Forget the current analysis and go back to the upload prompt. */
  const reset = useCallback(() => {
    setAnalysisId(null);
    setDocumentId(null);
    setError(null);
  }, [setAnalysisId]);

  const envelope = analysisQ.data;
  const status = envelope?.meta.status;
  const pending =
    start.isPending ||
    (!!analysisId && !envelope && !analysisQ.isError) ||
    status === 'queued' ||
    status === 'running';

  // Which single error to show: an upload / start error, else a failed read of
  // the analysis (a dropped connection while polling).
  const shownError = error ?? (analysisQ.isError ? analysisQ.error : null);
  const upgrade = isUpgradeRequired(shownError);

  /** Message for a plain error. */
  const errorMessage = (e: unknown): string => {
    if (isNetworkFailure(e)) return 'No connection. Check your network and try again.';
    const m = (e as { message?: string } | null)?.message;
    return m || 'Something went wrong. Please try again.';
  };

  /** What "Try again" does for the current error. */
  const retry = () => {
    if (analysisQ.isError) {
      setError(null);
      analysisQ.refetch();
    } else if (documentId) {
      startAnalysis(documentId);
    } else {
      pickAndUpload();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: EX.color.bg }}>
      <BackHeader
        title="Your refusal letter"
        subtitle="See what it says next to the published rule"
        insets={insets}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: EX.space.screenX,
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* 402: the plan does not include reading letters. */}
        {upgrade ? (
          <Card>
            <EmptyState
              message="Reading a refusal letter is part of the case-officer plan."
              actionLabel="See plans"
              onAction={() => router.push('/subscription')}
            />
          </Card>
        ) : shownError ? (
          // Network or server failure, with retry.
          <View style={{ gap: 12 }}>
            <InlineError message={errorMessage(shownError)} />
            <CoralSubmit label="Try again" onPress={retry} />
          </View>
        ) : !storedReady ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={EX.color.primary} />
          </View>
        ) : uploading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
            <ActivityIndicator color={EX.color.primary} />
            <Text style={{ color: EX.color.inkMuted, fontSize: 14.5 }}>
              Uploading your letter…
            </Text>
          </View>
        ) : pending ? (
          // Pending: the job runs on the server, so leaving is safe.
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
            <ActivityIndicator color={EX.color.primary} />
            <Text style={{ color: EX.color.ink, fontSize: 15.5, fontWeight: '700' }}>
              Reading your letter…
            </Text>
            <Text
              style={{
                color: EX.color.inkMuted,
                fontSize: 14,
                lineHeight: 20,
                textAlign: 'center',
              }}
            >
              You can leave this screen. We’ll keep going and it will be here
              when you come back.
            </Text>
          </View>
        ) : status === 'failed' ? (
          <View style={{ gap: 12 }}>
            <InlineError
              message={
                envelope?.meta.error?.message ??
                'We could not read this letter.'
              }
            />
            <CoralSubmit label="Upload a different file" onPress={reset} />
          </View>
        ) : envelope?.data ? (
          <View>
            <Results data={envelope.data} />
            <View style={{ marginTop: 16 }}>
              <Pressable onPress={reset} hitSlop={8} style={{ alignSelf: 'center' }}>
                <Text style={{ color: EX.color.primary, fontSize: 14, fontWeight: '700' }}>
                  Upload a different letter
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          // Idle: nothing uploaded yet.
          <View>
            <Card>
              <Text style={{ color: EX.color.ink, fontSize: 16, fontWeight: '700' }}>
                Been refused before?
              </Text>
              <Text
                style={{
                  color: EX.color.inkMuted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginTop: 6,
                }}
              >
                Upload your refusal letter. We read the reasons it gives and
                show each one next to the published rule it points to.
              </Text>
              <Text
                style={{
                  color: EX.color.muted,
                  fontSize: 13,
                  lineHeight: 18,
                  marginTop: 8,
                }}
              >
                We only report what the letter says. We don’t judge it, and we
                can’t say how a new application will go. A PDF, JPEG or PNG
                works.
              </Text>
            </Card>
            <View style={{ marginTop: 16 }}>
              <CoralSubmit label="Upload your letter" onPress={pickAndUpload} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
