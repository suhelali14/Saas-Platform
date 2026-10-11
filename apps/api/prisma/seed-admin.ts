/**
 * Creates (or updates) one platform AdminUser (docs/plans
 * platform-trust-layer). Deliberately not reachable via any HTTP
 * endpoint -- there is no public admin-registration route anywhere in this
 * API, on purpose. This script is the only way an admin account gets
 * created.
 *
 * Usage:
 *   ADMIN_SEED_EMAIL=you@example.com ADMIN_SEED_PASSWORD=... ADMIN_SEED_NAME="Your Name" npx tsx prisma/seed-admin.ts
 *
 * If the env vars are omitted, falls back to an obviously-dev credential
 * and prints it -- change it immediately if this is ever anything other
 * than a local dev database.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.env.ADMIN_SEED_EMAIL || "admin@local.dev";
const password = process.env.ADMIN_SEED_PASSWORD || "change-me-now-12345";
const name = process.env.ADMIN_SEED_NAME || "Platform Admin";

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { password: passwordHash, name },
    create: { email, password: passwordHash, name, role: "SUPER_ADMIN" },
  });

  console.log(`Admin account ready: ${admin.email} (role: ${admin.role})`);
  if (!process.env.ADMIN_SEED_PASSWORD) {
    console.log(`No ADMIN_SEED_PASSWORD was set -- using the dev default. Password: ${password}`);
    console.log("Set ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD/ADMIN_SEED_NAME and re-run before this touches anything but a local dev database.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
