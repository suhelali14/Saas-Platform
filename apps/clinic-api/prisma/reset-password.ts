/**
 * Resets one staff member's password in one clinic.
 *
 * There was no way to do this. A clinic's own Settings screen can change
 * your password only if you know the current one; the staff screen can
 * create an account with a password but never reset one; and re-running
 * seed-clinic.ts does reset the doctor -- but it also rewrites the
 * clinic's name, the printed doctor name and the UHID prefix from
 * whatever env vars happen to be set, which is a lot of collateral for
 * a forgotten password.
 *
 * So this does exactly one thing: set one user's password hash.
 *
 *   CLINIC_RESET_EMAIL=doctor@clinic.in \
 *   CLINIC_RESET_PASSWORD=... \
 *   npx tsx prisma/reset-password.ts
 *
 * Run through deploy/reset-clinic-password.sh, which prompts for the
 * password rather than taking it as an argument -- an argument lands in
 * the shell history and in `ps` for every user on the box.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma-client/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.CLINIC_RESET_EMAIL?.trim().toLowerCase();
  const password = process.env.CLINIC_RESET_PASSWORD;

  if (!email || !password) {
    console.error("Set CLINIC_RESET_EMAIL and CLINIC_RESET_PASSWORD.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Use at least 10 characters -- this account can read patient records.");
    process.exit(1);
  }

  const user = await prisma.clinicUser.findUnique({ where: { email } });
  if (!user) {
    // This is a CLI the operator runs on their own server, not a login
    // form, so naming the accounts that do exist costs nothing and saves
    // a long detour over a typo or the wrong clinic's slug.
    const all = await prisma.clinicUser.findMany({
      select: { email: true, role: true, isActive: true },
      orderBy: { email: "asc" },
    });
    console.error(`No account with the email ${email} in this clinic.`);
    if (all.length) {
      console.error("Accounts in this clinic:");
      for (const a of all) console.error(`  ${a.email}  (${a.role}${a.isActive ? "" : ", deactivated"})`);
    }
    process.exit(1);
  }

  await prisma.clinicUser.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  // Written into the append-only audit trail by hand.
  //
  // Every other write in this system is logged by a single onResponse
  // hook, which is what makes the trail complete -- but a hook cannot
  // see a command run from a shell. A password reset on an account that
  // can read patient records is exactly what a DPDP or NABH review asks
  // about, and an out-of-band change that leaves no trace is worse than
  // one that does.
  await prisma.auditLog.create({
    data: {
      clinicUserId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "password.reset",
      resource: "ClinicUser",
      method: "CLI",
      path: "prisma/reset-password.ts",
      statusCode: 200,
    },
  });

  // Deliberately not reactivated. If this account was deactivated, that
  // was somebody's decision, and quietly undoing it as a side effect of
  // a password reset is how a departed staff member gets their access
  // back.
  if (!user.isActive) {
    console.log(`Note: ${user.email} is deactivated, so it still cannot sign in.`);
    console.log("Reactivate it from Staff in the portal -- this command does not, on purpose.");
  }

  console.log(`Password reset for ${user.email} (${user.role}).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
