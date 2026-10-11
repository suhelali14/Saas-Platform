import { useEffect, useState } from 'react';
import { currentTenant, fetchTenantConfig, TenantNotFound, type TenantConfig } from './lib/tenant';
import { setApiBaseUrl } from './lib/api';

/**
 * Resolves which clinic this hostname belongs to before the app renders.
 *
 * One static bundle serves every clinic on the platform wildcard, and each
 * clinic has its own database behind its own API. So there is a genuine
 * ordering requirement: nothing may issue a request until the API base URL
 * for *this* clinic is known, or the first request goes to whichever API
 * the bundle happened to be built against -- which in a multi-tenant
 * deployment means another clinic's database.
 *
 * Hence a gate rather than a hook inside the app. The resolution happens
 * once, above everything, and children only mount after it has succeeded.
 *
 * Deployments that are not subdomain-addressed (a clinic on its own domain,
 * and local development) skip the lookup entirely and render immediately on
 * the build-time `VITE_API_URL`, exactly as before.
 */
export function TenantGate({ children }: { children: React.ReactNode }) {
  const location = currentTenant();
  const needsLookup = location.kind === 'tenant';

  const [state, setState] = useState<
    | { phase: 'ready'; config: TenantConfig | null }
    | { phase: 'loading' }
    | { phase: 'suspended'; name: string }
    | { phase: 'unknown' }
    | { phase: 'error'; message: string }
  >(needsLookup ? { phase: 'loading' } : { phase: 'ready', config: null });

  useEffect(() => {
    if (location.kind !== 'tenant') return;
    let cancelled = false;

    fetchTenantConfig(location.slug)
      .then((config) => {
        if (cancelled) return;
        if (config.suspended || !config.apiBaseUrl) {
          // The directory withholds the API base URL for a suspended
          // clinic, so there is nothing to point the app at even if this
          // branch were somehow skipped.
          setState({ phase: 'suspended', name: config.name });
          return;
        }
        setApiBaseUrl(config.apiBaseUrl);
        setState({ phase: 'ready', config });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof TenantNotFound) return setState({ phase: 'unknown' });
        setState({
          phase: 'error',
          message: error instanceof Error ? error.message : 'Could not reach the clinic directory.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [location.kind, location.kind === 'tenant' ? location.slug : '']);

  if (state.phase === 'ready') return <>{children}</>;

  if (state.phase === 'loading') {
    // Deliberately plain and unbranded: at this point the clinic's own
    // identity is exactly what has not been loaded yet, so anything more
    // decorative would be guessing.
    return (
      <Centered>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-teal-600" role="status">
          <span className="sr-only">Loading</span>
        </div>
      </Centered>
    );
  }

  if (state.phase === 'suspended') {
    return (
      <Centered>
        <h1 className="text-xl font-semibold text-gray-900">{state.name} is temporarily unavailable</h1>
        <p className="mt-2 max-w-md text-sm text-gray-600">
          This clinic's online services are paused. Please contact the clinic directly for appointments
          or records.
        </p>
      </Centered>
    );
  }

  if (state.phase === 'unknown') {
    return (
      <Centered>
        <h1 className="text-xl font-semibold text-gray-900">No clinic at this address</h1>
        <p className="mt-2 max-w-md text-sm text-gray-600">
          Please check the web address. If you reached this from a link, the clinic may have moved.
        </p>
      </Centered>
    );
  }

  return (
    <Centered>
      <h1 className="text-xl font-semibold text-gray-900">Temporarily unreachable</h1>
      <p className="mt-2 max-w-md text-sm text-gray-600">
        We could not load this clinic's details. Please try again in a moment.
      </p>
      <p className="mt-4 font-mono text-xs text-gray-400">{state.message}</p>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      {children}
    </div>
  );
}
