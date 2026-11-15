/**
 * Which parts of the portal a person sees.
 *
 * Their role says what they may do; the service points they are assigned
 * to (Departments) add the desks they work at. A receptionist who also
 * covers the scheme desk sees the claims screen; a ward nurse sees the
 * bed board and the chart but not the cash counter. Admins see everything.
 *
 * The API enforces the same lines -- this only keeps each person's menu to
 * the work that is theirs, which is what makes a hospital portal usable by
 * a cashier on day one.
 */

export type Area =
  | 'queue' | 'requests' | 'patients' | 'ipd' | 'nursing' | 'ot' | 'labs' | 'radiology' | 'pharmacy'
  | 'billing' | 'counter' | 'claims' | 'expenses' | 'reports' | 'departments';

// The first five roles keep exactly the menu they had before hospitals
// existed, so a single-doctor clinic sees no change; the hospital trim
// below only applies once the departments module is on.
const BY_ROLE: Record<string, Area[]> = {
  DOCTOR: ['queue', 'requests', 'patients', 'ipd', 'nursing', 'ot', 'labs', 'radiology', 'pharmacy', 'billing', 'claims', 'expenses', 'reports'],
  ADMIN: ['queue', 'requests', 'patients', 'ipd', 'nursing', 'ot', 'labs', 'radiology', 'pharmacy', 'billing', 'counter', 'claims', 'expenses', 'reports', 'departments'],
  RECEPTIONIST: ['queue', 'requests', 'patients', 'ipd', 'labs', 'billing', 'counter', 'expenses', 'reports'],
  NURSE: ['queue', 'patients', 'ipd', 'nursing', 'ot', 'labs'],
  PHARMACIST: ['queue', 'patients', 'labs', 'pharmacy'],
  CASHIER: ['patients', 'billing', 'counter'],
  BILLING_CLERK: ['patients', 'ipd', 'billing', 'counter', 'claims'],
  LAB_TECH: ['patients', 'labs'],
  RADIOGRAPHER: ['patients', 'radiology'],
};

const BY_SERVICE: Record<string, Area[]> = {
  FRONT_DESK: ['queue', 'requests'],
  CASH_COUNTER: ['counter', 'billing'],
  INSURANCE: ['claims'],
  SCHEMES: ['claims'],
  PHARMACY: ['pharmacy'],
  LAB: ['labs'],
  RADIOLOGY: ['radiology'],
  OT: ['ot'],
  WARD: ['ipd', 'nursing'],
  RECORDS: ['patients'],
};

/**
 * Areas the API restricts by role, with the roles it lets in (the sets in
 * apps/clinic-api/src/plugins/auth.ts and the expense routes). A desk
 * assignment cannot add one of these to a role the API refuses -- a nurse
 * put on the cash-counter desk would otherwise get a menu link to a screen
 * that only says no. Areas not listed here are readable by any staff.
 */
const AREA_ROLES: Partial<Record<Area, ReadonlySet<string>>> = {
  counter: new Set(['CASHIER', 'RECEPTIONIST', 'BILLING_CLERK', 'ADMIN', 'DOCTOR']),
  billing: new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN', 'CASHIER', 'BILLING_CLERK']),
  claims: new Set(['BILLING_CLERK', 'RECEPTIONIST', 'ADMIN', 'DOCTOR']),
  requests: new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']),
  pharmacy: new Set(['PHARMACIST', 'DOCTOR', 'ADMIN']),
  expenses: new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']),
};

/** The module each area belongs to; an area whose module is off is never shown. */
export const AREA_MODULE: Partial<Record<Area, string>> = {
  ipd: 'ipd', nursing: 'nursing', ot: 'ot', labs: 'labs', radiology: 'radiology', pharmacy: 'pharmacy',
  billing: 'billing', counter: 'cashcounter', expenses: 'expenses', reports: 'analytics', departments: 'departments',
};

export function areasFor(role: string | undefined, isAdmin: boolean, servicePoints: string[], hasModule: (m: string) => boolean): Set<Area> {
  const out = new Set<Area>(role ? BY_ROLE[role] ?? ['patients'] : []);
  // In a hospital the money is handled at the counter and the billing
  // desk, so a doctor who is not also an admin sees clinical work only.
  // Their own desk assignments below can still add a screen back.
  if (hasModule('departments') && role === 'DOCTOR' && !isAdmin) {
    for (const a of ['billing', 'expenses', 'requests'] as Area[]) out.delete(a);
  }
  for (const sp of servicePoints) {
    for (const a of BY_SERVICE[sp] ?? []) {
      const allowed = AREA_ROLES[a];
      if (!allowed || (role && allowed.has(role))) out.add(a);
    }
  }
  // Admins pass every role check in the API (allowAdmin), so they see it all.
  if (isAdmin) for (const a of BY_ROLE.ADMIN!) out.add(a);
  for (const a of [...out]) {
    const m = AREA_MODULE[a];
    if (m && !hasModule(m)) out.delete(a);
  }
  // Claims belong to two modules; either desk being on is enough.
  if (out.has('claims') && !hasModule('insurance') && !hasModule('schemes')) out.delete('claims');
  if (out.has('nursing') && !hasModule('ipd')) out.delete('nursing');
  return out;
}
