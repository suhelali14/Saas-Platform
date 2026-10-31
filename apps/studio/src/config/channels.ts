/**
 * The accounts this studio posts to, and what each one is allowed to say.
 *
 * ── Why the rules live here and not in a prompt ──────────────────────
 *
 * Every account carries a different legal exposure, and the difference is
 * not stylistic. Nayaverse is B2B software, so India's medical advertising
 * rules bind a doctor, not a vendor — right up until an account starts
 * publishing something that reads as health advice to the public, at which
 * point the Drugs and Magic Remedies (Objectionable Advertisements) Act and
 * the ASCI code apply to it.
 *
 * And the NMC's ethics regulations prohibit a registered practitioner from
 * soliciting patients or sharing patient testimonials. A reel that features
 * a named clinic or its patients therefore puts THAT DOCTOR'S REGISTRATION
 * at risk, not this brand's reputation. The clinic is the customer; the
 * licence is theirs; the consequence is not ours to spend.
 *
 * So the constraints are data, checked by code after the model writes
 * (see lib/guard.ts), rather than a paragraph of good intentions in a
 * prompt that a model may or may not honour on any given day.
 */

export type Audience =
  /** Owns or runs a clinic. Decides whether to buy. */
  | 'clinic-owner'
  /** Works at the front desk. Uses it all day, influences renewal. */
  | 'clinic-staff'
  /** Runs a shop, gym, salon, restaurant — the next verticals. */
  | 'smb-owner'
  /** Builds software. Recruiting and credibility, not sales. */
  | 'developer';

export interface Channel {
  /** Folder name and the key used everywhere. */
  readonly key: string;
  /** The Instagram handle, for the record. */
  readonly handle: string;
  readonly audience: Audience;
  /** One sentence: what someone gets by following this. */
  readonly promise: string;
  /**
   * Languages to produce. English first because the buyer reads English
   * even where the staff do not; Marathi because the first customer and
   * the next twenty are in Maharashtra.
   */
  readonly languages: readonly ('en' | 'hi' | 'mr')[];
  /**
   * May this account publish anything a reader could take as health
   * guidance? False everywhere, and it stays false until somebody with a
   * medical registration is accountable for the words.
   */
  readonly mayGiveHealthAdvice: boolean;
  /**
   * May it name a real clinic or show its data? False: that is the
   * customer's licence to lose, and consent for a specific post is not the
   * same as consent for a pipeline that posts daily.
   */
  readonly mayNameCustomers: boolean;
  /** Topics this account is for. Used to steer ideation, not to censor. */
  readonly beats: readonly string[];
}

export const CHANNELS: readonly Channel[] = [
  {
    key: 'nayaverse',
    handle: '@nayaverse',
    audience: 'clinic-owner',
    promise:
      'What running a clinic on software actually looks like, shown rather than claimed.',
    languages: ['en', 'mr'],
    mayGiveHealthAdvice: false,
    mayNameCustomers: false,
    beats: [
      'the queue, and what triage order does to a waiting room',
      'one screen of the product, doing one thing, in under fifteen seconds',
      'the cost of a split patient record',
      'what a prescription has to carry to be safe to dispense',
      'pricing, plainly',
      'what the software deliberately does not do',
    ],
  },
  {
    key: 'clinics',
    handle: '@nayaverse.clinics',
    audience: 'clinic-staff',
    promise: 'Front-desk work, made less annoying. Short, practical, no theory.',
    languages: ['mr', 'hi', 'en'],
    mayGiveHealthAdvice: false,
    mayNameCustomers: false,
    beats: [
      'a thing that takes six taps and should take one',
      'why the same patient ends up in the system twice',
      'what to do when the internet is out',
      'end-of-day cash closing without a calculator',
      'finding a patient by phone number when you cannot spell the name',
    ],
  },
  {
    key: 'build',
    handle: '@nayaverse.build',
    audience: 'developer',
    promise:
      'Bugs found in production and what they cost, from one small Indian SaaS.',
    languages: ['en'],
    mayGiveHealthAdvice: false,
    mayNameCustomers: false,
    beats: [
      'a bug that passed every check and reached real users',
      'a check that was wrong before the code was',
      'why a measurement beat a screenshot',
      'open source we published and what it found',
      'a decision we reversed, and the evidence that reversed it',
    ],
  },
];

export const channel = (key: string): Channel => {
  const c = CHANNELS.find((x) => x.key === key);
  if (!c) {
    throw new Error(
      `No channel "${key}". Known: ${CHANNELS.map((x) => x.key).join(', ')}`,
    );
  }
  return c;
};
