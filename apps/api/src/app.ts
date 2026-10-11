import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import authPlugin from "./plugins/auth.js";
import bizResponseEnvelopePlugin from "./plugins/biz-response-envelope.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { intentRequestRoutes } from "./routes/intent-requests.js";
import { businessRoutes } from "./routes/businesses.js";
import { userRoutes } from "./routes/users.js";
import { funnelEventRoutes } from "./routes/funnel-events.js";
import { statsRoutes } from "./routes/stats.js";
import { bizAuthRoutes } from "./routes/biz/biz-auth.js";
import { bizBusinessRoutes } from "./routes/biz/biz-business.js";
import { bizCatalogRoutes } from "./routes/biz/biz-catalog.js";
import { bizCustomerRoutes } from "./routes/biz/biz-customers.js";
import { bizInventoryRoutes } from "./routes/biz/biz-inventory.js";
import { bizOrderRoutes } from "./routes/biz/biz-orders.js";
import { bizEmployeeRoutes } from "./routes/biz/biz-employees.js";
import { bizConversationRoutes } from "./routes/biz/biz-conversations.js";
import { bizPaymentRoutes } from "./routes/biz/biz-payments.js";
import { bizDashboardRoutes } from "./routes/biz/biz-dashboard.js";
import { bizAnalyticsRoutes } from "./routes/biz/biz-analytics.js";
import { bizGrowthRoutes } from "./routes/biz/biz-growth.js";
import { bizWebsiteRoutes } from "./routes/biz/biz-website.js";
import { bizWhatsappRoutes } from "./routes/biz/biz-whatsapp.js";
import { bizAiRoutes } from "./routes/biz/biz-ai.js";
import { bizOnboardingRoutes } from "./routes/biz/biz-onboarding.js";
import { intentlyBridgeRoutes } from "./routes/intently-bridge.js";
import { bookingRoutes } from "./routes/bookings.js";
import { bizBookingRoutes } from "./routes/biz/biz-bookings.js";
import { bizKycRoutes } from "./routes/biz/biz-kyc.js";
import { bizTicketRoutes } from "./routes/biz/biz-tickets.js";
import { adminAuthRoutes } from "./routes/admin/admin-auth.js";
import { adminKycRoutes } from "./routes/admin/admin-kyc.js";
import { adminTicketRoutes } from "./routes/admin/admin-tickets.js";


export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }); // matches lib/file-storage.ts's own cap
  app.register(authPlugin);
  app.register(bizResponseEnvelopePlugin);
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(intentRequestRoutes);
  app.register(businessRoutes);
  app.register(userRoutes);
  app.register(funnelEventRoutes);
  app.register(statsRoutes);
  app.register(bizAuthRoutes);
  app.register(bizBusinessRoutes);
  app.register(bizCatalogRoutes);
  app.register(bizCustomerRoutes);
  app.register(bizInventoryRoutes);
  app.register(bizOrderRoutes);
  app.register(bizEmployeeRoutes);
  app.register(bizConversationRoutes);
  app.register(bizPaymentRoutes);
  app.register(bizDashboardRoutes);
  app.register(bizAnalyticsRoutes);
  app.register(bizGrowthRoutes);
  app.register(bizWebsiteRoutes);
  app.register(bizWhatsappRoutes);
  app.register(bizAiRoutes);
  app.register(bizOnboardingRoutes);
  app.register(intentlyBridgeRoutes);
  app.register(bookingRoutes);
  app.register(bizBookingRoutes);
  app.register(bizKycRoutes);
  app.register(bizTicketRoutes);
  app.register(adminAuthRoutes);
  app.register(adminKycRoutes);
  app.register(adminTicketRoutes);


  return app;
}
