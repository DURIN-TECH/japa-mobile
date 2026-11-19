// ─────────────────────────────────────────────────────────────────────────────
// Visa list paging — the pure "which page next?" rule (japa#341).
//
// The Explore grid used to ask GET /visas for one page of 60 and stop, so any
// visa past position 60 (on dev: Slovakia, Switzerland, Liechtenstein, Croatia,
// Bulgaria, Romania, Italy, Austria) could only be found through search.
//
// The backend already pages: GET /visas takes `limit` + `offset`, sorts the
// WHOLE list before slicing (stable order), and returns `{ visaTypes, total }`.
// So the app just asks for the next slice until it has `total`. Each request
// stays at `limit=60`, the size of today's single request, so no request costs
// more than before (each call runs one Firestore query per country whatever
// the page size; see japa#327 item 2).
//
// This file holds only pure functions so the rule is unit tested without
// React or TanStack Query (`__tests__/visaPaging.test.ts`).
// ─────────────────────────────────────────────────────────────────────────────

/** Page size for the Explore grid. Never raise past 60 (japa#341: cost cap). */
export const EXPLORE_PAGE_SIZE = 60;

/** One page as GET /visas returns it. */
export interface VisaPage<T = unknown> {
  visaTypes?: T[];
  total: number;
}

/**
 * The `offset` of the next page, or `undefined` when there is nothing more to
 * fetch (TanStack Query's `getNextPageParam` contract: `undefined` = no next
 * page, so `hasNextPage` goes false and no further request is sent).
 *
 * • offset = the number of visas the SERVER has handed out so far, i.e. the
 *   raw sum of page lengths. Deliberately not the de-duplicated count: if data
 *   shifted between requests and a page overlapped the previous one, using the
 *   smaller de-duplicated count would ask for the same rows again forever.
 * • Stop when that count reaches `total`. The newest page's `total` wins, since
 *   it is the freshest count the server reported.
 * • Stop when a page comes back empty, even if `total` says there should be
 *   more (rows removed mid-scroll): otherwise we would loop on empty pages.
 *   A page with no `visaTypes` at all counts as empty.
 */
export function nextVisaOffset(pages: VisaPage[]): number | undefined {
  if (pages.length === 0) return 0;
  const last = pages[pages.length - 1];
  // `?.` / `?? 0`: a page without `visaTypes` counts as empty (it must never
  // throw here: TanStack calls this during render).
  if (!last.visaTypes?.length) return undefined;
  const loaded = pages.reduce((n, p) => n + (p.visaTypes?.length ?? 0), 0);
  const total = last.total ?? 0;
  return loaded >= total ? undefined : loaded;
}
