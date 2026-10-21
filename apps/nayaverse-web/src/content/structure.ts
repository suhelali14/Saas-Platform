/**
 * The parts of the content that do not change with language.
 *
 * A row's status, which column it sits in, whether it is right-aligned, a
 * token number, a file number, a time, a price: none of these are translated,
 * and keeping them here means a translator never has to copy them and can
 * never accidentally change one. The words live in en.ts, hi.ts and mr.ts,
 * keyed by the ids below.
 */

export type Readiness = 'LIVE' | 'BUILDING' | 'WAITLIST';
export type Tone = 'serving' | 'next' | 'waiting' | 'done';
export type GroupKey =
  | 'Health' | 'Retail' | 'Food' | 'Personal care'
  | 'Fitness' | 'Education' | 'Services' | 'Hospitality';

/** Service chart rows. `type` is the literal enum member in apps/api, so a
 *  reader can check the claim against the schema. */
export const serviceRows: {
  code: string;
  type: string | null;
  group: GroupKey;
  status: Readiness;
}[] = [
  { code: '01', type: 'CLINIC', group: 'Health', status: 'LIVE' },
  { code: '02', type: 'HOSPITAL', group: 'Health', status: 'BUILDING' },
  { code: '03', type: 'PHARMACY', group: 'Health', status: 'BUILDING' },
  { code: '04', type: 'KIRANA_STORE', group: 'Retail', status: 'BUILDING' },
  { code: '05', type: 'RETAIL_STORE', group: 'Retail', status: 'BUILDING' },
  { code: '06', type: 'GROCERY', group: 'Retail', status: 'BUILDING' },
  { code: '07', type: 'ELECTRONICS', group: 'Retail', status: 'BUILDING' },
  { code: '08', type: 'BOUTIQUE', group: 'Retail', status: 'BUILDING' },
  { code: '09', type: 'D2C_BRAND', group: 'Retail', status: 'BUILDING' },
  { code: '10', type: 'RESTAURANT', group: 'Food', status: 'BUILDING' },
  { code: '11', type: 'CAFE', group: 'Food', status: 'BUILDING' },
  { code: '12', type: 'BAKERY', group: 'Food', status: 'BUILDING' },
  { code: '13', type: 'SALON', group: 'Personal care', status: 'BUILDING' },
  { code: '14', type: 'SPA', group: 'Personal care', status: 'BUILDING' },
  { code: '15', type: 'GYM_FITNESS', group: 'Fitness', status: 'BUILDING' },
  { code: '16', type: 'COACHING', group: 'Education', status: 'BUILDING' },
  { code: '17', type: 'EDUCATION', group: 'Education', status: 'BUILDING' },
  { code: '18', type: 'TRAVEL_AGENCY', group: 'Services', status: 'BUILDING' },
  { code: '19', type: 'REAL_ESTATE', group: 'Services', status: 'BUILDING' },
  { code: '20', type: 'HOME_BUSINESS', group: 'Services', status: 'BUILDING' },
  { code: '21', type: 'SERVICES', group: 'Services', status: 'BUILDING' },
  { code: '22', type: null, group: 'Hospitality', status: 'WAITLIST' },
  { code: '23', type: 'OTHER', group: 'Hospitality', status: 'WAITLIST' },
];

export const groupOrder: GroupKey[] = [
  'Health', 'Retail', 'Food', 'Personal care', 'Fitness', 'Education', 'Services', 'Hospitality',
];

/* ---------------------------------------------------------------- charts -- */

export type ChartColumn = {
  key: string;
  right?: boolean;
  /** Dropped below this breakpoint as the chart narrows column priority. */
  hide?: 'sm' | 'md' | 'lg';
  /** Where a dropped marker falls back to on a phone. Exactly one per chart:
   *  the marker explains why a row sits where it does, and losing it on a
   *  phone loses the argument on the device most people read on. */
  primary?: boolean;
};

export type ChartRowDef = {
  id: string;
  tone: Tone;
  urgent?: boolean;
  /** A stable key for the exception marker. The visible label is translated;
   *  the triage tier is looked up on this, so a translation can never change
   *  the order rows come out in. */
  markKey?: string;
  /** Identifiers and figures, which are the same in every language. */
  cells: Record<string, string>;
};

export type ChartDef = {
  key: string;
  status: Readiness;
  columns: ChartColumn[];
  rows: ChartRowDef[];
};

/** Triage tiers, read off the marker that is on screen: the thing you can see
 *  is the thing that decides the order. Only the clinic chart re-ranks. */
export const TIER: Record<string, number> = { emergency: 0, antenatal: 1, senior: 1, child: 2 };

export const chartDefs: ChartDef[] = [
  {
    key: 'clinic',
    status: 'LIVE',
    columns: [
      { key: 'token' },
      { key: 'file' },
      { key: 'age', hide: 'sm' },
      { key: 'reason', primary: true },
      { key: 'mark', hide: 'md' },
      { key: 'waited', right: true, hide: 'lg' },
    ],
    rows: [
      { id: '04', tone: 'done', cells: { token: '04', file: '···0041', age: '52 M', waited: '38m' } },
      { id: '07', tone: 'serving', markKey: 'antenatal', cells: { token: '07', file: '···0112', age: '34 F', waited: '11m' } },
      { id: '09', tone: 'next', markKey: 'senior', cells: { token: '09', file: '···0208', age: '71 M', waited: '9m' } },
      { id: '11', tone: 'waiting', markKey: 'child', cells: { token: '11', file: '···0317', age: '6 F', waited: '6m' } },
      { id: '12', tone: 'waiting', cells: { token: '12', file: '···0094', age: '29 M', waited: '4m' } },
      { id: '13', tone: 'waiting', cells: { token: '13', file: '···0286', age: '45 F', waited: '2m' } },
    ],
  },
  {
    key: 'salon',
    status: 'BUILDING',
    columns: [
      { key: 'time' },
      { key: 'client' },
      { key: 'service', primary: true },
      { key: 'stylist', hide: 'sm' },
      { key: 'mark', hide: 'md' },
      { key: 'due', right: true, hide: 'lg' },
    ],
    rows: [
      { id: 's1', tone: 'done', cells: { time: '10:30', stylist: 'Asha', due: '₹600' } },
      { id: 's2', tone: 'serving', markKey: 'runs90', cells: { time: '11:15', stylist: 'Rehan', due: '₹2,400' } },
      { id: 's3', tone: 'next', cells: { time: '12:00', stylist: 'Asha', due: '₹250' } },
      { id: 's4', tone: 'waiting', urgent: true, markKey: 'nobooking', cells: { time: '12:30', stylist: '—', due: '₹400' } },
      { id: 's5', tone: 'waiting', markKey: 'advance', cells: { time: '14:00', stylist: 'Rehan', due: '₹5,000' } },
    ],
  },
  {
    key: 'gym',
    status: 'BUILDING',
    columns: [
      { key: 'member' },
      { key: 'plan', primary: true },
      { key: 'expires' },
      { key: 'seen', hide: 'sm' },
      { key: 'mark', hide: 'md' },
      { key: 'dues', right: true, hide: 'lg' },
    ],
    rows: [
      { id: 'g1', tone: 'next', urgent: true, markKey: 'expiring', cells: { member: '···0188', dues: '—' } },
      { id: 'g2', tone: 'waiting', markKey: 'notseen', cells: { member: '···0241', dues: '—' } },
      { id: 'g3', tone: 'waiting', markKey: 'unpaid', cells: { member: '···0119', dues: '₹1,200' } },
      { id: 'g4', tone: 'serving', cells: { member: '···0302', dues: '—' } },
      { id: 'g5', tone: 'done', cells: { member: '···0077', dues: '—' } },
    ],
  },
  {
    key: 'kirana',
    status: 'BUILDING',
    columns: [
      { key: 'time' },
      { key: 'bill' },
      { key: 'customer', primary: true },
      { key: 'items', right: true, hide: 'sm' },
      { key: 'mark', hide: 'md' },
      { key: 'amount', right: true },
    ],
    rows: [
      { id: 'k1', tone: 'done', cells: { time: '09:12', bill: 'B-114', items: '6', amount: '₹340' } },
      { id: 'k2', tone: 'waiting', urgent: true, markKey: 'onaccount', cells: { time: '09:48', bill: 'B-115', items: '14', amount: '₹1,280' } },
      { id: 'k3', tone: 'done', cells: { time: '10:05', bill: 'B-116', items: '2', amount: '₹95' } },
      { id: 'k4', tone: 'done', cells: { time: '10:31', bill: 'B-117', items: '9', amount: '₹760' } },
      { id: 'k5', tone: 'serving', markKey: 'atcounter', cells: { time: '10:44', bill: 'B-118', items: '3', amount: '₹210' } },
    ],
  },
  {
    key: 'restaurant',
    status: 'BUILDING',
    columns: [
      { key: 'table' },
      { key: 'covers', right: true },
      { key: 'order', primary: true },
      { key: 'waiter', hide: 'sm' },
      { key: 'mark', hide: 'md' },
      { key: 'elapsed', right: true, hide: 'lg' },
    ],
    rows: [
      { id: 'r1', tone: 'serving', cells: { table: 'T2', covers: '4', waiter: 'Imran', elapsed: '34m' } },
      { id: 'r2', tone: 'next', urgent: true, markKey: 'kitchenlate', cells: { table: 'T5', covers: '2', waiter: 'Sana', elapsed: '28m' } },
      { id: 'r3', tone: 'next', markKey: 'billasked', cells: { table: 'T1', covers: '6', waiter: 'Imran', elapsed: '58m' } },
      { id: 'r4', tone: 'waiting', cells: { table: 'T7', covers: '2', waiter: 'Sana', elapsed: '3m' } },
      { id: 'r5', tone: 'done', cells: { table: 'T3', covers: '4', waiter: '—', elapsed: '—' } },
    ],
  },
];

/** The clinic row that arrives while you are reading. */
export const clinicArrival: ChartRowDef = {
  id: '14',
  tone: 'next',
  urgent: true,
  markKey: 'emergency',
  cells: { token: '14', file: '···0355', age: '38 M', waited: '0m' },
};

/** Fare bands, by the number of people who need a login. */
export const fareSeats: [number, number][] = [
  [1, 2],
  [3, 10],
  [11, 40],
  [41, 9999],
];

export const seatSteps = [1, 2, 3, 5, 8, 12, 20, 30, 45] as const;

/** Each script set in itself — someone looking for Marathi should find
 *  मराठी, not the word "Marathi". */
export const languages = [
  { code: 'hi', native: 'हिन्दी', latin: 'Hindi' },
  { code: 'mr', native: 'मराठी', latin: 'Marathi' },
  { code: 'ta', native: 'தமிழ்', latin: 'Tamil' },
  { code: 'bn', native: 'বাংলা', latin: 'Bengali' },
  { code: 'te', native: 'తెలుగు', latin: 'Telugu' },
  { code: 'kn', native: 'ಕನ್ನಡ', latin: 'Kannada' },
  { code: 'ml', native: 'മലയാളം', latin: 'Malayalam' },
  { code: 'gu', native: 'ગુજરાતી', latin: 'Gujarati' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', latin: 'Punjabi' },
  { code: 'or', native: 'ଓଡ଼ିଆ', latin: 'Odia' },
  { code: 'as', native: 'অসমীয়া', latin: 'Assamese' },
  { code: 'ur', native: 'اردو', latin: 'Urdu' },
] as const;
