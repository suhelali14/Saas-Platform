-- The business software sold on nayaversse.in's fare chart, as a product in
-- the catalogue, so the site's prices come from the console. Additive.
ALTER TYPE "Product" ADD VALUE IF NOT EXISTS 'BUSINESS';
