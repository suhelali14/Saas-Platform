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

/**
 * Two flags, deliberately not one.
 *
 * `DRUG_IMPORT_FORCE` means "re-import even though rows are already
 * there", which is a reasonable thing to want and is not dangerous.
 * `DRUG_IMPORT_DESTROY_REFERENCED` is the one that permits deleting
 * catalogue rows a clinic's pharmacy batches point at, and it is named
 * after what it does rather than after when you reach for it.
 *
 * Collapsing them into a single FORCE -- which the first version of this
 * did -- recreates the bug it was added to fix: someone refreshing a
 * catalogue sets the flag that sounds benign and loses stock records.
 */
const FORCE = process.env.DRUG_IMPORT_FORCE === "1";
const DESTROY_REFERENCED = process.env.DRUG_IMPORT_DESTROY_REFERENCED === "1";

/** Below this the catalogue counts as missing or half-imported, and is
 *  worth (re)doing. The real figure is ~246,000. */
const HEALTHY = 1000;

async function main() {
  // ── Already done? Then do nothing at all. ────────────────────────────
  //
  // This makes the import CONVERGENT, which is what lets the per-push
  // deploy call it for every clinic on every deploy: a clinic that has
  // its catalogue costs one COUNT and exits, and a clinic that somehow
  // does not gets it without anyone noticing it was missing. The first
  // live clinic ran for weeks with an empty Drug table precisely because
  // this was a one-shot step at provisioning time that nothing ever
  // re-checked.
  const already = await prisma.drug.count({ where: { addedManually: false } });
  if (already >= HEALTHY && !FORCE) {
    console.log(`Catalogue already holds ${already} imported medicines. Nothing to do.`);
    return;
  }

  // ── Refuse to destroy data the clinic is using. ──────────────────────
  //
  // The wipe below is `deleteMany({ addedManually: false })`, and Drug is
  // the parent of two things that matter:
  //
  //   DrugBatch.drug        onDelete: Cascade  -- deleting a catalogue row
  //     DELETES its stock batches. Quantities, batch numbers, expiry
  //     dates: gone, with no record that they existed.
  //   PrescriptionItem.drug onDelete: SetNull  -- breaks the link from a
  //     prescription already issued back to what was prescribed.
  //
  // So on a clinic that has started using its pharmacy, re-running this
  // is silent data loss -- and re-running it is exactly what anyone is
  // told to do when the autocomplete finds nothing. The recovery for one
  // problem was a cause of a worse one.
  //
  // Checked rather than assumed, because "no batches exist yet" was true
  // when this script was written and is not a property that stays true.
  const [batches, items] = await Promise.all([
    prisma.drugBatch.count({ where: { drug: { addedManually: false } } }),
    prisma.prescriptionItem.count({ where: { drug: { addedManually: false } } }),
  ]);
  if ((batches > 0 || items > 0) && !DESTROY_REFERENCED) {
    throw new Error(
      `Refusing to re-import: ${batches} pharmacy batch(es) and ${items} prescription ` +
        `item(s) point at catalogue rows. Replacing the catalogue would delete those ` +
        `batches outright (Drug -> DrugBatch cascades) and unlink those prescriptions. ` +
        `The catalogue currently holds ${already} imported rows.
` +
        `If the catalogue really must be rebuilt, back up DrugBatch first and re-run ` +
        `with DRUG_IMPORT_DESTROY_REFERENCED=1.`,
    );
  }

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

  // An exit code says the script ran, not that the catalogue is usable.
  //
  // `createMany({ skipDuplicates: true })` returns a count of rows it
  // actually inserted, so a run that skipped everything reports a small
  // number and still exits 0 -- and the clinic gets a prescription
  // screen whose autocomplete finds nothing. That is precisely the
  // failure this import existed to prevent and did not, because nothing
  // ever checked the table afterwards.
  const inTable = await prisma.drug.count({ where: { isDiscontinued: false } });
  console.log(`Catalogue now holds ${inTable} searchable medicines.`);
  if (inTable < 1000) {
    throw new Error(
      `Only ${inTable} medicines are in the table after importing. Tens of thousands ` +
        `were expected, so the prescription autocomplete would find almost nothing. ` +
        `Refusing to report this as success.`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
