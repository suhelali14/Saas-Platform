"use client";

import { useActionState } from "react";
import { addOfferAction, type AddOfferState } from "./actions";

const initialState: AddOfferState = {};

export function AddOfferForm({ businessId }: { businessId: string }) {
  const addOfferWithId = addOfferAction.bind(null, businessId);
  const [state, formAction, pending] = useActionState(addOfferWithId, initialState);

  return (
    <section className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="text-sm font-medium text-neutral-500">Add another offer</h2>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input
          name="price"
          type="number"
          placeholder="Price (INR)"
          required
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          name="description"
          type="text"
          placeholder="Offer description"
          required
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
        >
          {pending ? "Adding…" : "Add offer"}
        </button>
      </form>
    </section>
  );
}
