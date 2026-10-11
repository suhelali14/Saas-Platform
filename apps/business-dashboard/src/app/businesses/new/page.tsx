"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createBusinessAction, type CreateBusinessState } from "./actions";

const initialState: CreateBusinessState = {};

export default function NewBusinessPage() {
  const [state, formAction, pending] = useActionState(createBusinessAction, initialState);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header>
        <Link href="/businesses" className="text-sm text-neutral-500 hover:underline">
          ← Businesses
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Add your business</h1>
        <p className="mt-1 text-sm text-neutral-500">
          List your business and one offer so it can start appearing in real Intently searches.
        </p>
      </header>

      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800"
      >
        <Field label="Business name" name="name" required />
        <Field
          label="Categories (comma-separated)"
          name="categories"
          placeholder="gym, fitness"
          required
          hint="Supported today: restaurant, gym, salon"
        />
        <Field label="City" name="city" required />
        <Field label="Address (optional)" name="address" />

        <div className="mt-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="text-sm font-medium">First offer</p>
          <p className="text-xs text-neutral-500">A business with no offers can never appear in a match.</p>
        </div>
        <Field label="Price (INR)" name="price" type="number" required />
        <Field
          label="Offer description"
          name="description"
          placeholder="Monthly membership, group classes included"
          required
        />

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Creating…" : "Create business"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
      />
      {hint ? <span className="text-xs text-neutral-400">{hint}</span> : null}
    </label>
  );
}
