import { prisma } from "./prisma.js";

/**
 * How much of this clinic's public page actually exists.
 *
 * A freshly provisioned clinic has a name and nothing else, so its
 * patient website renders a header, an empty middle and a footer. The
 * page itself is working exactly as designed -- every section is hidden
 * when the field behind it is blank, which is what stops a new clinic
 * showing empty headings -- but from the clinic's side it looks broken,
 * and the only person who can fix it is the one who has not been told.
 *
 * So the same judgement lives in one place and is reported to the portal,
 * rather than each screen deciding for itself what "set up" means. Two
 * copies of this rule would drift, and then the portal would say the page
 * is ready while the page disagrees.
 *
 * Deliberately not a gate. Nothing here blocks the clinic from using the
 * system: a doctor can see patients, write prescriptions and bill on the
 * first day with nothing but a name. These are prompts, in the order a
 * patient notices them missing.
 */

export type SetupItem = {
  key: string;
  /** What to do, phrased as the action rather than the field name. */
  label: string;
  /** Why it matters to someone outside the clinic. */
  why: string;
  done: boolean;
  /** Which settings tab it is on, so the prompt can link straight there. */
  tab: "clinic" | "public" | "profile";
  /** A patient cannot act without these; the rest make the page better. */
  essential: boolean;
};

export type SetupStatus = {
  /** True once every essential item is done. */
  ready: boolean;
  essentialRemaining: number;
  totalRemaining: number;
  items: SetupItem[];
};

function filled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

export async function getSetupStatus(): Promise<SetupStatus | null> {
  const clinic = await prisma.clinic.findFirst({
    select: {
      name: true, address: true, phone: true, email: true, about: true,
      timings: true, services: true, logoPath: true, registrationNumber: true,
      tagline: true, doctorName: true, highlights: true, faqs: true, mapUrl: true,
    },
  });
  if (!clinic) return null;

  // At least one doctor who has not opted out. Without this the page has
  // no named practitioner, which is the single strongest reason a patient
  // decides to trust a clinic's site -- and it is also the field that
  // signs every prescription.
  const publicDoctors = await prisma.clinicUser.count({
    where: { role: "DOCTOR", isActive: true, showOnPublicPage: true },
  });

  const items: SetupItem[] = [
    {
      key: "address",
      label: "Add the clinic's address",
      why: "A patient cannot visit without it, and the Get directions link needs it.",
      done: filled(clinic.address),
      tab: "clinic",
      essential: true,
    },
    {
      key: "phone",
      label: "Add a phone number",
      why: "The page's Call Clinic button does nothing until there is one.",
      done: filled(clinic.phone),
      tab: "clinic",
      essential: true,
    },
    {
      key: "timings",
      label: "Set the opening hours",
      why: "Patients arriving at a closed clinic is the complaint this prevents. The open/closed badge needs them.",
      done: filled(clinic.timings),
      tab: "public",
      essential: true,
    },
    {
      key: "doctor",
      label: "Show at least one doctor on the public page",
      why: "A clinic page with no named doctor reads as untrustworthy, and this name signs every prescription.",
      done: publicDoctors > 0,
      tab: "profile",
      essential: true,
    },
    {
      key: "services",
      label: "List the services offered",
      why: "This is what a patient searches for before deciding to come.",
      done: filled(clinic.services),
      tab: "public",
      essential: false,
    },
    {
      key: "about",
      label: "Write a short About section",
      why: "A few honest lines about the practice. Nothing else on the page does this job.",
      done: filled(clinic.about),
      tab: "public",
      essential: false,
    },
    {
      key: "registrationNumber",
      label: "Add the registration number",
      why: "It prints on every certificate and prescription, and patients look for it.",
      done: filled(clinic.registrationNumber),
      tab: "clinic",
      essential: false,
    },
    {
      key: "logo",
      label: "Upload the clinic's logo",
      why: "Used on the website header and on the letterhead of every printed document.",
      done: filled(clinic.logoPath),
      tab: "clinic",
      essential: false,
    },
    {
      key: "tagline",
      label: "Add a tagline",
      why: "One line under the clinic's name, the first thing a visitor reads.",
      done: filled(clinic.tagline),
      tab: "public",
      essential: false,
    },
    {
      key: "mapUrl",
      label: "Add a map link",
      why: "Turns the address into directions a patient can follow on their phone.",
      done: filled(clinic.mapUrl),
      tab: "public",
      essential: false,
    },
  ];

  const essentialRemaining = items.filter((i) => i.essential && !i.done).length;
  return {
    ready: essentialRemaining === 0,
    essentialRemaining,
    totalRemaining: items.filter((i) => !i.done).length,
    items,
  };
}
