#!/usr/bin/env node
/**
 * Auditoría rápida de APIs protegidas (sin sesión → 401).
 * Uso: node scripts/audit-api.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

const PROTECTED_APIS = [
  "/api/dashboard",
  "/api/objectives",
  "/api/metrics",
  "/api/approvals",
  "/api/brand-knowledge/profile",
];

const PROTECTED_PAGES = [
  "/dashboard",
  "/campaigns",
  "/metrics",
];

async function checkApi(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { path, ok: false, reason: "non-json", status: res.status };
  }
  const pass =
    res.status === 401 &&
    json?.error === true &&
    (json?.code === "UNAUTHORIZED" || json?.code);
  return { path, pass, status: res.status, code: json?.code, message: json?.message };
}

async function checkPage(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const pass =
    (res.status === 307 || res.status === 308 || res.status === 302) &&
    location.includes("/login");
  return { path, pass, status: res.status, location };
}

async function main() {
  console.log(`\n🔍 Auth audit — ${BASE}\n`);

  console.log("APIs sin sesión (esperado: 401 JSON):");
  for (const path of PROTECTED_APIS) {
    const r = await checkApi(path);
    console.log(
      r.pass ? "  ✅" : "  ❌",
      path,
      `→ ${r.status}`,
      r.code ?? r.reason ?? ""
    );
  }

  console.log("\nPáginas sin sesión (esperado: redirect /login):");
  for (const path of PROTECTED_PAGES) {
    const r = await checkPage(path);
    console.log(
      r.pass ? "  ✅" : "  ❌",
      path,
      `→ ${r.status}`,
      r.location || ""
    );
  }

  console.log("\nLogin page (esperado: 200):");
  const login = await fetch(`${BASE}/login`);
  console.log(login.ok ? "  ✅ /login" : "  ❌ /login", login.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
