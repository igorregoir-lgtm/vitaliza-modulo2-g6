"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push(redirectTo);
          router.refresh();
        } else {
          setNotice("Conta criada. Se a confirmação por e-mail estiver ativa, confirme antes de entrar.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-[var(--radius-md)] bg-[var(--tier-critico-bg)] px-3 py-2 text-sm text-[var(--tier-critico-text)]">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-[var(--radius-md)] bg-[var(--accent-light)] px-3 py-2 text-sm text-[var(--accent-deep)]">
          {notice}
        </p>
      )}

      <Button type="submit" variant="accent" disabled={loading} className="mt-1">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "login" ? "Entrar" : "Criar conta"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "login" ? "signup" : "login"));
          setError(null);
          setNotice(null);
        }}
        className="text-center text-sm text-[var(--steel)] hover:text-[var(--accent-deep)]"
      >
        {mode === "login" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Editorial dark panel */}
      <div className="relative hidden flex-col justify-between bg-[var(--ink)] p-10 text-[var(--paper)] lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
            <Activity className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold">Vitaliza</span>
        </div>
        <div className="max-w-md">
          <p className="eyebrow mb-3 text-[var(--steel-soft)]">Sistema de Inteligência de Retenção</p>
          <h1 className="font-display text-3xl font-semibold leading-tight">
            Prever, explicar e agir — sem acordar o cão que dorme.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--cloud)]">
            Risco de churn por usuário, explicação individual com SHAP e recomendação prescritiva,
            tudo auditável de ponta a ponta.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-[var(--steel-soft)]">
          <ShieldCheck className="h-4 w-4" />
          Conforme LGPD e Nota Técnica ANPD 07/2025.
        </p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-[var(--paper)] p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <span className="font-display text-xl font-semibold">Vitaliza</span>
            <p className="eyebrow mt-1">Inteligência de Retenção</p>
          </div>
          <h2 className="mb-1 text-xl font-semibold">Acesso ao sistema</h2>
          <p className="mb-6 text-sm text-[var(--steel)]">
            Entre para acessar o dashboard, a carteira e a consulta individual.
          </p>
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-xs text-[var(--steel)]">
            A{" "}
            <Link
              href="/principios-de-personalizacao"
              className="text-[var(--accent-deep)] underline-offset-2 hover:underline"
            >
              política de personalização
            </Link>{" "}
            é pública e não exige login.
          </p>
        </div>
      </div>
    </div>
  );
}
