import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Wraps every /api/biz/* JSON response in the `{ success, data }` /
 * `{ success: false, error: { message } }` envelope
 * `SAAS/frontend/src/hooks/useApi.ts` requires (`if (!response.ok ||
 * !data.success) throw`) -- unify-platform Phase 5.
 *
 * This was supposed to happen per-route while porting each Phase 3
 * module (the plan said so explicitly), but none of the ~90 ported
 * endpoints actually did it -- they return raw payloads. Retrofitting
 * that by hand across 14 already-tested route files would touch every
 * single handler for a purely mechanical shape change; a single hook
 * does the same job in one place instead.
 *
 * Uses `onSend`, not `preSerialization` -- Fastify explicitly skips
 * `preSerialization` when the payload is `null` (per its own hook docs),
 * and `GET /api/biz/website/config` legitimately returns `null` for an
 * unconfigured business, so that edge case would silently bypass the
 * envelope entirely. `onSend` fires for every response unconditionally
 * and hands over the already-JSON-serialized string, which this parses,
 * transforms, and re-serializes.
 *
 * Only touches routes under /api/biz -- Intently's own consumer routes
 * (/api/intent-requests, /api/auth, ...) are untouched, the mobile app
 * already depends on their current raw shape. HTML responses (website
 * preview/invoice `?format=html`, the public storefront render) set
 * `Content-Type: text/html` themselves, so they're skipped by the
 * content-type check below; the WhatsApp webhook's challenge-echo/
 * "EVENT_RECEIVED" are plain-text strings under a JSON content-type by
 * Fastify's default, but aren't valid JSON, so the JSON.parse below fails
 * for them too and they're passed through unchanged.
 *
 * One shape simplification vs. SAAS's original per-controller responses:
 * a message-only action (e.g. "Employee deactivated") becomes
 * `{ success: true, data: { message: "..." } }` here instead of
 * `{ success: true, message: "..." }` -- one consistent `data.data` access
 * pattern everywhere beats special-casing each endpoint's shape.
 */
function bizResponseEnvelopePlugin(app: FastifyInstance) {
  app.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    if (!request.url.startsWith("/api/biz/")) return payload;

    const contentType = String(reply.getHeader("content-type") ?? "");
    if (!contentType.includes("application/json")) return payload;
    if (typeof payload !== "string") return payload;

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return payload;
    }

    const statusCode = reply.statusCode;

    if (statusCode >= 400) {
      return JSON.stringify({ success: false, error: { message: extractErrorMessage(parsed) } });
    }

    if (isPaginatedList(parsed)) {
      return JSON.stringify({ success: true, data: parsed.data, pagination: parsed.pagination });
    }

    return JSON.stringify({ success: true, data: parsed });
  });
}

export default fp(bizResponseEnvelopePlugin);

function isPaginatedList(payload: unknown): payload is { data: unknown; pagination: unknown } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    "data" in payload &&
    "pagination" in payload &&
    Array.isArray((payload as { data: unknown }).data)
  );
}

function extractErrorMessage(payload: unknown): string {
  if (payload == null) return "Request failed";
  if (typeof payload === "string") return payload;

  const obj = payload as Record<string, unknown>;
  const err = obj.error;

  if (typeof err === "string") return err;

  // zod's .flatten() shape: { formErrors: string[], fieldErrors: Record<string, string[]> }
  if (err && typeof err === "object") {
    const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const parts = [...(flat.formErrors ?? []), ...Object.values(flat.fieldErrors ?? {}).flat()];
    if (parts.length > 0) return parts.join("; ");
  }

  return "Request failed";
}
