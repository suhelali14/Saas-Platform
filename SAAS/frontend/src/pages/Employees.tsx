import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

function getAvatarClass(name: string) {
  const classes = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5', 'avatar-6'];
  return classes[name.charCodeAt(0) % classes.length];
}

export function Employees() {
  const { fetchWithAuth, isLoading } = useApi();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', department: '', phone: '', email: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetchWithAuth('/employees');
      setEmployees(res.data || []);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load the team.');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/employees', { method: 'POST', data: form });
      setShowModal(false);
      setActionError(null);
      load();
      setForm({ name: '', role: '', department: '', phone: '', email: '' });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to add employee.');
    }
  };

  const toggleAvailability = async (emp: any) => {
    try {
      await fetchWithAuth(`/employees/${emp.id}`, { method: 'PUT', data: { ...emp, isAvailable: !emp.isAvailable } });
      setActionError(null);
      load();
    } catch (e: any) {
      setActionError(e?.message || 'Failed to update availability.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{employees.length} employees · {employees.filter(e => e.isAvailable).length} available</p>
        </div>
        <Button variant="accent" onClick={() => setShowModal(true)}>+ Add Employee</Button>
      </div>

      {(loadError || actionError) && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {loadError || actionError} {loadError && <button onClick={load} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>Retry</button>}
        </div>
      )}

      {/* Employee Cards */}
      <div className="grid grid-auto">
        {employees.map((emp, i) => (
          <Card key={emp.id} className={`stagger-${(i % 6) + 1}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`avatar avatar-lg ${getAvatarClass(emp.name)}`}>
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-width-0">
                <div className="font-semibold text-primary truncate">{emp.name}</div>
                <div className="text-sm text-secondary">{emp.role}</div>
                <div className="text-xs text-tertiary">{emp.department}</div>
              </div>
              <Badge variant={emp.isAvailable ? 'success' : 'neutral'} withDot>
                {emp.isAvailable ? 'Available' : 'Busy'}
              </Badge>
            </div>

            <div className="grid grid-2 mb-4" style={{ gap: '12px' }}>
              <div className="card" style={{ padding: '12px', background: 'var(--bg-tertiary)' }}>
                <div className="text-xs text-tertiary mb-1">Tasks Done</div>
                <div className="font-bold text-primary">{emp.tasksCompleted || 0}</div>
              </div>
              <div className="card" style={{ padding: '12px', background: 'var(--bg-tertiary)' }}>
                <div className="text-xs text-tertiary mb-1">Rating</div>
                <div className="font-bold text-accent">⭐ {emp.rating || '—'}</div>
              </div>
            </div>

            <div className="text-sm text-secondary mb-4">{emp.phone || emp.email || '—'}</div>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => toggleAvailability(emp)}>
                {emp.isAvailable ? 'Mark Busy' : 'Mark Available'}
              </Button>
              <Button variant="secondary" size="sm" className="flex-1">View</Button>
            </div>
          </Card>
        ))}

        {employees.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon">👥</div>
            <h3 className="empty-state-title">No team members yet</h3>
            <p className="empty-state-description">Add your staff to assign orders, appointments, and tasks.</p>
            <Button variant="accent" onClick={() => setShowModal(true)}>+ Add Employee</Button>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Team Member"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="accent" isLoading={isLoading} onClick={handleAdd as any}>Add Member</Button>
          </>
        }
      >
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Full Name *" placeholder="Suresh Kumar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-2" style={{ gap: '16px' }}>
            <Input label="Role" placeholder="Manager, Driver, Chef..." value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
            <Input label="Department" placeholder="Operations, Sales..." value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
          </div>
          <Input label="Phone" placeholder="9876500001" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" placeholder="suresh@yourbusiness.com" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
