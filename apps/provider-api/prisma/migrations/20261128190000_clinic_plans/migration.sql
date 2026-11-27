-- Clinic plans on the console's subscriptions (Growth's D54, phase 2).
-- Additive: the clinic server's public key, and the four clinic plans in
-- the catalogue at the console's own list prices, off sale until the
-- founder puts them on sale.
ALTER TABLE "ClinicAccount" ADD COLUMN IF NOT EXISTS "s2sPublicKey" TEXT;

INSERT INTO "CatalogOffer" ("id", "product", "code", "kind", "name", "summary", "includes", "grants", "monthlyPricePaise", "published", "position", "updatedAt") VALUES
('clinic:basic', 'CLINIC', 'basic', 'plan', 'Clinic', 'One doctor and a front desk.', ARRAY[]::TEXT[], '{"plan":"BASIC"}', 300000, false, 10, CURRENT_TIMESTAMP),
('clinic:standard', 'CLINIC', 'standard', 'plan', 'Polyclinic', 'Several doctors, a pharmacy, no beds.', ARRAY[]::TEXT[], '{"plan":"STANDARD"}', 700000, false, 20, CURRENT_TIMESTAMP),
('clinic:premium', 'CLINIC', 'premium', 'plan', 'Hospital', 'A hospital with beds, up to about 50.', ARRAY[]::TEXT[], '{"plan":"PREMIUM"}', 2000000, false, 30, CURRENT_TIMESTAMP),
('clinic:enterprise', 'CLINIC', 'enterprise', 'plan', 'Multi-specialty', 'A multi-specialty hospital, government schemes, 50+ beds.', ARRAY[]::TEXT[], '{"plan":"ENTERPRISE"}', 5000000, false, 40, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
