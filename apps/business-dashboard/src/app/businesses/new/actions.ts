"use server";

import { redirect } from "next/navigation";
import { createBusiness } from "@/lib/api";

export interface CreateBusinessState {
  error?: string;
}

export async function createBusinessAction(
  _prevState: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const name = String(formData.get("name") ?? "").trim();
  const categoriesRaw = String(formData.get("categories") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const price = String(formData.get("price") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  const categories = categoriesRaw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  if (!name || categories.length === 0 || !city || !price || !description) {
    return { error: "Fill in all required fields." };
  }

  const priceNum = Number(price);
  if (!Number.isInteger(priceNum) || priceNum <= 0) {
    return { error: "Price must be a whole number greater than 0." };
  }

  const result = await createBusiness({
    name,
    categories,
    city,
    address: address || undefined,
    offer: { price: priceNum, description },
  });

  if (!result.ok || !result.data) {
    return { error: result.error ?? "Something went wrong." };
  }

  redirect(`/businesses/${result.data.id}`);
}
