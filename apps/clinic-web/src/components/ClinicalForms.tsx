import { useState, useEffect } from 'react';
import { apiFetch, ApiError, getApiBaseUrl } from '../lib/api';
import { Button } from './Button';
import { Pick } from './Field';
import { SegmentedControl } from './SegmentedControl';
import { DoseInput } from './DoseInput';
import { DatePicker } from './DatePicker';
import { todayInput } from '../lib/date';
import { doseConflict, frequencyFromDose, parseDose, shouldDeriveFrequency } from '../lib/dose';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export interface PrescriptionItem { drugId?: string; drugName: string; dosage: string; frequency: string; duration: string; instructions: string | null }
interface Drug { id: string; name: string; composition: string | null; manufacturer: string | null }
interface Template { id: string; name: string; items: PrescriptionItem[] }

const FREQUENCIES = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'STAT'];
const CERT_TYPES = [
  { id: 'SICK_LEAVE', label: 'Sick Leave' },
  { id: 'FITNESS', label: 'Fitness' },
  { id: 'REFERRAL', label: 'Referral' },
];

/** Everything created from these forms can optionally be bound to a live
 * appointment (the "session data, appointment-wise" model) -- passed by the
 * Encounter screen; omitted when creating a standalone record from the
 * patient's profile directly. */
interface EncounterBinding { appointmentId?: string; initialVitals?: { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string } }

export function CaseSheetForm({ patientId, appointmentId, initialVitals, onDone }: { patientId: string; onDone: () => void } & EncounterBinding) {
  const [form, setForm] = useState({
    chiefComplaint: '', hopi: '',
    bp: initialVitals?.bp || '', temp: initialVitals?.temp || '', spo2: initialVitals?.spo2 || '', weight: initialVitals?.weight || '', pulse: initialVitals?.pulse || '',
    diagnosis: '', notes: '', followUpDate: '', remindDoctor: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [frequentDiagnoses, setFrequentDiagnoses] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<{ data: string[] }>('/diagnoses/frequent').then((res) => setFrequentDiagnoses(res.data)).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ id: string }>('/case-sheets', {
        method: 'POST',
        data: {
          patientId,
          appointmentId,
          chiefComplaint: form.chiefComplaint || undefined,
          hopi: form.hopi || undefined,
          vitals: { bp: form.bp || undefined, temp: form.temp || undefined, spo2: form.spo2 || undefined, weight: form.weight || undefined, pulse: form.pulse || undefined },
          diagnosis: form.diagnosis || undefined,
          notes: form.notes || undefined,
          followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : undefined,
          remindDoctor: form.followUpDate ? form.remindDoctor : undefined,
        },
      });
      setCreatedId(res.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save case sheet.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAttachment = async () => {
    if (!file || !createdId) return;
    setUploading(true);
    setError(null);
    try {
      const token = localStorage.getItem('clinicAccessToken');
      const apiBase = getApiBaseUrl();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${apiBase}/case-sheets/${createdId}/attachments`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Upload failed');
      }
      setFile(null);
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (createdId) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <p className="text-sm text-emerald-400 mb-3">Case sheet saved. Attach an X-ray or lab report? (optional)</p>
        <div className="flex items-center gap-2">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs text-foreground/80" />
          <button onClick={uploadAttachment} disabled={!file || uploading} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button onClick={onDone} className="px-3 py-1.5 rounded-lg bg-foreground/10 text-xs">Skip</button>
        </div>
        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03] flex flex-col gap-3">
      <h3 className="text-sm font-semibold">New Case Sheet</h3>
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
      <textarea placeholder="Chief complaint" value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} rows={2} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <textarea placeholder="History of presenting illness (HOPI)" value={form.hopi} onChange={(e) => setForm({ ...form, hopi: e.target.value })} rows={2} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <input placeholder="BP" value={form.bp} onChange={(e) => setForm({ ...form, bp: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400" />
        <input placeholder="Temp" value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400" />
        <input placeholder="SpO2" value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400" />
        <input placeholder="Weight" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400" />
        <input placeholder="Pulse" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400" />
      </div>
      {initialVitals && Object.values(initialVitals).some(Boolean) && (
        <p className="text-xs text-emerald-400">Pre-filled from the nurse's pre-consult vitals.</p>
      )}
      {frequentDiagnoses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {frequentDiagnoses.map((d) => (
            <button type="button" key={d} onClick={() => setForm({ ...form, diagnosis: d })} className="px-2 py-1 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-xs text-foreground/80">
              {d}
            </button>
          ))}
        </div>
      )}
      <input placeholder="Diagnosis" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Follow-up date (optional)</label>
        <DatePicker value={form.followUpDate} onChange={(iso) => setForm({ ...form, followUpDate: iso })} label="Follow-up date" placeholder="No follow-up" min={todayInput()} clearable />
        {form.followUpDate && (
          <label className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={form.remindDoctor} onChange={(e) => setForm({ ...form, remindDoctor: e.target.checked })} />
            Remind me when this follow-up is due
          </label>
        )}
      </div>
      <button type="submit" disabled={saving} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Case Sheet'}
      </button>
    </form>
  );
}

type LastPrescription = {
  id: string;
  issuedAt: string;
  doctorName: string;
  daysAgo: number;
  /** Older than six months. Flagged, not blocked: a doctor looking at
   *  the patient is better placed to judge than a cutoff is. */
  stale: boolean;
  items: PrescriptionItem[];
};

export function PrescriptionForm({ patientId, appointmentId, onDone }: { patientId: string; onDone: () => void } & EncounterBinding) {
  const [items, setItems] = useState<PrescriptionItem[]>([{ drugName: '', dosage: '', frequency: 'OD', duration: '', instructions: '' }]);
  const [suggestions, setSuggestions] = useState<Record<number, Drug[]>>({});
  const [searchedEmpty, setSearchedEmpty] = useState<Record<number, boolean>>({});
  const [addingDrug, setAddingDrug] = useState<number | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsTemplateName, setSaveAsTemplateName] = useState('');
  // What this patient is already on. Fetched once when the form opens,
  // because the answer decides whether the most useful control on this
  // screen is even shown.
  const [lastRx, setLastRx] = useState<LastPrescription | null>(null);

  useEffect(() => {

    // Null when they have never been prescribed anything here, which

    // is most first visits -- the button is simply absent then

    // rather than present and inert.

    apiFetch<{ prescription: LastPrescription | null }>(`/patients/${patientId}/last-prescription`)

      .then((r) => setLastRx(r.prescription))

      .catch(() => { /* a missing repeat must never block writing a new one */ });

  }, [patientId]);


  useEffect(() => {
    apiFetch<{ data: Template[] }>('/prescription-templates').then((res) => setTemplates(res.data)).catch(() => {});
  }, []);

  const searchDrug = async (index: number, query: string) => {
    // Typing away from a previously-matched suggestion clears drugId -- the
    // link should only survive an exact pick, never a free-text edit,
    // otherwise stock could get decremented against the wrong medicine.
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, drugName: query, drugId: undefined } : it)));
    if (query.length < 2) {
      setSuggestions((s) => ({ ...s, [index]: [] }));
      setSearchedEmpty((s) => ({ ...s, [index]: false }));
      return;
    }
    try {
      const res = await apiFetch<{ data: Drug[] }>(`/drugs?search=${encodeURIComponent(query)}`);
      setSuggestions((s) => ({ ...s, [index]: res.data }));
      setSearchedEmpty((s) => ({ ...s, [index]: res.data.length === 0 }));
    } catch {
      // ignore
    }
  };

  const addNewMedicine = async (index: number, name: string) => {
    setAddingDrug(index);
    setError(null);
    try {
      const drug = await apiFetch<Drug>('/drugs', { method: 'POST', data: { name } });
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, drugName: drug.name, drugId: drug.id } : it)));
      setSuggestions((s) => ({ ...s, [index]: [] }));
      setSearchedEmpty((s) => ({ ...s, [index]: false }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add medicine.');
    } finally {
      setAddingDrug(null);
    }
  };

  const updateItem = (index: number, field: keyof PrescriptionItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  /**
   * The dose and the frequency are the same fact, so only one gets typed.
   *
   * "1-0-1" and "BD" both mean twice a day. Asking for both was duplicate
   * work on the highest-volume screen here, and let a row be saved saying
   * "1-1-1" and "BD" at once -- a prescription that contradicts itself in
   * two adjacent printed columns.
   *
   * The pattern now sets the frequency. Two deliberate limits:
   *
   *   - SOS and STAT are never overwritten. They are not times-per-day;
   *     a doctor who chose "as needed" alongside "1-0-1" is describing
   *     the dose to take when needed, and rewriting that to BD would
   *     change the instruction.
   *   - The frequency stays editable, and a disagreement only warns. A
   *     doctor may have a reason, and refusing to save a prescription
   *     over this would be far worse than printing it.
   */
  const updateDose = (index: number, dosage: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const slots = parseDose(dosage);
        const implied = slots ? frequencyFromDose(slots) : null;
        const takeIt = implied && shouldDeriveFrequency(it.frequency);
        return { ...it, dosage, frequency: takeIt ? implied : it.frequency };
      }),
    );
  };

  const addRow = () => setItems((prev) => [...prev, { drugName: '', dosage: '', frequency: 'OD', duration: '', instructions: '' }]);
  const removeRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const loadTemplate = (templateId: string) => {
    const t = templates.find((t) => t.id === templateId);
    if (t) setItems(t.items.map((it) => ({ ...it, instructions: it.instructions || '' })));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.drugName && it.dosage && it.duration);
    if (validItems.length === 0) {
      setError('Add at least one complete drug entry.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/prescriptions', { method: 'POST', data: { patientId, appointmentId, items: validItems.map((it) => ({ ...it, instructions: it.instructions || undefined })) } });
      if (saveAsTemplateName.trim()) {
        await apiFetch('/prescription-templates', { method: 'POST', data: { name: saveAsTemplateName, items: validItems } }).catch(() => {});
      }
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save prescription.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03] flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">New Prescription</h3>
        <div className="flex items-center gap-2">
          {/* The most useful control on this screen for a returning
              patient, so it sits before the template picker: templates
              answer "what do I usually give for this", and this answers
              "what is this person already on". */}
          {lastRx && lastRx.items.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={12} />}
              onClick={() => {
                setItems(lastRx.items.map((i) => ({ ...i })));
                setSuggestions({});
                setSearchedEmpty({});
              }}
              title={`${lastRx.items.length} medicine${lastRx.items.length === 1 ? '' : 's'} from ${describeAge(lastRx.daysAgo)}, prescribed by Dr ${lastRx.doctorName}`}
            >
              Repeat last ({lastRx.items.length})
            </Button>
          )}
          {templates.length > 0 && (
            <Pick
              value=""
              placeholder="Load template…"
              onChange={(id) => { if (id) loadTemplate(id); }}
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
              triggerClassName="h-8 text-xs"
            />
          )}
        </div>
      </div>

      {/* Said before the click, not after. A prescription repeated from
          two years ago without a fresh look is a real risk, and the
          person best placed to judge needs the date in front of them. */}
      {lastRx?.stale && (
        <p className="flex items-start gap-1.5 text-[11px] text-warning">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Their last prescription was {describeAge(lastRx.daysAgo)}. Worth confirming it still
            suits them before repeating it.
          </span>
        </p>
      )}
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-start">
          <div className="col-span-2 sm:col-span-4 relative">
            <input
              placeholder="Drug name"
              value={item.drugName}
              onChange={(e) => searchDrug(i, e.target.value)}
              className="w-full px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400"
            />
            {(suggestions[i]?.length ?? 0) > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border/10 bg-[#14171f] max-h-40 overflow-y-auto">
                {suggestions[i].map((d) => (
                  <button type="button" key={d.id} onClick={() => { setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, drugName: d.name, drugId: d.id } : it))); setSuggestions((s) => ({ ...s, [i]: [] })); }} className="block w-full text-left px-2 py-1.5 text-xs hover:bg-foreground/5">
                    <div>{d.name}</div>
                    {d.composition && <div className="text-[10px] text-muted-foreground/70 truncate">{d.composition}</div>}
                  </button>
                ))}
              </div>
            )}
            {searchedEmpty[i] && item.drugName.length >= 2 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-emerald-500/30 bg-[#14171f] p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addNewMedicine(i, item.drugName)}
                  busy={addingDrug === i}
                  busyLabel="Adding…"
                  className="!px-0 text-emerald-400"
                >
                  {`+ Add "${item.drugName}" as new medicine`}
                </Button>
              </div>
            )}
          </div>
          {/* Three columns, not two: the grid needs room for three cells
              and the dashes between them. Paid for by moving
              instructions to its own row below, where it was never
              usable at one twelfth of the width anyway. */}
          <DoseInput
            className="col-span-2 sm:col-span-3"
            label={item.drugName ? `Dose for ${item.drugName}` : 'Dose'}
            value={item.dosage}
            onChange={(d) => updateDose(i, d)}
          />
          <Pick
            className="col-span-1 sm:col-span-2"
            value={item.frequency}
            onChange={(f) => updateItem(i, 'frequency', f)}
            options={FREQUENCIES.map((f) => ({ value: f, label: f }))}
          />
          <input placeholder="Duration" value={item.duration} onChange={(e) => updateItem(i, 'duration', e.target.value)} className="col-span-1 sm:col-span-2 px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400" />
          <button type="button" onClick={() => removeRow(i)} disabled={items.length === 1} aria-label="Remove this medicine" className="col-span-2 sm:col-span-1 min-h-[36px] text-xs text-muted-foreground/70 hover:text-red-400 disabled:opacity-30">✕</button>

          {/* Instructions print as a sub-row beneath the medicine on the
              prescription, so they get a full row here too. "After food,
              with plenty of water" never fitted in a 1/12 box. */}
          <input
            placeholder="Instructions (optional) — e.g. after food, with plenty of water"
            value={item.instructions ?? ''}
            onChange={(e) => updateItem(i, 'instructions', e.target.value)}
            className="col-span-2 sm:col-span-11 px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400"
          />

          {/* Warned, never blocked -- see updateDose. */}
          {doseConflict(item.dosage, item.frequency) && (
            <p className="col-span-2 sm:col-span-12 flex items-start gap-1.5 text-[11px] text-warning">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{doseConflict(item.dosage, item.frequency)}</span>
            </p>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow} className="self-start text-xs text-emerald-400 hover:underline">+ Add drug</button>

      <input placeholder="Save these items as a template? (optional name)" value={saveAsTemplateName} onChange={(e) => setSaveAsTemplateName(e.target.value)} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />

      <button type="submit" disabled={saving} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Prescription'}
      </button>
    </form>
  );
}

export function CertificateForm({ patientId, patientName, appointmentId, onDone }: { patientId: string; patientName: string; onDone: () => void } & EncounterBinding) {
  const [type, setType] = useState('SICK_LEAVE');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/certificates', {
        method: 'POST',
        data: {
          patientId,
          appointmentId,
          type,
          fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
          toDate: toDate ? new Date(toDate).toISOString() : undefined,
          content: customContent || undefined,
        },
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to issue certificate.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03] flex flex-col gap-3">
      <h3 className="text-sm font-semibold">New Certificate for {patientName}</h3>
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
      <SegmentedControl
        label="Certificate type"
        value={type}
        onChange={setType}
        options={CERT_TYPES.map((t) => ({ value: t.id, label: t.label }))}
      />
      {type === 'SICK_LEAVE' && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
            <DatePicker value={fromDate} onChange={setFromDate} label="Certificate valid from" className="w-full" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
            <DatePicker value={toDate} onChange={setToDate} label="Certificate valid to" min={fromDate || undefined} className="w-full" />
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Content (leave blank to auto-generate)</label>
        <textarea value={customContent} onChange={(e) => setCustomContent(e.target.value)} rows={3} placeholder="Auto-filled from patient name and dates unless overridden here" className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      </div>
      <button type="submit" disabled={saving} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Issuing...' : 'Issue Certificate'}
      </button>
    </form>
  );
}

interface LabTest { id: string; name: string }

export function LabOrderForm({ patientId, appointmentId, onDone }: { patientId: string; onDone: () => void } & EncounterBinding) {
  const [catalog, setCatalog] = useState<LabTest[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: LabTest[] }>('/lab-tests').then((res) => setCatalog(res.data)).catch(() => {});
  }, []);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) {
      setError('Select at least one test.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/lab-orders', { method: 'POST', data: { patientId, appointmentId, testNames: Array.from(selected) } });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to order tests.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03] flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Order Lab Tests</h3>
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
        {catalog.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => toggle(t.name)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${selected.has(t.name) ? 'bg-primary text-primary-foreground' : 'bg-foreground/5 text-foreground/80 hover:bg-foreground/10'}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <button type="submit" disabled={saving} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Ordering...' : `Order ${selected.size || ''} Test${selected.size === 1 ? '' : 's'}`.trim()}
      </button>
    </form>
  );
}

/** "3 weeks ago", "8 months ago" -- a day count is arithmetic the reader
 *  should not have to do. */
function describeAge(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}
