/**
 * Resets a console account's password.
 *
 * Separate from seed-provider.ts on purpose. That script refuses to
 * touch an account that already exists -- "already exists, nothing to
 * do" -- and that refusal is a safety feature worth keeping: a seed is
 * something people re-run casually, often as part of a deploy, and it
 * must never silently change a live credential.
 *
 * So resetting is its own command, which does exactly one thing and says
 * so. It exists because there was no way back in at all: the password is
 * bcrypt-hashed and was typed interactively into seed-provider.sh, so
 * nothing on the server or in the repository holds it. An owner who
 * forgot it was locked out of the console that provisions every clinic.
 *
 *   PROVIDER_RESET_EMAIL=you@example.com \
 *   PROVIDER_RESET_PASSWORD=... \
 *   npx tsx prisma/reset-password.ts
 *
 * Run through deploy/reset-console-password.sh, which reads the password
 * from a prompt rather than taking it on a command line -- an argument
 * ends up in the shell history and in `ps` output for every user on the
 * box.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma-client/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.PROVIDER_RESET_EMAIL?.trim().toLowerCase();
  const password = process.env.PROVIDER_RESET_PASSWORD;

  if (!email || !password) {
    console.error("Set PROVIDER_RESET_EMAIL and PROVIDER_RESET_PASSWORD.");
    process.exit(1);
  }
  // Longer than the seed's floor of ten. This account can create and
  // destroy clinic infrastructure, and a reset is exactly the moment
  // somebody reaches for something short and memorable.
  if (password.length < 12) {
    console.error("Use at least 12 characters -- this account can provision and delete clinic infrastructure.");
    process.exit(1);
  }

  const user = await prisma.providerUser.findUnique({ where: { email } });
  if (!user) {
    // Named rather than vague: this is a CLI run by the owner on their
    // own server, not a login form, so account enumeration is not a
    // concern and "no such account" saves a long debugging detour.
    const all = await prisma.providerUser.findMany({ select: { email: true, role: true } });
    console.error(`No console account with the email ${email}.`);
    if (all.length) {
      console.error("Accounts that do exist:");
      for (const a of all) console.error(`  ${a.email}  (${a.role})`);
    } else {
      console.error("There are no console accounts at all -- use deploy/seed-provider.sh to create the first one.");
    }
    process.exit(1);
  }

  await prisma.providerUser.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  // Recorded in the append-only log, attributed to the account itself.
  // A password change on the account that can delete every clinic's
  // infrastructure is precisely what a security review looks for, and an
  // out-of-band reset that leaves no trace is worse than one that does.
  await prisma.activityLog.create({
    data: {
      actorId: user.id,
      actorName: user.name,
      action: "owner.password-reset",
      detail: "Reset from the server with deploy/reset-console-password.sh",
    },
  });

  console.log(`Password reset for ${user.email}. Sign in at the console with the new one.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
