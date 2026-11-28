-- Growth's posts and photos (its D55): the module in the catalogue, off
-- sale and unpriced, with no photos or posts a month until the founder
-- sets them. Grants gain photosMonth and postsMonth (JSON, no schema change).
INSERT INTO "CatalogOffer" ("id", "product", "code", "kind", "name", "summary", "includes", "grants", "monthlyPricePaise", "published", "position", "updatedAt") VALUES
('growth:module-content', 'GROWTH', 'module-content', 'module', 'Posts and photos', 'Product photos from a phone photo, and a month of posts',
 ARRAY['Product photos restaged from a phone photo', 'A month of posts planned for you to approve', 'Posted to Instagram, Facebook and Google'],
 '{"modules":["content"],"videosMonth":0,"aiSecondsMonth":0,"photosMonth":0,"postsMonth":0}', NULL, false, 150, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
