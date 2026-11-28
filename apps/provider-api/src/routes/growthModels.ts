import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireOwnerAuth, requireProviderAuth } from "../plugins/auth.js";
import { callGrowth } from "../lib/subscriptions.js";

/*
 * Growth's AI models (Growth's D55), managed here: who each model is, how
 * they look and carry themselves on camera, how they are styled, which
 * kinds of shop they suit, their portrait and their examples. The roster
 * lives on Growth's server; every call goes there signed. Reading is for
 * anyone on the console; changing is for its owners.
 */

function fail(reply: FastifyReply, err: unknown) {
  const e = err as Error & { status?: number };
  const status = e.status && e.status < 600 ? e.status : 502;
  return reply.status(status).send({ error: e.message || "Growth did not answer." });
}

const words = z.string().trim().max(240).default("");

const modelBody = z.object({
  name: z.string().trim().min(1).max(40),
  gender: z.enum(["woman", "man"]),
  age: z.coerce.number().int().min(18, "Every model is an adult: 18 or over.").max(80),
  line: words,
  skin: words,
  build: words,
  hair: words,
  features: words,
  expression: words,
  pose: words,
  styling: words,
  note: words,
  suits: z.array(z.enum(["jeweller", "clothing", "general"])).min(1, "Choose at least one kind of shop."),
  active: z.boolean().default(true),
  position: z.coerce.number().int().min(0).max(1000).default(0),
});

// A picture arrives as base64, already made small in the browser.
const picture = z.object({ image: z.string().min(20).max(1_400_000) });
const PICTURE_LIMIT = 2 * 1024 * 1024;

const idOf = (request: FastifyRequest) => encodeURIComponent((request.params as { id: string }).id);

// Which reference photo: the front portrait, a three-quarter view, or full length.
const angleOf = (request: FastifyRequest) => {
  const a = (request.query as { angle?: string }).angle ?? "front";
  return ["front", "side", "full"].includes(a) ? a : null;
};

export async function growthModelRoutes(app: FastifyInstance) {
  app.get("/api/provider/growth/models", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    try {
      return await callGrowth("/api/s2s/v1/models");
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.put("/api/provider/growth/models/:id", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const id = (request.params as { id: string }).id;
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(id)) return reply.status(400).send({ error: "The id is 2 to 40 small letters, numbers or dashes, starting with a letter." });
    const body = modelBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Check the model's details." });
    try {
      return await callGrowth(`/api/s2s/v1/models/${idOf(request)}`, "PUT", { ...body.data, by: auth.name });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete("/api/provider/growth/models/:id", async (request, reply) => {
    if (!requireOwnerAuth(request, reply)) return;
    try {
      return await callGrowth(`/api/s2s/v1/models/${idOf(request)}`, "DELETE");
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.put("/api/provider/growth/models/:id/portrait", { bodyLimit: PICTURE_LIMIT }, async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const body = picture.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Choose a picture under 1 MB." });
    const angle = angleOf(request);
    if (!angle) return reply.status(400).send({ error: "Choose the front portrait, the three-quarter view or the full-length photo." });
    try {
      return await callGrowth(`/api/s2s/v1/models/${idOf(request)}/portrait?angle=${angle}`, "PUT", { image: body.data.image, by: auth.name });
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Made by Growth's image model from the description: it can take a minute.
  app.post("/api/provider/growth/models/:id/portrait/make", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const angle = angleOf(request);
    if (!angle) return reply.status(400).send({ error: "Choose the front portrait, the three-quarter view or the full-length photo." });
    try {
      return await callGrowth(`/api/s2s/v1/models/${idOf(request)}/portrait/make?angle=${angle}`, "POST", { by: auth.name }, 150_000);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post("/api/provider/growth/models/:id/examples", { bodyLimit: PICTURE_LIMIT }, async (request, reply) => {
    if (!requireOwnerAuth(request, reply)) return;
    const body = picture
      .extend({ caption: z.string().trim().min(1, "Say what the photo shows.").max(120), kind: z.enum(["jeweller", "clothing", "general"]) })
      .safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Choose a picture and say what it shows." });
    try {
      return await callGrowth(`/api/s2s/v1/models/${idOf(request)}/examples`, "POST", body.data);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.delete("/api/provider/growth/models/:id/examples/:eid", async (request, reply) => {
    if (!requireOwnerAuth(request, reply)) return;
    const eid = encodeURIComponent((request.params as { eid: string }).eid);
    try {
      return await callGrowth(`/api/s2s/v1/models/${idOf(request)}/examples/${eid}`, "DELETE");
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.put("/api/provider/growth/models-order", async (request, reply) => {
    if (!requireOwnerAuth(request, reply)) return;
    const body = z.object({ ids: z.array(z.string().max(40)).max(200) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Send the models in their new order." });
    try {
      return await callGrowth("/api/s2s/v1/models-order", "PUT", body.data);
    } catch (err) {
      return fail(reply, err);
    }
  });
}
