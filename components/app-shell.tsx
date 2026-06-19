"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  UserSearch,
  Users,
  ShieldCheck,
  Menu,
  LogOut,
  Activity,
  Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { TutorProvider } from "@/components/tutor/tutor-provider";
import { GuideRail } from "@/components/trilha/guide-rail";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { href: "/trilha", label: "Trilha de Aprendizado", icon: Map, roles: ["exec", "admin", "cs"] },
  { href: "/dashboard", label: "Dashboard Executivo", icon: LayoutDashboard, roles: ["exec", "admin", "cs"] },
  { href: "/eda", label: "EDA Interativa", icon: BarChart3, roles: ["exec", "admin", "cs"] },
  { href: "/individual", label: "Consulta Individual", icon: UserSearch, roles: ["cs", "admin", "exec"] },
  { href: "/carteira", label: "Visão de Carteira", icon: Users, roles: ["cs", "admin", "exec"] },
  {
    href: "/principios-de-personalizacao",
    label: "Princípios (LGPD)",
    icon: ShieldCheck,
    roles: ["cs", "admin", "exec"],
  },
];

const ROLE_LABEL: Record<UserRole, string> = {
  cs: "Customer Success",
  exec: "Liderança",
  admin: "Administrador",
};

function NavLinks({
  role,
  pathname,
  onNavigate,
}: {
  role: UserRole;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const prominent = item.roles[0] === role;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[var(--accent-light)] font-semibold text-[var(--primary-deep)]"
                : "text-[var(--steel)] hover:bg-[var(--paper-soft)] hover:text-[var(--ink)]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {prominent && !active && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] text-[var(--paper)]">
        <Activity className="h-4 w-4" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-base font-semibold text-[var(--ink)]">Vitaliza</span>
      </span>
    </Link>
  );
}

export function AppShell({
  role,
  email,
  children,
}: {
  role: UserRole;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  async function logout() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  const initials = (email ?? "VZ").slice(0, 2).toUpperCase();

  return (
    <TutorProvider>
    <div className="flex min-h-screen flex-col">
      {/* Top bar (dark ink header) */}
      <header className="no-print sticky top-0 z-30 border-b border-[var(--primary-deep)] bg-[var(--ink)] text-[var(--paper)]">
        <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[var(--paper)] hover:bg-white/10 lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir navegação</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-[var(--paper)] p-0">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <div className="border-b border-[var(--rule)] px-4 py-4">
                <Brand />
              </div>
              <div className="px-3 py-4">
                <NavLinks role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden shrink-0 items-center lg:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
              <Activity className="h-4 w-4" />
            </span>
            <div className="ml-2.5 flex flex-col leading-none">
              <span className="font-display text-base font-semibold">Vitaliza</span>
            </div>
          </div>

          <p className="min-w-0 flex-1 truncate px-1 text-center font-display text-[13px] font-semibold tracking-tight text-[var(--paper)] sm:text-base lg:text-lg">
            Sistema de Inteligência de Retenção
          </p>

          <div className="flex shrink-0 items-center gap-3">
            {email ? (
              <>
                <Badge variant="outline" className="border-white/25 text-[var(--paper)]">
                  {ROLE_LABEL[role]}
                </Badge>
                <div className="hidden items-center gap-2 sm:flex">
                  <Avatar className="h-8 w-8 bg-[var(--accent)]">
                    <AvatarFallback className="bg-[var(--accent)] text-white">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-[12rem] truncate text-sm text-[var(--cloud)]">{email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-[var(--paper)] hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </>
            ) : (
              <span aria-hidden className="w-9 shrink-0 lg:hidden" />
            )}
          </div>
        </div>
      </header>

      {/* Faixa de proposta de valor (todas as páginas) */}
      <div className="no-print border-b border-[var(--rule)] bg-[var(--paper)]">
        <div className="mx-auto max-w-3xl px-4 py-2.5 text-center">
          <p className="text-xs leading-relaxed text-[var(--steel)] sm:text-sm">
            Risco de churn por usuário, explicação individual com SHAP e recomendação prescritiva,
            tudo auditável de ponta a ponta.
          </p>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="no-print hidden w-64 shrink-0 border-r border-[var(--rule)] bg-[var(--paper)] lg:block">
          <div className="sticky top-14 px-3 py-5">
            <NavLinks role={role} pathname={pathname} />
            <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--rule)] bg-[var(--paper-soft)] p-3">
              <p className="eyebrow mb-1">Política</p>
              <p className="text-xs leading-relaxed text-[var(--steel)]">
                Membros &quot;cão que dorme&quot; são excluídos de campanhas proativas
                (não-intrusão).
              </p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 bg-[var(--paper-soft)]">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>

      {/* Painel-guia da Trilha — aparece quando há ?trilha=<id> na URL.
          Suspense exigido pelo useSearchParams (Next 16). */}
      <React.Suspense fallback={null}>
        <GuideRail />
      </React.Suspense>
    </div>
    </TutorProvider>
  );
}
