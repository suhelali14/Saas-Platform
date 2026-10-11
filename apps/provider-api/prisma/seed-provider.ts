import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma-client/index.js";
import bcrypt from "bcryptjs";

/**
 * Creates the first console account.
 *
 * There is deliberately no public sign-up route anywhere in this API: this
 * console can provision infrastructure and see every customer's commercial
 * terms, so the only way in is a deliberate seed run by whoever controls
 * the server.
 */
const prisma = new PrismaClient();

const email = process.env.PROVIDER_SEED_EMAIL;
const password = process.env.PROVIDER_SEED_PASSWORD;
const name = process.env.PROVIDER_SEED_NAME || "Owner";

async function main() {
  if (!email || !password) {
    console.error("Set PROVIDER_SEED_EMAIL and PROVIDER_SEED_PASSWORD -- see .env.example");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Use a password of at least 10 characters. This account can provision infrastructure.");
    process.exit(1);
  }

  const existing = await prisma.providerUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`${email} already exists -- nothing to do.`);
    return;
  }

  const user = await prisma.providerUser.create({
    data: { email, name, role: "OWNER", passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Created owner account ${user.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
