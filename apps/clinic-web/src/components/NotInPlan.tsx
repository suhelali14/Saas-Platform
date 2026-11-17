import { Link } from 'react-router-dom';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { MODULE_INFO, PLAN_LABELS, type PlanTier } from '../lib/modules';

const ORDER: PlanTier[] = ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'];

/**
 * Shown in place of a screen whose module this clinic's plan does not
 * include.
 *
 * It says what the module is, which plan has it, and who to ask -- the
 * clinic's upgrade path is a conversation with Nayaversse, so this is
 * where that conversation starts. It never pretends the page is broken,
 * and it never hides that the feature exists.
 */
export function NotInPlan({ module, inline }: { module: string; inline?: boolean }) {
  const { entitlement } = useClinicAuth();
  const info = MODULE_INFO[module];
  const name = info?.label ?? 'This screen';
  return (
    // Inline, it sits inside another page (a tab), so no page padding or title.
    <div className={inline ? 'max-w-2xl' : 'p-4 sm:p-6 md:p-8 max-w-2xl'}>
      {!inline && <h1>{name}</h1>}
      <div className={`${inline ? '' : 'mt-5 '}rounded-xl border border-border/15 bg-card p-5`}>
        <p className="text-[16px] font-semibold">Not part of your plan yet.</p>
        {info && <p className="mt-1.5 text-[15px] text-muted-foreground">{info.what}</p>}
        <p className="mt-3 text-[15px]">
          Your clinic is on the <span className="font-semibold">{entitlement.planLabel}</span> plan.
          {info && (ORDER.indexOf(info.from) <= ORDER.indexOf(entitlement.plan)
            // Normally in this plan, but left out of this clinic's deal.
            ? <> {name} is not switched on for your clinic.</>
            : <> {name} comes with the <span className="font-semibold">{PLAN_LABELS[info.from]}</span> plan, or can be added to yours on its own.</>)}
        </p>
        <p className="mt-3 text-[15px]">
          {entitlement.upgradeContact
            ? <>To add it, contact <span className="font-semibold">{entitlement.upgradeContact}</span>.</>
            : <>To add it, contact Nayaversse.</>}
          {' '}Nothing already in your records changes when a plan changes.
        </p>
        <Link to="/queue" className="mt-4 inline-block text-[14px] font-medium underline underline-offset-4">Back to the queue</Link>
      </div>
    </div>
  );
}
