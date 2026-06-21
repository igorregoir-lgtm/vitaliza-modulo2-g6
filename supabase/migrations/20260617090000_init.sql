-- ============================================================================
-- Vitaliza — Sistema de Inteligência de Retenção de Clientes
-- Migration 0001 — schema inicial (modelo de dados + RLS + auditoria)
-- Auditabilidade: ver docs/decisions/0009-auditabilidade.md
-- ============================================================================

-- ---------- Enums ----------
create type user_role           as enum ('cs','exec','admin');
create type risk_tier           as enum ('baixo','medio','alto','critico');
create type archetype           as enum ('preco_sensivel','desengajado_conteudo','early_dropper','sleeping_dog','concorrente_driven');
create type intervention_status as enum ('sugerida','aplicada','descartada','bloqueada');

-- ---------- Perfis (1-1 com auth.users) ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       user_role not null default 'cs',
  created_at timestamptz not null default now()
);

-- ---------- Base de clientes pontuados ----------
create table public.customer (
  id           bigint generated always as identity primary key,
  external_ref text unique,
  features     jsonb  not null,         -- snapshot anonimizado das variáveis do modelo
  true_churn   smallint,                -- ground truth do dataset (apenas auditoria/validação)
  created_at   timestamptz not null default now()
);

-- ---------- Scores (histórico permitido; usar o mais recente) ----------
create table public.score (
  id                bigint generated always as identity primary key,
  customer_id       bigint not null references public.customer(id) on delete cascade,
  churn_probability numeric(6,5) not null,
  risk_tier         risk_tier not null,
  archetype         archetype not null,
  proactive_allowed boolean not null default true,   -- false p/ sleeping_dog (guardrail)
  threshold         numeric(6,5) not null,
  model_version     text not null,
  created_at        timestamptz not null default now()
);
create index score_customer_idx on public.score(customer_id);
create index score_tier_idx     on public.score(risk_tier);
create index score_arch_idx     on public.score(archetype);
create index score_prob_idx     on public.score(churn_probability desc);

-- ---------- Explicações (SHAP local + narrativa LLM + recomendação) ----------
create table public.explanation (
  id             bigint generated always as identity primary key,
  score_id       bigint not null references public.score(id) on delete cascade,
  base_value     numeric,
  drivers        jsonb not null,        -- [{feature, shap_value, value, actionable, direction}]
  narrative      text,                  -- LLM Função A (cache)
  recommendation jsonb,                 -- LLM Função B {offer, channel, copy, timing}
  created_at     timestamptz not null default now()
);
create index explanation_score_idx on public.explanation(score_id);

-- ---------- Intervenções (ações tomadas) ----------
create table public.intervention (
  id          bigint generated always as identity primary key,
  customer_id bigint not null references public.customer(id) on delete cascade,
  archetype   archetype,
  offer       text,
  channel     text,
  copy        text,
  timing      text,
  status      intervention_status not null default 'sugerida',
  created_by  uuid references auth.users(id),
  outcome     text,
  created_at  timestamptz not null default now()
);
create index intervention_customer_idx on public.intervention(customer_id);

-- ---------- Log de auditoria (append-only; escrito via service_role) ----------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor       uuid,
  actor_email text,
  action      text not null,            -- ex.: 'predict','explain','recommend','apply_intervention'
  entity      text,
  entity_id   text,
  payload     jsonb,                    -- input anonimizado, score, threshold, model_version, etc.
  created_at  timestamptz not null default now()
);
create index audit_created_idx on public.audit_log(created_at desc);

-- ---------- Princípios de personalização (conteúdo público — LGPD/ANPD) ----------
create table public.principios (
  id         smallint primary key default 1,
  conteudo   jsonb not null,
  updated_at timestamptz not null default now(),
  constraint principios_singleton check (id = 1)
);

-- ---------- Trigger: cria profile no signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'cs')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- service_role (uso server-side) ignora RLS — usado p/ carga, scores e audit_log.
-- ============================================================================
alter table public.profiles     enable row level security;
alter table public.customer     enable row level security;
alter table public.score        enable row level security;
alter table public.explanation  enable row level security;
alter table public.intervention enable row level security;
alter table public.audit_log    enable row level security;
alter table public.principios   enable row level security;

-- profiles: cada usuário lê/atualiza o próprio
create policy "profiles_self_read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);

-- leitura autenticada da base/score/explicação
create policy "auth_read_customer"    on public.customer    for select to authenticated using (true);
create policy "auth_read_score"       on public.score       for select to authenticated using (true);
create policy "auth_read_explanation" on public.explanation for select to authenticated using (true);

-- intervenções: leitura autenticada; insert do próprio usuário; update autenticado
create policy "auth_read_intervention"   on public.intervention for select to authenticated using (true);
create policy "auth_insert_intervention" on public.intervention for insert to authenticated with check (auth.uid() = created_by);
create policy "auth_update_intervention" on public.intervention for update to authenticated using (true);

-- audit_log: leitura autenticada; inserts somente via service_role (sem policy de insert)
create policy "auth_read_audit" on public.audit_log for select to authenticated using (true);

-- princípios: leitura pública (página /principios-de-personalizacao acessível sem login)
create policy "public_read_principios" on public.principios for select using (true);

-- ---------- Conteúdo inicial dos princípios (LGPD/ANPD 07/2025) ----------
insert into public.principios (id, conteudo) values (1, jsonb_build_object(
  'titulo', 'Princípios de Personalização',
  'resumo', 'Como usamos dados de comportamento para reduzir o churn de forma transparente, proporcional e contestável.',
  'principios', jsonb_build_array(
    jsonb_build_object('nome','Finalidade','texto','Os dados comportamentais (frequência de uso, tipo de contrato, tempo de assinatura, participação em desafios) são usados exclusivamente para estimar risco de cancelamento e oferecer ações de retenção úteis ao usuário.'),
    jsonb_build_object('nome','Transparência','texto','Toda previsão é explicável: mostramos quais variáveis pesaram e em que direção. As explicações descrevem o comportamento do modelo, não relações de causa e efeito.'),
    jsonb_build_object('nome','Proporcionalidade','texto','No máximo 2 canais de contato simultâneos por pessoa; nenhuma oferta de desconto sem segmentação prévia.'),
    jsonb_build_object('nome','Não-intrusão','texto','Usuários de baixíssimo uso e vínculo longo (perfil "cão que dorme") são excluídos de qualquer campanha proativa, para respeitar quem não quer ser contatado.'),
    jsonb_build_object('nome','Contestação','texto','Qualquer pessoa pode solicitar revisão humana de uma decisão automatizada e a exclusão de seus dados do processo de personalização.'),
    jsonb_build_object('nome','Auditabilidade','texto','Cada previsão e cada ação ficam registradas (entrada anonimizada, score, versão do modelo, explicação, decisão) para auditoria e melhoria contínua.')
  ),
  'base_legal', 'LGPD (Lei 13.709/2018) e Nota Técnica ANPD 07/2025 sobre transparência em decisões automatizadas.'
));
