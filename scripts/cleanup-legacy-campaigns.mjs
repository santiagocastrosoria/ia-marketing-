#!/usr/bin/env node
/**
 * Limpieza segura de campañas ACTIVE legacy.
 * dryRun=true por defecto — no modifica datos hasta pasar --apply
 *
 * Uso:
 *   node scripts/cleanup-legacy-campaigns.mjs [baseUrl] [email]
 *   node scripts/cleanup-legacy-campaigns.mjs http://localhost:3000 --apply
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const filtered = args.filter((a) => a !== "--apply");
const BASE = filtered[0] ?? "http://localhost:3000";
const EMAIL = filtered[1] ?? "scastrosoria@gmail.com";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

async function getCookieHeader(email) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;

  const jar = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => jar,
        setAll: (cookies) => {
          for (const c of cookies) {
            const i = jar.findIndex((x) => x.name === c.name);
            if (i >= 0) jar[i] = c;
            else jar.push(c);
          }
        },
      },
    }
  );
  const { error: otpErr } = await supabase.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: "email",
  });
  if (otpErr) throw otpErr;
  return jar.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
}

async function main() {
  console.log(`\n🧹 Cleanup legacy campaigns — ${BASE}`);
  console.log(`Modo: ${apply ? "APLICAR (dryRun=false)" : "DRY RUN (solo listar)"}\n`);

  const cookie = await getCookieHeader(EMAIL);

  const listRes = await fetch(`${BASE}/api/dev/cleanup-legacy-campaigns`, {
    headers: { Cookie: cookie },
  });
  const list = await listRes.json();
  if (!listRes.ok) {
    console.error("Error listando:", list.message ?? listRes.status);
    process.exit(1);
  }

  console.log(`Objetivo más reciente: ${list.latestObjectiveId}\n`);
  console.log("Campañas ACTIVE legacy a pausar:");
  if (list.wouldPause?.length === 0) {
    console.log("  (ninguna)\n");
  } else {
    for (const c of list.wouldPause ?? []) {
      console.log(
        `  • ${c.campaignName} [${c.campaignId.slice(0, 8)}…] — ${c.reason}`
      );
    }
    console.log();
  }

  console.log("Todas las legacy (incl. PAUSED de objetivos viejos):");
  for (const c of list.legacyCampaigns ?? []) {
    console.log(
      `  • ${c.campaignName} | ${c.status} | obj ${c.objectiveId.slice(0, 8)}… | ${c.reason}`
    );
  }

  if (!apply) {
    console.log(
      "\n⚠️  Dry run — para aplicar: node scripts/cleanup-legacy-campaigns.mjs --apply\n"
    );
    return;
  }

  const applyRes = await fetch(`${BASE}/api/dev/cleanup-legacy-campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ dryRun: false, targetStatus: "PAUSED" }),
  });
  const result = await applyRes.json();
  if (!applyRes.ok) {
    console.error("Error aplicando:", result.message ?? applyRes.status);
    process.exit(1);
  }

  console.log(`\n✅ ${result.message}`);
  for (const p of result.paused ?? []) {
    console.log(`  Pausada: ${p.campaignName} — ${p.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
