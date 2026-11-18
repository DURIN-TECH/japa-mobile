// ─────────────────────────────────────────────────────────────────────────────
// Settings screen helpers (japa#346): the version footer and the Legal /
// Support links, with the message shown when a link can't be opened.
// ─────────────────────────────────────────────────────────────────────────────

// ── Version footer ───────────────────────────────────────────────────────────

/**
 * "Version <x>" from the app config's `expo.version` (pass
 * `Constants.expoConfig?.version`, the same value `useFeedback` sends as
 * `appVersion`). Missing, empty or not a string → null, and the footer leaves
 * the line out: never "Version undefined".
 */
export function versionLabel(version: unknown): string | null {
  if (typeof version !== 'string') return null;
  const v = version.trim();
  return v ? `Version ${v}` : null;
}

// ── External links ───────────────────────────────────────────────────────────

/** The four Legal / Support rows that leave the app. */
export type SettingsLinkKey = 'privacy' | 'terms' | 'help' | 'contact';

/**
 * Where each row goes, and what the user reads if it won't open. The message
 * writes the address without its scheme (weareseli.com/privacy, not
 * https://…) so it can be typed or copied as is. Copy from the design spec.
 */
export const SETTINGS_LINKS: Record<
  SettingsLinkKey,
  { url: string; failure: string }
> = {
  privacy: {
    url: 'https://weareseli.com/privacy',
    failure:
      'We couldn’t open the privacy policy. You’ll find it at weareseli.com/privacy',
  },
  terms: {
    url: 'https://weareseli.com/terms',
    failure:
      'We couldn’t open the terms of service. You’ll find them at weareseli.com/terms',
  },
  help: {
    url: 'https://weareseli.com/help',
    failure:
      'We couldn’t open the Help Center. You’ll find it at weareseli.com/help',
  },
  contact: {
    url: 'mailto:support@weareseli.com',
    failure:
      'We couldn’t open your email app. Write to us at support@weareseli.com',
  },
};

/** The bit of react-native's `Linking` that `openSettingsLink` needs. */
export interface LinkOpener {
  openURL(url: string): Promise<unknown>;
}

/**
 * Try to open a link. Resolves true when it opened, false when `openURL`
 * rejected (no browser / no mail app on the device, e.g. `mailto:` on a
 * simulator). Never rejects.
 *
 * No `canOpenURL` pre-check: on iOS it answers false for any scheme not
 * declared in LSApplicationQueriesSchemes (this app declares none), which
 * would show the failure message for a link that would have opened. Both
 * platforms reject `openURL` when nothing can handle the link.
 */
export async function openSettingsLink(
  linking: LinkOpener,
  url: string,
): Promise<boolean> {
  try {
    await linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
