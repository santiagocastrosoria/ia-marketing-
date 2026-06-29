#!/usr/bin/env node
/**
 * Verifica insert de marketing_objectives (sin columnas meta opcionales).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!businesses?.length) {
    console.error("❌ No hay businesses");
    process.exit(1);
  }

  const businessId = businesses[0].id;
  console.log("Using business:", businesses[0].name, businessId);

  const row = {
    business_id: businessId,
    goal: "conseguir consultas por WhatsApp",
    product: "livings, reposeras, camastros",
    daily_budget: 150000,
    monthly_budget: 4500000,
    locations: ["Córdoba", "Buenos Aires"],
    platforms: "BOTH",
    ideal_customer: "casas premium, countries, arquitectos, desarrollistas",
    average_ticket: 850000,
    brand_awareness_level: "medium",
    status: "DRAFT",
  };

  const { data, error } = await supabase
    .from("marketing_objectives")
    .insert(row)
    .select("id, business_id, goal, daily_budget")
    .single();

  if (error) {
    console.error("❌ INSERT FAILED:", error.code, error.message);
    process.exit(1);
  }

  console.log("✅ Objective created:", data);
  console.log("   business_id:", data.business_id, data.business_id ? "OK" : "NULL!");

  await supabase.from("marketing_objectives").delete().eq("id", data.id);
  console.log("✅ Cleaned up test row");
}

main();
