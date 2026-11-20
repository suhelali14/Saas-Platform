/**
 * Longitudinal visit comparison: every visit as its own column, laid
 * out left-to-right so the doctor can SCAN across time at a glance.
 *
 * The owner asked for this with pregnancy in mind -- antenatal care
 * is a sequence of visits over ~9 months and each one needs to be
 * read against the previous (did BP go up, did weight gain stall,
 * what was advised last time versus what is happening now). The same
 * shape is just as useful for diabetes follow-ups, post-op review,
 * any chronic care thread.
 *
 * It takes the history the PatientDetail page already has -- case
 * sheets, prescriptions, vitals, specialty records -- and groups by
 * appointment date. Each column shows the row that matches on that
 * date (vitals / diagnosis / plan / medicines / labs / specialty
 * notes). The rightmost column is the most recent visit.
 *
 * Deliberately reuses the vertical timeline's data; it is the SAME
 * records, rotated. So nothing here can drift from what the day
 * cards show -- if it's in the timeline, it's in a column here.
 */
import { useMemo, useState } from 'react';
import { Columns3, ChevronLeft, ChevronRight, Activity, Pill, Stethoscope, FlaskConical, FileText } from 'lucide-react';

// Shapes mirror what PatientDetail.tsx already defines -- kept local
// (not imported) so this component stands on its own and the
// PatientDetail types can change without a knock-on.
interface Vitals { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string }
interface Doctor { name: string }
interface CaseSheet {
  id: string; appointmentId: string | null; chiefComplaint: string | null; hopi: string | null;
  diagnosis: string | null; notes: string | null; vitals: Vitals | null;
  followUpDate: string | null; createdAt: string; doctor: Doctor;
}
interface PrescriptionItem { drugName: string; dosage: string; frequency: string; duration: string; instructions: string | null }
interface Prescription { id: string; appointmentId: string | null; createdAt: string; doctor: Doctor; items: PrescriptionItem[] }
interface Appointment { id: string; scheduledAt: string; status: string; reason: string | null; vitals: Vitals | null; doctor: Doctor | null }
interface LabOrder {
  id: string; appointmentId: string | null; createdAt: string; status: string; doctor: Doctor;
  items: { testName: string; resultText: string | null; completedAt: string | null }[];
}
interface SpecialtyRecord { id: string; formKey: string; title: string; recordedOn: string; summary: string; recordedByName: string }

export interface SideBySideVisitsProps {
  appointments: Appointment[];
  caseSheets: CaseSheet[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  records: SpecialtyRecord[];
}

const FREQ: Record<string, string> = {
  OD: '1-OD', BD: '2-BD', TDS: '3-TDS', QID: '4-QID', SOS: 'SOS', STAT: 'STAT',
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const yearSuffix = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { year: 'numeric' });
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/** Collect every record keyed by its appointment date. Case sheets,
 *  prescriptions, lab orders and specialty records all key on their
 *  own createdAt, since not every one has a linked appointment id. */
function groupByVisit(props: SideBySideVisitsProps) {
  // One bucket per visit date.
  const buckets = new Map<string, {
    date: string;
    appointment?: Appointment;
    caseSheets: CaseSheet[];
    prescriptions: Prescription[];
    labOrders: LabOrder[];
    records: SpecialtyRecord[];
  }>();
  const key = (iso: string) => iso.slice(0, 10);
  for (const a of props.appointments) {
    const k = key(a.scheduledAt);
    const b = buckets.get(k) ?? { date: a.scheduledAt, caseSheets: [], prescriptions: [], labOrders: [], records: [] };
    b.appointment = a;
    buckets.set(k, b);
  }
  for (const c of props.caseSheets) {
    const k = key(c.createdAt);
    const b = buckets.get(k) ?? { date: c.createdAt, caseSheets: [], prescriptions: [], labOrders: [], records: [] };
    b.caseSheets.push(c);
    buckets.set(k, b);
  }
  for (const p of props.prescriptions) {
    const k = key(p.createdAt);
    const b = buckets.get(k) ?? { date: p.createdAt, caseSheets: [], prescriptions: [], labOrders: [], records: [] };
    b.prescriptions.push(p);
    buckets.set(k, b);
  }
  for (const l of props.labOrders) {
    const k = key(l.createdAt);
    const b = buckets.get(k) ?? { date: l.createdAt, caseSheets: [], prescriptions: [], labOrders: [], records: [] };
    b.labOrders.push(l);
    buckets.set(k, b);
  }
  for (const r of props.records) {
    const k = key(r.recordedOn);
    const b = buckets.get(k) ?? { date: r.recordedOn, caseSheets: [], prescriptions: [], labOrders: [], records: [] };
    b.records.push(r);
    buckets.set(k, b);
  }
  // Most recent on the right so the doctor reads left-to-right along a
  // calendar timeline, which is how a ledger reads.
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function SideBySideVisits(props: SideBySideVisitsProps) {
  const visits = useMemo(() => groupByVisit(props), [props]);
  const [open, setOpen] = useState(false);

  if (visits.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[16px] font-semibold flex items-center gap-2">
          <Columns3 size={16} /> Visits side-by-side
          <span className="text-[11px] text-muted-foreground/70 font-normal">
            {visits.length} visit{visits.length === 1 ? '' : 's'}, newest right
          </span>
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs px-2.5 py-1 rounded-lg bg-foreground/10 hover:bg-foreground/20 font-medium"
        >
          {open ? 'Hide' : 'Open'}
        </button>
      </div>
      {open && <Comparison visits={visits} />}
    </div>
  );
}

function Comparison({ visits }: { visits: ReturnType<typeof groupByVisit> }) {
  return (
    <div className="rounded-xl border border-border/10 bg-foreground/[0.02] overflow-hidden">
      {/* Horizontally scrollable table. Row headers freeze on the
          left, so the row label stays visible as you scroll through
          later visits. */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <RowHeader sticky>Visit</RowHeader>
              {visits.map((v, i) => {
                const prev = i > 0 ? visits[i - 1]!.date : null;
                const gap = prev ? daysBetween(prev, v.date) : 0;
                return (
                  <th key={v.date} className="min-w-[200px] px-3 py-2 border-b border-border/10 bg-foreground/[0.04] text-left align-top">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{yearSuffix(v.date)}</div>
                    <div className="text-sm font-semibold">{shortDate(v.date)}</div>
                    {gap > 0 && (
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">+{gap}d since last</div>
                    )}
                    {v.appointment?.doctor?.name && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">Dr. {v.appointment.doctor.name}</div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Vitals: BP / weight / pulse / SpO2 / temp. Shows the
                case sheet's vitals, falling back to the appointment's
                pre-consult vitals. */}
            <VitalRow icon={<Activity size={12} />} label="BP (mmHg)" visits={visits} read={(v) => firstVitals(v)?.bp} />
            <VitalRow label="Weight (kg)" visits={visits} read={(v) => firstVitals(v)?.weight} />
            <VitalRow label="Pulse" visits={visits} read={(v) => firstVitals(v)?.pulse} />
            <VitalRow label="SpO2" visits={visits} read={(v) => firstVitals(v)?.spo2} />
            <VitalRow label="Temp" visits={visits} read={(v) => firstVitals(v)?.temp} />

            {/* Clinical content: diagnosis / complaint / plan. */}
            <TextRow icon={<Stethoscope size={12} />} label="Chief complaint" visits={visits} read={(v) => v.caseSheets[0]?.chiefComplaint} />
            <TextRow label="Diagnosis" visits={visits} read={(v) => v.caseSheets[0]?.diagnosis} emphasise />
            <TextRow label="Plan / notes" visits={visits} read={(v) => v.caseSheets[0]?.notes} />
            <TextRow label="Follow-up on" visits={visits} read={(v) => v.caseSheets[0]?.followUpDate ? shortDate(v.caseSheets[0].followUpDate) : null} />

            {/* Prescription medicines. Lists one per line. */}
            <MedicinesRow visits={visits} />

            {/* Labs ordered on that visit. */}
            <LabsRow visits={visits} />

            {/* Specialty forms (antenatal check, follicle scan, etc.) */}
            <RecordsRow visits={visits} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function firstVitals(v: ReturnType<typeof groupByVisit>[0]): Vitals | null {
  return v.caseSheets[0]?.vitals ?? v.appointment?.vitals ?? null;
}

function RowHeader({ children, sticky }: { children: React.ReactNode; sticky?: boolean }) {
  return (
    <th className={`${sticky ? 'sticky left-0 z-10 bg-background' : ''} px-3 py-2 border-b border-r border-border/10 text-left align-top w-[160px] min-w-[160px]`}>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{children}</span>
    </th>
  );
}

function Cell({ children, emphasise }: { children: React.ReactNode; emphasise?: boolean }) {
  return (
    <td className={`px-3 py-1.5 border-b border-border/10 align-top ${emphasise ? 'font-medium' : ''}`}>
      {children ?? <span className="text-muted-foreground/30">—</span>}
    </td>
  );
}

function VitalRow({ label, visits, read, icon }: {
  label: string;
  icon?: React.ReactNode;
  visits: ReturnType<typeof groupByVisit>;
  read: (v: ReturnType<typeof groupByVisit>[0]) => string | undefined;
}) {
  // Skip the row entirely if no visit had this vital recorded -- a
  // row of em-dashes is noise.
  if (!visits.some((v) => read(v))) return null;
  return (
    <tr>
      <th className="sticky left-0 z-10 bg-background px-3 py-1.5 border-b border-r border-border/10 text-left">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      </th>
      {visits.map((v) => (
        <Cell key={v.date}>
          <span className="tabular text-sm">{read(v) ?? null}</span>
        </Cell>
      ))}
    </tr>
  );
}

function TextRow({ label, visits, read, emphasise, icon }: {
  label: string;
  visits: ReturnType<typeof groupByVisit>;
  read: (v: ReturnType<typeof groupByVisit>[0]) => string | null | undefined;
  emphasise?: boolean;
  icon?: React.ReactNode;
}) {
  if (!visits.some((v) => read(v))) return null;
  return (
    <tr>
      <th className="sticky left-0 z-10 bg-background px-3 py-1.5 border-b border-r border-border/10 text-left">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      </th>
      {visits.map((v) => (
        <Cell key={v.date} emphasise={emphasise}>
          <span className="text-sm">{read(v) ?? null}</span>
        </Cell>
      ))}
    </tr>
  );
}

function MedicinesRow({ visits }: { visits: ReturnType<typeof groupByVisit> }) {
  if (!visits.some((v) => v.prescriptions.length > 0)) return null;
  return (
    <tr>
      <th className="sticky left-0 z-10 bg-background px-3 py-1.5 border-b border-r border-border/10 text-left align-top">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Pill size={12} />Medicines</span>
      </th>
      {visits.map((v) => {
        const items = v.prescriptions.flatMap((p) => p.items);
        return (
          <Cell key={v.date}>
            {items.length === 0 ? null : (
              <ul className="space-y-1">
                {items.map((m, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{m.drugName}</span>
                    <span className="text-muted-foreground"> · {m.dosage} · {FREQ[m.frequency] ?? m.frequency}
                      {m.duration ? ` · ${m.duration}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Cell>
        );
      })}
    </tr>
  );
}

function LabsRow({ visits }: { visits: ReturnType<typeof groupByVisit> }) {
  if (!visits.some((v) => v.labOrders.length > 0)) return null;
  return (
    <tr>
      <th className="sticky left-0 z-10 bg-background px-3 py-1.5 border-b border-r border-border/10 text-left align-top">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FlaskConical size={12} />Labs</span>
      </th>
      {visits.map((v) => {
        const items = v.labOrders.flatMap((l) => l.items);
        return (
          <Cell key={v.date}>
            {items.length === 0 ? null : (
              <ul className="space-y-1">
                {items.map((it, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{it.testName}</span>
                    {it.resultText ? <span className="text-muted-foreground"> · {it.resultText}</span> : it.completedAt ? <span className="text-muted-foreground"> · done</span> : <span className="text-amber-500"> · pending</span>}
                  </li>
                ))}
              </ul>
            )}
          </Cell>
        );
      })}
    </tr>
  );
}

function RecordsRow({ visits }: { visits: ReturnType<typeof groupByVisit> }) {
  if (!visits.some((v) => v.records.length > 0)) return null;
  return (
    <tr>
      <th className="sticky left-0 z-10 bg-background px-3 py-1.5 border-b border-r border-border/10 text-left align-top">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText size={12} />Specialty forms</span>
      </th>
      {visits.map((v) => (
        <Cell key={v.date}>
          {v.records.length === 0 ? null : (
            <ul className="space-y-1">
              {v.records.map((r) => (
                <li key={r.id} className="text-xs">
                  <span className="font-medium">{r.title}</span>
                  {r.summary && <span className="text-muted-foreground"> · {r.summary}</span>}
                </li>
              ))}
            </ul>
          )}
        </Cell>
      ))}
    </tr>
  );
}

// Unused imports kept visible so the shell compiles when icons move.
void ChevronLeft; void ChevronRight;
