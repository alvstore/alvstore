/** Idempotent Prisma seed. Re-running repairs admin/profile/defaults without resetting passwords or data. */
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { prisma, pool } from "../src/db.js";
import { serverRoot } from "../src/env.js";

const email = (process.env.ADMIN_EMAIL ?? "admin@alvstore.in").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "admin123";
const fullName = process.env.ADMIN_NAME ?? "ALV Admin";

try {
  // Triggers are not expressible in Prisma. This installs behaviour only, not tables.
  await pool.query(fs.readFileSync(path.join(serverRoot, "prisma/runtime.sql"), "utf8"));
  await prisma.$transaction(async tx => {
    const existing = await tx.authUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    const admin = existing ?? await tx.authUser.create({ data: {
      email, password_hash: await bcrypt.hash(password, 10), raw_user_meta_data: { full_name: fullName },
    } });
    await tx.profiles.upsert({ where: { user_id: admin.id }, update: {}, create: { user_id: admin.id, full_name: fullName } });
    await tx.userRoles.upsert({ where: { user_id_role: { user_id: admin.id, role: "admin" } }, update: {}, create: { user_id: admin.id, role: "admin" } });
    if (!await tx.businessSettings.findFirst()) await tx.businessSettings.create({ data: { company_name: "ALV Store" } });

    for (const [name, type] of [
      ["POS Sales", "income"], ["Repair Income", "income"], ["Service Income", "income"], ["Other Income", "income"],
      ["Salary", "expense"], ["Rent", "expense"], ["Purchase", "expense"], ["Utilities", "expense"], ["Maintenance", "expense"], ["Misc Expense", "expense"],
    ]) if (!await tx.financeCategories.findFirst({ where: { name, type } })) await tx.financeCategories.create({ data: { name, type } });

    for (const [name, charge] of [["iPhone", 750], ["Android", 500], ["Laptop", 2600], ["MacBook", 3500], ["Tablet", 1000], ["Other", 500]] as const) {
      if (!await tx.serviceChargeCategories.findFirst({ where: { name } })) await tx.serviceChargeCategories.create({ data: { name, default_charge: charge } });
    }
    for (const [name, description] of [
      ["Hardware", "Physical component issues"], ["Software", "OS, apps, firmware issues"], ["Screen", "Display damage and touch issues"],
      ["Battery", "Battery and charging issues"], ["Water Damage", "Liquid damage recovery"], ["Data Backup", "Data recovery and backup"], ["Other", "Miscellaneous repairs"],
    ]) if (!await tx.issueCategories.findFirst({ where: { name } })) await tx.issueCategories.create({ data: { name, description } });
    console.log(`[seed] admin ${email} ${existing ? "already exists (password unchanged)" : "created"}; defaults ready`);
  }, { timeout: 30_000 });
} catch (error) {
  console.error("[seed] failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
