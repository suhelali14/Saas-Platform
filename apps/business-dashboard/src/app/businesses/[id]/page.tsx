import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchBusiness } from "@/lib/api";
import { AddOfferForm } from "./add-offer-form";

export default async function BusinessDetailPage({ params }: PageProps<"/businesses/[id]">) {
  const { id } = await params;
  const result = await fetchBusiness(id);

  if (!result.ok || !result.data) {
    notFound();
  }

  const business = result.data;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/businesses" className="text-sm text-neutral-500 hover:underline">
        ← Businesses
      </Link>

      <header>
        <h1 className="text-2xl font-semibold">{business.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {business.categories.join(", ")} · {business.city}
          {business.address ? ` · ${business.address}` : ""}
        </p>
        <p className="mt-1 text-xs tracking-wide text-neutral-400 uppercase">
          {business.verificationStatus.toLowerCase()}
        </p>
      </header>

      <section className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">Offers</h2>
        {business.offers.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No offers yet — add one below.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {business.offers.map((offer) => (
              <li key={offer.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="font-medium">
                  {offer.currency} {offer.price}
                </p>
                <p className="text-sm text-neutral-500">{offer.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddOfferForm businessId={business.id} />
    </main>
  );
}
