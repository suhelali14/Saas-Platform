-- Phase 11: per-clinic printed-document template (header mode, accent
-- colour, watermark, pre-printed-stationery offset).
ALTER TABLE "Clinic" ADD COLUMN "documentTemplate" JSONB;
