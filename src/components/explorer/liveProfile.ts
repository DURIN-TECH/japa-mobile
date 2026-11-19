// ─────────────────────────────────────────────────────────────────────────────
// Profile — live backend adapter (japa#145).
//
// The Home greeting and the Profile header used to read a hard-coded persona
// (the static `ME` persona). They now read the
// signed-in user's `GET /users/me` profile through these helpers:
//
//   • profileName(p)    "Ada Obi" from first + last name ('' when unknown)
//   • profileCity(p)    "Lagos" from the address city ('' when unknown)
//   • profileHeader(p)  "Ada Obi · Lagos", or just the name when there is no
//                       city (no dangling separator), or '' with no name
//   • profileSeed(p)    stable Portrait gradient seed from the user id
//
// Pure (no React / RN imports) so it is unit-tested directly.
// ─────────────────────────────────────────────────────────────────────────────

import type { UserProfile } from '@/types/user.type';

/** The fields these helpers read; everything is optional/defensive. */
export type ProfileLike = Pick<
  Partial<UserProfile>,
  'id' | 'firstName' | 'lastName' | 'address'
> | null;

/** "First Last", trimmed; '' when the profile has no name. */
export function profileName(p: ProfileLike | undefined): string {
  if (!p) return '';
  return [p.firstName, p.lastName]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

/** The user's city from their address; '' when missing. */
export function profileCity(p: ProfileLike | undefined): string {
  const city = p?.address?.city;
  return typeof city === 'string' ? city.trim() : '';
}

/**
 * Header line: "Name · City". With no city, the name alone (the AC: "if
 * the city is missing, show the name only"). With no name, ''.
 */
export function profileHeader(p: ProfileLike | undefined): string {
  const name = profileName(p);
  if (!name) return '';
  const city = profileCity(p);
  return city ? `${name} · ${city}` : name;
}

/** Stable Portrait seed (0–5) from the user id; 0 when unknown. */
export function profileSeed(p: ProfileLike | undefined): number {
  const id = p?.id ?? '';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 6;
}
