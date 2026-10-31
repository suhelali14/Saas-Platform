import { z } from 'zod';

/**
 * What a user of this platform describes, once, so the automation can run.
 *
 * ── The whole product is this file ───────────────────────────────────
 *
 * Everything downstream — what to post, in what language, what it may not
 * say, where it goes — is derived from a workspace. Nothing about any
 * particular business is compiled into the code. A content tool that knows
 * what your product is can only ever serve one customer, and the first
 * version of this one knew about a clinic system, which made it an internal
 * script wearing a platform's clothes.
 *
 * So the schema is the contract. If something cannot be expressed here, the
 * platform cannot do it for anybody, and that is the right place to find out.
 *
 * ── Why context is this detailed ─────────────────────────────────────
 *
 * A generative tool given a brand name and a tone adjective produces copy
 * that could be about anything, which is why most of it reads like it was.
 * The fields that make the difference are the unglamorous ones: what is
 * actually built, what the business must not claim, who specifically is
 * being spoken to. `mustNotClaim` does more for output quality than any
 * prompt instruction, because it is the list a model cannot infer.
 */

export const Platform = z.enum(['instagram', 'linkedin', 'x', 'youtube', 'tiktok', 'facebook']);
export type Platform = z.infer<typeof Platform>;

/** BCP-47-ish; kept open because the platform is not an i18n authority. */
export const LanguageTag = z.string().min(2).max(12);

export const Audience = z.object({
  /** Who, in the user's own words. "Receptionist at a 2-doctor clinic." */
  who: z.string().min(3).max(200),
  /** Where they are, when relevant to language and idiom. */
  region: z.string().max(120).optional(),
  /** What they are trying to get done. Drives the hook. */
  jobToBeDone: z.string().min(3).max(300),
  /** What they currently believe that is wrong or incomplete. */
  misconception: z.string().max(300).optional(),
});
export type Audience = z.infer<typeof Audience>;

/**
 * An asset the user has, described so a model can decide to use it.
 *
 * The description matters more than the file. A folder of screenshots named
 * `shot1.png` is unusable by anything; `the queue, reordered by triage, on a
 * phone` is a shot a model can reach for deliberately.
 */
export const Asset = z.object({
  path: z.string().min(1),
  describes: z.string().min(3).max(240),
  /** Anything in frame that must never be published. */
  caution: z.string().max(240).optional(),
});
export type Asset = z.infer<typeof Asset>;

export const ContextPack = z.object({
  /** The business, in two or three sentences. Plain, not a tagline. */
  what: z.string().min(20).max(2000),
  /**
   * What exists and works, as specifically as the user can bear to be.
   * The single highest-leverage field: specifics are what make a post
   * credible, and a model cannot invent a feature list that is true.
   */
  whatWorks: z.array(z.string().min(3)).min(1).max(60),
  /**
   * What does not exist yet. Named so the automation cannot promise it.
   * Every business has this list and almost nobody writes it down, which
   * is why so much marketing copy is quietly false.
   */
  doesNotExist: z.array(z.string().min(3)).max(60).default([]),
  /**
   * Claims this business must not make, in its own words. Fed to the model
   * AND compiled into a check that runs over the finished draft, because a
   * prompt is a request and a check is a rule.
   */
  mustNotClaim: z.array(z.string().min(3)).max(60).default([]),
  /** Price or commercial terms, if they are to be stated publicly. */
  pricing: z.string().max(400).optional(),
  /** How it should sound. Two or three words beats a paragraph. */
  voice: z.string().max(240).optional(),
  /** Captures, product shots, logos. */
  assets: z.array(Asset).max(200).default([]),
});
export type ContextPack = z.infer<typeof ContextPack>;

/**
 * One account the platform posts to.
 *
 * A channel is an audience plus a promise, not just a login. Two accounts
 * on the same platform for the same business exist because they speak to
 * different people, and that difference is the only thing that makes the
 * second one worth running.
 */
export const Channel = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/, 'lowercase, digits and dashes'),
  platform: Platform,
  handle: z.string().min(1).max(80),
  /** One sentence: what someone gets by following this. */
  promise: z.string().min(10).max(300),
  audience: Audience,
  languages: z.array(LanguageTag).min(1).max(8),
  /** Subjects this account is for. Steers ideation; does not censor. */
  beats: z.array(z.string().min(3)).min(1).max(40),
  /** Posts per week. The scheduler spaces them; it does not batch. */
  cadencePerWeek: z.number().int().min(1).max(21).default(3),
  /** Rule packs this channel opts into, beyond the always-on ones. */
  rulePacks: z.array(z.string()).max(12).default([]),
  /** Off without deleting, for a channel being paused. */
  active: z.boolean().default(true),
});
export type Channel = z.infer<typeof Channel>;

export const Workspace = z.object({
  /** Folder name and the key in every path and log line. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  context: ContextPack,
  channels: z.array(Channel).min(1).max(40),
  /**
   * Publish without a person reading it. Per workspace, because the answer
   * genuinely differs: a meme account and a medical device company carry
   * different consequences for one bad post, and the platform should not
   * decide that on either's behalf. Defaults to false either way.
   */
  autoPublish: z.boolean().default(false),
});
export type Workspace = z.infer<typeof Workspace>;

/** The result of reading a user-supplied workspace file. */
export type LoadResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; problems: string[] };

export function parseWorkspace(raw: unknown): LoadResult {
  const r = Workspace.safeParse(raw);
  if (r.success) return { ok: true, workspace: r.data };
  return {
    ok: false,
    // Flattened to "field: what is wrong", because a zod tree is not
    // something to show somebody filling in a form about their business.
    problems: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

export const channelOf = (w: Workspace, key: string): Channel => {
  const c = w.channels.find((x) => x.key === key);
  if (!c) {
    throw new Error(
      `Workspace "${w.slug}" has no channel "${key}". Has: ${w.channels.map((x) => x.key).join(', ')}`,
    );
  }
  return c;
};
