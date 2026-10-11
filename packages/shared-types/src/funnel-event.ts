// Wire shape for the funnel instrumentation named in
// docs/05-native-app-spec.md ("submitted -> shown -> opened -> compared ->
// booked") and built per docs/14-mvp-implementation-plan.md M7.
// INTENT_SUBMITTED and RESULTS_SHOWN are recorded server-side (both always
// happen together, atomically, inside the intent-requests route); only
// RESULT_OPENED needs an explicit client call, since opening a business
// profile is a later, disconnected user action the server can't observe on
// its own. COMPARED/BOOKED exist in the type for forward-compatibility but
// nothing fires them yet -- no Compare screen, no transaction flow.
export type FunnelEventType = "INTENT_SUBMITTED" | "RESULTS_SHOWN" | "RESULT_OPENED" | "COMPARED" | "BOOKED";

export interface RecordFunnelEventRequest {
  eventType: FunnelEventType;
  intentRequestId?: string;
  metadata?: Record<string, unknown>;
}

export interface FunnelEventDTO {
  id: string;
  eventType: FunnelEventType;
  intentRequestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// GET /api/stats -- public, aggregate, non-sensitive totals for the
// Business Dashboard home page. No revenue/conversion numbers here; those
// need the Transaction Service (Phase 2, not built yet).
export interface PlatformStats {
  totalBusinesses: number;
  totalIntentRequests: number;
  matchedIntentRequests: number;
  totalMatches: number;
}
