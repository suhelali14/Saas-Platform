/**
 * Specialty records, as the portal sees them.
 *
 * The forms themselves come from the API (GET /specialty/forms): nothing
 * about any specialty is written into these screens, so a clinic's own
 * forms and fields render exactly like the built-in ones. The shapes here
 * mirror apps/clinic-api/src/lib/specialty-forms.ts.
 *
 * The computed values below are a live preview while typing -- the EDD
 * appearing as the LMP is entered. The server works them out again on
 * save and its answer is the one stored.
 */

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multi' | 'yesno' | 'computed' | 'table';

export interface FormField {
  key: string;
  label: string;
  /** The card's abbreviation (LMP, FH, Hb), for table columns. */
  short?: string;
  type: FieldType;
  hint?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  formula?: 'edd' | 'ga' | 'bmi' | 'cycle_day' | 'age_at_visit';
  columns?: FormField[];
  rows?: string[];
  addRows?: boolean;
  wide?: boolean;
  required?: boolean;
  /** group under a named section heading; blank/absent = default section */
  section?: string;
  /** show only when another field's answer equals this value */
  showIf?: { field: string; equals: string | boolean | number };
  retired?: boolean;
}
export interface FormSection { title: string; fields: FormField[] }
export interface FormDef {
  key: string;
  version: number;
  title: string;
  specialty: string;
  kind: 'history' | 'visit' | 'episode';
  tags: string[];
  episodeKey?: string;
  visitForms?: string[];
  couple?: boolean;
  sections: FormSection[];
  closeSections?: FormSection[];
  summary?: string[];
  trend?: string[];
  note?: string;
  custom?: boolean;
  isActive: boolean;
  builtIn: boolean;
}

export type Answers = Record<string, unknown>;

export interface SpecialtyRecord {
  id: string;
  formKey: string;
  formVersion: number;
  scope: 'HISTORY' | 'VISIT';
  episodeId: string | null;
  appointmentId: string | null;
  patientId: string;
  recordedOn: string;
  data: Answers;
  recordedByName: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  id: string;
  patientId: string;
  kind: RelationKind;
  relatedPatientId: string | null;
  relatedPatient?: { id: string; name: string; uhid: string } | null;
  patient?: { id: string; name: string; uhid: string };
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  bloodGroup: string | null;
  occupation: string | null;
  notes: string | null;
}

export interface Episode {
  id: string;
  patientId: string;
  patient: { id: string; name: string; uhid: string };
  formKey: string;
  title: string;
  status: 'ACTIVE' | 'CLOSED';
  startedOn: string;
  closedOn: string | null;
  partnerId: string | null;
  partner: (Relation & { relatedPatient: { id: string; name: string; uhid: string } | null }) | null;
  data: Answers;
  outcome: Answers | null;
  summary: string;
  gaToday: string | null;
  viaPartner: boolean;
  createdByName: string;
  records: SpecialtyRecord[];
}

export interface SpecialtyOverview {
  forms: FormDef[];
  relations: Relation[];
  linkedFrom: Relation[];
  episodes: Episode[];
  history: SpecialtyRecord[];
  visits: SpecialtyRecord[];
  suggested: string[];
  pregnancy: { episodeId: string; ga: string | null; edd: string | null } | null;
}

export type RelationKind = 'SPOUSE' | 'PARTNER' | 'FATHER' | 'MOTHER' | 'CHILD' | 'SIBLING' | 'GUARDIAN' | 'OTHER';
export const RELATION_WORDS: Record<RelationKind, string> = {
  SPOUSE: 'Husband / wife', PARTNER: 'Partner', FATHER: 'Father', MOTHER: 'Mother',
  CHILD: 'Child', SIBLING: 'Brother / sister', GUARDIAN: 'Guardian', OTHER: 'Other',
};

// ── Preview of computed values ─────────────────────────────────────────

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const parse = (v: unknown) => (typeof v === 'string' && ISO.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export function gaText(on: string, episode: Answers | null | undefined): string | null {
  if (!episode) return null;
  const at = parse(on);
  const usg = parse(episode.usg_edd);
  const start = usg ? new Date(usg.getTime() - 280 * DAY) : parse(episode.lmp);
  if (!at || !start) return null;
  const total = Math.round((at.getTime() - start.getTime()) / DAY);
  if (total < 0 || total > 315) return null;
  return `${Math.floor(total / 7)}w ${total % 7}d`;
}

export interface PreviewContext { recordedOn: string; episode?: Answers | null; dob?: string | null; age?: number | null }

export function preview(f: FormField, values: Answers, ctx: PreviewContext): string | null {
  switch (f.formula) {
    case 'edd': {
      const d = parse(values.lmp);
      return d ? iso(new Date(d.getTime() + 280 * DAY)) : null;
    }
    case 'ga':
      return gaText(ctx.recordedOn, ctx.episode ?? values);
    case 'bmi': {
      const w = Number(values.weight ?? values.pre_weight);
      const h = Number(values.height) / 100;
      return w > 0 && h > 0.3 ? String(Math.round((w / (h * h)) * 10) / 10) : null;
    }
    case 'cycle_day': {
      const lmp = parse(values.cycle_lmp ?? values.lmp);
      const at = parse(ctx.recordedOn);
      const n = lmp && at ? Math.round((at.getTime() - lmp.getTime()) / DAY) + 1 : null;
      return n && n >= 1 && n <= 120 ? String(n) : null;
    }
    case 'age_at_visit': {
      const at = parse(ctx.recordedOn);
      const dob = ctx.dob ? new Date(ctx.dob) : null;
      if (at && dob && !Number.isNaN(dob.getTime())) {
        let m = (at.getUTCFullYear() - dob.getUTCFullYear()) * 12 + (at.getUTCMonth() - dob.getUTCMonth());
        if (at.getUTCDate() < dob.getUTCDate()) m -= 1;
        if (m < 0) return null;
        if (m < 24) return `${m} month${m === 1 ? '' : 's'}`;
        return m % 12 ? `${Math.floor(m / 12)} years ${m % 12} month${m % 12 === 1 ? '' : 's'}` : `${Math.floor(m / 12)} years`;
      }
      return ctx.age != null ? `${ctx.age} years` : null;
    }
    default:
      return null;
  }
}

/** A stored value as words, for tables and the read-only view. */
export function showValue(f: FormField, v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (f.type === 'yesno') return v ? 'Yes' : 'No';
  if (f.type === 'date' && typeof v === 'string') return longDate(v);
  if (f.formula === 'edd' && typeof v === 'string') return longDate(v);
  if (Array.isArray(v)) return f.type === 'table' ? `${v.length} ${v.length === 1 ? 'entry' : 'entries'}` : v.join(', ');
  return `${v}${f.unit ? ` ${f.unit}` : ''}`;
}

export function longDate(day: string | null | undefined): string {
  if (!day) return '';
  const d = new Date(`${day.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const allFields = (def: Pick<FormDef, 'sections'>) => def.sections.flatMap((s) => s.fields);
