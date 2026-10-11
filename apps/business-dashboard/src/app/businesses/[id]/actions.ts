"use server";

import { revalidatePath } from "next/cache";
import { createOffer } from "@/lib/api";

export interface AddOfferState {
  error?: string;
}

export async function addOfferAction(
  businessId: string,
  _prevState: AddOfferState,
  formData: FormData,
): Promise<AddOfferState> {
  const price = Number(formData.get("price"));
  const description = String(formData.get("description") ?? "").trim();

  if (!Number.isInteger(price) || price <= 0 || !description) {
    return { error: "Enter a valid price and description." };
  }

  const result = await createOffer(businessId, { price, description });
  if (!result.ok) {
    return { error: result.error ?? "Something went wrong." };
  }

  revalidatePath(`/businesses/${businessId}`);
  return {};
}
