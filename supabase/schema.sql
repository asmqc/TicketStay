-- TicketStay — table des données « Mon compte »
-- À coller dans Supabase : SQL Editor → New query → Run
-- Une ligne par équipe et par compte. L'app iPhone écrit, le site lit.

create table if not exists public.ts_snapshots (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  team_id    text        not null,
  payload    jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

-- Sécurité par ligne : sans ça, la table serait lisible par tout le monde.
alter table public.ts_snapshots enable row level security;

drop policy if exists "Lire ses propres saisons"      on public.ts_snapshots;
drop policy if exists "Ajouter ses propres saisons"   on public.ts_snapshots;
drop policy if exists "Modifier ses propres saisons"  on public.ts_snapshots;
drop policy if exists "Supprimer ses propres saisons" on public.ts_snapshots;

create policy "Lire ses propres saisons" on public.ts_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Ajouter ses propres saisons" on public.ts_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Modifier ses propres saisons" on public.ts_snapshots
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Supprimer ses propres saisons" on public.ts_snapshots
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Les visiteurs non connectés n'ont aucun accès.
revoke all on public.ts_snapshots from anon;
grant select, insert, update, delete on public.ts_snapshots to authenticated;

-- Met à jour la date à chaque modification.
create or replace function public.ts_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists ts_snapshots_touch on public.ts_snapshots;
create trigger ts_snapshots_touch before update on public.ts_snapshots
  for each row execute function public.ts_touch();
