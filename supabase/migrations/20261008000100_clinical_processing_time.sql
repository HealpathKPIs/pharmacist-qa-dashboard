-- Processing Time KPI: monthly pharmacist task tracker (DAILY_WORK_LOG).
--
-- Run as ONE script in the Supabase SQL Editor. It is wrapped in a single
-- transaction: if any statement fails, everything is rolled back.
--
-- Additive only:
--   * New table clinical_processing_tasks (one row per task line of the
--     tracker), linked to clinical_pharmacists, so a rename cannot disconnect it.
--   * New read-only view clinical_processing_tasks_resolved (current display
--     name and active flag), like clinical_workload_resolved.
--   * New function qa_replace_processing_month: replaces one whole month in a
--     single transaction, so a failed upload leaves the old month in place.
--   * Widens upload_batches.upload_kind with 'processing_time'.
--   * Does NOT insert, update, or delete any existing row, and does not change
--     pharmacist_workload, qa_errors, daily_patients or any existing view.
--
-- Rerunnable: every object is created with IF NOT EXISTS / OR REPLACE, and
-- the constraint is dropped (IF EXISTS) and added again.

begin;

-- ---------------------------------------------------------------------------
-- 1. Task rows. A pharmacist can have several rows on the same day (one per
--    task line), so there is no unique key: a re-upload replaces the month.
-- ---------------------------------------------------------------------------
create table if not exists public.clinical_processing_tasks (
  id bigint generated always as identity primary key,
  day date not null,
  pharmacist_id bigint not null
    references public.clinical_pharmacists (id) on delete restrict,
  pharmacist_name_raw text not null,
  task_reference text not null default '',
  task_type text not null,
  items_completed numeric not null,
  sla_per_item numeric not null,
  sla_minutes numeric not null,
  actual_minutes numeric not null,
  source_file text,
  source_row integer,
  upload_batch_id bigint
    references public.upload_batches (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  constraint clinical_processing_tasks_task_type_check
    check (btrim(task_type) <> ''),
  constraint clinical_processing_tasks_items_check
    check (items_completed >= 0),
  constraint clinical_processing_tasks_sla_per_item_check
    check (sla_per_item >= 0),
  constraint clinical_processing_tasks_sla_minutes_check
    check (sla_minutes >= 0),
  constraint clinical_processing_tasks_actual_minutes_check
    check (actual_minutes > 0)
);

create index if not exists clinical_processing_tasks_day_idx
  on public.clinical_processing_tasks (day);

create index if not exists clinical_processing_tasks_pharmacist_day_idx
  on public.clinical_processing_tasks (pharmacist_id, day);

create index if not exists clinical_processing_tasks_upload_batch_id_idx
  on public.clinical_processing_tasks (upload_batch_id);

-- ---------------------------------------------------------------------------
-- 2. upload_batches: label Processing Time uploads.
-- ---------------------------------------------------------------------------
alter table public.upload_batches
  drop constraint if exists upload_batches_upload_kind_check,
  add constraint upload_batches_upload_kind_check
    check (upload_kind in (
      'qa_audit',
      'reconciliation_workload',
      'calls_workload',
      'processing_time'
    ));

-- ---------------------------------------------------------------------------
-- 3. Security: server-side (service role) access only, like the other
--    Clinical tables.
-- ---------------------------------------------------------------------------
alter table public.clinical_processing_tasks enable row level security;

revoke all on table public.clinical_processing_tasks from anon, authenticated;
grant all on table public.clinical_processing_tasks to service_role;

drop policy if exists "Service role can manage clinical processing tasks"
  on public.clinical_processing_tasks;

create policy "Service role can manage clinical processing tasks"
  on public.clinical_processing_tasks
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 4. Read-only view with the pharmacist's current display name.
-- ---------------------------------------------------------------------------
create or replace view public.clinical_processing_tasks_resolved
with (security_invoker = true)
as
select
  t.id,
  t.day,
  t.task_reference,
  t.task_type,
  t.items_completed,
  t.sla_per_item,
  t.sla_minutes,
  t.actual_minutes,
  t.pharmacist_name_raw,
  t.source_file,
  t.source_row,
  t.upload_batch_id,
  t.uploaded_at,
  p.id as pharmacist_id,
  p.display_name as pharmacist_name,
  p.active as pharmacist_active
from public.clinical_processing_tasks t
join public.clinical_pharmacists p
  on p.id = t.pharmacist_id;

revoke all on table public.clinical_processing_tasks_resolved from anon, authenticated;
grant select on table public.clinical_processing_tasks_resolved to service_role;

-- ---------------------------------------------------------------------------
-- 5. Replace one month. p_month is any day of the month; every row must fall
--    inside that month, otherwise nothing is changed. Returns the number of
--    rows deleted and inserted.
-- ---------------------------------------------------------------------------
create or replace function public.qa_replace_processing_month(
  p_batch_id bigint,
  p_month date,
  p_rows jsonb
)
returns table (deleted_rows integer, inserted_rows integer)
language plpgsql
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', p_month)::date;
  month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  outside integer;
  deleted_count integer;
  inserted_count integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No Processing Time rows to import.'
      using errcode = '22023';
  end if;

  select count(*)
    into outside
  from jsonb_array_elements(p_rows) r
  where (r ->> 'day')::date not between month_start and month_end;

  if outside > 0 then
    raise exception '% row(s) are outside %.', outside, to_char(month_start, 'FMMonth YYYY')
      using errcode = '22023';
  end if;

  delete from public.clinical_processing_tasks
  where day between month_start and month_end;

  get diagnostics deleted_count = row_count;

  insert into public.clinical_processing_tasks (
    day,
    pharmacist_id,
    pharmacist_name_raw,
    task_reference,
    task_type,
    items_completed,
    sla_per_item,
    sla_minutes,
    actual_minutes,
    source_file,
    source_row,
    upload_batch_id
  )
  select
    (r ->> 'day')::date,
    (r ->> 'pharmacist_id')::bigint,
    r ->> 'pharmacist_name_raw',
    coalesce(r ->> 'task_reference', ''),
    r ->> 'task_type',
    (r ->> 'items_completed')::numeric,
    (r ->> 'sla_per_item')::numeric,
    (r ->> 'sla_minutes')::numeric,
    (r ->> 'actual_minutes')::numeric,
    r ->> 'source_file',
    (r ->> 'source_row')::integer,
    p_batch_id
  from jsonb_array_elements(p_rows) r;

  get diagnostics inserted_count = row_count;

  return query select deleted_count, inserted_count;
end;
$$;

revoke all on function public.qa_replace_processing_month(bigint, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.qa_replace_processing_month(bigint, date, jsonb)
  to service_role;

commit;

-- ---------------------------------------------------------------------------
-- Checks (read-only). Run 1 and 2 before and after the script: they must
-- return the same rows. Run 3 after the script.
-- ---------------------------------------------------------------------------
-- 1. Existing tracker rows and upload batches by type.
-- select 'pharmacist_workload' as source, workload_type as kind, count(*) as rows,
--        coalesce(sum(item_count), 0) as items, min(day)::text as first_day, max(day)::text as last_day
-- from public.pharmacist_workload group by workload_type
-- union all
-- select 'upload_batches', upload_kind, count(*), null, min(uploaded_at)::date::text, max(uploaded_at)::date::text
-- from public.upload_batches group by upload_kind
-- order by 1, 2;
--
-- 2. Medication reconciliation fingerprint.
-- select md5(string_agg(day::text || '|' || pharmacist_id || '|' || item_count, ',' order by day, pharmacist_id))
-- from public.pharmacist_workload
-- where workload_type = 'medication_reconciliation';
--
-- 3. New objects exist (expect 4 rows) and the new table is empty.
-- select 'table' as kind, to_regclass('public.clinical_processing_tasks')::text as name
-- union all select 'view', to_regclass('public.clinical_processing_tasks_resolved')::text
-- union all select 'function', to_regprocedure('public.qa_replace_processing_month(bigint,date,jsonb)')::text
-- union all select 'rows', count(*)::text from public.clinical_processing_tasks;
