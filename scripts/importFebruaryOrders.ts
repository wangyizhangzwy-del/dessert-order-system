#!/usr/bin/env node
/**
 * One-time February historical order import into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:february
 *   npm run import:february -- path/to/february_orders_normalized.csv
 *
 * Requires data/february_orders_normalized.csv by default.
 * Safe to run multiple times (upserts by import_february_YYYY-MM-DD batch_id).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildFebruaryBatches,
  isImportableDefaultAddress,
  parseFebruaryCsv,
} from "../lib/februaryImport";
import { getBatch, listBatches, upsertBatch } from "../lib/supabaseRepo";
import { isSupabaseConfigured } from "../lib/supabaseServer";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const dryRun = process.argv.includes("--dry-run");
  loadEnvFile(join(root, ".env.local"));
  loadEnvFile(join(root, ".env"));

  const csvArg = process.argv.find((a) => a.endsWith(".csv"));
  const csvPath = csvArg
    ? (csvArg.startsWith("/") ? csvArg : join(root, csvArg))
    : join(root, "data/february_orders_normalized.csv");

  if (!existsSync(csvPath)) {
    console.error(`❌ CSV not found: ${csvPath}`);
    console.error("   Place the normalized file at data/february_orders_normalized.csv");
    process.exit(1);
  }

  if (!dryRun && !isSupabaseConfigured()) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    console.error("   Set them in .env.local or export before running.");
    console.error("   Use --dry-run to validate CSV without uploading.");
    process.exit(1);
  }

  const csvText = readFileSync(csvPath, "utf8");
  const rows = parseFebruaryCsv(csvText);
  const { batches, summary } = buildFebruaryBatches(rows);

  console.log("\n=== February Import Preview ===");
  console.log(`Rows read:              ${summary.rowsRead}`);
  console.log(`Date batches:           ${summary.batchesCreatedOrUpdated} (${summary.dates.join(", ")})`);
  console.log(`Customer orders:        ${summary.customerOrders}`);
  console.log(`Product lines:          ${summary.productLines}`);
  console.log(`Total known sales:      ${summary.totalKnownSales.toFixed(1)}`);
  console.log(`Missing price rows:     ${summary.missingPriceRows}`);
  if (summary.missingPriceDetails.length > 0) {
    console.log("\nMissing price warnings:");
    for (const w of summary.missingPriceDetails) {
      console.log(`  - ${w}`);
    }
  }

  const addressSamples = rows
    .filter((r) => isImportableDefaultAddress(r.delivery_or_address))
    .map((r) => `${r.wechat_id}: ${r.delivery_or_address.trim()}`);
  const uniqueAddresses = [...new Set(addressSamples)];
  if (uniqueAddresses.length > 0) {
    console.log(`\nImportable addresses (${uniqueAddresses.length} unique customer-note pairs):`);
    for (const a of uniqueAddresses.slice(0, 15)) {
      console.log(`  - ${a}`);
    }
    if (uniqueAddresses.length > 15) console.log(`  ... and ${uniqueAddresses.length - 15} more`);
  }

  if (dryRun) {
    console.log("\n=== Dry run (no Supabase upload) ===\n");
    return;
  }

  const beforeCount = (await listBatches()).length;
  let created = 0;
  let updated = 0;

  console.log("\n=== Uploading to Supabase ===");
  for (const batch of batches) {
    const existing = await getBatch(batch.batch_id);
    await upsertBatch(batch);
    if (existing) {
      updated += 1;
      console.log(`  ↻ updated ${batch.batch_id} (${batch.order_date})`);
    } else {
      created += 1;
      console.log(`  ✓ created ${batch.batch_id} (${batch.order_date})`);
    }
  }

  const afterCount = (await listBatches()).length;

  console.log("\n=== Import Complete ===");
  console.log(`Batches created:        ${created}`);
  console.log(`Batches updated:        ${updated}`);
  console.log(`Total batches in DB:    ${afterCount} (was ${beforeCount})`);
  console.log("\nVerify in production:");
  console.log("  - /batches — February batches titled 接龙-YYYY-MM-DD-周X-历史导入");
  console.log("  - /api/health — batchCount increased");
  console.log("  - /customers, /analytics, /performance — imported data visible");
  console.log("  - Re-run this script — no duplicate batches (same batch_id upserted)\n");
}

main().catch((err) => {
  console.error("Import failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
