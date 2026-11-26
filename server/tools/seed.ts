/** Idempotent Prisma seed. Re-running repairs admin/profile/defaults without resetting passwords or data. */
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { prisma, pool } from "../src/db.js";
import { serverRoot } from "../src/env.js";
import { DEFAULT_FINANCE_CATEGORIES } from "../src/lib/default-finance-categories.js";
import {
  DEFAULT_APPLE_MODELS,
  DEFAULT_DEVICE_BRANDS,
  DEFAULT_DEVICE_TYPES,
  DEFAULT_SERVICE_CHARGE_CATEGORIES,
} from "../src/lib/default-device-catalog.js";

const email = (process.env.ADMIN_EMAIL ?? "admin@alvstore.in").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "admin123";
const fullName = process.env.ADMIN_NAME ?? "ALV Admin";

async function ensureNamedCatalogRow(
  model: { findFirst: Function; update: Function; create: Function },
  name: string,
) {
  const exact = await model.findFirst({ where: { name } });
  if (exact) return exact;
  const insensitive = await model.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (insensitive) {
    return model.update({ where: { id: insensitive.id }, data: { name } });
  }
  return model.create({ data: { name } });
}

try {
  // Triggers are not expressible in Prisma. This installs behaviour only, not tables.
  await pool.query(fs.readFileSync(path.join(serverRoot, "prisma/runtime.sql"), "utf8"));
  await prisma.$transaction(async tx => {
    const existing = await tx.authUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    const admin = existing ?? await tx.authUser.create({ data: {
      email, password_hash: await bcrypt.hash(password, 10), raw_user_meta_data: { full_name: fullName },
    } });
    await tx.profiles.upsert({ where: { user_id: admin.id }, update: { full_name: fullName }, create: { user_id: admin.id, full_name: fullName } });
    await tx.userRoles.upsert({ where: { user_id_role: { user_id: admin.id, role: "admin" } }, update: {}, create: { user_id: admin.id, role: "admin" } });
    await tx.userRoles.deleteMany({ where: { user_id: admin.id, role: { not: "admin" } } });
    if (!await tx.businessSettings.findFirst()) await tx.businessSettings.create({ data: { company_name: "ALV Store" } });

    for (const [name, type] of DEFAULT_FINANCE_CATEGORIES) {
      if (!await tx.financeCategories.findFirst({ where: { name, type } })) await tx.financeCategories.create({ data: { name, type } });
    }

    for (const brand of DEFAULT_DEVICE_BRANDS) {
      await ensureNamedCatalogRow(tx.deviceBrands, brand);
    }
    for (const deviceType of DEFAULT_DEVICE_TYPES) {
      await ensureNamedCatalogRow(tx.deviceTypes, deviceType);
    }
    for (const model of DEFAULT_APPLE_MODELS) {
      await tx.deviceModels.upsert({
        where: {
          brand_device_type_name: {
            brand: model.brand,
            device_type: model.device_type,
            name: model.name,
          },
        },
        update: {
          series: model.series,
          color_options: model.color_options as any,
          storage_options: model.storage_options as any,
          sort_order: model.sort_order,
          is_active: true,
        },
        create: {
          brand: model.brand,
          device_type: model.device_type,
          name: model.name,
          series: model.series,
          color_options: model.color_options as any,
          storage_options: model.storage_options as any,
          sort_order: model.sort_order,
          is_active: true,
        },
      });
    }

    for (const [name, charge] of DEFAULT_SERVICE_CHARGE_CATEGORIES) {
      if (!await tx.serviceChargeCategories.findFirst({ where: { name } })) await tx.serviceChargeCategories.create({ data: { name, default_charge: charge } });
    }
    for (const [name, description] of [
      ["Hardware", "Physical component issues"], ["Software", "OS, apps, firmware issues"], ["Screen", "Display damage and touch issues"],
      ["Battery", "Battery and charging issues"], ["Water Damage", "Liquid damage recovery"], ["Data Backup", "Data recovery and backup"], ["Other", "Miscellaneous repairs"],
    ]) if (!await tx.issueCategories.findFirst({ where: { name } })) await tx.issueCategories.create({ data: { name, description } });
    console.log(`[seed] admin ${email} ${existing ? "already exists (password unchanged)" : "created"}; ${DEFAULT_DEVICE_BRANDS.length} brands, ${DEFAULT_DEVICE_TYPES.length} types, ${DEFAULT_APPLE_MODELS.length} Apple models ready`);
  }, { timeout: 30_000 });
} catch (error) {
  console.error("[seed] failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
