// ─────────────────────────────────────────────────────────────────────────────
// Explorer view-model types (japa#145).
//
// The shapes the coral/cream Explorer screens render. The `live*.ts` mappers
// in src/components/explorer/ convert backend records (the other files in
// src/types/) into these. They used to live next to the demo fixtures in
// explorer/data.ts; the fixtures are gone, the shapes stay here.
//
// Field names are terse because they came 1:1 from the design prototype
// (`n` = name, `r` = rating, `rev` = review count, …); each is documented.
// ─────────────────────────────────────────────────────────────────────────────

/** A destination tile / detail: one visa route in one country. */
export type Dest = {
  /** Visa type id (route param for /destination/[id]). */
  id: string;
  /** Country display name. */
  country: string;
  /** Display city from the assets module ('' when unknown). */
  city: string;
  /** Lower-case ISO2 code (flag + country art key). */
  flag: string;
  /** Visa display name. */
  visa: string;
  /** Short category label ("Work", "Study", …). */
  cat: string;
  blurb: string;
  /** Hero photo URL (assets module). */
  img: string;
  /** Backdrop tone while the photo loads (assets module). */
  tone: string;
  processing: string;
  /** Government fee, USD, whole units. */
  price: number;
  /** "96%" or "—". */
  approval: string;
  /** Total applications on the route. */
  applied: number;
  /** Lead tile in the Explore grid. */
  featured?: boolean;
};

/** One "What you'll need" row: title, description, estimate. */
export type Req = { t: string; d: string; e: string };

/** An agency card / detail header. */
export type Agency = {
  id: string;
  name: string;
  city: string;
  flag: string;
  /** Founding year; 0 when unknown. */
  est: number;
  /** Number of agents. */
  agents: number;
  /** Rating, review count, success % (0 = unknown). */
  r: number;
  rev: number;
  succ: number;
  verified: boolean;
  cover: string;
  tone: string;
  blurb: string;
  badges: string[];
  /** Public page slug (#144), when the backend sends one. */
  slug?: string;
};

/** An agent card / detail. */
export type Agent = {
  id: string;
  /** Display name. */
  n: string;
  /** Headline specialisation. */
  spec: string;
  /** '' for an independent agent (no agency section). */
  agencyId: string;
  /** "Founder" | "Agent" | "Independent". */
  role: string;
  /** Rating, review count, success %, applications, years. */
  r: number;
  rev: number;
  succ: number;
  apps: number;
  years: number;
  /** Consultation fee in naira. */
  fee: number;
  /** Response-time label. */
  resp: string;
  /** Portrait gradient seed. */
  seed: number;
  tone: string;
  /** Accepting bookings. */
  avail: boolean;
  langs: string[];
  specs: string[];
  bio: string;
};

/** One review card. */
export type Review = {
  id: string;
  agentId: string;
  /** Reviewer display name. */
  n: string;
  seed: number;
  /** Rating 1–5. */
  r: number;
  ago: string;
  /** Review text. */
  t: string;
};

/** One timeline step on an application. */
export type AppStep = {
  t: string; // title
  d: string; // date / status label
  s: 'done' | 'current' | 'next';
  desc?: string; // what happened (timeline detail)
  by?: 'you' | 'agent' | 'system'; // who performed the step (drives the dot colour)
};

/** An application (portal "case") row / detail. */
export type App = {
  id: string;
  destId: string;
  /** Explorer STATUS key ('documents' | 'review' | …). */
  status: string;
  step: number;
  /** 0–1. */
  progress: number;
  ref: string;
  updated: string;
  agentId: string;
  next: { label: string; cta: string | null };
  steps: AppStep[];
  /** Resolved destination art + names for the row. */
  dest?: Dest;
};

/** One eligibility question, in the quiz's display shape. */
export type EligQ = {
  id: string;
  type: 'single' | 'number' | 'boolean' | 'multiple';
  q: string;
  help?: string;
  opts?: string[];
  unit?: string;
  min?: number;
  max?: number;
};

/** One conversation row. */
export type Convo = {
  id: string;
  agentId: string;
  last: string;
  ago: string;
  unread: number;
  online: boolean;
  agentName?: string;
};

/** A chat bubble. `files` carries any documents shared on the message. */
export type Msg = {
  from: 'agent' | 'me';
  t: string;
  at: string;
  files?: { url: string; name: string }[];
};

/** One consultation card / detail. */
export type Consult = {
  id: string;
  agentId: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  date: string;
  time: string;
  mode: string;
  topic: string;
  dur: string;
  notes?: string; // agent-facing note the applicant left when booking
  summary?: string; // post-call recap (completed consultations)
  agentName?: string; // denormalised agent display name
};

/** One notification row. */
export type Notif = {
  id: string;
  kind: 'status' | 'message' | 'action' | 'consult';
  unread: boolean;
  ago: string;
  title: string;
  body: string;
  destId?: string;
  agentId?: string;
};

/** One document slot on the self-service checklist. */
export type SSDoc = {
  name: string;
  file: string | null;
  status: 'verified' | 'uploaded' | 'rejected' | 'missing';
  reason?: string;
};

/** One requirement group on the self-service checklist. */
export type SSReq = {
  id: string;
  title: string;
  est: string;
  desc: string;
  docs: SSDoc[];
};

/** A subscription plan card. */
export type Plan = {
  id: string;
  name: string;
  /** Naira. */
  price: number;
  interval: string | null;
  tag: string | null;
  features: string[];
  blurb: string;
};

/** A welcome-carousel slide (static product content). */
export type OnboardSlide = {
  id: string;
  img: string;
  tone: string;
  kicker: string;
  title: string;
  body: string;
};

/** A "My documents" row. */
export type Doc = {
  id: string;
  name: string;
  category: string;
  status: 'verified' | 'uploaded' | 'rejected' | 'missing';
  file: string | null;
  size?: string;
  date: string;
  destId?: string;
};

/** A payments-history row. */
export type Payment = {
  id: string;
  title: string;
  sub: string;
  /** Naira. */
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'refunded';
  method: string;
};
