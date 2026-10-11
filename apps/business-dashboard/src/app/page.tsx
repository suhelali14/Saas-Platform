import Link from "next/link";
import { fetchPlatformStats, getHealth } from "@/lib/api";

export default async function DashboardPage() {
  const [health, stats] = await Promise.all([getHealth(), fetchPlatformStats()]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">Intently for Business</p>
          <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
        </div>
        <Link
          href="/businesses"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Manage businesses
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Requests received" value="—" />
        <StatCard label="Qualified opportunities" value="—" />
        <StatCard label="Conversions" value="—" />
        <StatCard label="Revenue generated" value="—" />
      </section>

      <p className="text-xs text-neutral-400">
        Stats above are placeholders. They wire up to real data once the Matching Engine and
        Transaction Service ship in Phase 2 — see docs/07-roadmap-phases.md and
        docs/02-product-spec.md §2.4.
      </p>

      <section className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">Platform activity (real, live totals)</h2>
        {!stats.ok ? (
          <p className="mt-2 text-sm text-red-600">Couldn&apos;t load platform stats: {stats.error}</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Businesses listed" value={String(stats.data?.totalBusinesses ?? 0)} />
            <StatCard label="Requests submitted" value={String(stats.data?.totalIntentRequests ?? 0)} />
            <StatCard label="Requests matched" value={String(stats.data?.matchedIntentRequests ?? 0)} />
            <StatCard label="Total matches shown" value={String(stats.data?.totalMatches ?? 0)} />
          </div>
        )}
        <p className="mt-3 text-xs text-neutral-400">
          Real counts across the whole platform (not scoped to one business — there&apos;s no business
          login yet). This is the pitch data doc 08&apos;s outreach playbook uses: &ldquo;we have N
          people asking for exactly what you sell.&rdquo;
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">System status</h2>
        <p className="mt-2 text-sm">
          API:{" "}
          <span className={health.ok ? "text-emerald-600" : "text-red-600"}>
            {health.ok ? `connected (${health.data?.service})` : `unreachable — ${health.error}`}
          </span>
        </p>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
