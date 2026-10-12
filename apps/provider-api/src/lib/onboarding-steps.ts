/**
 * The onboarding checklist, as a fixed template.
 *
 * Every step is listed whether or not the console performs it, and
 * `automated` says which is which. That distinction is the point: an
 * operator should never sit waiting for a button that was never going to
 * exist, and should never assume a step happened because the row was
 * there.
 *
 * DNS in particular can only ever be manual — it is the customer's domain,
 * bought from a registrar this console has no relationship with.
 */
export interface StepTemplate {
  key: string;
  label: string;
  automated: boolean;
  hint: string;
}

export const ONBOARDING_TEMPLATE: StepTemplate[] = [
  {
    key: "deal",
    label: "Deal agreed and plan chosen",
    automated: false,
    hint: "Plan, monthly fee and start date recorded on this account.",
  },
  {
    key: "domains",
    label: "Domains decided",
    automated: false,
    hint: "The clinic buys the domain. You need the public site, the portal subdomain and the API subdomain.",
  },
  {
    key: "database",
    label: "Database created",
    automated: true,
    hint: "A dedicated Neon project in ap-southeast-1 (Singapore). Never shared with another clinic.",
  },
  {
    key: "api-project",
    label: "API deployed",
    automated: true,
    hint: "Its own deployment, with the plan baked into CLINIC_PLAN at boot.",
  },
  {
    key: "web-project",
    label: "Website + portal deployed",
    automated: true,
    hint: "One build serves both; the hostname decides which a visitor gets.",
  },
  {
    key: "migrate",
    label: "Tables created and first admin seeded",
    automated: true,
    hint: "Runs the clinic app's own migrations, not a copy of them.",
  },
  {
    key: "dns",
    label: "DNS pointed",
    automated: false,
    hint: "The clinic's registrar. Public domain to the host, portal subdomain CNAME to it, API subdomain to the API deployment.",
  },
  {
    key: "branding",
    label: "Logo, address and timings filled in",
    automated: false,
    hint: "The clinic does this in Settings. Their site stays sparse until they do — by design, nothing is invented for them.",
  },
  {
    key: "handover",
    label: "Credentials handed over and password rotated",
    automated: false,
    hint: "Give the generated password once, in person or by phone. Have them change it on first sign-in.",
  },
  {
    key: "live",
    label: "Clinic confirmed live",
    automated: false,
    hint: "They have seen real patients through it.",
  },
];
