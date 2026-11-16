// ─────────────────────────────────────────────────────────────────────────────
// Profile tab (prototype profile.jsx ProfileView).
// Tonal purple header + floating glass stats + premium upsell + two menu groups
// + sign out. Ported 1:1 from source (paddings, radii, colors preserved).
// japa#346: every row value and the upgrade banner come from the user's real
// data (or "–" / hidden while unknown) — no typed-in counts, amounts or plan.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EX, displayText } from '@/components/explorer/theme';
import { Ic } from '@/components/explorer/icons';
import { Portrait, Verified } from '@/components/explorer/primitives';
// Real Firebase sign-out — clears auth state, then returns to the auth entry.
import { authService } from '@/services/auth.service';
// ── Live data sources ────────────────────────────────────────────────────────
// Signed-in user profile (GET /users/me) + React Query hooks for the live
// counts shown in the floating stats and menu rows. japa#145: no demo persona —
// a count that hasn't loaded shows "–" (never a fabricated number), and the
// header shows the real name (plus the city only when the profile has one).
import { useApplications } from '@/hooks/useApplications';
import { useConsultations } from '@/hooks/useConsultations';
import { useConversations } from '@/hooks/useMessaging';
import { useIdentityVerification } from '@/hooks/useVerification';
import { useMe } from '@/hooks/useMe';
// japa#346: real values for the documents / payments / subscription rows and
// the upgrade banner.
import { useMyDocumentsCount } from '@/hooks/useDocuments';
import { useTransactions } from '@/hooks/useTransactions';
import { useCurrentPlan } from '@/hooks/useCurrentPlan';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
// japa#146: the live saved list behind the Saved stat and row.
import { useSavedDestinations } from '@/hooks/useSavedDestinations';
import { savedCountLabel } from '@/components/explorer/savedLogic';
import { queryState } from '@/components/explorer/states';
import { upgradeBanner } from '@/components/explorer/planLogic';
import {
  fileCountLabel,
  paidLabel,
  planNameLabel,
} from '@/components/explorer/profileLogic';
// Self-service-only launch flag (japa#334).
import { isSelfServiceOnly } from '@/config/env';
import {
  profileName,
  profileCity,
  profileSeed,
} from '@/components/explorer/liveProfile';

// ── One settings/menu row ────────────────────────────────────────────────────
function ProfileRow({
  icon: IconCmp,
  label,
  value,
  divider = false,
  onPress,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  divider?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: EX.color.line06,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: EX.color.cream,
        }}
      >
        <IconCmp size={19} color={EX.color.primary} strokeWidth={1.8} />
      </View>
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
      {value ? (
        // One line, tail ellipsis, at most 55% of the row (japa#346): a long
        // plan name like "Client Standard (Yearly)" never wraps the label.
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13.5,
            color: EX.color.muted,
            fontWeight: '500',
            flexShrink: 1,
            maxWidth: '55%',
          }}
        >
          {value}
        </Text>
      ) : null}
      <Ic.chevR size={18} color="rgba(23,19,38,0.32)" strokeWidth={1.8} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  // ── Self-service-only build (japa#334) ───────────────────────────────────
  // Hides the My consultations, Messages, Verify identity and Payments rows
  // and the Agents stat (Active and Saved stay), skips the queries that only
  // fed them, and rewords the Plus card subtitle (no agent chat). Off =
  // everything as before.
  const selfServiceOnly = isSelfServiceOnly();
  const insets = useSafeAreaInsets();

  // ── Live data (hooks called unconditionally, before any early return) ───────
  // Signed-in user profile and the three list queries that back the live
  // counts. A count whose query hasn't answered shows "–" (spec: never a
  // fabricated number for a failed/unknown count).
  const { data: me } = useMe();
  const applicationsQ = useApplications();
  const applications = applicationsQ.data;
  const consultationsQ = useConsultations(undefined, {
    enabled: !selfServiceOnly,
  });
  const consultations = consultationsQ.data;
  const conversationsQ = useConversations({ enabled: !selfServiceOnly });
  const conversations = conversationsQ.data;
  // Live identity-verification (KYC) status — powers the short hint shown on the
  // "Verify identity" row. Falls back to the profile's embedded field if present.
  const idVerification = useIdentityVerification({
    enabled: !selfServiceOnly,
  }).data;

  // Header — real full name and city from GET /users/me. With no city, the
  // name shows alone (the pin row hides entirely — no dangling separator).
  const fullName = profileName(me);
  const location = profileCity(me);

  // ── Saved destinations: ONE source (japa#346, live since japa#146) ───────
  // Both the "Saved" stat and the "Saved destinations" row read `savedCount`
  // and nothing else: the number of items in the live saved list (the same
  // query key as the Saved screen and the destination heart, so the three
  // agree). "–" while the first load runs or after it failed (#145 rule); a
  // failed background refetch keeps the cached number. Refetched on every
  // re-focus (below), like the other counts.
  const savedQ = useSavedDestinations();
  const savedCount = savedCountLabel(
    queryState(savedQ) === 'ready' ? savedQ.data : undefined,
  );

  // Floating stats ───────────────────────────────────────────────────────────
  // Active = number of applications; Saved = `savedCount` above; Agents =
  // distinct agents the user has consultations with. Unknown (query
  // pending/failed) renders "–".
  const activeCount = applications != null ? String(applications.length) : '–';
  const agentsCount =
    consultations != null
      ? String(new Set(consultations.map((c) => c.agentId)).size)
      : '–';

  // "My consultations" value — count of upcoming (not-yet-happened) bookings.
  const upcomingConsults = consultations
    ? consultations.filter((c) =>
        ['scheduled', 'confirmed', 'pending_payment', 'in_progress'].includes(
          c.status,
        ),
      ).length
    : null;
  const consultsValue =
    upcomingConsults != null ? `${upcomingConsults} upcoming` : '–';

  // "Messages" value — total unread messages for this user across conversations.
  const unreadMessages = conversations
    ? conversations.reduce((sum, c) => sum + (c.unreadCountUser ?? 0), 0)
    : null;
  const messagesValue = unreadMessages != null ? `${unreadMessages} new` : '–';

  // "Verify identity" value — a short status hint. Prefer the live verification
  // query, falling back to the profile's embedded `identityVerification`.
  // NOTE: ProfileRow renders `value` in a single muted tone (no per-row color
  // prop), so the "Verified" hint can't be tinted teal without adding a prop —
  // we render the plain text hint only.
  const idStatus = idVerification?.status ?? me?.identityVerification?.status;
  const identityValue =
    idStatus === 'verified'
      ? 'Verified'
      : idStatus === 'pending' || idStatus === 'under_review'
        ? 'In review'
        : 'Not started';

  // ── "My documents" value (japa#346) ─────────────────────────────────────
  // Uploaded files across the user's applications, the same files the
  // Documents screen lists under "All". "–" while loading, and whenever the
  // count could be short (a request failed, or more applications than the
  // fan-out fetches): an undercount must never read as a real number.
  const documentsQ = useMyDocumentsCount();
  const documentsValue = fileCountLabel(documentsQ.data);

  // ── "Payments" value (japa#346) ──────────────────────────────────────────
  // Completed payments ("N paid"), no money amount (see profileLogic.ts).
  // Skipped in a self-service-only build, where the row is hidden.
  const transactionsQ = useTransactions({ enabled: !selfServiceOnly });
  const paymentsValue = paidLabel(transactionsQ.data);

  // ── Fresh counts on return (japa#346 review) ─────────────────────────────
  // The tab stays mounted, so without this "N files" / "N paid" would keep
  // the value from first load after an upload or payment elsewhere, and a
  // "–" from a passing network failure would never recover. Refetch both on
  // every re-focus (not the first, which already fetched).
  useRefetchOnFocus(documentsQ.refetch);
  useRefetchOnFocus(transactionsQ.refetch, !selfServiceOnly);
  // japa#146: the saved list too. Writes already edit the shared cache, so
  // this only catches saves made on another device (or a passing "–").
  useRefetchOnFocus(savedQ.refetch);

  // ── Subscription row + upgrade banner (japa#346) ─────────────────────────
  // Same hook as Settings, so both screens name the same plan. The banner
  // shows only once both queries answered and a higher monthly plan exists;
  // `upgradeBanner` returns null otherwise (loading, error, top plan).
  const currentPlan = useCurrentPlan();
  const subscriptionValue = planNameLabel(currentPlan.plan?.name);
  const banner = upgradeBanner(currentPlan.plan, currentPlan.plans, {
    selfServiceOnly,
  });

  // ── Real sign-out: clear Firebase auth, then return to the auth entry ───────
  const onSignOut = async () => {
    try {
      await authService.logout();
    } finally {
      router.replace('/(auth)/welcome');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: EX.color.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: EX.space.tabClear }}
    >
      {/* Tonal header */}
      <LinearGradient
        colors={[EX.color.profileTop, EX.color.profileBot]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          paddingTop: insets.top + 30,
          paddingHorizontal: 22,
          paddingBottom: 44,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: -50,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: 'rgba(255,255,255,0.05)',
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Portrait
            // Seed from the user id; initials from the real name ('' → none).
            seed={profileSeed(me)}
            size={70}
            name={fullName}
            style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)' }}
          />
          <View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <Text
                numberOfLines={1}
                style={[displayText(23, 'semibold'), { color: '#fff' }]}
              >
                {fullName}
              </Text>
              {/* japa#145: the badge is a claim, so only for a verified ID. */}
              {idStatus === 'verified' ? <Verified size={17} /> : null}
            </View>
            {/* City row only when the profile has a city (name alone otherwise). */}
            {location ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <Ic.pin
                  size={14}
                  color="rgba(255,255,255,0.8)"
                  strokeWidth={1.8}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: 'rgba(255,255,255,0.8)',
                  }}
                >
                  {location}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {/* Floating glass stats */}
      <View style={{ paddingHorizontal: 22, marginTop: -28, zIndex: 5 }}>
        <BlurView
          intensity={24}
          tint="light"
          style={{
            flexDirection: 'row',
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.74)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.6)',
          }}
        >
          {[
            [String(activeCount), 'Active'],
            [String(savedCount), 'Saved'],
            // No Agents cell in a self-service-only build (japa#334).
            ...(selfServiceOnly ? [] : [[String(agentsCount), 'Agents']]),
          ].map(([v, l], i) => (
            <React.Fragment key={l}>
              {i > 0 ? (
                <View style={{ width: 1, backgroundColor: EX.color.line10 }} />
              ) : null}
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 15,
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: EX.color.ink,
                  }}
                >
                  {v}
                </Text>
                <Text
                  style={{
                    fontSize: 11.5,
                    color: EX.color.inkMuted,
                    fontWeight: '500',
                    marginTop: 2,
                  }}
                >
                  {l}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </BlurView>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
        {/* Premium upsell — real target plan (japa#346). Left out entirely
            (with its bottom margin) while hidden, so the first menu card
            sits at the container's 22pt top padding with no gap. */}
        {banner ? (
          <Pressable
            onPress={() => router.push('/subscription')}
            accessibilityRole="button"
            accessibilityLabel={
              banner.benefits
                ? `${banner.title}, ${banner.benefits}`
                : banner.title
            }
            accessibilityHint="Opens plans"
          >
            <LinearGradient
              colors={[EX.color.primary, EX.color.primaryDark]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{
                borderRadius: 22,
                padding: 18,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                overflow: 'hidden',
                shadowColor: EX.color.primary,
                shadowOpacity: 0.45,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 12 },
                elevation: 6,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: -30,
                  right: -20,
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              />
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ic.crown size={23} color="#fff" strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}
                >
                  {banner.title}
                </Text>
                {/* What the target plan adds over the current one. In a
                  self-service-only build agent features are filtered out
                  (planLogic.ts). Nothing to list → no second line at all. */}
                {banner.benefits ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 12.5,
                      color: 'rgba(255,255,255,0.85)',
                      marginTop: 1,
                    }}
                  >
                    {banner.benefits}
                  </Text>
                ) : null}
              </View>
              <Ic.chevR size={20} color="#fff" strokeWidth={1.8} />
            </LinearGradient>
          </Pressable>
        ) : null}

        {/* Menu group 1 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: EX.color.line06,
            borderRadius: 22,
            overflow: 'hidden',
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          {/* Consultations + Messages: hidden in a self-service-only build
              (japa#334). */}
          {selfServiceOnly ? null : (
            <>
              <ProfileRow
                icon={Ic.cal}
                label="My consultations"
                value={consultsValue}
                onPress={() => router.push('/consultations')}
              />
              <ProfileRow
                icon={Ic.msg}
                label="Messages"
                value={messagesValue}
                divider
                onPress={() => router.push('/messages')}
              />
            </>
          )}
          <ProfileRow
            icon={Ic.docs}
            label="My documents"
            value={documentsValue}
            // First row of the card when the two above are hidden: no
            // divider line along the card's top edge.
            divider={!selfServiceOnly}
            onPress={() => router.push('/documents')}
          />
          {/* Verify identity + Payments: hidden in a self-service-only build
              (japa#334; no self-service screen needs KYC, and Payments lists
              only consultation / agent fees). */}
          {selfServiceOnly ? null : (
            <>
              <ProfileRow
                icon={Ic.shield}
                label="Verify identity"
                value={identityValue}
                divider
                onPress={() => router.push('/verify-identity')}
              />
              <ProfileRow
                icon={Ic.cards}
                label="Payments"
                value={paymentsValue}
                divider
                onPress={() => router.push('/payments')}
              />
            </>
          )}
          <ProfileRow
            icon={Ic.heart}
            label="Saved destinations"
            // Same single source as the "Saved" stat (see `savedCount`).
            value={savedCount}
            divider
            onPress={() => router.push('/saved')}
          />
        </View>

        {/* Menu group 2 */}
        <View
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: EX.color.line06,
            borderRadius: 22,
            overflow: 'hidden',
            marginTop: 14,
            shadowColor: '#171326',
            shadowOpacity: 0.04,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
        >
          <ProfileRow
            icon={Ic.sliders}
            label="Settings"
            onPress={() => router.push('/settings')}
          />
          <ProfileRow
            icon={Ic.crown}
            label="Subscription"
            value={subscriptionValue}
            divider
            onPress={() => router.push('/subscription')}
          />
          <ProfileRow
            icon={Ic.bell}
            label="Notifications"
            divider
            onPress={() => router.push('/notifications')}
          />
          <ProfileRow
            icon={Ic.shield}
            label="Privacy & security"
            divider
            onPress={() => router.push('/settings')}
          />
          <ProfileRow
            icon={Ic.msg}
            label="Help & support"
            divider
            onPress={() => router.push('/settings')}
          />
        </View>

        {/* Sign out — real Firebase logout, then back to the auth entry */}
        <Pressable
          onPress={onSignOut}
          style={{
            marginTop: 14,
            height: 52,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: EX.color.line10,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ fontSize: 15, fontWeight: '700', color: EX.color.danger }}
          >
            Sign out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
