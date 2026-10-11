import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth } from "../plugins/auth.js";
import {
  SUPPORTED_LOCALES, LOCALE_CODES, translateBatch, activeProvider,
  TranslationUnavailableError, localeName, unavailableReason,
  namespaceAllowed, allowedNamespaces, maxItemsPerRun,
} from "../lib/translate.js";

/**
 * Regional-language support for the public website.
 *
 * Content is authored once in English. Each enabled language gets a stored
 * translated copy, produced either by the machine translator (a first
 * draft) or typed in by hand -- both paths land in the same table and the
 * public site can't tell them apart.
 *
 * Crucially, translation happens ONCE, on demand, and is cached in the
 * database. A patient loading the page in Marathi costs nothing and waits
 * for no API: the page reads stored rows. Re-translation only happens when
 * the admin asks for it.
 */

/** Every translatable field, flattened into stable keys. Array fields get
 * indexed keys (`services.2`, `faqs.0.answer`) so an edit to one FAQ
 * doesn't invalidate the rest. */
function collectClinicStrings(clinic: Record<string, unknown>): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  const push = (key: string, value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) out.push({ key, text: value.trim() });
  };

  push("tagline", clinic.tagline);
  push("about", clinic.about);

  const services = clinic.services;
  if (Array.isArray(services)) services.forEach((s, i) => push(`services.${i}`, s));

  const highlights = clinic.highlights;
  if (Array.isArray(highlights)) {
    highlights.forEach((h, i) => {
      if (h && typeof h === "object") {
        push(`highlights.${i}.title`, (h as Record<string, unknown>).title);
        push(`highlights.${i}.description`, (h as Record<string, unknown>).description);
      }
    });
  }

  const faqs = clinic.faqs;
  if (Array.isArray(faqs)) {
    faqs.forEach((f, i) => {
      if (f && typeof f === "object") {
        push(`faqs.${i}.question`, (f as Record<string, unknown>).question);
        push(`faqs.${i}.answer`, (f as Record<string, unknown>).answer);
      }
    });
  }

  return out;
}

const localeSchema = z.enum(LOCALE_CODES as [string, ...string[]]);

export async function clinicTranslationRoutes(app: FastifyInstance) {
  /** What this deployment can do, so the UI can say so honestly rather
   * than offering a button that will fail. */
  app.get("/api/clinic/translations/status", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const clinic = await prisma.clinic.findFirst({ select: { defaultLocale: true, enabledLocales: true } });
    const counts = await prisma.translation.groupBy({
      by: ["locale"],
      _count: { _all: true },
    });
    const reviewed = await prisma.translation.groupBy({
      by: ["locale"],
      where: { isReviewed: true },
      _count: { _all: true },
    });

    return {
      provider: activeProvider(),
      autoTranslateAvailable: activeProvider() !== null,
      // Why it's off, when it is -- so the UI can say "switched off for
      // this clinic" rather than telling an admin to add a key they
      // already have.
      unavailableReason: activeProvider() === null ? unavailableReason() : null,
      // Which content classes this deployment permits auto-translating,
      // and the per-run cap. Hand-entered translations are never limited.
      autoTranslatableNamespaces: allowedNamespaces(),
      maxItemsPerRun: maxItemsPerRun(),
      supportedLocales: SUPPORTED_LOCALES,
      defaultLocale: clinic?.defaultLocale ?? "en",
      enabledLocales: Array.isArray(clinic?.enabledLocales) ? clinic.enabledLocales : [],
      progress: counts.map((c) => ({
        locale: c.locale,
        total: c._count._all,
        reviewed: reviewed.find((r) => r.locale === c.locale)?._count._all ?? 0,
      })),
    };
  });

  /** Which languages this clinic publishes in, and which is the default. */
  app.put("/api/clinic/translations/locales", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = z
      .object({
        // "en" is always available and is the authoring language, so it is
        // accepted as a default but never needs to be in enabledLocales.
        defaultLocale: z.union([z.literal("en"), localeSchema]).optional(),
        enabledLocales: z.array(localeSchema).max(SUPPORTED_LOCALES.length).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.clinic.findFirst();
    if (!existing) return reply.status(404).send({ error: "Clinic not configured" });

    const next = { ...parsed.data };
    // A default the clinic hasn't enabled would render a page in a language
    // with no translations behind it.
    if (next.defaultLocale && next.defaultLocale !== "en") {
      const enabled = next.enabledLocales ?? (Array.isArray(existing.enabledLocales) ? (existing.enabledLocales as string[]) : []);
      if (!enabled.includes(next.defaultLocale)) {
        return reply.status(400).send({ error: `Enable ${localeName(next.defaultLocale)} before making it the default language.` });
      }
    }

    const clinic = await prisma.clinic.update({ where: { id: existing.id }, data: next });
    return { defaultLocale: clinic.defaultLocale, enabledLocales: clinic.enabledLocales };
  });

  /** Everything translatable for one language, with its stored translation
   * and a staleness flag. This is what the review screen edits. */
  app.get("/api/clinic/translations/:locale", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { locale } = request.params as { locale: string };
    if (!LOCALE_CODES.includes(locale)) return reply.status(400).send({ error: "Unsupported language" });

    const clinic = await prisma.clinic.findFirst();
    if (!clinic) return reply.status(404).send({ error: "Clinic not configured" });

    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { id: true, title: true, excerpt: true, content: true },
    });

    const stored = await prisma.translation.findMany({ where: { locale } });
    const byKey = new Map(stored.map((t) => [`${t.namespace}:${t.entityId}:${t.field}`, t]));

    const build = (namespace: string, entityId: string, entries: { key: string; text: string }[]) =>
      entries.map((e) => {
        const row = byKey.get(`${namespace}:${entityId}:${e.key}`);
        return {
          namespace,
          entityId,
          field: e.key,
          sourceText: e.text,
          translatedText: row?.translatedText ?? "",
          isReviewed: row?.isReviewed ?? false,
          // The English changed after this was translated, so the stored
          // copy no longer says the same thing. Surfaced rather than
          // silently serving an out-of-date translation.
          isStale: Boolean(row && row.sourceText !== e.text),
        };
      });

    const items = [
      ...build("clinic", "", collectClinicStrings(clinic as unknown as Record<string, unknown>)),
      ...posts.flatMap((p) =>
        build("post", p.id, [
          { key: "title", text: p.title },
          ...(p.excerpt ? [{ key: "excerpt", text: p.excerpt }] : []),
          { key: "content", text: p.content },
        ]),
      ),
    ];

    return { locale, items };
  });

  /** Machine-translate everything missing or stale for one language.
   * Runs on demand only -- never on a page load. */
  app.post("/api/clinic/translations/:locale/generate", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { locale } = request.params as { locale: string };
    if (!LOCALE_CODES.includes(locale)) return reply.status(400).send({ error: "Unsupported language" });

    const parsed = z
      .object({
        retranslateAll: z.boolean().optional(),
        // Translate only these exact items. Sent by the "Translate
        // selected" action so an admin can do a handful of strings rather
        // than paying to redo the whole site.
        only: z
          .array(z.object({ namespace: z.string().max(40), entityId: z.string().max(100).default(""), field: z.string().max(100) }))
          .max(500)
          .optional(),
        // Or restrict to whole content classes, e.g. site copy but not
        // the long blog articles.
        namespaces: z.array(z.string().max(40)).max(10).optional(),
      })
      .safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const retranslateAll = Boolean(parsed.data.retranslateAll);
    const onlyKeys = parsed.data.only
      ? new Set(parsed.data.only.map((o) => `${o.namespace}:${o.entityId}:${o.field}`))
      : null;
    const requestedNamespaces = parsed.data.namespaces ?? null;

    const clinic = await prisma.clinic.findFirst();
    if (!clinic) return reply.status(404).send({ error: "Clinic not configured" });

    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { id: true, title: true, excerpt: true, content: true },
    });

    const stored = await prisma.translation.findMany({ where: { locale } });
    const byKey = new Map(stored.map((t) => [`${t.namespace}:${t.entityId}:${t.field}`, t]));

    interface Pending { namespace: string; entityId: string; field: string; text: string; batchKey: string }
    const pending: Pending[] = [];
    const consider = (namespace: string, entityId: string, entries: { key: string; text: string }[]) => {
      // Deployment-level gate: this content class may not be auto-translated
      // at all here. Typing translations in by hand is still allowed -- this
      // only limits spending.
      if (!namespaceAllowed(namespace)) return;
      // Caller asked for specific content classes only.
      if (requestedNamespaces && !requestedNamespaces.includes(namespace)) return;

      for (const e of entries) {
        // Caller picked specific items; skip everything else.
        if (onlyKeys && !onlyKeys.has(`${namespace}:${entityId}:${e.key}`)) continue;

        const row = byKey.get(`${namespace}:${entityId}:${e.key}`);
        // An explicitly selected item is always retranslated -- the admin
        // asked for that exact string, so "it already exists" is not a
        // reason to ignore them.
        const needs = !row || row.sourceText !== e.text || retranslateAll || Boolean(onlyKeys);
        // A translation the clinic reviewed by hand is never silently
        // overwritten unless the English behind it actually changed --
        // their correction outranks a fresh machine draft.
        const protectedByReview =
          row?.isReviewed && row.sourceText === e.text && !retranslateAll && !onlyKeys;
        if (needs && !protectedByReview) {
          pending.push({
            namespace, entityId, field: e.key, text: e.text,
            batchKey: `${namespace}__${entityId || "clinic"}__${e.key}`,
          });
        }
      }
    };

    consider("clinic", "", collectClinicStrings(clinic as unknown as Record<string, unknown>));
    for (const p of posts) {
      consider("post", p.id, [
        { key: "title", text: p.title },
        ...(p.excerpt ? [{ key: "excerpt", text: p.excerpt }] : []),
        { key: "content", text: p.content },
      ]);
    }

    if (pending.length === 0) {
      const blocked = !namespaceAllowed("post") && !namespaceAllowed("clinic");
      return {
        locale,
        translated: 0,
        message: blocked
          ? "Automatic translation is restricted on this deployment. Translations can still be typed in by hand."
          : "Everything is already translated and up to date.",
      };
    }

    // Cost guard. Refused rather than silently truncated: an admin who
    // asked for 400 items and got 200 with no warning would assume the
    // rest were fine.
    if (pending.length > maxItemsPerRun()) {
      return reply.status(400).send({
        error:
          `That would translate ${pending.length} items in one go, over this deployment's limit of ${maxItemsPerRun()}. ` +
          `Select fewer items, or raise AI_TRANSLATION_MAX_ITEMS in the clinic API's .env.`,
      });
    }

    try {
      // Chunked so one very long blog post can't blow the model's output
      // limit and take the whole batch down with it.
      const CHUNK = 40;
      let translatedCount = 0;

      for (let i = 0; i < pending.length; i += CHUNK) {
        const chunk = pending.slice(i, i + CHUNK);
        const result = await translateBatch(
          chunk.map((p) => ({ key: p.batchKey, text: p.text })),
          locale,
          { clinicName: clinic.name, region: clinic.address },
        );

        for (const item of chunk) {
          const translated = result[item.batchKey];
          if (!translated) continue; // left untranslated rather than stored empty
          await prisma.translation.upsert({
            where: {
              locale_namespace_entityId_field: {
                locale, namespace: item.namespace, entityId: item.entityId, field: item.field,
              },
            },
            create: {
              locale, namespace: item.namespace, entityId: item.entityId, field: item.field,
              sourceText: item.text, translatedText: translated, isReviewed: false,
            },
            // isReviewed resets to false: this is a new machine draft and
            // has not been checked by anyone yet. Saying otherwise would
            // make the review flag meaningless.
            update: { sourceText: item.text, translatedText: translated, isReviewed: false },
          });
          translatedCount++;
        }
      }

      return {
        locale,
        translated: translatedCount,
        skipped: pending.length - translatedCount,
        message: `Translated ${translatedCount} item(s) into ${localeName(locale)}. Please review them below before relying on them.`,
      };
    } catch (err) {
      if (err instanceof TranslationUnavailableError) {
        return reply.status(503).send({ error: err.message });
      }
      throw err;
    }
  });

  /** Save one hand-edited translation. Editing marks it reviewed -- a human
   * who speaks the language has now looked at it. */
  app.put("/api/clinic/translations/:locale/item", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { locale } = request.params as { locale: string };
    if (!LOCALE_CODES.includes(locale)) return reply.status(400).send({ error: "Unsupported language" });

    const parsed = z
      .object({
        namespace: z.enum(["clinic", "post"]),
        entityId: z.string().max(100).default(""),
        field: z.string().min(1).max(100),
        sourceText: z.string().max(50_000),
        translatedText: z.string().max(50_000),
        isReviewed: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { namespace, entityId, field, sourceText, translatedText, isReviewed } = parsed.data;

    const row = await prisma.translation.upsert({
      where: { locale_namespace_entityId_field: { locale, namespace, entityId, field } },
      create: { locale, namespace, entityId, field, sourceText, translatedText, isReviewed: isReviewed ?? true },
      update: { sourceText, translatedText, isReviewed: isReviewed ?? true },
    });
    return row;
  });

  app.delete("/api/clinic/translations/:locale", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { locale } = request.params as { locale: string };
    if (!LOCALE_CODES.includes(locale)) return reply.status(400).send({ error: "Unsupported language" });

    const { count } = await prisma.translation.deleteMany({ where: { locale } });
    return { deleted: count };
  });
}
