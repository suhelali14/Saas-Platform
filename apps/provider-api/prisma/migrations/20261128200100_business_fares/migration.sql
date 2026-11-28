-- The fare chart's three priced rows, at the prices nayaversse.in shows
-- today, on sale because they are already public. The fourth row (Custom)
-- is "on enquiry" and stays the site's own words. Changing a price here now
-- changes it on the site.
INSERT INTO "CatalogOffer" ("id", "product", "code", "kind", "name", "summary", "includes", "grants", "monthlyPricePaise", "published", "position", "updatedAt") VALUES
('business:a', 'BUSINESS', 'a', 'plan', 'Single counter', 'One location, the owner and a person or two. 1–2 logins.', ARRAY[]::TEXT[], '{}', 300000, true, 10, CURRENT_TIMESTAMP),
('business:b', 'BUSINESS', 'b', 'plan', 'Growing', 'Staff who each need a login, real stock, a booking diary that matters. 3–10 logins.', ARRAY[]::TEXT[], '{}', 1200000, true, 20, CURRENT_TIMESTAMP),
('business:c', 'BUSINESS', 'c', 'plan', 'Multi-location', 'Several branches, or one location with many staff. 11–40 logins.', ARRAY[]::TEXT[], '{}', 5000000, true, 30, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
