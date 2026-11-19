/**
 * The clauses in a Nayaversse service agreement.
 *
 * The body of an Agreement record is a Json structure {heading, paragraphs[]};
 * these functions produce that structure for a given deal, so the PDF and
 * any HTML preview render from the same source and never disagree.
 *
 * Why these clauses, not some others:
 *   - The customer is a Data Fiduciary and we are a Data Processor under
 *     the DPDP Act 2023. That framing is in the data-protection section
 *     because under the Act the Fiduciary carries the regulatory risk,
 *     and a boilerplate that leaves it ambiguous is worse than a plain
 *     one that names which side we are on.
 *   - Breach notification tracks the DPDP Rules 2025 (notified 14 Nov
 *     2025). "Without undue delay" is the drafted language; the exact
 *     number of hours is in the Rules and changes less often than this
 *     file does.
 *   - Service levels are drafted as the customer's SOLE remedy at the
 *     service-credit stage. India-SaaS practitioner writing recommends
 *     this; without it the service credit stacks under contract.
 *   - Liability is layered: fees paid in the prior 12 months, with
 *     carve-outs for wilful misconduct and DPDP regulatory penalties
 *     caused by the processor's own breach. Those carve-outs are the
 *     ones a careful customer would ask for and the ones we can honour.
 *
 * None of this is a substitute for a lawyer reviewing the document the
 * first time it is sent to a real client; the comment above a clause
 * explains the choice so the lawyer can judge it rather than rewrite
 * from scratch.
 */

export interface Clause {
  heading: string;
  paragraphs: string[];
}

export interface AgreementVariables {
  /** Vendor legal name on the paper. */
  providerName: string;
  providerAddress?: string;
  providerGSTIN?: string;
  /** Client legal name on the paper. */
  clientName: string;
  clientAddress?: string;
  clientGSTIN?: string;
  effectiveFrom?: Date;
  termMonths: number;
  noticeDays: number;
  autoRenew: boolean;
  /** Which plan tier is on offer. Rendered in the scope clause. */
  planTier: "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
  /** Fees as prose, lifted from the accepted quotation. */
  feeSummary: string;
  /** The jurisdiction's registered city. Rendered in governing-law. */
  governingCity: string;
}

const PLAN_SCOPE_TEXT: Record<AgreementVariables["planTier"], string> = {
  BASIC:
    "Nayaversse BASIC: patients, appointments, case sheets, prescriptions, medical certificates, cash billing, and a public clinic website. Up to five staff logins.",
  STANDARD:
    "Nayaversse STANDARD: everything in BASIC, plus multi-doctor scheduling, pharmacy inventory with FEFO dispensing, lab orders, expenses and monthly P&L, and an append-only audit trail. Up to fifteen staff logins.",
  PREMIUM:
    "Nayaversse PREMIUM: everything in STANDARD, plus in-patient beds, discharge summary generation, role-based access, custom analytics, priority support with a four-hour first response during business hours. Unlimited staff logins.",
  ENTERPRISE:
    "Nayaversse ENTERPRISE: a bespoke scope, as set out in the Schedule to this Agreement. The Schedule controls where it differs from any plan description.",
};

function ymd(d: Date | undefined): string {
  if (!d) return "the Effective Date";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}/${m}/${y}`;
}

export function buildAgreementClauses(v: AgreementVariables): Clause[] {
  const effective = ymd(v.effectiveFrom);
  const plural = v.termMonths === 1 ? "month" : "months";

  return [
    {
      heading: "1. Parties and Effective Date",
      paragraphs: [
        `This Service Agreement (the "Agreement") is made on ${effective} between:`,
        `(a) ${v.providerName}${v.providerAddress ? `, having its office at ${v.providerAddress}` : ""}${v.providerGSTIN ? ` (GSTIN: ${v.providerGSTIN})` : ""} (the "Provider" / "Nayaversse"); and`,
        `(b) ${v.clientName}${v.clientAddress ? `, having its office at ${v.clientAddress}` : ""}${v.clientGSTIN ? ` (GSTIN: ${v.clientGSTIN})` : ""} (the "Customer").`,
        `The Provider and the Customer are each a "Party" and together the "Parties".`,
      ],
    },
    {
      heading: "2. Scope of Services",
      paragraphs: [
        `The Provider grants the Customer a non-exclusive, non-transferable, non-sublicensable right to access and use the Services for the Term, solely for the Customer's own clinical and business operations.`,
        `The Services comprise: ${PLAN_SCOPE_TEXT[v.planTier]}`,
        `The scope, exclusions and deliverables set out in the accepted Quotation attached as Schedule A control over this clause where they differ from it, except to the extent any such term is inconsistent with the data protection, liability or governing law clauses of this Agreement.`,
      ],
    },
    {
      heading: "3. Fees and Payment",
      paragraphs: [
        v.feeSummary,
        `All fees are exclusive of applicable Goods and Services Tax (GST), which the Customer will pay in addition. GST invoices will be issued by the Provider in accordance with the Central Goods and Services Tax Act, 2017 and the rules framed under it.`,
        `Any amount not paid within thirty (30) days of the invoice date bears interest at 1.5% per month, calculated from the due date to the date of payment, without prejudice to the Provider's other rights.`,
      ],
    },
    {
      heading: "4. Term and Termination",
      paragraphs: [
        `This Agreement begins on the Effective Date and continues for an initial term of ${v.termMonths} ${plural} (the "Initial Term").`,
        v.autoRenew
          ? `After the Initial Term, this Agreement renews automatically for successive periods of twelve (12) months each (each a "Renewal Term"), unless either Party gives the other not less than sixty (60) days' written notice of non-renewal before the end of the then-current term.`
          : `After the Initial Term, this Agreement ends unless the Parties agree in writing on a renewal.`,
        `Either Party may terminate this Agreement for convenience on not less than ${v.noticeDays} days' written notice to the other.`,
        `Either Party may terminate this Agreement for material breach by the other with immediate effect, if the breach is not remedied within thirty (30) days of written notice specifying it.`,
        `On termination for any reason: (i) the Provider will provide the Customer with a complete export of the Customer Data in a commonly machine-readable format within thirty (30) days of request made before or within thirty (30) days after termination; (ii) the Provider will delete or securely destroy all remaining Customer Data within sixty (60) days of termination or of completion of the export, whichever is later, and will certify such deletion in writing on the Customer's request; and (iii) the Customer will pay all fees accrued up to the effective date of termination.`,
      ],
    },
    {
      heading: "5. Data Protection and DPDP Act 2023",
      paragraphs: [
        `For the purposes of the Digital Personal Data Protection Act, 2023 ("DPDP Act") and the Digital Personal Data Protection Rules, 2025, the Customer is the Data Fiduciary and the Provider is a Data Processor acting on behalf of the Customer.`,
        `The Provider will process Personal Data only to perform the Services and only in accordance with the Customer's written instructions as reflected in this Agreement, except where applicable law requires otherwise, in which case the Provider will inform the Customer unless prohibited from doing so.`,
        `The Provider will implement and maintain reasonable security safeguards appropriate to the nature of the Personal Data processed, including access controls, encryption of data in transit, and append-only access logging of patient records sufficient to satisfy the Customer's obligations as Data Fiduciary.`,
        `In the event the Provider becomes aware of any personal data breach affecting the Customer Data, the Provider will notify the Customer without undue delay and in any event within the timeframe set out in the DPDP Rules, and will provide the information reasonably required by the Customer to notify the Data Protection Board of India and affected Data Principals.`,
        `The Provider will assist the Customer, on reasonable notice, in responding to requests from Data Principals for access, correction, completion and erasure within the timelines prescribed by the DPDP Rules.`,
        `The Provider will not engage any sub-processor that will have access to the Customer Data without first giving the Customer not less than thirty (30) days' notice of the sub-processor and the Customer the opportunity to object on reasonable grounds.`,
      ],
    },
    {
      heading: "6. Confidentiality",
      paragraphs: [
        `Each Party will keep confidential, and not use or disclose other than for performing this Agreement, any non-public information disclosed by the other Party and marked or reasonably identifiable as confidential (the "Confidential Information").`,
        `Confidential Information does not include information that (a) is or becomes publicly available other than by breach of this Agreement, (b) was known to the receiving Party before disclosure, (c) is independently developed by the receiving Party without reference to the Confidential Information, or (d) is required to be disclosed by law or by a court order, in which case the receiving Party will give the disclosing Party reasonable prior notice where lawful.`,
        `This clause survives termination of this Agreement for three (3) years. The data protection obligations in clause 5 survive without time limit, for as long as the Provider holds Customer Data.`,
      ],
    },
    {
      heading: "7. Intellectual Property",
      paragraphs: [
        `The Provider retains all right, title and interest in and to the Services and the underlying software, including all intellectual property rights. Nothing in this Agreement transfers such ownership.`,
        `The Customer retains all right, title and interest in and to the Customer Data. The Customer grants the Provider a limited, non-exclusive licence to process the Customer Data solely to the extent required to perform the Services.`,
        `The Provider may use anonymised, aggregated service metrics (such as counts of appointments processed) for the purposes of operating and improving the Services. Such metrics will not contain any Personal Data.`,
      ],
    },
    {
      heading: "8. Service Levels",
      paragraphs: [
        `The Provider will use reasonable endeavours to keep the Services available 99.5% of the time, measured monthly and excluding (i) scheduled maintenance of which the Customer has been given at least 24 hours' notice, (ii) emergency maintenance of which notice is given as soon as reasonably practicable, (iii) failures caused by the Customer or a third party, and (iv) causes beyond the Provider's reasonable control.`,
        `If availability in any calendar month falls below 99.5%, the Customer's sole and exclusive remedy will be a service credit equal to 5% of the fees paid for the Services in that month, which the Provider will apply against the next invoice. This clause is without prejudice to the Customer's termination rights under clause 4.`,
        `The Provider will provide support during Indian business hours (9:00 to 18:00 IST, Monday to Saturday, excluding public holidays). Priority support with a shorter first-response time is available where specified in the Schedule.`,
      ],
    },
    {
      heading: "9. Warranties and Disclaimer",
      paragraphs: [
        `Each Party warrants that it has the authority to enter into this Agreement and that the entry into and performance of this Agreement will not breach any contract or law applicable to it.`,
        `The Provider warrants that the Services will perform substantially in accordance with their documented functionality, and that it will perform the Services with reasonable skill and care.`,
        `Except as expressly set out in this Agreement, the Services are provided "as is" and the Provider disclaims all other warranties, whether express, implied or statutory, including any implied warranty of merchantability, fitness for a particular purpose or non-infringement, to the fullest extent permitted by applicable law.`,
        `The Services are a tool to support clinical and business operations, and are not a substitute for clinical judgement. The Customer remains responsible for every clinical and business decision taken using the Services.`,
      ],
    },
    {
      heading: "10. Limitation of Liability",
      paragraphs: [
        `Subject to the following paragraph, neither Party's total aggregate liability arising under or in connection with this Agreement (whether in contract, tort (including negligence) or otherwise) will exceed the total fees paid by the Customer to the Provider in the twelve (12) months immediately preceding the event giving rise to the claim.`,
        `Nothing in this Agreement limits or excludes a Party's liability for: (a) fraud or wilful misconduct; (b) death or personal injury caused by negligence; (c) a Party's indemnity obligations; (d) the Customer's obligation to pay fees properly due; or (e) any liability that cannot be excluded or limited under applicable law. For the avoidance of doubt, a regulatory penalty imposed on the Customer under the DPDP Act that arises directly from the Provider's own material breach of clause 5 (Data Protection) is not subject to the cap in the preceding paragraph.`,
        `Neither Party will be liable for any indirect, special, consequential, punitive or exemplary loss, or for loss of profits, revenue, business, goodwill or anticipated savings, whether or not it was advised of the possibility of such loss.`,
      ],
    },
    {
      heading: "11. Governing Law and Jurisdiction",
      paragraphs: [
        `This Agreement is governed by the laws of India.`,
        `The courts at ${v.governingCity} have exclusive jurisdiction over any dispute arising out of or in connection with this Agreement, subject to either Party's right to apply to any court of competent jurisdiction for interim or injunctive relief.`,
      ],
    },
    {
      heading: "12. General",
      paragraphs: [
        `Notices under this Agreement will be given in writing by email to the address each Party designates in Schedule B, with a copy by registered post for notices of breach, termination or legal proceedings.`,
        `This Agreement, together with the Quotation attached as Schedule A, constitutes the entire agreement between the Parties with respect to its subject matter and supersedes any prior agreement, representation or understanding, whether written or oral.`,
        `No amendment to this Agreement is effective unless it is in writing and signed by both Parties, except for changes made to the Schedules by a change-order process agreed in writing.`,
        `If any provision of this Agreement is found by a court of competent jurisdiction to be invalid or unenforceable, the remaining provisions will continue in full force and effect, and the Parties will negotiate in good faith a valid provision that comes closest to the original intent.`,
        `Neither Party may assign this Agreement without the other's prior written consent, except that the Provider may assign on notice to an affiliate or in connection with a sale of substantially all its assets or shares.`,
      ],
    },
  ];
}
