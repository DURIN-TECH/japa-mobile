// ─────────────────────────────────────────────────────────────────────────────
// Draft vault (issue #187): encrypted on-device storage for UNSAVED answer text,
// so typing survives being offline and the app being killed.
//
// Uses `expo-secure-store` (iOS Keychain / Android Keystore), never AsyncStorage
// (unencrypted): these answers are personal details. NATIVE MODULE: needs a new
// dev build.
//
// The store talks to the small `DraftVault` interface below (save / delete /
// clearAll / load); `secureStoreVault` is the implementation.
//
// LAYOUT, one logical entry per draft (application id + item id):
//   <base>        JSON { updatedAt, chunks }       base = "seli.draft.<enc app>.<enc item>"
//   <base>.c0..n  the text, split into chunks
// plus one index entry listing the drafts (ids only, no text), because
// SecureStore cannot list its keys.
//
// SecureStore keys allow only [A-Za-z0-9._-]: ids are encoded (see `encodeId`).
// SecureStore warns above ~2048 bytes per value, so text is split into chunks of
// at most CHUNK_BYTES UTF-8 bytes and reassembled on read.
// Drafts older than 7 days are dropped when loaded.
//
// Every call is best effort: a vault failure never blocks typing (the in-memory
// store stays the live source). The text is never logged, and neither are errors
// (they could echo values).
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';

/** Largest chunk, in UTF-8 bytes: safely under SecureStore's ~2048 warning. */
export const CHUNK_BYTES = 1800;
/** Drafts older than this are dropped on load. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const PREFIX = 'seli.draft.';
const INDEX_KEY = 'seli.drafts.index';

/** One stored draft. */
export interface StoredDraft {
  applicationId: string;
  itemId: string;
  text: string;
  /** ms since epoch of the last edit. */
  updatedAt: number;
}

/** What the drafts store needs from a persistent backend. */
export interface DraftVault {
  save: (
    applicationId: string,
    itemId: string,
    text: string,
    updatedAt?: number,
  ) => Promise<void>;
  delete: (applicationId: string, itemId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  /** Every stored draft, with drafts older than 7 days dropped. */
  load: (now?: number) => Promise<StoredDraft[]>;
}

/**
 * Make an id safe for a SecureStore key: keep [A-Za-z0-9-], turn every other
 * character (including "_" and ".") into `_<hex code point>_`. Reversible and
 * free of "." so it can never collide with the "." separators.
 */
export function encodeId(id: string): string {
  let out = '';
  for (const ch of id) {
    out += /[A-Za-z0-9-]/.test(ch)
      ? ch
      : `_${ch.codePointAt(0)!.toString(16)}_`;
  }
  return out;
}

/** Inverse of `encodeId`. */
export function decodeId(enc: string): string {
  return enc.replace(/_([0-9a-f]+)_/g, (_m, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );
}

/** Base key of one draft. */
export const draftBaseKey = (applicationId: string, itemId: string) =>
  `${PREFIX}${encodeId(applicationId)}.${encodeId(itemId)}`;

/** UTF-8 byte length of one code point. */
const bytesOf = (cp: number) =>
  cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;

/** Split text into chunks of at most `max` UTF-8 bytes, never inside a character. */
export function chunkText(text: string, max = CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let cur = '';
  let size = 0;
  for (const ch of text) {
    const b = bytesOf(ch.codePointAt(0)!);
    if (size + b > max) {
      chunks.push(cur);
      cur = '';
      size = 0;
    }
    cur += ch;
    size += b;
  }
  chunks.push(cur);
  return chunks;
}

interface IndexEntry {
  a: string;
  i: string;
}

async function readIndex(): Promise<IndexEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(entries: IndexEntry[]): Promise<void> {
  try {
    if (entries.length === 0) await SecureStore.deleteItemAsync(INDEX_KEY);
    else await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(entries));
  } catch {
    /* best effort */
  }
}

/** Remove one draft's entries (meta and every chunk). */
async function removeEntry(applicationId: string, itemId: string) {
  const base = draftBaseKey(applicationId, itemId);
  try {
    const raw = await SecureStore.getItemAsync(base);
    const chunks = raw
      ? ((JSON.parse(raw) as { chunks?: number }).chunks ?? 0)
      : 0;
    for (let n = 0; n < chunks; n++)
      await SecureStore.deleteItemAsync(`${base}.c${n}`);
    await SecureStore.deleteItemAsync(base);
  } catch {
    /* best effort */
  }
}

/** Write one draft (replaces the previous one for the same item). */
export async function saveDraft(
  applicationId: string,
  itemId: string,
  text: string,
  updatedAt = Date.now(),
): Promise<void> {
  try {
    const base = draftBaseKey(applicationId, itemId);
    const chunks = chunkText(text);
    // Drop leftover chunks of a longer previous version first.
    await removeEntry(applicationId, itemId);
    for (let n = 0; n < chunks.length; n++)
      await SecureStore.setItemAsync(`${base}.c${n}`, chunks[n]);
    await SecureStore.setItemAsync(
      base,
      JSON.stringify({ updatedAt, chunks: chunks.length }),
    );
    const index = await readIndex();
    if (!index.some((e) => e.a === applicationId && e.i === itemId))
      await writeIndex([...index, { a: applicationId, i: itemId }]);
  } catch {
    /* best effort */
  }
}

/** Delete one draft (after a successful save). */
export async function deleteDraft(
  applicationId: string,
  itemId: string,
): Promise<void> {
  await removeEntry(applicationId, itemId);
  const index = await readIndex();
  await writeIndex(
    index.filter((e) => !(e.a === applicationId && e.i === itemId)),
  );
}

/** Delete every draft (sign-out). */
export async function clearAllDrafts(): Promise<void> {
  const index = await readIndex();
  for (const e of index) await removeEntry(e.a, e.i);
  await writeIndex([]);
}

/**
 * Read every stored draft, reassembling chunks. Drafts older than 7 days (or
 * unreadable / incomplete) are deleted and not returned.
 */
export async function loadDrafts(now = Date.now()): Promise<StoredDraft[]> {
  const index = await readIndex();
  const out: StoredDraft[] = [];
  for (const e of index) {
    try {
      const base = draftBaseKey(e.a, e.i);
      const raw = await SecureStore.getItemAsync(base);
      const meta = raw
        ? (JSON.parse(raw) as { updatedAt?: number; chunks?: number })
        : null;
      if (
        !meta ||
        typeof meta.updatedAt !== 'number' ||
        typeof meta.chunks !== 'number' ||
        now - meta.updatedAt > DRAFT_MAX_AGE_MS
      ) {
        await deleteDraft(e.a, e.i);
        continue;
      }
      let text = '';
      let complete = true;
      for (let n = 0; n < meta.chunks; n++) {
        const part = await SecureStore.getItemAsync(`${base}.c${n}`);
        if (part === null) {
          complete = false;
          break;
        }
        text += part;
      }
      if (!complete) {
        await deleteDraft(e.a, e.i);
        continue;
      }
      out.push({
        applicationId: e.a,
        itemId: e.i,
        text,
        updatedAt: meta.updatedAt,
      });
    } catch {
      /* skip an unreadable draft */
    }
  }
  return out;
}

/** The SecureStore-backed implementation of `DraftVault`. */
export const secureStoreVault: DraftVault = {
  save: saveDraft,
  delete: deleteDraft,
  clearAll: clearAllDrafts,
  load: loadDrafts,
};
