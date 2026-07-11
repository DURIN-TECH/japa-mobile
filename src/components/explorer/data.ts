// ─────────────────────────────────────────────────────────────────────────────
// Japa / Seli Destination Explorer — demo data
//
// Faithful TypeScript port of the prototype's explorer/data.jsx. The Explorer is
// a self-contained showcase experience, so it ships with this static demo data
// (persona: "Alex Kayode", Lagos). Wiring these screens to the live React Query
// hooks (useCountriesWithVisas, useAgents, …) is a follow-up; the shapes below
// intentionally mirror the prototype 1:1.
// ─────────────────────────────────────────────────────────────────────────────

// Unsplash CDN helper — image id → sized URL.
export const IMG = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

// Currency helper.
export const NAIRA = (n: number) => '₦' + n.toLocaleString();

// flagcdn helper — ISO2 code → round flag image URL.
export const flagUrl = (code: string, w = 160) =>
  `https://flagcdn.com/w${w}/${code.toLowerCase()}.png`;

export type Dest = {
  id: string;
  country: string;
  city: string;
  flag: string;
  visa: string;
  cat: string;
  blurb: string;
  img: string;
  tone: string;
  processing: string;
  price: number;
  approval: string;
  applied: number;
  featured?: boolean;
};

export const DESTS: Dest[] = [
  {
    id: 'us', country: 'United States', city: 'New York', flag: 'us',
    visa: 'H-1B Work Visa', cat: 'Work',
    blurb: 'Specialty-occupation work visa for professionals sponsored by a U.S. employer.',
    img: IMG('1496442226666-8d4d0e62e6e9'), tone: '#2A3A52',
    processing: '6–8 mo', price: 460, approval: '98%', applied: 1234, featured: true,
  },
  {
    id: 'gb', country: 'United Kingdom', city: 'London', flag: 'gb',
    visa: 'Skilled Worker', cat: 'Work',
    blurb: 'Long-term work route for those with a job offer from a licensed UK sponsor.',
    img: IMG('1513635269975-59663e0ac1ad'), tone: '#3A2E38',
    processing: '8–10 wks', price: 719, approval: '96%', applied: 563,
  },
  {
    id: 'ca', country: 'Canada', city: 'Toronto', flag: 'ca',
    visa: 'Express Entry PR', cat: 'PR',
    blurb: 'Points-based permanent residency for skilled workers across the country.',
    img: IMG('1517935706615-2717063c2225'), tone: '#1F3A44',
    processing: '10–12 mo', price: 1500, approval: '94%', applied: 822,
  },
  {
    id: 'au', country: 'Australia', city: 'Sydney', flag: 'au',
    visa: 'Subclass 485', cat: 'Study',
    blurb: 'Post-study work visa letting graduates live and work temporarily in Australia.',
    img: IMG('1506973035872-a4ec16b8e8d9'), tone: '#244A55',
    processing: '4–6 mo', price: 1895, approval: '95%', applied: 411,
  },
  {
    id: 'jp', country: 'Japan', city: 'Tokyo', flag: 'jp',
    visa: 'Engineer / Specialist', cat: 'Work',
    blurb: 'Work status of residence for engineers and specialists in humanities.',
    img: IMG('1540959733332-eab4deabeeaf'), tone: '#3A2733',
    processing: '1–3 mo', price: 310, approval: '97%', applied: 506,
  },
  {
    id: 'de', country: 'Germany', city: 'Berlin', flag: 'de',
    visa: 'EU Blue Card', cat: 'Work',
    blurb: 'Residence permit for highly-qualified non-EU professionals with a job offer.',
    img: IMG('1560969184-10fe8719e047'), tone: '#2C3540',
    processing: '6–8 wks', price: 200, approval: '93%', applied: 328,
  },
  {
    id: 'fr', country: 'France', city: 'Paris', flag: 'fr',
    visa: 'Talent Passport', cat: 'Work',
    blurb: 'Multi-year residence permit for skilled talent, founders and researchers.',
    img: IMG('1502602898657-3e91760cbb34'), tone: '#34303E',
    processing: '2–3 mo', price: 280, approval: '95%', applied: 374,
  },
  {
    id: 'ae', country: 'United Arab Emirates', city: 'Dubai', flag: 'ae',
    visa: 'Golden Visa', cat: 'PR',
    blurb: 'Long-term renewable residency for investors, talent and skilled workers.',
    img: IMG('1512453979798-5ea266f8880c'), tone: '#403225',
    processing: '3–5 wks', price: 545, approval: '96%', applied: 690,
  },
];

export const CATS = ['All', 'Work', 'Study', 'PR', 'Family'];

export type Req = { t: string; d: string; e: string };
export const REQS: Req[] = [
  { t: 'Passport & identity', d: 'Valid passport, photos, prior visas', e: 'Ready' },
  { t: 'Employment offer', d: 'Offer letter, sponsor licence, role detail', e: '1–2 wks' },
  { t: 'Qualifications', d: 'Degree, transcripts, credential evaluation', e: '2–3 wks' },
  { t: 'Financial proof', d: 'Bank statements, maintenance funds', e: '1 wk' },
];

export type Agency = {
  id: string; name: string; city: string; flag: string; est: number;
  agents: number; r: number; rev: number; succ: number; verified: boolean;
  cover: string; tone: string; blurb: string; badges: string[];
};
export const AGENCIES: Agency[] = [
  {
    id: 'ag1', name: 'Pathway Global', city: 'Lagos', flag: 'ng', est: 2016,
    agents: 24, r: 4.9, rev: 3412, succ: 96, verified: true,
    cover: IMG('1568515387631-8b650bbcdb90'), tone: '#1F3A44',
    blurb: 'Nigeria’s most-trusted migration partner — full-service visa, PR and relocation across 30+ countries.',
    badges: ['Govt. licensed', 'ICEF certified'],
  },
  {
    id: 'ag2', name: 'Horizon Migration', city: 'Abuja', flag: 'ng', est: 2019,
    agents: 11, r: 4.8, rev: 1187, succ: 94, verified: true,
    cover: IMG('1542315192-1f61a1792f33'), tone: '#2C3540',
    blurb: 'Boutique advisory specialising in study routes and skilled-worker pathways.',
    badges: ['Govt. licensed'],
  },
];

export type Agent = {
  id: string; n: string; spec: string; agencyId: string; role: string;
  r: number; rev: number; succ: number; apps: number; years: number; fee: number;
  resp: string; seed: number; tone: string; avail: boolean;
  langs: string[]; specs: string[]; bio: string;
};
export const AGENTS: Agent[] = [
  {
    id: 'a1', n: 'Sarah Johnson', spec: 'US Visa Expert', agencyId: 'ag1', role: 'Founder',
    r: 4.9, rev: 1234, succ: 98, apps: 1450, years: 12, fee: 35000,
    resp: '2–4 hrs', seed: 0, tone: '#2A3A52', avail: true,
    langs: ['English', 'Yoruba'], specs: ['Work Visa', 'H-1B', 'Green Card'],
    bio: 'Twelve years guiding professionals into the US. Former immigration paralegal; ~1,450 approved petitions and counting.',
  },
  {
    id: 'a2', n: 'Michael Okafor', spec: 'Business & Investment', agencyId: 'ag1', role: 'Senior agent',
    r: 4.9, rev: 2156, succ: 95, apps: 2100, years: 9, fee: 50000,
    resp: '1–3 hrs', seed: 3, tone: '#3A2E38', avail: true,
    langs: ['English', 'Igbo'], specs: ['Golden Visa', 'Investor', 'Startup'],
    bio: 'Specialises in investor and golden-visa routes across the UAE, Portugal and the Caribbean.',
  },
  {
    id: 'a3', n: 'Amara Eze', spec: 'Student Visa Specialist', agencyId: 'ag2', role: 'Lead agent',
    r: 4.8, rev: 824, succ: 97, apps: 980, years: 7, fee: 25000,
    resp: '3–5 hrs', seed: 4, tone: '#244A55', avail: false,
    langs: ['English', 'French'], specs: ['Study Permit', 'Post-study work', 'Dependants'],
    bio: 'Helps students land at top universities in Canada, the UK and Australia — visa to arrival.',
  },
];

export type Review = { id: string; agentId: string; n: string; seed: number; r: number; ago: string; t: string };
export const REVIEWS: Review[] = [
  { id: 'r1', agentId: 'a1', n: 'Tunde A.', seed: 1, r: 5, ago: '2 wks ago', t: 'Sarah made my H-1B feel effortless. Every document checked twice, approved first try.' },
  { id: 'r2', agentId: 'a1', n: 'Blessing O.', seed: 5, r: 5, ago: '1 mo ago', t: 'Responsive, calm and genuinely kind through a stressful process. Worth every naira.' },
  { id: 'r3', agentId: 'a1', n: 'David M.', seed: 2, r: 4, ago: '2 mo ago', t: 'Great guidance on the petition. A small delay on scheduling but the outcome was perfect.' },
];

export const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  documents: { label: 'Documents required', fg: '#B26A14', bg: '#FCEAC8' },
  review: { label: 'Under review', fg: '#2F62A0', bg: '#DCEBF7' },
  interview: { label: 'Interview scheduled', fg: '#5A49C4', bg: '#ECE9FB' },
  submitted: { label: 'Submitted', fg: '#1F8A7A', bg: '#D6F0EC' },
  approved: { label: 'Approved', fg: '#1E8E55', bg: '#D6F2E2' },
};

export type AppStep = { t: string; d: string; s: 'done' | 'current' | 'next' };
export type App = {
  id: string; destId: string; status: string; step: number; progress: number;
  ref: string; updated: string; agentId: string;
  next: { label: string; cta: string | null };
  steps: AppStep[];
};
export const APPS: App[] = [
  {
    id: 'ap1', destId: 'us', status: 'review', step: 3, progress: 0.62,
    ref: 'JP-4821', updated: '2 days ago', agentId: 'a1',
    next: { label: 'Awaiting embassy slot — no action needed', cta: null },
    steps: [
      { t: 'Application started', d: 'Mar 2', s: 'done' },
      { t: 'Documents submitted', d: 'Mar 14', s: 'done' },
      { t: 'Payment confirmed', d: 'Mar 16', s: 'done' },
      { t: 'Under review', d: 'In progress', s: 'current' },
      { t: 'Submitted to embassy', d: 'Est. Apr', s: 'next' },
      { t: 'Decision', d: 'Est. May', s: 'next' },
    ],
  },
  {
    id: 'ap2', destId: 'ca', status: 'documents', step: 1, progress: 0.32,
    ref: 'JP-4790', updated: '5 hrs ago', agentId: 'a3',
    next: { label: 'Upload proof of funds', cta: 'Upload document' },
    steps: [
      { t: 'Application started', d: 'Mar 20', s: 'done' },
      { t: 'Documents required', d: '1 of 4 left', s: 'current' },
      { t: 'Payment', d: 'Pending', s: 'next' },
      { t: 'Under review', d: '—', s: 'next' },
      { t: 'Decision', d: '—', s: 'next' },
    ],
  },
  {
    id: 'ap3', destId: 'jp', status: 'interview', step: 4, progress: 0.82,
    ref: 'JP-4655', updated: '1 day ago', agentId: 'a2',
    next: { label: 'Interview · Apr 18, 10:00 — Tokyo Embassy', cta: 'View details' },
    steps: [
      { t: 'Application started', d: 'Feb 8', s: 'done' },
      { t: 'Documents submitted', d: 'Feb 19', s: 'done' },
      { t: 'Payment confirmed', d: 'Feb 21', s: 'done' },
      { t: 'Submitted to embassy', d: 'Mar 9', s: 'done' },
      { t: 'Interview scheduled', d: 'Apr 18', s: 'current' },
      { t: 'Decision', d: 'Est. Apr', s: 'next' },
    ],
  },
];

export type EligQ = {
  id: string; type: 'single' | 'number' | 'boolean' | 'multiple';
  q: string; help?: string; opts?: string[]; unit?: string; min?: number; max?: number;
};
export const ELIG_Q: EligQ[] = [
  { id: 'q1', type: 'single', q: 'What is your highest qualification?', help: 'Your most advanced completed degree or certificate.', opts: ["Master's or PhD", "Bachelor's degree", 'Diploma / HND', 'Secondary school'] },
  { id: 'q2', type: 'number', q: 'Years of relevant work experience?', unit: 'years', min: 0, max: 40 },
  { id: 'q3', type: 'boolean', q: 'Do you have a job offer from a sponsoring employer?', help: 'A licensed sponsor is required for most work visas.' },
  { id: 'q4', type: 'single', q: 'How would you rate your English proficiency?', opts: ['Native / fluent', 'Advanced (IELTS 7+)', 'Intermediate', 'Basic'] },
  { id: 'q5', type: 'multiple', q: 'Which of these can you provide?', opts: ['Proof of funds', 'Clean police record', 'Medical certificate', 'Prior travel history'] },
];
export const ELIG_RESULT = {
  score: 82, verdict: 'Likely eligible',
  summary: 'Based on your answers, you meet the core criteria for the H-1B Work Visa. A specialist can strengthen your petition further.',
  matched: ['Meets qualification threshold', 'Sufficient work experience', 'Strong English proficiency', 'Employer sponsorship confirmed'],
  gaps: ['Proof of funds not yet uploaded', 'Medical certificate recommended'],
};

export type Convo = { id: string; agentId: string; last: string; ago: string; unread: number; online: boolean };
export const CONVOS: Convo[] = [
  { id: 'c1', agentId: 'a1', last: 'Great — I’ve reviewed your petition draft. One small edit and we’re set.', ago: '2m', unread: 2, online: true },
  { id: 'c2', agentId: 'a3', last: 'Your I-20 looks good. Let’s book the interview prep for next week.', ago: '1h', unread: 0, online: false },
  { id: 'c3', agentId: 'a2', last: 'The golden-visa route is open again for Q3. Want me to send details?', ago: '3d', unread: 0, online: true },
];
export type Msg = { from: 'agent' | 'me'; t: string; at: string };
export const THREAD: Record<string, Msg[]> = {
  c1: [
    { from: 'agent', t: 'Hi Alex! I’m Sarah, I’ll be handling your H-1B petition. 👋', at: '9:02' },
    { from: 'me', t: 'Thank you Sarah! Excited to get started.', at: '9:04' },
    { from: 'agent', t: 'Could you upload your degree certificate and last 3 payslips when you have a moment?', at: '9:05' },
    { from: 'me', t: 'Just uploaded them to the documents tab.', at: '9:41' },
    { from: 'agent', t: 'Great — I’ve reviewed your petition draft. One small edit and we’re set.', at: '9:48' },
  ],
};

export type Consult = {
  id: string; agentId: string; status: 'upcoming' | 'completed' | 'cancelled';
  date: string; time: string; mode: string; topic: string; dur: string;
  notes?: string; // agent-facing note the applicant left when booking
  summary?: string; // post-call recap (completed consultations)
};
export const CONSULTS: Consult[] = [
  { id: 'cs1', agentId: 'a1', status: 'upcoming', date: 'Tue, Apr 15', time: '10:00 AM', mode: 'Video call', topic: 'H-1B petition review', dur: '45 min', notes: 'Would like to focus on strengthening the specialty-occupation argument.' },
  { id: 'cs2', agentId: 'a3', status: 'upcoming', date: 'Fri, Apr 18', time: '2:30 PM', mode: 'Phone call', topic: 'Study-permit options for Canada', dur: '30 min' },
  { id: 'cs3', agentId: 'a2', status: 'completed', date: 'Mar 28', time: '11:00 AM', mode: 'Video call', topic: 'Golden-visa eligibility', dur: '45 min', summary: 'Confirmed you meet the investor threshold. Next: gather 6 months of bank statements and a clean police record before we file.' },
  { id: 'cs4', agentId: 'a1', status: 'completed', date: 'Mar 12', time: '4:00 PM', mode: 'Video call', topic: 'Initial consultation', dur: '30 min', summary: 'Walked through the H-1B timeline and document checklist. You are on track — begin uploading your degree certificate and payslips.' },
  { id: 'cs5', agentId: 'a3', status: 'cancelled', date: 'Mar 5', time: '9:00 AM', mode: 'Phone call', topic: 'Document checklist', dur: '30 min' },
];

export type Notif = {
  id: string; kind: 'status' | 'message' | 'action' | 'consult'; unread: boolean;
  ago: string; title: string; body: string; destId?: string; agentId?: string;
};
export const NOTIFS: Notif[] = [
  { id: 'n1', kind: 'status', unread: true, ago: '2h', title: 'Your US application moved to Under Review', body: 'The embassy has received your documents.', destId: 'us' },
  { id: 'n2', kind: 'message', unread: true, ago: '2h', title: 'Sarah Johnson sent you a message', body: 'Great — I’ve reviewed your petition draft…', agentId: 'a1' },
  { id: 'n3', kind: 'action', unread: true, ago: '5h', title: 'Action needed on your Canada application', body: 'Upload proof of funds to continue.', destId: 'ca' },
  { id: 'n4', kind: 'consult', unread: false, ago: '1d', title: 'Consultation confirmed with Amara Eze', body: 'Fri, Apr 18 · 2:30 PM · Phone call', agentId: 'a3' },
  { id: 'n5', kind: 'status', unread: false, ago: '3d', title: 'Interview scheduled for Japan', body: 'Apr 18, 10:00 — Tokyo Embassy.', destId: 'jp' },
];

export type SSDoc = { name: string; file: string | null; status: 'verified' | 'uploaded' | 'rejected' | 'missing'; reason?: string };
export type SSReq = { id: string; title: string; est: string; desc: string; docs: SSDoc[] };
export const SS: {
  destId: string; ref: string; status: string; progress: number;
  officialUrl: string; step: string; requirements: SSReq[];
} = {
  destId: 'ca', ref: 'JP-4790', status: 'documents', progress: 0.32,
  officialUrl: 'ircc.canada.ca', step: 'Step 2 of 5 · Upload documents',
  requirements: [
    { id: 'r1', title: 'Passport & identity', est: '5 min', desc: 'A clear scan of your passport bio page plus two recent photos.',
      docs: [{ name: 'Passport bio page', file: 'passport.pdf', status: 'verified' }, { name: 'Passport photo ×2', file: 'photos.jpg', status: 'uploaded' }] },
    { id: 'r2', title: 'Proof of funds', est: '1 wk', desc: 'Six months of bank statements showing sufficient settlement funds.',
      docs: [{ name: 'Bank statement (6 mo)', file: null, status: 'missing' }] },
    { id: 'r3', title: 'Qualifications', est: '2–3 wks', desc: 'Degree certificate and an ECA credential evaluation report.',
      docs: [{ name: 'Degree certificate', file: 'degree.pdf', status: 'verified' }, { name: 'ECA report', file: 'eca-report.pdf', status: 'rejected', reason: 'Expired — must be within 5 years' }] },
    { id: 'r4', title: 'Language test', est: '1 wk', desc: 'IELTS or CELPIP results meeting the minimum band score.',
      docs: [{ name: 'IELTS results', file: null, status: 'missing' }] },
  ],
};
export const DOC_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  verified: { label: 'Verified', fg: '#1E8E55', bg: '#D6F2E2' },
  uploaded: { label: 'In review', fg: '#2F62A0', bg: '#DCEBF7' },
  rejected: { label: 'Rejected', fg: '#C0453C', bg: '#FBE3E1' },
  missing: { label: 'Not uploaded', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

export const PLAN_FEATURES: Record<string, string> = {
  create: 'Create applications', messaging: 'Agent messaging', consults: 'Book consultations',
  docs: 'Document uploads', self: 'Self-service flow', priority: 'Priority support', alerts: 'Visa news alerts',
};
export type Plan = { id: string; name: string; price: number; interval: string | null; tag: string | null; features: string[]; blurb: string };
export const PLANS: Plan[] = [
  { id: 'free', name: 'Free', price: 0, interval: null, tag: null, features: ['create', 'alerts'], blurb: 'Explore visas and start one application.' },
  { id: 'plus', name: 'Japa Plus', price: 4500, interval: 'mo', tag: 'Most popular', features: ['create', 'messaging', 'docs', 'self', 'alerts'], blurb: 'Everything you need to self-manage your move.' },
  { id: 'pro', name: 'Japa Pro', price: 12000, interval: 'mo', tag: null, features: ['create', 'messaging', 'consults', 'docs', 'self', 'priority', 'alerts'], blurb: 'Unlimited access plus priority agent support.' },
];
export const CURRENT_PLAN = 'free';

// ── Promoted (sponsored) agencies — paid placement on Home ───────────────────
export type Promo = { id: string; label: string; headline: string; cta: string; accent: string };
export const PROMOS: Promo[] = [
  { id: 'ag1', label: 'Sponsored', headline: '30% off your first consultation', cta: 'Claim offer', accent: '#1F6E63' },
  { id: 'ag2', label: 'Featured partner', headline: 'Free eligibility review this month', cta: 'Book now', accent: '#2F62A0' },
];

// ── Auth onboarding carousel slides ──────────────────────────────────────────
export type OnboardSlide = { id: string; img: string; tone: string; kicker: string; title: string; body: string };
export const ONBOARD: OnboardSlide[] = [
  { id: 'o1', img: IMG('1436491865332-7a61a109cc05'), tone: '#1E2A44', kicker: 'Your move, made simple', title: 'Every visa,\none clear path', body: 'Explore hand-picked routes to 30+ countries with real processing times and costs.' },
  { id: 'o2', img: IMG('1521737604893-d14cc237f11d'), tone: '#2A2036', kicker: 'Guided by experts', title: 'Vetted agents\nby your side', body: 'Message government-licensed specialists who’ve done it hundreds of times.' },
  { id: 'o3', img: IMG('1526304640581-d334cdbbf45e'), tone: '#243A44', kicker: 'Always in the loop', title: 'Track it all,\nstart to visa', body: 'Live status, document checklists and reminders — from application to approval.' },
];

// ── Country list for onboarding (nationality picker) ─────────────────────────
export type Country = { code: string; name: string };
export const COUNTRIES: Country[] = [
  { code: 'ng', name: 'Nigeria' },
  { code: 'gh', name: 'Ghana' },
  { code: 'ke', name: 'Kenya' },
  { code: 'za', name: 'South Africa' },
  { code: 'eg', name: 'Egypt' },
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'ie', name: 'Ireland' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'jp', name: 'Japan' },
  { code: 'in', name: 'India' },
];

// ── My documents (profile → documents) ───────────────────────────────────────
export type Doc = {
  id: string; name: string; category: string;
  status: 'verified' | 'uploaded' | 'rejected' | 'missing';
  file: string | null; size?: string; date: string; destId?: string;
};
export const DOCUMENTS: Doc[] = [
  { id: 'd1', name: 'Passport bio page', category: 'Identity', status: 'verified', file: 'passport.pdf', size: '1.2 MB', date: 'Mar 14', destId: 'us' },
  { id: 'd2', name: 'Passport photo ×2', category: 'Identity', status: 'uploaded', file: 'photos.jpg', size: '840 KB', date: 'Mar 14', destId: 'us' },
  { id: 'd3', name: 'Degree certificate', category: 'Qualifications', status: 'verified', file: 'degree.pdf', size: '2.1 MB', date: 'Mar 15', destId: 'us' },
  { id: 'd4', name: 'ECA report', category: 'Qualifications', status: 'rejected', file: 'eca-report.pdf', size: '1.8 MB', date: 'Mar 20', destId: 'ca' },
  { id: 'd5', name: 'Bank statement (6 mo)', category: 'Financial', status: 'missing', file: null, date: '—', destId: 'ca' },
  { id: 'd6', name: 'Employment offer letter', category: 'Employment', status: 'verified', file: 'offer.pdf', size: '320 KB', date: 'Mar 10', destId: 'us' },
  { id: 'd7', name: 'IELTS results', category: 'Language', status: 'uploaded', file: 'ielts.pdf', size: '560 KB', date: 'Mar 22', destId: 'ca' },
];

// ── Payments / transactions (profile → payments) ─────────────────────────────
export type Payment = {
  id: string; title: string; sub: string; amount: number; date: string;
  status: 'paid' | 'pending' | 'refunded'; method: string;
};
export const PAYMENTS: Payment[] = [
  { id: 'pm1', title: 'Consultation — Sarah Johnson', sub: 'H-1B petition review', amount: 35000, date: 'Apr 12', status: 'paid', method: 'Card' },
  { id: 'pm2', title: 'Application service fee', sub: 'US · H-1B Work Visa', amount: 50000, date: 'Mar 16', status: 'paid', method: 'Paystack' },
  { id: 'pm3', title: 'Document review service', sub: 'Canada · Express Entry PR', amount: 25000, date: 'Apr 18', status: 'pending', method: '—' },
  { id: 'pm4', title: 'Consultation — Amara Eze', sub: 'Study-permit options', amount: 25000, date: 'Mar 28', status: 'paid', method: 'Card' },
  { id: 'pm5', title: 'Eligibility review', sub: 'Refunded — cancelled session', amount: 10000, date: 'Mar 5', status: 'refunded', method: 'Card' },
];
export const PAY_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  paid: { label: 'Paid', fg: '#1E8E55', bg: '#D6F2E2' },
  pending: { label: 'Pending', fg: '#B26A14', bg: '#FCEAC8' },
  refunded: { label: 'Refunded', fg: '#8B8499', bg: 'rgba(23,19,38,0.06)' },
};

// ── Saved destinations (profile → saved) ─────────────────────────────────────
export const SAVED = ['gb', 'ca', 'au', 'jp', 'de', 'fr', 'ae'];

// ── Payment requests on an application (agent-raised) ─────────────────────────
export type PaymentRequest = {
  id: string; appId: string; title: string; amount: number; agentId: string;
  status: 'pending' | 'paid'; due: string; note: string;
};
export const PAYMENT_REQUESTS: PaymentRequest[] = [
  { id: 'pr1', appId: 'ap2', title: 'Document review service', amount: 25000, agentId: 'a3', status: 'pending', due: 'Due Apr 20', note: 'Covers ECA verification and a re-submission of your credential report.' },
];
export const paymentRequestsForApp = (appId: string) => PAYMENT_REQUESTS.filter((p) => p.appId === appId);

// ── Common visa refusal reasons (visa breakdown) ─────────────────────────────
export const REJECTIONS = [
  'Incomplete or inconsistent documentation',
  'Insufficient proof of funds',
  'Weak demonstrated ties to home country',
  'Unexplained gaps in employment history',
  'Expired or out-of-date supporting documents',
];

// ── Lookup helpers ───────────────────────────────────────────────────────────
export const destById = (id?: string) => DESTS.find((d) => d.id === id);
export const agentById = (id?: string) => AGENTS.find((a) => a.id === id);
export const agencyById = (id?: string) => AGENCIES.find((a) => a.id === id);
export const appById = (id?: string) => APPS.find((a) => a.id === id);
export const convoById = (id?: string) => CONVOS.find((c) => c.id === id);
export const consultById = (id?: string) => CONSULTS.find((c) => c.id === id);
export const convoForAgent = (agentId: string) => CONVOS.find((c) => c.agentId === agentId);
// Consultation topics offered when booking (Explorer demo).
export const CONSULT_TOPICS = [
  'Visa eligibility',
  'Document review',
  'Application strategy',
  'Interview prep',
  'General questions',
];
export const reviewsForAgent = (id: string) => REVIEWS.filter((r) => r.agentId === id);
export const agentsForAgency = (id: string) => AGENTS.filter((a) => a.agencyId === id);

// Persona
export const ME = { name: 'Alex Kayode', seed: 3, city: 'Lagos, Nigeria' };
