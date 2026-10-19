import { useState, useEffect } from 'react';
import { BarChart3, Users, UserPlus, Repeat, Stethoscope, ClipboardList } from 'lucide-react';
import { TrendChart, BarList } from '../components/charts';
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
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2"><BarChart3 size={20} className="text-muted-foreground" /> Analytics</h1>
        <SegmentedControl
          label="Date range"
          value={String(rangeDays)}
          onChange={(v) => setRangeDays(Number(v))}
          options={RANGES.map((r) => ({ value: String(r.days), label: r.label }))}
        />
      </div>
      <p className="text-sm text-muted-foreground mb-6">Visit trends, common diagnoses, and workload for the selected period.</p>

      {error && <div className="mb-4 px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}
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
