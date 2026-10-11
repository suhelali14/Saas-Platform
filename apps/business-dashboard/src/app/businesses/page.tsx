import Link from "next/link";
import { fetchBusinesses } from "@/lib/api";

export default async function BusinessesPage() {
  const result = await fetchBusinesses();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Businesses</h1>
        </div>
        <Link
          href="/businesses/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + Add business
        </Link>
      </header>

      {!result.ok ? (
        <p className="text-sm text-red-600">Couldn&apos;t load businesses: {result.error}</p>
      ) : result.data && result.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {result.data.map((business) => (
            <li key={business.id}>
              <Link
                href={`/businesses/${business.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div>
                  <p className="font-medium">{business.name}</p>
                  <p className="text-sm text-neutral-500">
                    {business.categories.join(", ")} · {business.city}
                  </p>
                </div>
                <div className="text-right text-sm text-neutral-500">
                  <p>
                    {business.matchCount} match{business.matchCount === 1 ? "" : "es"}
                  </p>
                  <p className="text-xs tracking-wide uppercase">{business.verificationStatus.toLowerCase()}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">No businesses yet.</p>
          <Link href="/businesses/new" className="mt-2 inline-block text-sm font-medium underline">
            Add the first one
          </Link>
        </div>
      )}
    </main>
  );
}
