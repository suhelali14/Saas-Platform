/**
 * Imports a real Indian medicine database for the prescription autocomplete
 * (see the plan's Phase 2 research) -- replaces the 72-drug hand-picked MVP
 * seed with ~250,000 real medicines.
 *
 * Source: github.com/junioralive/Indian-Medicine-Dataset -- MIT licensed.
 * id, name, price(₹), Is_discontinued, manufacturer_name, type,
 * pack_size_label, short_composition1, short_composition2.
 * Attribution per the MIT license: this script and prisma/schema.prisma's
 * Drug model document the source.
 *
 * Discontinued medicines are filtered out -- a doctor shouldn't be able to
 * accidentally prescribe something no longer on the market.
 *
 * Captures `price` from the source CSV too (added in Phase 4, to suggest a
 * starting amount on a billing line item -- see clinic-analytics/billing
 * design). Re-running this script truncates and reloads the auto-imported
 * rows (preserving anything a doctor added manually via `addedManually`) so
 * a price backfill or a refreshed dataset both work the same way.
 *
 * One-time / re-run-when-you-want-fresh-data script, not part of the
 * running API. Usage: npm run seed:drugs (from apps/clinic-api).
 */
import { parse } from "csv-parse/sync";
import { PrismaClient } from "../../src/generated/prisma-client/index.js";

const prisma = new PrismaClient();

const CSV_URL = "https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/DATA/indian_medicine_data.csv";
const BATCH_SIZE = 5000;

interface CsvRow {
  id: string;
  name: string;
  "price(₹)": string;
  Is_discontinued: string;
  manufacturer_name: string;
  type: string;
  pack_size_label: string;
  short_composition1: string;
  short_composition2: string;
}

async function main() {
  console.log(`Downloading medicine dataset from ${CSV_URL} ...`);
  const response = await fetch(CSV_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const csvText = await response.text();
  console.log(`Downloaded ${(csvText.length / 1024 / 1024).toFixed(1)}MB, parsing...`);

  const rows: CsvRow[] = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true });
  console.log(`Parsed ${rows.length} rows.`);

  const active = rows.filter((r) => r.Is_discontinued?.trim().toUpperCase() !== "TRUE" && r.name?.trim());
  console.log(`${active.length} active (non-discontinued) medicines to import.`);

  // Safe pre-launch: no DrugBatch or PrescriptionItem.drugId references any
  // auto-imported row yet in this deployment. Once real batches/prescriptions
  // exist against specific rows, re-running this would cascade-delete their
  // batches and null out drugId links on old prescriptions -- switch to a
  // name-matched UPDATE-only backfill at that point instead of this wipe.
  const deleted = await prisma.drug.deleteMany({ where: { addedManually: false } });
  console.log(`Cleared ${deleted.count} previously auto-imported rows (kept anything doctor-added).`);

  let imported = 0;
  for (let i = 0; i < active.length; i += BATCH_SIZE) {
    const batch = active.slice(i, i + BATCH_SIZE).map((r) => {
      const priceNum = Number(r["price(₹)"]);
      return {
        name: r.name.trim(),
        composition: [r.short_composition1, r.short_composition2].filter((c) => c?.trim()).join(", ").trim() || null,
        manufacturer: r.manufacturer_name?.trim() || null,
        packSize: r.pack_size_label?.trim() || null,
        type: r.type?.trim() || null,
        price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
        isDiscontinued: false,
      };
    });
    const result = await prisma.drug.createMany({ data: batch, skipDuplicates: true });
    imported += result.count;
    process.stdout.write(`\rImported ${imported}/${active.length}...`);
  }
  console.log(`\nDone. ${imported} medicines imported.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
