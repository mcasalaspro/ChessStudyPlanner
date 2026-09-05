-- ============================================================
-- Chess Study Planner — banco de dados (Supabase / PostgreSQL)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- Pode rodar mais de uma vez sem problemas.
-- ============================================================

-- Uma tabela só: cada linha é um "documento" (bloco de estudo, missão ou configurações)
-- que pertence a exatamente um usuário (user_id = id do usuário em Authentication).
create table if not exists public.study_records (
  id          text        not null,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('session', 'mission', 'settings')),
  doc         jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create index if not exists study_records_user_kind_idx on public.study_records (user_id, kind, updated_at);

-- ------------------------------------------------------------
-- Segurança: Row Level Security (RLS)
-- Com RLS ligado, NENHUMA linha é visível ou editável a não ser que uma
-- política permita. As políticas abaixo só liberam as linhas cujo user_id
-- é o próprio usuário logado (auth.uid()). Assim, mesmo que alguém tenha o
-- endereço do projeto e a chave "anon" (que ficam públicos no site), só
-- consegue ver os dados da conta com a qual fez login.
-- ------------------------------------------------------------
alter table public.study_records enable row level security;

drop policy if exists "own rows - select" on public.study_records;
drop policy if exists "own rows - insert" on public.study_records;
drop policy if exists "own rows - update" on public.study_records;
drop policy if exists "own rows - delete" on public.study_records;

create policy "own rows - select" on public.study_records
  for select to authenticated using (auth.uid() = user_id);

create policy "own rows - insert" on public.study_records
  for insert to authenticated with check (auth.uid() = user_id);

create policy "own rows - update" on public.study_records
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows - delete" on public.study_records
  for delete to authenticated using (auth.uid() = user_id);

-- Visitantes não autenticados (papel "anon") não têm nenhuma política => não veem nada.
revoke all on public.study_records from anon;
grant select, insert, update, delete on public.study_records to authenticated;
