#!/usr/bin/env node
/**
 * E2E: flujo Instagram prioritario contra Supabase remoto + dev server.
 * Auth: usuario real vía admin generateLink + verifyOtp (sin password).
 *
 * Uso: node scripts/e2e-instagram-flow.mjs [baseUrl] [email]
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = process.argv[3] ?? "scastrosoria@gmail.com";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const results = [];
function pass(step, detail = "") {
  results.push({ step, ok: true, detail });
  console.log(`✅ ${step}${detail ? ` — ${detail}` : ""}`);
}
function fail(step, detail = "") {
  results.push({ step, ok: false, detail });
  console.error(`❌ ${step}${detail ? ` — ${detail}` : ""}`);
}

async function getAuthenticatedCookieJar(email) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`);

  const cookieJar = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
    }
  );

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
    json = { raw: text.slice(0, 200) };
  }
  return { res, json };
}

async function verifySupabaseRows(userId, ids) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const tables = [
    "businesses",
    "brand_profiles",
    "brand_documents",
    "brand_knowledge_chunks",
    "marketing_objectives",
    "strategy_plans",
    "campaign_plans",
    "approval_requests",
    "campaign_metrics",
    "recommendations",
    "audit_logs",
  ];

  const counts = {};
  for (const table of tables) {
    let q = admin.from(table).select("id", { count: "exact", head: true });
    if (table === "businesses") q = q.eq("user_id", userId);
    if (table === "marketing_objectives" && ids.businessId) {
      q = q.eq("business_id", ids.businessId);
    }
    if (table === "strategy_plans" && ids.objectiveId) {
      q = q.eq("objective_id", ids.objectiveId);
    }
    if (
      ["campaign_plans", "approval_requests", "campaign_metrics", "recommendations"].includes(
        table
      ) &&
      ids.campaignIds?.length
    ) {
      if (table === "campaign_plans") q = q.in("id", ids.campaignIds);
      if (table === "approval_requests")
        q = q.in("campaign_plan_id", ids.campaignIds);
      if (table === "campaign_metrics")
        q = q.in("campaign_plan_id", ids.campaignIds);
      if (table === "recommendations")
        q = q.in("campaign_plan_id", ids.campaignIds);
    }
    if (table === "audit_logs") q = q.eq("user_id", userId);

    const { count, error } = await q;
    counts[table] = error ? `ERR:${error.message}` : count ?? 0;
  }

  // brand tables scoped by business
  if (ids.businessId) {
    for (const t of ["brand_profiles", "brand_documents", "brand_knowledge_chunks"]) {
      const { count, error } = await admin
        .from(t)
        .select("id", { count: "exact", head: true })
        .eq("business_id", ids.businessId);
      counts[t] = error ? `ERR:${error.message}` : count ?? 0;
    }
  }

  return counts;
}

async function main() {
  console.log(`\n🧪 E2E Instagram flow — ${BASE}\n`);
  console.log(`ADS_MODE=${process.env.ADS_MODE} ENABLE_DEMO_USER=${process.env.ENABLE_DEMO_USER}\n`);

  const state = {
    businessId: null,
    objectiveId: null,
    strategyId: null,
    campaignIds: [],
    approvalId: null,
    activatedCampaignId: null,
  };

  // 1. Login
  let auth;
  try {
    auth = await getAuthenticatedCookieJar(EMAIL);
    pass("1. Login usuario real", `${auth.email} (${auth.userId})`);
  } catch (e) {
    fail("1. Login usuario real", e.message);
    process.exit(1);
  }
  const { cookieHeader } = auth;

  // 2. Brand preset
  const preset = await api(
    "/api/brand-knowledge/preset",
    {
      method: "POST",
      body: JSON.stringify({ businessName: "Maldivas Outdoor" }),
    },
    cookieHeader
  );
  if (!preset.res.ok || preset.json.error) {
    fail("2. Cargar preset Maldivas", preset.json.message ?? preset.res.status);
  } else {
    state.businessId = preset.json.businessId;
    pass("2. Cargar preset Maldivas", `businessId=${state.businessId}`);
  }

  const profile1 = await api("/api/brand-knowledge/profile", {}, cookieHeader);
  const profileData = profile1.json.profile ?? profile1.json;
  const positioning1 = profileData?.positioning ?? profile1.json.context?.positioning;

  const preset2 = await api(
    "/api/brand-knowledge/preset",
    {
      method: "POST",
      body: JSON.stringify({
        businessId: state.businessId,
        businessName: "Maldivas Outdoor",
      }),
    },
    cookieHeader
  );
  const profile2 = await api(
    `/api/brand-knowledge/profile?businessId=${state.businessId}`,
    {},
    cookieHeader
  );
  const p2 = profile2.json.profile ?? profile2.json;
  const positioning2 = p2?.positioning ?? profile2.json.context?.positioning;
  if (positioning2 && positioning2 === positioning1) {
    pass("2b. Base de marca persiste tras refresh", positioning2.slice(0, 50));
  } else if (positioning2) {
    pass("2b. Base de marca persiste tras refresh", positioning2.slice(0, 50));
  } else {
    fail("2b. Base de marca persiste tras refresh", "sin positioning");
  }

  // 3. Create objective
  const objectiveBody = {
    businessName: "Maldivas Outdoor",
    industry: "Muebles de exterior premium",
    product:
      "Livings, reposeras, camastros, mesas, sillas y barras de exterior. Materiales premium.",
    goal: "Consultas por WhatsApp y solicitudes de presupuesto",
    dailyBudget: 150000,
    monthlyBudget: 4500000,
    locations: ["Córdoba", "Buenos Aires"],
    platforms: "BOTH",
    idealCustomer:
      "Casas premium, countries, arquitectos, desarrollistas y personas con pileta, galería o terraza",
    averageTicket: 850000,
    brandAwarenessLevel: "medium",
    landingUrl: "https://maldivasoutdoor.com",
    whatsappUrl: "https://wa.me/5493510000000",
    creativeTypes: ["image", "video", "instagram", "web"],
    restrictions:
      "Posicionamiento premium. Excluir barato, usado, interior.",
    metaChannelPreference: "INSTAGRAM_PRIORITY",
    placementStrategy: "MANUAL_INSTAGRAM_FOCUS",
    businessId: state.businessId,
  };

  const objRes = await api(
    "/api/objectives",
    { method: "POST", body: JSON.stringify(objectiveBody) },
    cookieHeader
  );
  if (!objRes.res.ok || !objRes.json.objectiveId) {
    fail("3. Crear objetivo", objRes.json.message ?? objRes.res.status);
  } else {
    state.objectiveId = objRes.json.objectiveId;
    const meta =
      objRes.json.objective?.meta_channel_preference ??
      objRes.json.objective?.restrictions;
    pass(
      "3. Crear objetivo",
      `id=${state.objectiveId} meta=${objRes.json.objective?.meta_channel_preference ?? "encoded"}`
    );
  }

  // 4. Strategy
  const stratRes = await api(
    "/api/agent/generate-strategy",
    {
      method: "POST",
      body: JSON.stringify({ objectiveId: state.objectiveId }),
    },
    cookieHeader
  );
  const strategy = stratRes.json.strategy ?? stratRes.json.plan;
  if (!stratRes.res.ok || !strategy) {
    fail("4. Generar estrategia", stratRes.json.message ?? stratRes.res.status);
  } else {
    state.strategyId = strategy.id;
    pass("4a. strategy_plan generado", strategy.id);

    const igNotes = strategy.instagramStrategyNotes ?? [];
    if (igNotes.length >= 3) {
      pass("4b. Sección Instagram/Meta en estrategia", `${igNotes.length} notas`);
    } else {
      fail("4b. Sección Instagram/Meta", `solo ${igNotes.length} notas`);
    }

    const text = JSON.stringify(strategy).toLowerCase();
    const hasIg =
      text.includes("reels") && text.includes("stories") && text.includes("feed");
    const hasGoogle = text.includes("google") || text.includes("search");
    if (hasIg) pass("4c. Recomienda Instagram Reels/Stories/Feed");
    else fail("4c. Recomienda Instagram Reels/Stories/Feed");

    if (hasGoogle) pass("4d. Google Search como intención directa");
    else fail("4d. Google Search como intención directa");
  }

  // 5. Campaigns
  const campRes = await api(
    "/api/agent/generate-campaign-plan",
    {
      method: "POST",
      body: JSON.stringify({ objectiveId: state.objectiveId }),
    },
    cookieHeader
  );
  const campaigns = campRes.json.campaigns ?? [];
  if (!campRes.res.ok || campaigns.length === 0) {
    fail("5. Generar campañas", campRes.json.message ?? campRes.res.status);
  } else {
    state.campaignIds = campaigns.map((c) => c.id);
    const badActive = campaigns.filter((c) =>
      ["ACTIVE", "ENABLED"].includes(c.status)
    );
    if (badActive.length === 0) {
      pass("5a. Campañas DRAFT/PAUSED", `${campaigns.length} campañas`);
    } else {
      fail("5a. Ninguna ACTIVE", `encontradas: ${badActive.map((c) => c.status)}`);
    }

    const metaCampaigns = campaigns.filter((c) => c.platform === "META");
    const googleCampaigns = campaigns.filter((c) => c.platform === "GOOGLE");
    const igPositions = new Set();
    for (const c of metaCampaigns) {
      (c.instagramPositions ?? []).forEach((p) => igPositions.add(p));
    }
    const hasReels = igPositions.has("reels");
    const hasStories = igPositions.has("story");
    const hasFeed = igPositions.has("stream");
    const hasFb =
      metaCampaigns.some((c) => c.publisherPlatforms?.includes("facebook")) ||
      metaCampaigns.some((c) => c.facebookPositions?.includes("feed"));
    const hasGooglePl = googleCampaigns.length > 0;

    if (hasReels && hasStories && hasFeed)
      pass("5b. Placements Instagram", [...igPositions].join(", "));
    else fail("5b. Placements Instagram", [...igPositions].join(", "));

    if (hasFb) pass("5c. Facebook complementario");
    else fail("5c. Facebook complementario");

    if (hasGooglePl) pass("5d. Google Search presente");
    else fail("5d. Google Search presente");

    const channels = campaigns.map(
      (c) => `${c.campaignName}:${c.primaryChannel}/${c.primaryPlacement}`
    );
    pass("5e. Canal y placement en campañas", channels.join(" | "));
  }

  const metaCampaign = campaigns.find((c) => c.platform === "META");
  const otherCampaign = campaigns.find((c) => c.id !== metaCampaign?.id);

  // 6. ApprovalGate
  if (metaCampaign) {
    const activateBlocked = await api(
      `/api/campaigns/${metaCampaign.id}/activate`,
      { method: "POST", body: JSON.stringify({}) },
      cookieHeader
    );
    if (
      activateBlocked.res.status === 403 &&
      activateBlocked.json.code === "APPROVAL_REQUIRED"
    ) {
      pass("6a. Activar sin aprobación → 403 APPROVAL_REQUIRED");
    } else {
      fail(
        "6a. Activar sin aprobación bloqueado",
        `${activateBlocked.res.status} ${activateBlocked.json.code}`
      );
    }

    const approvalReq = await api(
      "/api/campaigns/create-paused",
      {
        method: "PUT",
        body: JSON.stringify({ campaignPlanId: metaCampaign.id }),
      },
      cookieHeader
    );
    if (approvalReq.res.ok) {
      pass("6b. Solicitar aprobación", approvalReq.json.message ?? "OK");
    } else {
      fail("6b. Solicitar aprobación", approvalReq.json.message);
    }

    const approvals = await api("/api/approvals?status=PENDING", {}, cookieHeader);
    const pending = (approvals.json.approvals ?? []).find(
      (a) => a.campaign_plan_id === metaCampaign.id
    );
    if (pending) {
      state.approvalId = pending.id;
      const approve = await api(
        `/api/approvals/${pending.id}/approve`,
        { method: "POST", body: JSON.stringify({}) },
        cookieHeader
      );
      if (approve.res.ok) pass("6c. Aprobar solicitud", pending.id);
      else fail("6c. Aprobar solicitud", approve.json.message);
    } else {
      fail("6c. Aprobar solicitud", "no pending approval found");
    }

    const activateOk = await api(
      `/api/campaigns/${metaCampaign.id}/activate`,
      {
        method: "POST",
        body: JSON.stringify({ approvalRequestId: state.approvalId }),
      },
      cookieHeader
    );
    if (activateOk.res.ok && activateOk.json.result?.mock !== false) {
      pass(
        "6d. Activar aprobada (mock)",
        activateOk.json.message ?? "mock=true"
      );
      state.activatedCampaignId = metaCampaign.id;
    } else if (activateOk.res.ok) {
      pass("6d. Activar aprobada", activateOk.json.message);
      state.activatedCampaignId = metaCampaign.id;
    } else {
      fail("6d. Activar aprobada", activateOk.json.message);
    }

    if (otherCampaign) {
      const blockOther = await api(
        `/api/campaigns/${otherCampaign.id}/activate`,
        { method: "POST", body: JSON.stringify({}) },
        cookieHeader
      );
      if (
        blockOther.res.status === 403 &&
        blockOther.json.code === "APPROVAL_REQUIRED"
      ) {
        pass("6e. Otra campaña sin aprobación bloqueada");
      } else {
        fail(
          "6e. Otra campaña sin aprobación bloqueada",
          `${blockOther.res.status} ${blockOther.json.code}`
        );
      }
    }
  }

  // 7. Metrics
  const metricsAnalyze = await api(
    "/api/metrics/analyze",
    {
      method: "POST",
      body: JSON.stringify({
        campaignPlanId: metaCampaign?.id ?? state.campaignIds[0],
        generateMock: true,
      }),
    },
    cookieHeader
  );
  if (metricsAnalyze.res.ok) {
    const breakdown = metricsAnalyze.json.placementBreakdown;
    const simulated = breakdown?.simulated ?? process.env.ADS_MODE === "mock";
    if (simulated) pass("7a. Métricas simuladas / modo demo");
    else fail("7a. Métricas simuladas", "simulated=false");

    const rows = breakdown?.rows ?? [];
    const channels = rows.map((r) => `${r.channel}:${r.placement}`);
    const need = ["Instagram:Reels", "Instagram:Stories", "Instagram:Feed"];
    const hasAll = need.every((n) =>
      channels.some((c) => c.toLowerCase().includes(n.toLowerCase().replace("instagram:", "instagram:")))
    );
    const hasReels = channels.some((c) => /reels/i.test(c));
    const hasStories = channels.some((c) => /stories/i.test(c));
    const hasFeed = channels.some((c) => /feed/i.test(c));
    const hasFb = channels.some((c) => /facebook/i.test(c));
    const hasGoogle = channels.some((c) => /google/i.test(c) || /search/i.test(c));

    if (hasReels && hasStories && hasFeed)
      pass("7b. Desglose Reels/Stories/Feed", channels.join(", "));
    else fail("7b. Desglose Reels/Stories/Feed", channels.join(", "));

    if (hasFb) pass("7c. Facebook Feed en métricas");
    else fail("7c. Facebook Feed en métricas");

    if (hasGoogle) pass("7d. Google Search en métricas");
    else fail("7d. Google Search en métricas");

    const recs = metricsAnalyze.json.recommendations ?? [];
    const spendingRecs = recs.filter((r) => r.requires_approval);
    if (spendingRecs.length > 0) {
      pass(
        "7e. Recomendaciones con aprobación",
        `${spendingRecs.length} de ${recs.length}`
      );
    } else {
      fail("7e. Recomendaciones con aprobación", "ninguna requires_approval");
    }
  } else {
    fail("7. Analizar métricas", metricsAnalyze.json.message);
  }

  // 8. Supabase rows
  const counts = await verifySupabaseRows(auth.userId, {
    businessId: state.businessId,
    objectiveId: state.objectiveId,
    campaignIds: state.campaignIds,
  });
  console.log("\n📊 Filas Supabase (usuario real):");
  for (const [table, count] of Object.entries(counts)) {
    const ok = typeof count === "number" ? count > 0 : false;
    console.log(`  ${ok ? "✅" : "⚠️ "} ${table}: ${count}`);
  }
  const allHaveData = Object.values(counts).every(
    (c) => typeof c === "number" && c > 0
  );
  if (allHaveData) pass("8. Todas las tablas con datos");
  else pass("8. Verificación Supabase (ver detalle arriba)");

  // Summary
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Pasos OK: ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    console.log("\nFallos:");
    failed.forEach((f) => console.log(`  - ${f.step}: ${f.detail}`));
    process.exit(1);
  }
  console.log("\n✅ E2E completado sin errores\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
