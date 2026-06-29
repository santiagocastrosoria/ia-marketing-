"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Sparkles,
  Layers,
  ShieldCheck,
  BarChart3,
  Bot,
  BookOpen,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { isMockMode } from "@/lib/utils/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brand-knowledge", label: "Base de marca", icon: BookOpen },
  { href: "/objectives", label: "Crear objetivo", icon: Target },
  { href: "/strategy", label: "Estrategia", icon: Sparkles },
  { href: "/campaigns", label: "Campañas", icon: Layers },
  { href: "/approvals", label: "Aprobaciones", icon: ShieldCheck },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900">
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
        <Bot className="h-7 w-7 text-indigo-400" />
        <div>
          <h1 className="text-sm font-bold text-white">AI Marketing</h1>
          <p className="text-xs text-slate-400">Agent</p>
        </div>
      </div>

      {isMockMode() && (
        <div className="mx-4 mt-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
          <p className="text-xs font-medium text-amber-400">Modo demo/mock</p>
          <p className="text-[10px] text-amber-400/70">Sin APIs reales conectadas</p>
        </div>
      )}

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4 space-y-3">
        <p className="text-xs text-slate-500">
          Aprobación humana obligatoria antes de cualquier gasto.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
