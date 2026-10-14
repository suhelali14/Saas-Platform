import { useState, useEffect } from 'react';
import { BarChart3, Users, UserPlus, Repeat, Stethoscope, ClipboardList } from 'lucide-react';
import { SkeletonList, SkeletonTable, SkeletonStats, SkeletonForm, SkeletonPanels } from '../components/Skeleton';
import { apiFetch, ApiError } from '../lib/api';
import { shiftDateInput, todayInput } from '../lib/date';
import { SegmentedControl } from '../components/SegmentedControl';

interface DailyVisit { date: string; count: number }
interface TopDiagnosis { diagnosis: string; count: number }
interface DoctorWorkload { doctorId: string; doctorName: string; patientsSeen: number }
interface Overview {
  dailyVisits: DailyVisit[];
  topDiagnoses: TopDiagnosis[];
  doctorWorkload: DoctorWorkload[];
  totals: { totalAppointments: number; totalCaseSheets: number; uniquePatientsInRange: number; newPatients: number; returningPatients: number };
}

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

const ACCENT = '#34d399'; // emerald-400 -- this app's single accent hue throughout; single-series charts here need no categorical palette

export function Analytics() {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [rangeDays]);

  const load = async () => {
    try {
      // toISOString() was the bug here: it serialises in UTC, so before
      // about 5:30am IST both ends of the range landed on the previous
      // day and the chart reported the wrong days. A clinic's day
      // boundary is local midnight. lib/date is the one place that knows.
      const to = todayInput();
      const from = shiftDateInput(to, -rangeDays);
      const res = await apiFetch<Overview>(`/analytics/overview?from=${from}&to=${to}`);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load analytics.');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 size={20} className="text-emerald-400" /> Analytics</h1>
        <SegmentedControl
          label="Date range"
          value={String(rangeDays)}
          onChange={(v) => setRangeDays(Number(v))}
          options={RANGES.map((r) => ({ value: String(r.days), label: r.label }))}
        />
      </div>
      <p className="text-sm text-muted-foreground mb-6">Visit trends, common diagnoses, and workload for the selected period.</p>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
      {!data && !error && <><SkeletonStats count={4} label="Loading analytics" /><div className="mt-4"><SkeletonPanels count={2} label="Loading charts" /></div></>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatTile icon={ClipboardList} label="Appointments" value={data.totals.totalAppointments} />
            <StatTile icon={Users} label="Patients Seen" value={data.totals.uniquePatientsInRange} />
            <StatTile icon={UserPlus} label="New" value={data.totals.newPatients} />
            <StatTile icon={Repeat} label="Returning" value={data.totals.returningPatients} />
            <StatTile icon={Stethoscope} label="Case Sheets" value={data.totals.totalCaseSheets} />
          </div>

          <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02] mb-6">
            <h2 className="text-sm font-semibold text-foreground/80 mb-3">Daily Visits</h2>
            {data.dailyVisits.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">No visits in this period.</p>
            ) : (
              <TrendChart data={data.dailyVisits} />
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
              <h2 className="text-sm font-semibold text-foreground/80 mb-3">Top Diagnoses</h2>
              {data.topDiagnoses.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">No diagnoses recorded yet.</p>
              ) : (
                <BarList items={data.topDiagnoses.map((d) => ({ label: d.diagnosis, value: d.count }))} />
              )}
            </div>
            <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
              <h2 className="text-sm font-semibold text-foreground/80 mb-3">Doctor Workload</h2>
              {data.doctorWorkload.length === 0 ? (
                <p className="text-xs text-muted-foreground/70">No consultations recorded yet.</p>
              ) : (
                <BarList items={data.doctorWorkload.map((d) => ({ label: `Dr. ${d.doctorName}`, value: d.patientsSeen }))} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="p-3 rounded-xl border border-border/10 bg-foreground/[0.02]">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 mb-1"><Icon size={12} /> {label}</div>
      <div className="text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

// Thin 2px line, rounded data-end marker, recessive baseline grid, native
// <title> hover tooltip per point -- lightweight but real interactivity for
// this internal tool's scale (a handful of points per range).
function TrendChart({ data }: { data: DailyVisit[] }) {
  const width = 640;
  const height = 160;
  const padding = 24;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: height - padding - (d.count / max) * (height - padding * 2),
    ...d,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" preserveAspectRatio="none">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={ACCENT}>
          <title>{`${p.date}: ${p.count} visit${p.count === 1 ? '' : 's'}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// Horizontal bar list -- clearer than a vertical bar chart when labels are
// variable-length free text (diagnosis names, doctor names), avoids label
// rotation/overflow entirely.
function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground w-32 truncate shrink-0" title={item.label}>{item.label}</div>
          <div className="flex-1 h-4 bg-foreground/5 rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(item.value / max) * 100}%`, background: ACCENT }} title={`${item.value}`} />
          </div>
          <div className="text-xs text-foreground/80 w-6 text-right shrink-0">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
