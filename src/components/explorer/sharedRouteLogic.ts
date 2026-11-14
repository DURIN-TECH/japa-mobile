// ─────────────────────────────────────────────────────────────────────────────
// Shared routes, applicant side (japa#237, P8a of #228) — pure helpers + copy.
//
// No React / RN imports so everything here is unit-tested directly.
//
// RULE: no country, bloc or nationality name is typed here. Every name arrives
// as data (`covers`, `options`, `proposal`, `stackLayers`, the application).
// The only words in this file are product chrome ("Shared rules", "Through").
// ─────────────────────────────────────────────────────────────────────────────

import { classifyStartError, type StartFailure } from '@/hooks/queryErrors';
import type { Application } from '@/types/applications.type';
import type { IntakeAnswer, IntakeQuestion } from '@/types/intake.type';
import type {
  ApplyThroughOption,
  ApplyThroughView,
  PublicSharedRoute,
  SharedRouteCountry,
  StackLayer,
} from '@/types/sharedRoute.type';

// ── Copy ─────────────────────────────────────────────────────────────────────
export const SHARED_COPY = {
  // Visa screen: "also covers"
  alsoCoversTitle: 'Also covers other countries',
  showAll: (n: number) => `Show all ${n}`,
  showFewer: 'Show fewer',

  // The sheet
  sheetTitle: 'Which country will you apply through?',
  oneQuestionFirst: 'One question first',
  onlyYouCanSay: 'Only you can say. We won’t choose this for you.',
  skip: 'Skip, I’ll pick myself',
  change: 'Change',
  suggested: 'Suggested',
  current: 'Current',
  ruleBecause: 'The rule points to this country because:',
  howRuleDecides: 'How the rule decides',
  orPickAnother: 'Or pick another',
  pickACountry: 'Pick a country',
  noRule:
    'We don’t have a rule that tells you which one. Pick the country you’ll use. You can change it until you pay.',
  chooseCountry: 'Choose a country',
  notAvailableTitle: 'We can’t offer this route yet',
  notAvailableFallback: 'Check back soon, or look at another visa.',
  close: 'Close',
  loadError:
    'We couldn’t load the countries for this visa. Check your connection and try again.',
  offlineOpen: 'You’re offline. Reconnect to choose a country.',
  offlineMid: 'You’re offline. Reconnect to continue.',
  answerError: 'We couldn’t save that answer. Try again.',
  changeError:
    'We couldn’t change the country. Check your connection and try again.',
  paidFallback: 'You can’t change the country after you’ve paid.',
  source: 'Source',

  // Application screen
  changeCountry: 'Change country',

  // Layers
  sharedRules: 'Shared rules',
  a11yShared: 'From the shared rules',
  notCheckedCaption: 'Doesn’t include everything yet',

  // Intake
  intakeOnce:
    'Some of these questions cover every country this visa covers, so you only answer them once.',
  intakeMissing:
    'Part of the rules is not ready yet. You can answer what’s here now, and we’ll ask for anything else when it’s ready.',
} as const;

// ── 1. "Also covers other countries" ─────────────────────────────────────────

/** How many other countries show before "Show all". */
export const COVERS_COLLAPSED = 6;

/** The route's countries other than the one on screen (compared case-blind). */
export function otherCovers(
  route: PublicSharedRoute | null | undefined,
  thisCountryCode: string | null | undefined,
): SharedRouteCountry[] {
  if (!route) return [];
  const mine = (thisCountryCode ?? '').toUpperCase();
  return (route.covers ?? []).filter(
    (c) => (c.countryCode ?? '').toUpperCase() !== mine,
  );
}

/** The block shows only when there is at least one OTHER country. */
export function showAlsoCovers(
  route: PublicSharedRoute | null | undefined,
  thisCountryCode: string | null | undefined,
): boolean {
  return otherCovers(route, thisCountryCode).length > 0;
}

/** "One application, sent through one country. {n} countries in all." (n includes this one). */
export function alsoCoversSub(route: PublicSharedRoute): string {
  return `One application, sent through one country. ${route.covers.length} countries in all.`;
}

/** The first six, or all of them when expanded. Sorted as returned. */
export function visibleCovers(
  others: SharedRouteCountry[],
  expanded: boolean,
): SharedRouteCountry[] {
  return expanded ? others : others.slice(0, COVERS_COLLAPSED);
}

/** True when there are more than six others (so the toggle link shows). */
export function hasMoreCovers(others: SharedRouteCountry[]): boolean {
  return others.length > COVERS_COLLAPSED;
}

/** Destination-row pill: "Also covers {n} other countries" (n = covers - 1), or null. */
export function alsoCoversPillLabel(
  route: PublicSharedRoute | null | undefined,
): string | null {
  if (!route) return null;
  const n = (route.covers?.length ?? 0) - 1;
  if (n < 1) return null;
  return n === 1
    ? 'Also covers 1 other country'
    : `Also covers ${n} other countries`;
}

// ── 2. The sheet ─────────────────────────────────────────────────────────────

/** What the sheet shows, decided from the response and what the person did. */
export type SheetState = 'unavailable' | 'ask' | 'proposal' | 'list';

/** `skipped` = "Skip, I'll pick myself" (the plain list, no proposal). */
export function sheetState(
  view: ApplyThroughView,
  skipped: boolean,
): SheetState {
  if (!view.available || (view.options ?? []).length === 0) {
    return 'unavailable';
  }
  if (skipped) return 'list';
  if (view.competence && view.result?.status === 'ask') return 'ask';
  if (view.proposal && view.proposal.offered) return 'proposal';
  return 'list';
}

/** The question the rule is waiting on (never decided for the person), or null. */
export function questionToAsk(view: ApplyThroughView): IntakeQuestion | null {
  if (view.result?.status !== 'ask') return null;
  const id = view.result.questionId;
  return (view.questions ?? []).find((q) => q.id === id) ?? null;
}

/** The proposed option when it is offered and is among the options, else null. */
export function proposedOption(
  view: ApplyThroughView,
): ApplyThroughOption | null {
  if (!view.proposal || !view.proposal.offered) return null;
  const code = view.proposal.countryCode.toUpperCase();
  return (
    (view.options ?? []).find((o) => o.countryCode.toUpperCase() === code) ??
    null
  );
}

/** Options in display order: the proposal first (proposal state), the rest as returned. */
export function orderedOptions(
  view: ApplyThroughView,
  state: SheetState,
): ApplyThroughOption[] {
  const all = view.options ?? [];
  const first = state === 'proposal' ? proposedOption(view) : null;
  if (!first) return all;
  return [first, ...all.filter((o) => o !== first)];
}

/**
 * The country selected when the sheet opens:
 *  - change mode: the current country;
 *  - a proposal that is offered: the proposal (still needs the CTA press);
 *  - otherwise nothing (never defaulted).
 */
export function initialSelection(
  view: ApplyThroughView,
  state: SheetState,
  mode: 'start' | 'change',
  currentCode?: string | null,
): string | null {
  if (mode === 'change' && currentCode) return currentCode.toUpperCase();
  if (state === 'proposal') return proposedOption(view)?.countryCode ?? null;
  return null;
}

/**
 * The note shown when the person picks a country other than the rule's
 * proposal. Information, not a warning. Null when nothing differs or there is
 * no proposal (a plain list never shows it).
 */
export function choiceNote(
  view: ApplyThroughView,
  selectedCode: string | null,
  state: SheetState,
): string | null {
  if (state !== 'proposal' || !selectedCode || !view.proposal) return null;
  if (!view.proposal.offered) return null;
  if (selectedCode.toUpperCase() === view.proposal.countryCode.toUpperCase()) {
    return null;
  }
  const chosen = (view.options ?? []).find(
    (o) => o.countryCode.toUpperCase() === selectedCode.toUpperCase(),
  );
  if (!chosen) return null;
  return `The rule points to ${view.proposal.countryName}. You chose ${chosen.countryName}. We’ll keep a note that this was your choice.`;
}

/** Note for an "unknown" rule result: "We can't tell ... {why}" (why omitted when empty). */
export function unknownNote(view: ApplyThroughView): string | null {
  if (view.result?.status !== 'unknown') return null;
  const why = (view.result.why ?? '').trim();
  return `We can’t tell from your answers which country the rule points to.${why ? ` ${why}` : ''}`;
}

/** "From $120" (USD, as the visa screen shows), or null without a price. */
export function fromPrice(option: ApplyThroughOption): string | null {
  const c = option.baseCostUsd;
  if (c == null || !Number.isFinite(c)) return null;
  return `From $${Math.round(c)}`;
}

/** The CTA: its label and whether it can be pressed. */
export function ctaState(
  mode: 'start' | 'change',
  selected: ApplyThroughOption | null,
  currentCode: string | null | undefined,
): { label: string; disabled: boolean } {
  if (!selected) return { label: SHARED_COPY.chooseCountry, disabled: true };
  if (mode === 'change') {
    const same =
      !!currentCode &&
      currentCode.toUpperCase() === selected.countryCode.toUpperCase();
    return same
      ? { label: `Applying through ${selected.countryName}`, disabled: true }
      : { label: `Change to ${selected.countryName}`, disabled: false };
  }
  return { label: `Apply through ${selected.countryName}`, disabled: false };
}

/** A readable form of an answer, for the collapsed "{question}: {answer}" line. */
export function answerText(q: IntakeQuestion, a: IntakeAnswer): string {
  const label = (v: string) =>
    q.options?.find((o) => o.value === v)?.label ?? v;
  if (typeof a === 'boolean') return a ? 'Yes' : 'No';
  if (typeof a === 'string') return label(a);
  if (Array.isArray(a)) return a.map(label).join(', ');
  return '';
}

/** Answered questions (in question order) that have a readable answer. */
export function answeredQuestions(
  view: ApplyThroughView,
  answers: Record<string, IntakeAnswer>,
): Array<{ question: IntakeQuestion; text: string }> {
  return (view.questions ?? [])
    .filter((q) => answers[q.id] !== undefined)
    .map((q) => ({ question: q, text: answerText(q, answers[q.id]) }))
    .filter((r) => r.text !== '');
}

/** Drop one answer and every later one (question order): changing an answer re-asks. */
export function answersWithoutFrom(
  questions: IntakeQuestion[],
  answers: Record<string, IntakeAnswer>,
  questionId: string,
): Record<string, IntakeAnswer> {
  const at = questions.findIndex((q) => q.id === questionId);
  if (at < 0) return answers;
  const drop = new Set(questions.slice(at).map((q) => q.id));
  return Object.fromEntries(
    Object.entries(answers).filter(([id]) => !drop.has(id)),
  );
}

/** Body of POST /applications for a shared route (sent INSTEAD of visaTypeId/countryCode). */
export function buildSharedStartInput(args: {
  sharedRouteId: string;
  throughCountryCode: string;
  competenceAnswers?: Record<string, IntakeAnswer>;
  confirmNew?: boolean;
}) {
  const hasAnswers =
    !!args.competenceAnswers && Object.keys(args.competenceAnswers).length > 0;
  return {
    sharedRouteId: args.sharedRouteId,
    throughCountryCode: args.throughCountryCode.toUpperCase(),
    mode: 'self' as const,
    ...(hasAnswers ? { competenceAnswers: args.competenceAnswers } : {}),
    ...(args.confirmNew ? { confirmNew: true } : {}),
  };
}

/** Plain-words message for a failed change of country. */
export function changeCountryError(error: unknown): string {
  const e = (error ?? {}) as { code?: string; message?: string };
  if (e.code === 'ALREADY_PAID') {
    // The backend's own message when it gave one.
    return e.message?.trim() || SHARED_COPY.paidFallback;
  }
  if (e.code === 'NOT_EDITABLE' || e.code === 'NOT_SHARED_ROUTE') {
    return e.message?.trim() || SHARED_COPY.changeError;
  }
  return SHARED_COPY.changeError;
}

// ── 3. The application screen ────────────────────────────────────────────────

type SharedApp = Pick<
  Application,
  'routeName' | 'throughCountryCode' | 'canChangeThroughCountry'
>;

/** A shared-route application has a route name; ordinary ones look as today. */
export function showThroughChip(app: SharedApp): boolean {
  return !!app.routeName;
}

/** The route-name pill shows when it exists and differs from the visa name. */
export function showRoutePill(
  app: SharedApp,
  visaName: string | null | undefined,
): boolean {
  return !!app.routeName && app.routeName !== (visaName ?? '');
}

/** "Change country" shows ONLY when the backend says so (never computed here). */
export function canShowChangeCountry(app: SharedApp): boolean {
  return showThroughChip(app) && app.canChangeThroughCountry === true;
}

// ── Layer labels (findings, checklist) ───────────────────────────────────────

/** A rulebook with fewer than two layers shows no pills (an ordinary visa). */
export function hasLayers(layers: StackLayer[] | null | undefined): boolean {
  return !!layers && layers.length > 1;
}

export interface LayerLabel {
  kind: 'shared' | 'country';
  /** Pill text. */
  text: string;
  /** Screen-reader label. */
  a11y: string;
}

/**
 * The pill for an item's `layerKey`, from the stack's own layer list. Null when
 * the item has no key, the rulebook is one layer, or the key is unknown.
 */
export function layerLabel(
  layers: StackLayer[] | null | undefined,
  layerKey: string | null | undefined,
): LayerLabel | null {
  if (!layerKey || !hasLayers(layers)) return null;
  const layer = layers!.find((l) => l.key === layerKey);
  if (!layer) return null;
  if (layer.kind === 'shared') {
    return {
      kind: 'shared',
      text: SHARED_COPY.sharedRules,
      a11y: SHARED_COPY.a11yShared,
    };
  }
  // A country's own layer: the name is data; without one we say nothing rather than guess.
  if (!layer.countryName) return null;
  return {
    kind: 'country',
    text: `Rules for ${layer.countryName}`,
    a11y: `From the rules for ${layer.countryName}`,
  };
}

/** Names of the layers whose rules are not ready ("the shared rules", "the rules for {name}"). */
export function missingLayerNames(
  layers: StackLayer[] | null | undefined,
): string[] {
  if (!hasLayers(layers)) return [];
  return layers!
    .filter((l) => l.status === 'missing')
    .map((l) =>
      l.kind === 'shared'
        ? 'the shared rules'
        : l.countryName
          ? `the rules for ${l.countryName}`
          : 'part of the rules',
    );
}

/** The "not checked yet" note, or null when every layer is ready. */
export function missingLayerNote(
  layers: StackLayer[] | null | undefined,
): string | null {
  const names = missingLayerNames(layers);
  if (names.length === 0) return null;
  return `Part of the rules is not ready yet, so this check leaves out ${names.join(' and ')}. What’s listed below is still right.`;
}

/** Whether to say the result "doesn't include everything yet". */
export function hasMissingLayer(
  layers: StackLayer[] | null | undefined,
): boolean {
  return missingLayerNames(layers).length > 0;
}

/** A start failure the sheet can show: the shared ones plus "that country can't be used". */
export type SharedStartFailure = StartFailure | 'country';

/** Pure: classify a rejected shared-route create call. */
export function classifySharedStartError(error: unknown): SharedStartFailure {
  const e = (error ?? {}) as { status?: number; code?: string };
  if (
    e.status === 422 &&
    (e.code === 'COUNTRY_NOT_A_DESTINATION' || e.code === 'COUNTRY_NOT_OFFERED')
  ) {
    return 'country';
  }
  return classifyStartError(error);
}
