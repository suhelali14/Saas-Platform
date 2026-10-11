import type { FunnelEventType } from "@intently/shared-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/**
 * docs/14-mvp-implementation-plan.md M7. A thin wrapper rather than inline
 * `prisma.funnelEvent.create` calls at each site, so every call site stays
 * a one-liner regardless of which fields end up mattering later.
 */
export function recordFunnelEvent(
  userId: string,
  eventType: FunnelEventType,
  options?: { intentRequestId?: string; metadata?: Record<string, unknown> },
): Promise<unknown> {
  return prisma.funnelEvent.create({
    data: {
      userId,
      eventType,
      intentRequestId: options?.intentRequestId,
      metadata: options?.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
