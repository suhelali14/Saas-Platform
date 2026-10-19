import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { byTriage } from "../lib/triage.js";
import { resolveDesign, resolveSections } from "../lib/site-design.js";
import { resolveLayoutMode, readCanvas } from "../lib/site-canvas.js";

// Public, unauthenticated -- the "innovative" feature from the plan's Phase 4
// research: real-world token/queue-transparency displays measurably cut
// perceived wait time (~50%) and front-desk interruptions (~60%) just by
// letting people see their position without asking reception. No SMS/push
// infra needed -- just a page someone can check on their own phone or a
// waiting-room screen.
//
// Deliberately minimal and privacy-safe: position, status, and the assigned
// doctor's name only. NEVER a patient's full name or phone number on an
// endpoint with no auth -- shown as the last 4 characters of their UHID
// instead (e.g. "···00004"), the same "file number" reception already uses
// to identify people out loud in a waiting room.
// Tiers come from lib/triage.ts. This file had its own copy, so the
// waiting-room display and the staff queue could have disagreed about
// who was next in front of the whole waiting room.

export async function clinicPublicRoutes(app: FastifyInstance) {
  // Public clinic page (Phase 5) -- what a patient sees before they ever
  // walk in: where the clinic is, when it's open, what it treats, and who
  // the doctors are. No auth, and deliberately no patient data of any kind.
  // A doctor can opt out individually via `showOnPublicPage`.
  /**
   * Applies stored translations onto a payload, in place of the English.
   *
   * Falls back to English per field: a half-translated page is useful, a
   * blank one is not. Nothing here calls a translation API -- these are
   * rows written once by the admin's explicit "translate" action, so
   * serving a page in Marathi costs exactly one extra indexed query.
   */
  function applyTranslations(
    value: string | null,
    key: string,
    map: Map<string, string>,
  ): string | null {
    return map.get(key) ?? value;
  }

  async function translationMap(locale: string | undefined, namespaces: string[]): Promise<Map<string, string>> {
    if (!locale || locale === "en") return new Map();
    const rows = await prisma.translation.findMany({
      where: { locale, namespace: { in: namespaces } },
      select: { namespace: true, entityId: true, field: true, translatedText: true },
    });
    return new Map(rows.map((r) => [`${r.namespace}:${r.entityId}:${r.field}`, r.translatedText]));
  }

  app.get("/api/clinic/public/clinic", async (_request, reply) => {
    const clinic = await prisma.clinic.findFirst({
      select: {
        name: true, address: true, phone: true, email: true, about: true,
        timings: true, services: true, logoPath: true, registrationNumber: true,
        tagline: true, establishedYear: true, highlights: true, faqs: true,
        emergencyPhone: true, mapUrl: true,
        publicSections: true, publicTheme: true, heroImagePath: true, mapEmbedUrl: true,
        metaDescription: true,
        publicDesign: true,
        publicLayoutMode: true, publicCanvas: true,
        defaultLocale: true, enabledLocales: true,
      },
    });
    if (!clinic) return reply.status(404).send({ error: "Clinic not configured" });

    // Resolved here so the page never has to interpret a missing or
    // half-written design row -- it always receives a complete one, and
    // the defaults are the layout every clinic is already served.
    const design = resolveDesign(clinic.publicDesign);
    const sections = resolveSections(clinic.publicSections);
    // Which renderer the page should use, decided here rather than on the
    // page. resolveLayoutMode falls back to "sections" for a clinic that
    // has switched to the canvas but has an empty or unparseable
    // document -- a stale-but-correct website beats a blank one, and a
    // blank one is what a patient would otherwise see.
    const layoutMode = resolveLayoutMode(clinic.publicLayoutMode, clinic.publicCanvas);
    const canvas = layoutMode === "canvas" ? readCanvas(clinic.publicCanvas) : null;

    const [doctors, gallery, posts, feedback] = await Promise.all([
      prisma.clinicUser.findMany({
        where: { role: "DOCTOR", isActive: true, showOnPublicPage: true },
        select: { id: true, name: true, qualifications: true, specialization: true, bio: true, photoPath: true, experienceYears: true, languages: true },
        orderBy: { name: "asc" },
      }),
      prisma.galleryPhoto.findMany({
        select: { id: true, caption: true, storagePath: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 24,
      }),
      // Only published posts, and only the fields a card needs -- the full
      // body is fetched per-post so the landing page stays small.
      prisma.blogPost.findMany({
        where: { published: true },
        select: { id: true, title: true, slug: true, excerpt: true, coverImagePath: true, tags: true, publishedAt: true, author: { select: { name: true } } },
        orderBy: { publishedAt: "desc" },
        take: 6,
      }),
      // Explicitly published only. Unpublished feedback is internal to the
      // clinic and must never leave this boundary.
      prisma.feedback.findMany({
        where: { isPublished: true },
        select: { id: true, patientName: true, rating: true, comment: true, submittedAt: true },
        orderBy: { submittedAt: "desc" },
        take: 12,
      }),
    ]);

    // ?lang=mr serves the stored Marathi copy where one exists, English
    // everywhere else. No API call, no cost -- just an indexed read.
    const requested = (_request.query as { lang?: string } | undefined)?.lang;
    const locale = requested ?? clinic.defaultLocale ?? "en";
    const t = await translationMap(locale, ["clinic", "post"]);

    const localized = t.size === 0 ? clinic : {
      ...clinic,
      tagline: applyTranslations(clinic.tagline, "clinic::tagline", t),
      about: applyTranslations(clinic.about, "clinic::about", t),
      services: Array.isArray(clinic.services)
        ? (clinic.services as string[]).map((s, i) => t.get(`clinic::services.${i}`) ?? s)
        : clinic.services,
      highlights: Array.isArray(clinic.highlights)
        ? (clinic.highlights as { title: string; description?: string }[]).map((h, i) => ({
            ...h,
            title: t.get(`clinic::highlights.${i}.title`) ?? h.title,
            description: h.description ? t.get(`clinic::highlights.${i}.description`) ?? h.description : h.description,
          }))
        : clinic.highlights,
      faqs: Array.isArray(clinic.faqs)
        ? (clinic.faqs as { question: string; answer: string }[]).map((f, i) => ({
            question: t.get(`clinic::faqs.${i}.question`) ?? f.question,
            answer: t.get(`clinic::faqs.${i}.answer`) ?? f.answer,
          }))
        : clinic.faqs,
    };

    const localizedPosts = posts.map((p) => ({
      ...p,
      title: t.get(`post:${p.id}:title`) ?? p.title,
      excerpt: p.excerpt ? t.get(`post:${p.id}:excerpt`) ?? p.excerpt : p.excerpt,
    }));

    return {
      clinic: {
        ...localized,
        // Always complete, so the page never has to interpret a missing
        // or half-written design row. The defaults are the layout every
        // clinic is already being served.
        publicDesign: design,
        publicSections: sections,
        publicLayoutMode: layoutMode,
        publicCanvas: canvas,
      },
      doctors,
      gallery,
      posts: localizedPosts,
      feedback,
      locale,
      availableLocales: Array.isArray(clinic.enabledLocales) ? clinic.enabledLocales : [],
    };
  });

  /** One published post. 404s on an unpublished one rather than revealing
   * that a draft exists at that slug. */
  app.get("/api/clinic/public/posts/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const post = await prisma.blogPost.findFirst({
      where: { slug, published: true },
      select: {
        id: true, title: true, slug: true, excerpt: true, content: true,
        coverImagePath: true, tags: true, publishedAt: true,
        author: { select: { name: true, qualifications: true } },
      },
    });
    if (!post) return reply.status(404).send({ error: "Not found" });

    const requested = (request.query as { lang?: string } | undefined)?.lang;
    if (!requested || requested === "en") return post;

    const t = await translationMap(requested, ["post"]);
    return {
      ...post,
      title: t.get(`post:${post.id}:title`) ?? post.title,
      excerpt: post.excerpt ? t.get(`post:${post.id}:excerpt`) ?? post.excerpt : post.excerpt,
      content: t.get(`post:${post.id}:content`) ?? post.content,
    };
  });

  /** All published posts, for the blog index. */
  app.get("/api/clinic/public/posts", async () => {
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { id: true, title: true, slug: true, excerpt: true, coverImagePath: true, tags: true, publishedAt: true, author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
    });
    return { posts };
  });

  app.get("/api/clinic/public/queue", async () => {
    // The theme comes back with the queue so the waiting-room display can
    // be the clinic's own page rather than a differently-coloured one.
    // Carried here rather than fetched separately because this endpoint is
    // polled every 20 seconds and the clinic's palette is one short string.
    const clinic = await prisma.clinic.findFirst({
      select: { name: true, publicTheme: true, logoPath: true },
    });

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"] },
      },
      include: {
        patient: { select: { uhid: true, category: true } },
        doctor: { select: { name: true } },
      },
    });

    const sorted = [...appointments].sort(
      byTriage,
    );

    const queue = sorted.map((appt, index) => ({
      position: index + 1,
      status: appt.status,
      doctorName: appt.doctor?.name ?? null,
      patientLabel: `···${appt.patient.uhid.slice(-4)}`,
    }));

    return {
      clinicName: clinic?.name ?? "Clinic",
      theme: clinic?.publicTheme ?? null,
      logoPath: clinic?.logoPath ?? null,
      updatedAt: now.toISOString(),
      queue,
    };
  });
}
