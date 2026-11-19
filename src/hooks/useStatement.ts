// ─────────────────────────────────────────────────────────────────────────────
// useStatement — the applicant's "statement" for the review (issue #43).
//
// The statement is a `DocumentInstance` cloned from the `global-sop` template and
// linked to the application. NO field is added to `Application`. Each save is a
// PUT with the current `version`, and the backend writes a snapshot into the
// instance's `versions` subcollection, so every edit becomes a new version and a
// re-run of the review picks up the newest one.
//
// BACKEND CONTRACT (as integrated): an applicant may create and edit the
// statement on their OWN application only, through the ordinary
// `/document-instances` routes:
//   • POST   creates it; a repeat create returns the EXISTING statement (never a
//            second one). Only `templateId` and `applicationId` are read.
//   • PUT    saves `{ content, version }`; `content` must be a ProseMirror doc.
//   • 409 STATEMENT_LOCKED   the application is under review or later: read-only.
//   • 409 VERSION_CONFLICT   the version is stale (edited elsewhere).
// Editable only while the application is draft / pending_payment /
// pending_documents; `isStatementLocked` mirrors that so the screens can say so
// before a request is made.
//
// The editor is plain text. The instance is created from the template (as the
// issue requires), but its content is immediately replaced with the applicant's
// plain paragraphs, so the study-specific template headings never reach the
// screen. A statement that already has rich formatting is flattened to plain
// paragraphs for editing.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { assessmentKey } from '@/hooks/useCaseOfficer';

/** The template the statement is created from (seed-document-templates.ts). */
export const STATEMENT_TEMPLATE_ID = 'global-sop';

/**
 * Statuses in which the backend still lets the applicant create/edit the
 * statement. Anything else answers 409 STATEMENT_LOCKED.
 */
export const STATEMENT_EDITABLE_STATUSES = [
  'draft',
  'pending_payment',
  'pending_documents',
];

/** True when the statement can no longer be edited for this application status. */
export const isStatementLocked = (status: string | undefined | null) =>
  !!status && !STATEMENT_EDITABLE_STATUSES.includes(status);

/** 409 STATEMENT_LOCKED: the application is under review or later. */
export const isStatementLockedError = (e: unknown) =>
  (e as { code?: string } | null)?.code === 'STATEMENT_LOCKED';

/** 409 VERSION_CONFLICT: the statement was saved elsewhere since it was loaded. */
export const isVersionConflict = (e: unknown) =>
  (e as { code?: string } | null)?.code === 'VERSION_CONFLICT';

/**
 * Application statuses after which the application counts as submitted, so a
 * review can only be viewed, not started. (The statement locks earlier, from
 * `under_review`: see `isStatementLocked`.)
 */
export const SUBMITTED_STATUSES = [
  'submitted_to_embassy',
  'interview_scheduled',
  'approved',
  'rejected',
  'withdrawn',
  'expired',
];

/** Loose ProseMirror node (the backend stores this verbatim). */
interface PMNode {
  type?: string;
  text?: string;
  content?: PMNode[];
}

/** The statement as the screens use it. */
export interface Statement {
  /** DocumentInstance id, or null when nothing has been saved yet. */
  id: string | null;
  /** Optimistic-concurrency token for the next save. */
  version: number;
  /** Plain text, paragraphs separated by a blank line. */
  text: string;
  /** ISO time of the last save, when known. */
  updatedAt: string | null;
}

/** Instance list rows (content omitted in list responses). */
interface InstanceRow {
  id: string;
  templateId: string;
  version: number;
  updatedAt?: unknown;
  createdAt?: unknown;
}

/** Plain text → a ProseMirror doc of paragraphs (blank lines separate them). */
export function textToDoc(text: string): PMNode {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+$/g, ''))
    .filter((p) => p.trim().length > 0);
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      // Single newlines stay inside the paragraph as hard breaks.
      content: p.split('\n').flatMap((line, i, all) => {
        const nodes: PMNode[] = line ? [{ type: 'text', text: line }] : [];
        if (i < all.length - 1) nodes.push({ type: 'hardBreak' });
        return nodes;
      }),
    })),
  };
}

/** ProseMirror doc → plain text (block nodes become paragraphs). */
export function docToText(node: PMNode | undefined | null): string {
  if (!node) return '';
  const inline = (n: PMNode): string => {
    if (n.type === 'text') return n.text ?? '';
    if (n.type === 'hardBreak') return '\n';
    return (n.content ?? []).map(inline).join('');
  };
  const blocks = (node.content ?? []).map(inline).filter((t) => t.trim());
  return blocks.join('\n\n');
}

/** Word count for the "{n} words" line. */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Best-effort ISO string from a Firestore timestamp as serialised by the API. */
function isoOf(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof ts === 'string') return ts;
  const o = ts as { _seconds?: number; seconds?: number };
  const s = o._seconds ?? o.seconds;
  return typeof s === 'number' ? new Date(s * 1000).toISOString() : null;
}

export const statementKey = (applicationId: string) =>
  ['statement', applicationId] as const;

/**
 * The application's statement. Resolves to `{ id: null, text: '' }` when none
 * has been saved yet (not an error).
 */
export function useStatement(applicationId: string) {
  return useQuery<Statement>({
    queryKey: statementKey(applicationId),
    enabled: !!applicationId,
    queryFn: async () => {
      const list = await apiService.get<InstanceRow[]>(
        `/document-instances?applicationId=${encodeURIComponent(applicationId)}`,
      );
      // The statement is the instance made from the statement template.
      const mine = (list.data ?? []).filter(
        (i) => i.templateId === STATEMENT_TEMPLATE_ID,
      );
      if (mine.length === 0)
        return { id: null, version: 0, text: '', updatedAt: null };
      // Newest first, if several exist.
      mine.sort((a, b) =>
        (isoOf(b.updatedAt ?? b.createdAt) ?? '').localeCompare(
          isoOf(a.updatedAt ?? a.createdAt) ?? '',
        ),
      );
      const row = mine[0];
      const one = await apiService.get<{
        id: string;
        version: number;
        content?: PMNode;
        updatedAt?: unknown;
      }>(`/document-instances/${row.id}`);
      const inst = one.data;
      return {
        id: row.id,
        version: inst?.version ?? row.version,
        text: docToText(inst?.content),
        updatedAt: isoOf(inst?.updatedAt ?? row.updatedAt),
      };
    },
  });
}

/**
 * Save the statement. First save asks the server for the statement (a repeat
 * create returns the existing one, so a lost response or a second device never
 * makes a second statement) and then writes the applicant's text; later saves
 * PUT a new version. Invalidates the statement AND the review queries, since the
 * review's inputs changed.
 *
 * Rejects with the api service's `{ code, status, message }`:
 *   STATEMENT_LOCKED  → read-only now (see `isStatementLockedError`)
 *   VERSION_CONFLICT  → edited elsewhere (see `isVersionConflict`); the statement
 *                       query is refetched so the next save carries the fresh
 *                       version, and the screen keeps the typed text.
 */
export function useSaveStatement(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { current: Statement; text: string }) => {
      let { id, version } = input.current;
      if (!id) {
        // Only templateId + applicationId are read by the server; a title or
        // owner in the body would be ignored.
        const created = await apiService.post<{ id: string; version: number }>(
          '/document-instances',
          { templateId: STATEMENT_TEMPLATE_ID, applicationId },
        );
        if (!created.data) throw new Error('Could not create the statement');
        id = created.data.id;
        version = created.data.version;
      }
      // Replaces the template text with the applicant's own paragraphs.
      await apiService.put(`/document-instances/${id}`, {
        content: textToDoc(input.text),
        version,
      });
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statementKey(applicationId) });
      queryClient.invalidateQueries({ queryKey: assessmentKey(applicationId) });
    },
    onError: (e) => {
      // A stale version or a lock means the server moved: re-read it.
      if (isVersionConflict(e) || isStatementLockedError(e))
        queryClient.invalidateQueries({
          queryKey: statementKey(applicationId),
        });
    },
  });
}
