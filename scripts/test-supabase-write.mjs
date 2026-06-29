#!/usr/bin/env node
/**
 * Verifica escritura en Supabase con service role (mismo path que el repository).
 * Uso: node scripts/test-supabase-write.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {
    // ignore
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const testUserId = "00000000-0000-0000-0000-00000000c0de";
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("🔧 Test escritura Supabase (service role)\n");

  const { data: business, error: bizErr } = await supabase
    .from("businesses")
    .insert({
      user_id: testUserId,
      name: `Test Write ${Date.now()}`,
      industry: "test",
    })
    .select()
    .single();

  if (bizErr) {
    console.error("❌ businesses insert:", bizErr.message, bizErr.details, bizErr.hint);
    process.exit(1);
  }
  console.log("✅ businesses insert OK", business.id);

  const { data: profile, error: profErr } = await supabase
    .from("brand_profiles")
    .insert({
      business_id: business.id,
      positioning: "Test positioning",
      brand_voice: "Test voice",
    })
    .select()
    .single();

  if (profErr) {
    console.error("❌ brand_profiles insert:", profErr.message);
    await supabase.from("businesses").delete().eq("id", business.id);
    process.exit(1);
  }
  console.log("✅ brand_profiles insert OK", profile.id);

  await supabase.from("brand_profiles").delete().eq("id", profile.id);
  await supabase.from("businesses").delete().eq("id", business.id);
  console.log("\n✅ Limpieza OK — Supabase acepta escrituras con service role");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
