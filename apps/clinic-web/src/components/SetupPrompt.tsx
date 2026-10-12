import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { publicSiteUrl } from '../lib/site-mode';

/**
 * Tells the clinic what its own website is still missing.
 *
 * A newly provisioned clinic has a name and nothing else, so its public
 * page renders a header, an empty middle and a footer. The page is doing
 * the right thing -- a section whose field is blank is hidden, which is
 * what stops a new clinic showing empty headings -- but from inside the
 * clinic it looks broken, and nobody tells the one person who can fix it.
 * This is that person's screen, so this is where it belongs.
 *
 * Shown in the portal shell rather than on one page, because the doctor
 * who needs to see it did not come here to check their website; they came
 * to see patients, and will only ever notice this in passing.
 *
 * Dismissible, and the dismissal is remembered per browser. An
 * unclosable banner on every screen is how a prompt turns into furniture
 * that gets looked past -- and the information stays reachable from
 * Settings, which is where someone goes when they decide to act on it.
 */

type SetupItem = {
  key: string;
  label: string;
  why: string;
  done: boolean;
  tab: 'clinic' | 'public' | 'profile';
  essential: boolean;
};

type SetupStatus = {
  ready: boolean;
  essentialRemaining: number;
  totalRemaining: number;
  items: SetupItem[];
};

const DISMISS_KEY = 'clinicSetupPromptDismissed';

/** Re-shown when the remaining count changes, so finishing four of five
 *  items and stalling does not leave a dismissed banner hiding the last
 *  one forever. */
function dismissedAt(): string | null {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
}

export function SetupPrompt() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<SetupStatus>('/setup-status')
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => {
        // A clinic with no record at all, or an older API without this
        // route. Either way there is nothing useful to say, and a failed
        // check must not put an error banner above every screen.
      });
    return () => { cancelled = true; };
  }, []);

  if (!status || status.totalRemaining === 0 || hidden) return null;
  if (dismissedAt() === String(status.totalRemaining)) return null;

  const remaining = status.items.filter((i) => !i.done);
  const essential = remaining.filter((i) => i.essential);
  const urgent = essential.length > 0;

  return (
    <div className="px-4 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8">
    <div
      className={`rounded-lg border p-4 ${
        urgent
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-white/10 bg-white/5'
      }`}
      role="region"
      aria-label="Website setup"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {urgent
              ? `Your public website is missing ${essential.length} essential ${essential.length === 1 ? 'detail' : 'details'}`
              : 'Your public website could be more complete'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {urgent
              ? 'Patients visiting your page right now cannot see these. Nothing else in the portal is affected — you can keep seeing patients as normal.'
              : 'Everything essential is filled in. These would make the page more useful to a patient deciding whether to come.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/settings"
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            Fill it in
          </Link>
          <a
            href={publicSiteUrl('/')}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-1.5 text-xs text-gray-400 hover:text-white"
          >
            View page
          </a>
          <button
            type="button"
            onClick={() => {
              try { localStorage.setItem(DISMISS_KEY, String(status.totalRemaining)); } catch { /* private mode */ }
              setHidden(true);
            }}
            className="rounded-md px-2 py-1.5 text-xs text-gray-500 hover:text-white"
            aria-label="Hide this for now"
          >
            Not now
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-xs text-gray-400 underline-offset-2 hover:text-white hover:underline"
        aria-expanded={expanded}
      >
        {expanded ? 'Hide the list' : `Show what's missing (${remaining.length})`}
      </button>

      {expanded && (
        <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
          {remaining.map((item) => (
            <li key={item.key} className="text-xs">
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1 size-1.5 shrink-0 rounded-full ${
                    item.essential ? 'bg-amber-400' : 'bg-gray-500'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {item.label}
                    {!item.essential && <span className="ml-1.5 font-normal text-gray-500">optional</span>}
                  </p>
                  {/* The reason, not just the field name. "Add the
                      address" is an instruction; "a patient cannot visit
                      without it" is why anyone would follow it. */}
                  <p className="text-gray-400">{item.why}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
    </div>
  );
}
