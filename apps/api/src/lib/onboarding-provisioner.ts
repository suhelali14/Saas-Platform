import { BusinessType, type Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { classifyBusiness, CATEGORY_BUCKETS, type CategoryBucket } from "./business-classifier.js";
import { applyGenreProductToBusiness } from "./website-render.js";
import { generateStorefrontWithAI } from "./website-ai.js";
import { syncProductOffer, syncServiceOffer } from "./catalog-offer-sync.js";
import { uniqueSlug } from "./slug.js";

// Smart-onboarding auto-provisioner (docs/plans smart-onboarding). Turns an
// OnboardingDraft's accumulated answers into the real BusinessOS entities a
// working business needs -- called once, from POST /api/biz/onboarding/complete.
// Everything before this point (steps 1-6) only ever wrote to the draft;
// this is the one place that writes to Product/Service/Category/
// WebsiteConfig/Business.

// Appointment/service-style buckets get Service rows (bookable, has a
// duration); retail-style buckets get Product rows (has stock). This isn't
// a hard rule of the business itself -- it's a reasonable default for what
// "add your top items" means for that category, editable afterward from
// the Catalog page either way.
const SERVICE_BUCKETS = new Set<CategoryBucket>(["HEALTH_AND_BEAUTY", "HOME_AND_PROFESSIONAL_SERVICES", "EDUCATION_AND_COACHING"]);

export interface OnboardingDraftData {
  bucket: CategoryBucket;
  name: string;
  description: string;
  city: string;
  address?: string;
  phone?: string;
  logo?: string;
  offeredItems: { name: string; price: number; description?: string }[];
  workingHours: Record<string, { open: string; close: string } | null>;
  fulfillment: ("DINE_IN" | "PICKUP" | "DELIVERY" | "APPOINTMENT_ONLY")[];
  teamSize: "SOLO" | "SMALL" | "MEDIUM" | "LARGE";
  paymentMethods: string[];
  whatsapp?: string;
  instagram?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  businessTypeOverride?: BusinessType;
}

export interface ProvisionResult {
  businessType: BusinessType;
  classifierConfidence: number;
  planRecommendation: "STARTER" | "GROWTH" | "BUSINESS";
  itemsCreated: number;
  websiteTemplateSource: "genre-product" | "ai-generated-pending";
}

/** Same signal-based recommendation shown on the Review step's preview. */
export function recommendPlan(draft: Pick<OnboardingDraftData, "teamSize" | "offeredItems">): "STARTER" | "GROWTH" | "BUSINESS" {
  if (draft.teamSize === "LARGE" || draft.offeredItems.length > 15) return "BUSINESS";
  if (draft.teamSize === "MEDIUM" || draft.offeredItems.length > 6) return "GROWTH";
  return "STARTER";
}

export async function provisionBusiness(businessId: string, draft: OnboardingDraftData): Promise<ProvisionResult> {
  // 1. Resolve genre -- either the user's override from the Review step, or
  // a fresh classification.
  let businessType: BusinessType;
  let confidence: number;
  if (draft.businessTypeOverride) {
    businessType = draft.businessTypeOverride;
    confidence = 1;
  } else {
    const result = await classifyBusiness({
      bucket: draft.bucket,
      name: draft.name,
      description: draft.description,
      offeredItems: draft.offeredItems,
    });
    businessType = result.businessType;
    confidence = result.confidence;
  }

  const workingHours = Object.values(draft.workingHours).some((v) => v !== null) ? draft.workingHours : undefined;
  const deliveryRules = { fulfillment: draft.fulfillment };

  // 2. Update the business's operational profile with real answers.
  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      type: businessType,
      description: draft.description,
      address: draft.address,
      phone: draft.phone,
      logo: draft.logo,
      workingHours: workingHours as Prisma.InputJsonValue | undefined,
      deliveryRules: deliveryRules as Prisma.InputJsonValue,
      paymentMethods: draft.paymentMethods.length > 0 ? draft.paymentMethods : undefined,
      ...(draft.razorpayKeyId && draft.razorpayKeySecret
        ? { razorpayKeyId: draft.razorpayKeyId, razorpayKeySecret: draft.razorpayKeySecret }
        : {}),
    },
  });

  // 3. Seed the catalog from "what you offer" -- real Product/Service rows,
  // not placeholders. One Category per business, named after the bucket.
  let itemsCreated = 0;
  if (draft.offeredItems.length > 0) {
    const bucketLabel = CATEGORY_BUCKETS[draft.bucket].label;
    const category = await prisma.category.create({
      data: { businessId, name: bucketLabel, slug: uniqueSlug(bucketLabel) },
    });

    const asService = SERVICE_BUCKETS.has(draft.bucket);
    for (const item of draft.offeredItems) {
      if (asService) {
        const service = await prisma.service.create({
          data: {
            businessId,
            name: item.name,
            slug: uniqueSlug(item.name),
            description: item.description,
            price: item.price,
            categoryId: category.id,
          },
        });
        await syncServiceOffer(business, service).catch((err) => console.warn("[onboarding-provisioner] offer sync failed:", err));
      } else {
        const product = await prisma.product.create({
          data: {
            businessId,
            name: item.name,
            slug: uniqueSlug(item.name),
            description: item.description,
            price: item.price,
            categoryId: category.id,
          },
        });
        await prisma.inventoryItem.create({ data: { businessId, productId: product.id, quantity: 0 } });
        await syncProductOffer(business, product).catch((err) => console.warn("[onboarding-provisioner] offer sync failed:", err));
      }
      itemsCreated++;
    }
  }

  // 4. Website -- reuse an existing GenreProduct template if one matches
  // this genre (falling back through GENRE_MAPPING inside generateStorefrontWithAI
  // itself), otherwise generate one live. Either way, no user-facing
  // "generate my website" step -- this is an invisible side effect of
  // finishing onboarding.
  //
  // Applying a real GenreProduct is fast (no AI call) and stays synchronous
  // -- the response can honestly report "genre-product" immediately. The
  // AI-fallback path is not: live-tested, a full `generateStorefrontWithAI`
  // call here (a plan-generation Gemini call, then up to 7 more in parallel
  // to synthesize each section) pushed this endpoint's response time past a
  // minute. Nothing about onboarding completion needs to block on that --
  // the storefront isn't shown synchronously during onboarding, so it's
  // generated in the background instead, matching the same
  // respond-fast-then-do-the-slow-part-after pattern already used for the
  // WhatsApp webhook and the booking flywheel elsewhere in this codebase.
  let websiteTemplateSource: ProvisionResult["websiteTemplateSource"];
  const genreProduct = await prisma.genreProduct.findUnique({ where: { genre: businessType } });
  if (genreProduct) {
    await applyGenreProductToBusiness(business, genreProduct);
    websiteTemplateSource = "genre-product";
  } else {
    websiteTemplateSource = "ai-generated-pending";
    generateStorefrontWithAI(businessId, draft.description)
      .then(async (aiData) => {
        const { saveWebsiteConfig } = await import("./website-render.js");
        await saveWebsiteConfig(businessId, { theme: aiData.theme, blocks: aiData.blocks });
      })
      .catch((err) => console.error("[onboarding-provisioner] background website generation failed:", err));
  }

  // 5. Mark onboarding done and drop the draft -- this is the one place
  // that flips the flag, and only after everything above actually happened.
  // (The catalog/profile/plan are real and already committed at this point;
  // only the AI-fallback storefront, if any, is still finishing in the
  // background -- WebsiteConfig being briefly unset renders the same
  // graceful default-storefront branch website-render.ts already has for
  // any business with zero blocks configured.)
  await prisma.business.update({ where: { id: businessId }, data: { onboardingCompleted: true } });
  await prisma.onboardingDraft.deleteMany({ where: { businessId } });

  return {
    businessType,
    classifierConfidence: confidence,
    planRecommendation: recommendPlan(draft),
    itemsCreated,
    websiteTemplateSource,
  };
}
