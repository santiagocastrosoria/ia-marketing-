#!/usr/bin/env node
/**
 * Valida integración Meta/Instagram en ADS_MODE=read_only.
 * Solo lectura — no crea, edita, activa ni pausa campañas reales.
 *
 * Requisitos:
 *   - Dev server corriendo (npm run dev)
 *   - .env.local con ADS_MODE=read_only y credenciales Meta
 *
 * Uso: node scripts/test-meta-readonly.mjs [baseUrl] [email]
 *      node scripts/test-meta-readonly.mjs --skip-build
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const BASE = args[0] ?? "http://localhost:3000";
const EMAIL = args[1] ?? "scastrosoria@gmail.com";
const SKIP_BUILD = process.argv.includes("--skip-build");

const results = [];
const report = {
  adsMode: null,
  serverAdsMode: null,
  metaStatus: null,
  adAccountId: null,
  adAccountName: null,
  campaignCount: 0,
  insightRowCount: 0,
  placements: [],
  writeBlocked: { createPaused: false, activate: false, metaPlacements: false },
  permissionErrors: [],
  missingCredentials: [],
};

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    console.warn("⚠️  No se encontró .env.local — usando variables de entorno del sistema.");
  }
}

loadEnv();

function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`✅ ${step}${detail ? ` — ${detail}` : ""}`);
}

function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`❌ ${step}${detail ? ` — ${detail}` : ""}`);
}

function warn(step, detail = "") {
  results.push({ step, ok: true, detail, warn: true });
  console.log(`⚠️  ${step}${detail ? ` — ${detail}` : ""}`);
}

function normalizeAdAccountId(raw) {
  if (!raw?.trim()) return null;
  const id = raw.trim().replace(/^act_/, "");
  return id ? `act_${id}` : null;
}

function validateEnvVars() {
  console.log("\n📋 Validación de variables de entorno\n");

  const adsMode = (process.env.ADS_MODE ?? process.env.NEXT_PUBLIC_ADS_MODE ?? "mock")
    .trim()
    .toLowerCase();
  report.adsMode = adsMode;

  if (adsMode === "read_only") {
    pass("ADS_MODE=read_only");
  } else {
    fail(
      "ADS_MODE=read_only",
      `Actual: ${adsMode}. Configurá ADS_MODE=read_only en .env.local y reiniciá el dev server.`
    );
  }

  const hasToken = !!process.env.META_ACCESS_TOKEN?.trim();
  const hasAdAccount = !!normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID);
  const hasAppId = !!process.env.META_APP_ID?.trim();
  const hasAppSecret = !!process.env.META_APP_SECRET?.trim();

  if (hasToken) pass("META_ACCESS_TOKEN presente");
  else {
    fail("META_ACCESS_TOKEN presente", "falta");
    report.missingCredentials.push("META_ACCESS_TOKEN");
  }

  if (hasAdAccount) {
    pass("META_AD_ACCOUNT_ID presente", normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID));
  } else {
    fail("META_AD_ACCOUNT_ID presente", "falta");
    report.missingCredentials.push("META_AD_ACCOUNT_ID");
  }

  if (hasAppId) pass("META_APP_ID (opcional)", "configurado");
  else warn("META_APP_ID (opcional)", "no configurado");

  if (hasAppSecret) pass("META_APP_SECRET (opcional)", "configurado (servidor)");
  else warn("META_APP_SECRET (opcional)", "no configurado");

  return { adsMode, hasCredentials: hasToken && hasAdAccount };
}

async function getAuthenticatedCookieJar(email) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !service) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`);

  const cookieJar = [];
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieJar;
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) {
          const i = cookieJar.findIndex((x) => x.name === c.name);
          if (i >= 0) cookieJar[i] = c;
          else cookieJar.push(c);
        }
      },
    },
  });

  const { error: otpErr } = await supabase.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "email",
  });
  if (otpErr) throw new Error(`verifyOtp: ${otpErr.message}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No user after OTP");

  const cookieHeader = cookieJar
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");

  return { cookieHeader, userId: user.id, email: user.email };
}

async function api(path, options = {}, cookieHeader) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { res, json, status: res.status };
}

function detectPermissionError(json) {
  const msg = [json.message, json.details, JSON.stringify(json.details ?? "")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const scopeHints = [
    "permission",
    "permissions",
    "oauth",
    "ads_read",
    "read_insights",
    "access token",
    "scope",
    "(#200)",
    "(#10)",
  ];

  if (scopeHints.some((h) => msg.includes(h))) {
    return json.message ?? json.details ?? "Error de permisos Meta";
  }
  return null;
}

function collectPlacements(rows) {
  const set = new Set();
  for (const row of rows ?? []) {
    const channel = row.channel ?? "Unknown";
    const placement = row.placement ?? row.platform_position ?? "Other";
    set.add(`${channel} / ${placement}`);
  }
  return [...set].sort();
}

function checkExpectedPlacements(placements) {
  const joined = placements.join(" ").toLowerCase();
  const checks = [
    { label: "Instagram Reels", match: /instagram.*reels|reels/i.test(joined) },
    { label: "Instagram Stories", match: /instagram.*stories|stories/i.test(joined) },
    { label: "Instagram Feed", match: /instagram.*feed|feed/i.test(joined) },
    { label: "Facebook Feed", match: /facebook.*feed/i.test(joined) },
  ];

  for (const c of checks) {
    if (placements.length === 0) {
      warn(`Placement: ${c.label}`, "sin datos de insights — no verificable");
    } else if (c.match) {
      pass(`Placement detectado: ${c.label}`);
    } else {
      warn(
        `Placement: ${c.label}`,
        "no encontrado en insights (puede no haber gasto en ese placement)"
      );
    }
  }

  const known = /instagram|facebook|google/i;
  const otherLike = placements.filter((p) => !known.test(p));
  if (otherLike.length > 0) {
    warn("Placements Other / no mapeados", otherLike.join(", "));
  }
}

async function testWriteBlocked(cookieHeader, campaignPlanId) {
  console.log("\n🔒 Validación de seguridad (escritura bloqueada)\n");

  if (!campaignPlanId) {
    warn("Seguridad: create-paused", "sin campaignPlanId — omitido");
  } else {
    const create = await api(
      "/api/campaigns/create-paused",
      {
        method: "POST",
        body: JSON.stringify({ campaignPlanId }),
      },
      cookieHeader
    );
    if (create.status === 403 && create.json.code === "READ_ONLY_MODE") {
      pass("POST create-paused bloqueado", "403 READ_ONLY_MODE");
      report.writeBlocked.createPaused = true;
    } else {
      fail(
        "POST create-paused bloqueado",
        `esperado 403 READ_ONLY_MODE, recibido ${create.status} ${create.json.code ?? ""}`
      );
    }
  }

  if (campaignPlanId) {
    const activate = await api(
      `/api/campaigns/${campaignPlanId}/activate`,
      { method: "POST", body: JSON.stringify({}) },
      cookieHeader
    );
    if (activate.status === 403 && activate.json.code === "READ_ONLY_MODE") {
      pass("POST activate bloqueado", "403 READ_ONLY_MODE");
      report.writeBlocked.activate = true;
    } else if (
      activate.status === 403 &&
      (activate.json.code === "APPROVAL_REQUIRED" || activate.json.code === "NOT_APPROVED")
    ) {
      fail(
        "POST activate bloqueado",
        `${activate.json.code} — el guard read_only debería ejecutarse antes del ApprovalGate`
      );
    } else {
      fail(
        "POST activate bloqueado",
        `esperado 403 READ_ONLY_MODE, recibido ${activate.status} ${activate.json.code ?? ""}`
      );
    }

    const placements = await api(
      `/api/campaigns/${campaignPlanId}/meta-placements`,
      {
        method: "PATCH",
        body: JSON.stringify({ placementStrategy: "instagram_priority" }),
      },
      cookieHeader
    );
    if (placements.status === 403 && placements.json.code === "READ_ONLY_MODE") {
      pass("PATCH meta-placements bloqueado", "403 READ_ONLY_MODE");
      report.writeBlocked.metaPlacements = true;
    } else {
      fail(
        "PATCH meta-placements bloqueado",
        `esperado 403 READ_ONLY_MODE, recibido ${placements.status} ${placements.json.code ?? ""}`
      );
    }
  }
}

function printReport() {
  console.log(`\n${"=".repeat(56)}`);
  console.log("📊 REPORTE — Meta/Instagram read_only");
  console.log("=".repeat(56));
  console.log(`ADS_MODE (.env.local):     ${report.adsMode ?? "—"}`);
  console.log(`ADS_MODE (servidor API):   ${report.serverAdsMode ?? "—"}`);
  console.log(`Meta status:               ${report.metaStatus ?? "—"}`);
  console.log(`Ad Account ID:             ${report.adAccountId ?? "—"}`);
  console.log(`Ad Account name:           ${report.adAccountName ?? "—"}`);
  console.log(`Campañas reales leídas:    ${report.campaignCount}`);
  console.log(`Filas de insights:         ${report.insightRowCount}`);
  console.log(
    `Placements encontrados:    ${report.placements.length ? report.placements.join(" | ") : "(ninguno)"}`
  );
  console.log(
    `Escritura bloqueada:       create=${report.writeBlocked.createPaused ? "✓" : "✗"} activate=${report.writeBlocked.activate ? "✓" : "✗"} placements=${report.writeBlocked.metaPlacements ? "✓" : "✗"}`
  );
  if (report.permissionErrors.length) {
    console.log("Errores de permisos/scopes:");
    for (const e of report.permissionErrors) console.log(`  - ${e}`);
  }
  if (report.missingCredentials.length) {
    console.log(`Credenciales faltantes:    ${report.missingCredentials.join(", ")}`);
  }
  console.log("=".repeat(56));
}

function runBuild() {
  if (SKIP_BUILD) {
    warn("npm run build", "omitido (--skip-build)");
    return true;
  }
  console.log("\n🔨 Ejecutando npm run build...\n");
  const r = spawnSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });
  if (r.status === 0) {
    pass("npm run build");
    return true;
  }
  fail("npm run build", `exit code ${r.status}`);
  return false;
}

async function main() {
  console.log(`\n🔍 Test Meta read_only — ${BASE} — ${EMAIL}\n`);

  const { adsMode, hasCredentials } = validateEnvVars();

  if (!hasCredentials) {
    console.log(
      "\n⛔ Faltan credenciales Meta. Configurá META_ACCESS_TOKEN y META_AD_ACCOUNT_ID."
    );
    console.log("   El script termina sin error fatal.\n");
    printReport();
    const buildOk = runBuild();
    process.exit(buildOk ? 0 : 1);
  }

  try {
    const health = await fetch(BASE, { method: "GET" });
    if (health.ok || health.status === 404 || health.status === 307) {
      pass("Dev server accesible", BASE);
    } else {
      fail("Dev server accesible", `HTTP ${health.status}`);
    }
  } catch (e) {
    fail("Dev server accesible", e.message);
    console.error("\n💡 Iniciá el servidor: npm run dev\n");
    printReport();
    process.exit(1);
  }

  let cookieHeader;
  try {
    const auth = await getAuthenticatedCookieJar(EMAIL);
    cookieHeader = auth.cookieHeader;
    pass("Autenticación Supabase", auth.email);
  } catch (e) {
    fail("Autenticación Supabase", e.message);
    printReport();
    process.exit(1);
  }

  console.log("\n🌐 Endpoints Meta (solo lectura)\n");

  const statusRes = await api("/api/integrations/meta/status", {}, cookieHeader);
  if (statusRes.status === 200 && statusRes.json.error === false) {
    const meta = statusRes.json.meta ?? {};
    report.metaStatus = meta.status ?? "unknown";
    report.serverAdsMode = meta.adsMode ?? null;
    report.adAccountId = meta.adAccountIdMasked ?? meta.adAccountId ?? null;
    pass("GET /api/integrations/meta/status", `status=${meta.status}, adsMode=${meta.adsMode}`);

    if (meta.adsMode !== "read_only") {
      fail(
        "Servidor en read_only",
        `El servidor reporta adsMode=${meta.adsMode}. Reiniciá npm run dev con ADS_MODE=read_only.`
      );
    } else {
      pass("Servidor en read_only");
    }
  } else {
    fail(
      "GET /api/integrations/meta/status",
      `${statusRes.status} ${statusRes.json.code ?? statusRes.json.message ?? ""}`
    );
  }

  const intStatus = await api("/api/integrations/status", {}, cookieHeader);
  if (intStatus.json.adsMode) {
    report.serverAdsMode = intStatus.json.adsMode;
  }

  const testRes = await api("/api/integrations/meta/test", { method: "POST" }, cookieHeader);
  if (testRes.status === 200 && testRes.json.ok === true) {
    report.adAccountName = testRes.json.adAccount?.name ?? null;
    report.adAccountId =
      testRes.json.meta?.adAccountIdMasked ??
      testRes.json.adAccount?.id ??
      report.adAccountId;
    report.metaStatus = "connected";
    pass(
      "POST /api/integrations/meta/test",
      testRes.json.adAccount?.name ?? "conexión OK"
    );
  } else {
    const perm = detectPermissionError(testRes.json);
    if (perm) report.permissionErrors.push(perm);
    fail(
      "POST /api/integrations/meta/test",
      `${testRes.status} ${testRes.json.code ?? ""} — ${testRes.json.message ?? ""}`
    );
    if (testRes.json.details) {
      console.error("   details:", String(testRes.json.details).slice(0, 200));
    }
  }

  const campRes = await api("/api/integrations/meta/campaigns", {}, cookieHeader);
  if (campRes.status === 200 && campRes.json.error === false) {
    const campaigns = campRes.json.campaigns ?? [];
    report.campaignCount = campRes.json.count ?? campaigns.length;
    pass("GET /api/integrations/meta/campaigns", `${report.campaignCount} campaña(s)`);
    if (campaigns.length > 0) {
      const sample = campaigns.slice(0, 3).map((c) => c.name).join("; ");
      console.log(`   Muestra: ${sample}`);
    }
  } else {
    const perm = detectPermissionError(campRes.json);
    if (perm) report.permissionErrors.push(perm);
    fail(
      "GET /api/integrations/meta/campaigns",
      `${campRes.status} ${campRes.json.code ?? ""} — ${campRes.json.message ?? ""}`
    );
  }

  const insRes = await api(
    "/api/integrations/meta/insights?datePreset=last_30d",
    {},
    cookieHeader
  );
  if (insRes.status === 200 && insRes.json.error === false) {
    const rows = insRes.json.rows ?? [];
    report.insightRowCount = rows.length;
    report.placements = collectPlacements(rows);
    if (rows.length > 0) {
      pass("GET /api/integrations/meta/insights", `${rows.length} fila(s)`);
      checkExpectedPlacements(report.placements);
    } else {
      warn(
        "GET /api/integrations/meta/insights",
        insRes.json.message ?? "0 filas — sin gasto en el período o cuenta vacía"
      );
    }
  } else {
    const perm = detectPermissionError(insRes.json);
    if (perm) report.permissionErrors.push(perm);
    fail(
      "GET /api/integrations/meta/insights",
      `${insRes.status} ${insRes.json.code ?? ""} — ${insRes.json.message ?? ""}`
    );
  }

  let campaignPlanId = null;
  const dash = await api("/api/dashboard", {}, cookieHeader);
  if (dash.status === 200) {
    const campaigns = dash.json.campaigns ?? [];
    const metaPlan = campaigns.find((c) => c.platform === "META") ?? campaigns[0];
    campaignPlanId = metaPlan?.id ?? null;
    if (campaignPlanId) {
      pass("Campaign plan para test seguridad", metaPlan.campaignName ?? campaignPlanId);
    }
  }

  if (report.serverAdsMode === "read_only" || adsMode === "read_only") {
    await testWriteBlocked(cookieHeader, campaignPlanId);
  } else {
    warn("Test escritura bloqueada", "omitido — servidor no está en read_only");
  }

  printReport();

  const buildOk = runBuild();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPasos OK: ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    console.log("\nFallos:");
    failed.forEach((f) => console.log(`  - ${f.step}: ${f.detail}`));
    process.exit(1);
  }
  console.log("\n✅ Test Meta read_only completado\n");
  process.exit(buildOk ? 0 : 1);
}

main().catch((e) => {
  console.error("\n💥 Error fatal:", e.message);
  printReport();
  process.exit(1);
});
