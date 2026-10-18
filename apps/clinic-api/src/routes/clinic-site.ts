import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth, requireClinicAuth } from "../plugins/auth.js";
import { canvasSchema, readCanvas, LAYOUT_MODES } from "../lib/site-canvas.js";
import { saveUploadedFile, FileValidationError } from "../lib/file-storage.js";
import {
  resolveDesign, resolveSections, DEFAULT_DESIGN,
  SECTION_VARIANTS, FONT_PAIRINGS, DENSITIES, CORNERS, CTA_ACTIONS, defaultCtaLabel,
  SECTION_KEYS,
} from "../lib/site-design.js";

/**
 * Phase 8 -- the clinic controls its own public website: which sections
 * appear and in what order, a health-library blog, a photo gallery, and
 * patient feedback.
 *
 * On feedback: India's Code of Medical Ethics (Clause 6.1.1) and the NMC's
 * social-media guidance prohibit a registered practitioner from requesting
 * or sharing patient testimonials, recommendations, endorsements or
 * reviews. So feedback here is collected for the clinic's *own* use and is
 * unpublished by default. The publish toggle exists because it is the
 * clinic's decision, not this software's, but the UI states the rule at the
 * point of the choice rather than letting a doctor stumble into it.
 */

/**
 * The sections the public site knows how to render.
 *
 * Re-exported, not redeclared. This file used to carry its own copy of
 * the list; the two were identical, which is precisely why nobody
 * noticed there were two -- and then adding a section to one of them
 * left the page rendering an id with no key behind it. One list, one
 * place, and the existing importers are unaffected.
 */
export { SECTION_KEYS, type SectionKey } from "../lib/site-design.js";

/** Curated, contrast-checked palettes. Deliberately not a free colour
 * picker: patients rely on this page, and an arbitrary hex pair reliably
 * produces unreadable text. */
export const PUBLIC_THEMES = ["teal", "blue", "green", "indigo", "rose", "slate"] as const;

export const DEFAULT_SECTIONS = SECTION_KEYS.map((key) => ({ key, enabled: true }));

const sectionsSchema = z
  .array(
    z.object({
      key: z.enum(SECTION_KEYS),
      enabled: z.boolean(),
      // What the clinic calls this section, and which layout it is drawn
      // in. Both optional: a section the clinic has not customised keeps
      // the built-in heading and the default layout.
      heading: z.string().max(100).optional(),
      variant: z.string().max(40).optional(),
    }),
  )
  .max(SECTION_KEYS.length);

const siteSchema = z.object({
  publicSections: sectionsSchema.optional(),
  publicTheme: z.enum(PUBLIC_THEMES).optional(),
  mapEmbedUrl: z.string().max(1000).optional(),
  // Shapes only. resolveDesign decides which fonts, variants and
  // actions exist -- validating the semantics in both places is how the
  // two drift, and the page reads the resolved value.
  publicDesign: z
    .object({
      font: z.string().max(40).optional(),
      density: z.string().max(40).optional(),
      corners: z.string().max(40).optional(),
      heroVariant: z.string().max(40).optional(),
      heroHeadline: z.string().max(200).optional(),
      secondaryCta: z.boolean().optional(),
      cta: z
        .object({
          action: z.string().max(40).optional(),
          label: z.string().max(60).optional(),
          message: z.string().max(400).optional(),
        })
        .optional(),
    })
    .optional(),
});

/** A URL-safe slug. Stripped to ASCII word characters so the resulting
 * /blog/:slug is safe to put in a URL without encoding. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const postSchema = z.object({
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1).max(50_000),
  tags: z.string().max(200).optional(),
  published: z.boolean().optional(),
});

const feedbackSchema = z.object({
  patientName: z.string().max(120).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  visitDate: z.string().optional(),
});

export async function clinicSiteRoutes(app: FastifyInstance) {
  // ── The free-canvas page ──────────────────────────────────────────────
  //
  // Read separately from the public payload, and deliberately regardless
  // of `publicLayoutMode`: the whole point is that a clinic can build a
  // canvas page, look at it, and keep serving the section page to
  // patients until it is happy. An editor that could only load the
  // document once it was live would have no way to get there.
  app.get("/api/clinic/site/canvas", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const clinic = await prisma.clinic.findFirst({
      select: { publicCanvas: true, publicLayoutMode: true, publicSections: true },
    });
    if (!clinic) return reply.status(404).send({ error: "Clinic not configured" });

    return {
      // Parsed, not handed over raw. A document written by an older
      // version of the editor, or edited by hand, must not reach the
      // editor as something it will then re-save.
      canvas: readCanvas(clinic.publicCanvas),
      layoutMode: clinic.publicLayoutMode === "canvas" ? "canvas" : "sections",
      // So the editor can offer "start from my current site" rather than
      // an empty rectangle.
      sections: resolveSections(clinic.publicSections),
    };
  });

  app.put("/api/clinic/site/canvas", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = z
      .object({
        canvas: canvasSchema.optional(),
        layoutMode: z.enum(LAYOUT_MODES).optional(),
      })
      .strict()
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.clinic.findFirst({ select: { id: true, publicCanvas: true } });
    if (!existing) return reply.status(404).send({ error: "Clinic not configured" });

    // Going live needs something to go live with. Switching the renderer
    // on while the document is empty would replace a working website with
    // a blank page, and the clinic would find out from a patient.
    if (parsed.data.layoutMode === "canvas") {
      const willBe = parsed.data.canvas ?? readCanvas(existing.publicCanvas);
      if (!willBe || willBe.nodes.length === 0) {
        return reply.status(400).send({
          error: "There is nothing on the canvas yet, so publishing it would leave patients a blank page.",
        });
      }
    }

    const clinic = await prisma.clinic.update({
      where: { id: existing.id },
      data: {
        // Round-tripped through JSON so the column holds plain data with
        // no undefined holes, the same treatment publicSections gets.
        ...(parsed.data.canvas !== undefined
          ? { publicCanvas: JSON.parse(JSON.stringify(parsed.data.canvas)) }
          : {}),
        ...(parsed.data.layoutMode !== undefined ? { publicLayoutMode: parsed.data.layoutMode } : {}),
      },
      select: { publicCanvas: true, publicLayoutMode: true },
    });

    return {
      canvas: readCanvas(clinic.publicCanvas),
      layoutMode: clinic.publicLayoutMode === "canvas" ? "canvas" : "sections",
    };
  });

  // ── Site layout config ────────────────────────────────────────────────
  app.put("/api/clinic/site", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = siteSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.clinic.findFirst();
    if (!existing) return reply.status(404).send({ error: "Clinic not configured" });

    const { publicDesign, publicSections, ...rest } = parsed.data;

    const clinic = await prisma.clinic.update({
      where: { id: existing.id },
      data: {
        ...rest,
        // Resolved before storing, then round-tripped. Resolving first
        // means a hand-edited body cannot store a layout the page does
        // not have; the round trip means the column holds valid JSON
        // with no undefined holes in it.
        ...(publicSections !== undefined
          ? { publicSections: JSON.parse(JSON.stringify(resolveSections(publicSections))) }
          : {}),
        ...(publicDesign !== undefined
          ? { publicDesign: JSON.parse(JSON.stringify(resolveDesign(publicDesign))) }
          : {}),
      },
    });

    return {
      ...clinic,
      // Returned resolved, so the editor is holding the same values the
      // page will render rather than what it happened to send.
      publicSections: resolveSections(clinic.publicSections),
      publicDesign: resolveDesign(clinic.publicDesign),
    };
  });

  /**
   * The site's current design, plus what it may be changed to.
   *
   * The vocabulary is served rather than duplicated in the frontend, for
   * the same reason the document composer's is: a layout the editor
   * offers but the page cannot draw would be a setting that silently
   * does nothing.
   */
  app.get("/api/clinic/site-design", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const clinic = await prisma.clinic.findFirst({
      select: { publicDesign: true, publicSections: true, publicTheme: true, heroImagePath: true, tagline: true, phone: true, mapUrl: true },
    });

    return {
      design: resolveDesign(clinic?.publicDesign),
      sections: resolveSections(clinic?.publicSections),
      defaults: DEFAULT_DESIGN,
      vocabulary: {
        sectionVariants: SECTION_VARIANTS,
        fonts: FONT_PAIRINGS,
        densities: DENSITIES,
        corners: CORNERS,
        ctaActions: CTA_ACTIONS.map((a) => ({ ...a, defaultLabel: defaultCtaLabel(a.key) })),
      },
      // What each choice depends on, so the editor can say why an option
      // will not do anything yet rather than letting it quietly fail.
      available: {
        heroImage: Boolean(clinic?.heroImagePath),
        phone: Boolean(clinic?.phone),
        mapUrl: Boolean(clinic?.mapUrl),
        tagline: Boolean(clinic?.tagline),
      },
    };
  });

  app.post("/api/clinic/site/hero", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const existing = await prisma.clinic.findFirst();
    if (!existing) return reply.status(404).send({ error: "Clinic not configured" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    try {
      const saved = await saveUploadedFile("branding", existing.id, data.filename, data.mimetype, data.file);
      return await prisma.clinic.update({ where: { id: existing.id }, data: { heroImagePath: saved.storagePath } });
    } catch (err) {
      if (err instanceof FileValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  // ── Blog / health library ─────────────────────────────────────────────
  app.get("/api/clinic/posts", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const posts = await prisma.blogPost.findMany({
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { posts };
  });

  app.post("/api/clinic/posts", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const parsed = postSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const { published, ...rest } = parsed.data;

    // Slugs must be unique, and two posts titled "Managing Diabetes" is a
    // realistic thing for a clinic to publish a year apart. Suffix rather
    // than reject -- the author shouldn't have to invent a different title.
    const base = slugify(rest.title) || "post";
    let slug = base;
    for (let n = 2; await prisma.blogPost.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;

    const post = await prisma.blogPost.create({
      data: {
        ...rest,
        slug,
        published: published ?? false,
        publishedAt: published ? new Date() : null,
        authorId: auth.clinicUserId,
      },
      include: { author: { select: { name: true } } },
    });
    return reply.status(201).send(post);
  });

  app.put("/api/clinic/posts/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = postSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const { published, ...rest } = parsed.data;
    // publishedAt is stamped the first time a post actually goes live and
    // then left alone -- re-publishing an edited post shouldn't move it
    // back to the top of the list as though it were new.
    const publishedAt =
      published === true && !existing.published ? new Date() : published === false ? null : existing.publishedAt;

    const post = await prisma.blogPost.update({
      where: { id },
      data: { ...rest, ...(published === undefined ? {} : { published }), publishedAt },
      include: { author: { select: { name: true } } },
    });
    return post;
  });

  app.delete("/api/clinic/posts/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    await prisma.blogPost.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/api/clinic/posts/:id/cover", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    try {
      const saved = await saveUploadedFile("branding", id, data.filename, data.mimetype, data.file);
      return await prisma.blogPost.update({ where: { id }, data: { coverImagePath: saved.storagePath } });
    } catch (err) {
      if (err instanceof FileValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  // ── Gallery ───────────────────────────────────────────────────────────
  app.get("/api/clinic/gallery", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const photos = await prisma.galleryPhoto.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return { photos };
  });

  app.post("/api/clinic/gallery", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });
    // Multipart: text fields arrive alongside the file, not as a JSON body.
    const caption = typeof data.fields?.caption === "object" && data.fields.caption && "value" in data.fields.caption
      ? String((data.fields.caption as { value: unknown }).value).slice(0, 200)
      : null;

    try {
      const count = await prisma.galleryPhoto.count();
      const saved = await saveUploadedFile("branding", "gallery", data.filename, data.mimetype, data.file);
      const photo = await prisma.galleryPhoto.create({
        data: { storagePath: saved.storagePath, caption: caption || null, sortOrder: count },
      });
      return reply.status(201).send(photo);
    } catch (err) {
      if (err instanceof FileValidationError) return reply.status(400).send({ error: err.message });
      throw err;
    }
  });

  app.delete("/api/clinic/gallery/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const existing = await prisma.galleryPhoto.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    await prisma.galleryPhoto.delete({ where: { id } });
    return { ok: true };
  });

  // ── Patient feedback ──────────────────────────────────────────────────
  app.get("/api/clinic/feedback", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const feedback = await prisma.feedback.findMany({ orderBy: { submittedAt: "desc" }, take: 200 });
    const count = feedback.length;
    const average = count > 0 ? feedback.reduce((s, f) => s + f.rating, 0) / count : null;
    // Distribution matters more than the mean here: a 4.2 average made of
    // fives and ones is a different clinic from one made of fours.
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: feedback.filter((f) => f.rating === stars).length,
    }));
    return { feedback, count, average, distribution };
  });

  app.patch("/api/clinic/feedback/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = z.object({ isPublished: z.boolean() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.feedback.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    return await prisma.feedback.update({ where: { id }, data: { isPublished: parsed.data.isPublished } });
  });

  app.delete("/api/clinic/feedback/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const existing = await prisma.feedback.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    await prisma.feedback.delete({ where: { id } });
    return { ok: true };
  });

  /**
   * Public feedback submission -- unauthenticated, because a patient
   * leaving feedback has no login.
   *
   * Nothing submitted here is published automatically: `isPublished`
   * defaults to false in the schema and this route never sets it. So the
   * worst an abusive submission can do is add a row the clinic sees and
   * deletes -- it cannot put text on the public site.
   */
  app.post("/api/clinic/public/feedback", async (request, reply) => {
    const parsed = feedbackSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { visitDate, ...rest } = parsed.data;
    await prisma.feedback.create({
      data: { ...rest, visitDate: visitDate ? new Date(visitDate) : null },
    });
    // Deliberately returns nothing but an acknowledgement -- no id, no
    // echo of the stored row.
    return reply.status(201).send({ ok: true });
  });
}
