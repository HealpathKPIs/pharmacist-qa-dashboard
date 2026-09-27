-- Clinical pharmacist roster, alias-based name matching, and monthly
-- medication reconciliation workload.
--
-- Run as ONE script in the Supabase SQL Editor. It is wrapped in a single
-- transaction: if any statement fails, everything is rolled back.
--
-- Additive only:
--   * Creates new objects: 1 helper function, 3 tables, 2 trigger functions,
--     and 4 read-only views.
--   * Adds 2 columns (with defaults) and 1 check constraint to upload_batches.
--   * Seeds the new roster tables once, only while the roster is empty.
--   * Does NOT insert, update, or delete any row in qa_errors, daily_patients,
--     upload_batches, app_settings, profiles, auth.users, or auth.identities.
--
-- Rerunnable: every statement uses IF NOT EXISTS, CREATE OR REPLACE, or
-- DROP ... IF EXISTS, and the seed runs only when the roster is empty.
--
-- Module isolation: every view that reads qa_errors filters
-- audit_type = 'clinical'. Non-Medical and Doctors rows are never read.
--
-- Requires PostgreSQL 15+ (views use security_invoker).

begin;

-- ---------------------------------------------------------------------------
-- 1. Name-matching key: whitespace collapsed, trimmed, lower case.
--    Used on both sides of every roster match.
-- ---------------------------------------------------------------------------
create or replace function public.qa_name_key(raw_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(coalesce(raw_name, ''), '\s+', ' ', 'g')
    )
  );
$$;

revoke all on function public.qa_name_key(text) from public, anon, authenticated;
grant execute on function public.qa_name_key(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Roster: one row per Clinical pharmacist. The id never changes, so it is
--    safe to rename a pharmacist.
-- ---------------------------------------------------------------------------
create table if not exists public.clinical_pharmacists (
  id bigint generated always as identity primary key,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_pharmacists_display_name_check
    check (public.qa_name_key(display_name) <> '')
);

-- ---------------------------------------------------------------------------
-- 3. Aliases: every spelling a pharmacist may appear under in QA files and
--    trackers. alias_key is unique, so one spelling belongs to exactly one
--    pharmacist and a record can never be counted twice.
-- ---------------------------------------------------------------------------
create table if not exists public.clinical_pharmacist_aliases (
  id bigint generated always as identity primary key,
  pharmacist_id bigint not null
    references public.clinical_pharmacists (id) on delete restrict,
  alias text not null,
  alias_key text generated always as (public.qa_name_key(alias)) stored,
  created_at timestamptz not null default now(),
  constraint clinical_pharmacist_aliases_alias_check
    check (public.qa_name_key(alias) <> '')
);

create unique index if not exists clinical_pharmacist_aliases_alias_key_idx
  on public.clinical_pharmacist_aliases (alias_key);

create index if not exists clinical_pharmacist_aliases_pharmacist_id_idx
  on public.clinical_pharmacist_aliases (pharmacist_id);

-- ---------------------------------------------------------------------------
-- 4. Tracker workload (medication reconciliation now; calls later).
--    Linked by pharmacist_id, so a rename cannot disconnect it.
--    Unique (workload_type, day, pharmacist_id): uploading a day again
--    replaces that day instead of adding to it.
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacist_workload (
  id bigint generated always as identity primary key,
  workload_type text not null default 'medication_reconciliation',
  day date not null,
  pharmacist_id bigint not null
    references public.clinical_pharmacists (id) on delete restrict,
  pharmacist_name_raw text not null,
  task_label text not null default '',
  item_count integer not null,
  source_file text,
  upload_batch_id bigint
    references public.upload_batches (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  constraint pharmacist_workload_workload_type_check
    check (workload_type in ('medication_reconciliation')),
  constraint pharmacist_workload_item_count_check
    check (item_count >= 0)
);

create unique index if not exists pharmacist_workload_type_day_pharmacist_key
  on public.pharmacist_workload (workload_type, day, pharmacist_id);

create index if not exists pharmacist_workload_upload_batch_id_idx
  on public.pharmacist_workload (upload_batch_id);

-- ---------------------------------------------------------------------------
-- 5. upload_batches: label each batch. Existing rows read the defaults
--    ('qa_audit', 0); no existing value is changed.
-- ---------------------------------------------------------------------------
alter table public.upload_batches
  add column if not exists upload_kind text not null default 'qa_audit',
  add column if not exists inserted_workload_rows integer not null default 0;

alter table public.upload_batches
  drop constraint if exists upload_batches_upload_kind_check,
  add constraint upload_batches_upload_kind_check
    check (upload_kind in ('qa_audit', 'reconciliation_workload'));

-- ---------------------------------------------------------------------------
-- 6. Guards.
--    a) The display name is always one of the pharmacist's aliases. On insert
--       or rename it is added automatically. A name that already belongs to
--       another pharmacist is rejected. A rename never removes old aliases,
--       so records stored under the old name keep matching.
--    b) The alias equal to the current display name cannot be deleted or
--       changed.
-- ---------------------------------------------------------------------------
create or replace function public.qa_clinical_sync_display_alias()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_id bigint;
begin
  select a.pharmacist_id
    into owner_id
  from public.clinical_pharmacist_aliases a
  where a.alias_key = public.qa_name_key(new.display_name);

  if owner_id is null then
    insert into public.clinical_pharmacist_aliases (pharmacist_id, alias)
    values (new.id, new.display_name);
  elsif owner_id <> new.id then
    raise exception 'The name "%" already belongs to another Clinical pharmacist.',
      new.display_name
      using errcode = '23505';
  end if;

  return null;
end;
$$;

drop trigger if exists qa_clinical_sync_display_alias
  on public.clinical_pharmacists;

create trigger qa_clinical_sync_display_alias
  after insert or update of display_name on public.clinical_pharmacists
  for each row
  execute function public.qa_clinical_sync_display_alias();

create or replace function public.qa_clinical_protect_display_alias()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.clinical_pharmacists p
    where p.id = old.pharmacist_id
      and public.qa_name_key(p.display_name) = old.alias_key
  ) then
    if tg_op = 'DELETE' then
      raise exception 'The current display name cannot be removed from its aliases.'
        using errcode = '23514';
    end if;

    if new.pharmacist_id <> old.pharmacist_id
      or public.qa_name_key(new.alias) <> old.alias_key then
      raise exception 'The current display name alias cannot be changed.'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists qa_clinical_protect_display_alias
  on public.clinical_pharmacist_aliases;

create trigger qa_clinical_protect_display_alias
  before update or delete on public.clinical_pharmacist_aliases
  for each row
  execute function public.qa_clinical_protect_display_alias();

revoke all on function public.qa_clinical_sync_display_alias()
  from public, anon, authenticated;
revoke all on function public.qa_clinical_protect_display_alias()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Security: server-side (service role) access only, like the QA tables.
-- ---------------------------------------------------------------------------
alter table public.clinical_pharmacists enable row level security;
alter table public.clinical_pharmacist_aliases enable row level security;
alter table public.pharmacist_workload enable row level security;

revoke all on table public.clinical_pharmacists from anon, authenticated;
revoke all on table public.clinical_pharmacist_aliases from anon, authenticated;
revoke all on table public.pharmacist_workload from anon, authenticated;

grant all on table public.clinical_pharmacists to service_role;
grant all on table public.clinical_pharmacist_aliases to service_role;
grant all on table public.pharmacist_workload to service_role;

drop policy if exists "Service role can manage clinical pharmacists"
  on public.clinical_pharmacists;

create policy "Service role can manage clinical pharmacists"
  on public.clinical_pharmacists
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage clinical pharmacist aliases"
  on public.clinical_pharmacist_aliases;

create policy "Service role can manage clinical pharmacist aliases"
  on public.clinical_pharmacist_aliases
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage pharmacist workload"
  on public.pharmacist_workload;

create policy "Service role can manage pharmacist workload"
  on public.pharmacist_workload
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 8. Read-only views (security_invoker: they run with the caller's rights).
--    Only the service role can read them.
-- ---------------------------------------------------------------------------

-- Clinical QA errors under the pharmacist's current display name. Clinical
-- rows only. Rows whose stored name matches no alias are not included; they
-- are listed in clinical_unmatched_names instead.
create or replace view public.clinical_qa_errors_resolved
with (security_invoker = true)
as
select
  e.id,
  e.audit_type,
  e.day,
  p.display_name as pharmacist_name,
  e.pharmacist_name as stored_pharmacist_name,
  e.pharmacist_name_raw,
  e.patient_id,
  e.issue_type,
  e.score,
  e.issue_details,
  e.source_file,
  e.uploaded_at,
  p.id as pharmacist_id,
  p.active as pharmacist_active
from public.qa_errors e
join public.clinical_pharmacist_aliases a
  on a.alias_key = public.qa_name_key(e.pharmacist_name)
join public.clinical_pharmacists p
  on p.id = a.pharmacist_id
where e.audit_type = 'clinical';

-- Tracker workload with the pharmacist's current display name.
create or replace view public.clinical_workload_resolved
with (security_invoker = true)
as
select
  w.id,
  w.workload_type,
  w.day,
  w.item_count,
  w.task_label,
  w.pharmacist_name_raw,
  w.source_file,
  w.upload_batch_id,
  w.uploaded_at,
  p.id as pharmacist_id,
  p.display_name as pharmacist_name,
  p.active as pharmacist_active
from public.pharmacist_workload w
join public.clinical_pharmacists p
  on p.id = w.pharmacist_id;

-- Stored Clinical names that match no alias (for example a typo in an old
-- QA file). Shown in Settings so nothing is excluded silently.
create or replace view public.clinical_unmatched_names
with (security_invoker = true)
as
select
  e.pharmacist_name,
  count(*)::integer as records,
  min(e.day) as first_day,
  max(e.day) as last_day
from public.qa_errors e
where e.audit_type = 'clinical'
  and not exists (
    select 1
    from public.clinical_pharmacist_aliases a
    where a.alias_key = public.qa_name_key(e.pharmacist_name)
  )
group by e.pharmacist_name;

-- Clinical QA row count behind each alias (Settings warns before removing an
-- alias that still has records).
create or replace view public.clinical_alias_usage
with (security_invoker = true)
as
select
  a.id as alias_id,
  a.pharmacist_id,
  a.alias,
  a.alias_key,
  a.created_at,
  (
    select count(*)
    from public.qa_errors e
    where e.audit_type = 'clinical'
      and public.qa_name_key(e.pharmacist_name) = a.alias_key
  )::integer as qa_error_records
from public.clinical_pharmacist_aliases a;

revoke all on table public.clinical_qa_errors_resolved from anon, authenticated;
revoke all on table public.clinical_workload_resolved from anon, authenticated;
revoke all on table public.clinical_unmatched_names from anon, authenticated;
revoke all on table public.clinical_alias_usage from anon, authenticated;

grant select on table public.clinical_qa_errors_resolved to service_role;
grant select on table public.clinical_workload_resolved to service_role;
grant select on table public.clinical_unmatched_names to service_role;
grant select on table public.clinical_alias_usage to service_role;

-- ---------------------------------------------------------------------------
-- 9. Seed the roster once, only while it is empty. The display-name alias of
--    each pharmacist is created by the trigger in section 6.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.clinical_pharmacists) then
    insert into public.clinical_pharmacists (display_name, active)
    values
      ('Aya Wahba', true),
      ('Hossam', true),
      ('Khaled Moustafa', true),
      ('Kholoud Elkholy', true),
      ('Mohamed Darwish', true),
      ('Nadine', true),
      ('Samaa Ahmed', true),
      ('Youssef Ahmed', true),
      ('Mohamed Nour', false),
      ('Noha Ahmed', false),
      ('Dina Raid', false);

    insert into public.clinical_pharmacist_aliases (pharmacist_id, alias)
    select p.id, extra.alias
    from (
      values
        ('Khaled Moustafa', 'khaled'),
        ('Kholoud Elkholy', 'Khouloud Mohamed'),
        ('Kholoud Elkholy', 'Khouloud Mohamed Elkholy'),
        ('Nadine', 'Nadin Tamer')
    ) as extra (display_name, alias)
    join public.clinical_pharmacists p
      on p.display_name = extra.display_name;
  end if;
end;
$$;

commit;

-- ---------------------------------------------------------------------------
-- Verification (read-only). Run these after the script succeeds.
-- ---------------------------------------------------------------------------
-- select id, display_name, active from public.clinical_pharmacists order by display_name;
-- select pharmacist_id, alias, alias_key from public.clinical_pharmacist_aliases order by pharmacist_id, alias;
-- select * from public.clinical_unmatched_names order by records desc;
-- select count(*) from public.qa_errors where audit_type = 'clinical';
-- select count(*) from public.clinical_qa_errors_resolved where pharmacist_active;
