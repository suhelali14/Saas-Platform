import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import type { Channel, ContextPack, Workspace } from '../domain/workspace.js';
import type { Shot } from './store.js';

/**
 * The part that decides what to post, for whoever this workspace belongs to.
 *
 * ── Nothing about any business is in this file ───────────────────────
 *
 * The product description, the asset list and the prohibitions are all
 * assembled from the workspace the user wrote. An earlier version of this
 * file had a specific company's feature list hardcoded in it, which made
 * everything downstream serve exactly one customer.
 *
 * ── Why the model proposes and code refuses ──────────────────────────
 *
 * Deciding what is worth saying to a particular person on a particular day
 * is judgement, and a model is good at that and bad at remembering a
 * constraint for the four-hundredth time. Code is the reverse. So the model
 * writes and lib/guard.ts checks, and neither does the other's job.
 *
 * ── Why the output is a shot list ────────────────────────────────────
 *
 * Shots the user already has, with words over them, render in seconds and
 * are true. Generated video costs minutes per clip and shows an impression
 * of the thing rather than the thing. The model is told which assets exist
 * and asked to reach for them.
 */

const client = () => {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set, so there is nothing to think with. See .env.example.',
    );
  }
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
};

export interface Idea {
  premise: string;
  forWhom: string;
  shots: Shot[];
  caption: string;
}

/** The user's context, as the model sees it. */
function contextBlock(c: ContextPack): string {
  const lines = [`WHAT THIS BUSINESS IS\n${c.what}`];

  lines.push(`\nWHAT EXISTS AND WORKS\n${c.whatWorks.map((w) => `- ${w}`).join('\n')}`);

  if (c.doesNotExist.length) {
    lines.push(
      `\nWHAT DOES NOT EXIST YET — never imply any of these\n${c.doesNotExist.map((w) => `- ${w}`).join('\n')}`,
    );
  }
  if (c.mustNotClaim.length) {
    lines.push(
      `\nCLAIMS THIS BUSINESS MUST NOT MAKE\n${c.mustNotClaim.map((w) => `- ${w}`).join('\n')}`,
    );
  }
  if (c.pricing) lines.push(`\nCOMMERCIAL TERMS\n${c.pricing}`);
  if (c.voice) lines.push(`\nVOICE\n${c.voice}`);

  if (c.assets.length) {
    lines.push(
      `\nASSETS YOU MAY CUT FROM — use the exact path\n${c.assets
        .map((a) => `- ${a.path} — ${a.describes}${a.caution ? `  (careful: ${a.caution})` : ''}`)
        .join('\n')}`,
    );
  } else {
    lines.push(
      '\nASSETS\nNone supplied, so every shot must be a title card. Say so in the ' +
        'premise, because a reel of title cards is weaker and the user should know.',
    );
  }
  return lines.join('\n');
}

export async function ideate(
  workspace: Workspace,
  channel: Channel,
  language: string,
  avoid: string[],
): Promise<Idea> {
  const assetPaths = workspace.context.assets.map((a) => a.path);

  const system = `You write short vertical video scripts for a business's social accounts.

${contextBlock(workspace.context)}

THIS ACCOUNT
Platform: ${channel.platform}
Handle: ${channel.handle}
What a follower gets: ${channel.promise}
Speaking to: ${channel.audience.who}${channel.audience.region ? ` in ${channel.audience.region}` : ''}
They are trying to: ${channel.audience.jobToBeDone}${
    channel.audience.misconception ? `\nThey currently wrongly believe: ${channel.audience.misconception}` : ''
  }
Subjects this account covers:
${channel.beats.map((b) => `- ${b}`).join('\n')}

HARD RULES
- Never state a percentage, a customer count, or a superlative. No "best",
  "leading", "guaranteed".
- Never imply anything from the "does not exist yet" list.
- Never name a real person or a named third-party organisation.
- On-screen captions: at most 7 words each. These are read while scrolling
  with the sound off.
- Write every caption and the post caption in ${language}.

SHAPE
4 to 6 shots, 2 to 4 seconds each, 12 to 25 seconds total. Open on the
problem, not the product. The last shot earns the follow.

Return ONLY JSON, no prose and no code fence:
{
  "premise": "one line, in English, what this post argues",
  "forWhom": "one line, in English, who stops scrolling and why",
  "shots": [
    { "seconds": 3, "caption": "<= 7 words in ${language}",
      "source": { "kind": "asset", "path": "<exact path from the asset list>" } }
  ],
  "caption": "the post caption in ${language}: 2 short lines, then 3 to 5 hashtags"
}

A shot's source is {"kind":"asset","path":"..."} using a path from the asset
list verbatim, or {"kind":"solid","label":"<2-4 words in English>"} for a
plain title card. Prefer assets where they exist: the real thing is the
argument.`;

  const avoidBlock = avoid.length
    ? `Already used or rejected on this account — do not propose these again:\n${avoid.map((a) => `- ${a}`).join('\n')}`
    : 'Nothing has been posted on this account yet, so open with the single clearest idea.';

  const res = await client().messages.create({
    model: env.STUDIO_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: 'user', content: `${avoidBlock}\n\nWrite the next post.` }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Bare JSON is asked for and usually given; a fenced block is the common
  // deviation and is cheaper to accept than to re-prompt.
  const json = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  let idea: Idea;
  try {
    idea = JSON.parse(json) as Idea;
  } catch {
    throw new Error(`The model did not return JSON. It said:\n${text.slice(0, 400)}`);
  }
  if (!idea.shots?.length || !idea.caption || !idea.premise) {
    throw new Error(`Incomplete idea: ${JSON.stringify(idea).slice(0, 300)}`);
  }

  // A shot naming an asset the workspace does not have would fail at render
  // with a confusing error. Downgraded to a title card here, where the
  // reason can be stated, rather than crashing six shots in.
  idea.shots = idea.shots.map((s) => {
    if (s.source.kind === 'asset' && !assetPaths.includes(s.source.path)) {
      return {
        ...s,
        source: { kind: 'solid', label: s.source.path.replace(/\.[a-z]+$/i, '').slice(0, 24) },
      };
    }
    return s;
  });

  return idea;
}
