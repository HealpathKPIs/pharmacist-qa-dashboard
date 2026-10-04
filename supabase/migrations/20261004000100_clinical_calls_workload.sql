-- Clinical Calls KPI: allow call-count tracker rows in pharmacist_workload.
--
-- Run as ONE script in the Supabase SQL Editor. It is wrapped in a single
-- transaction: if any statement fails, everything is rolled back.
--
-- Additive only:
--   * Widens 2 CHECK constraints so they also accept the calls tracker:
--       pharmacist_workload.workload_type  + 'clinical_calls'
--       upload_batches.upload_kind         + 'calls_workload'
--   * Does NOT insert, update, or delete any row, and does not change any
--     table column, view, function, trigger, index, grant, or policy.
--   * Medication reconciliation reads only workload_type
--     'medication_reconciliation', so its numbers cannot change.
--
-- Rerunnable: each constraint is dropped (IF EXISTS) and added again in the
-- same statement.

begin;

alter table public.pharmacist_workload
  drop constraint if exists pharmacist_workload_workload_type_check,
  add constraint pharmacist_workload_workload_type_check
    check (workload_type in ('medication_reconciliation', 'clinical_calls'));

alter table public.upload_batches
  drop constraint if exists upload_batches_upload_kind_check,
  add constraint upload_batches_upload_kind_check
    check (upload_kind in ('qa_audit', 'reconciliation_workload', 'calls_workload'));

commit;

-- ---------------------------------------------------------------------------
-- Checks (read-only). Run the same three queries before and after the script:
-- only the constraint definitions may differ.
-- ---------------------------------------------------------------------------
-- 1. CHECK constraints of the two tables. Before: exactly one workload_type
--    check and one upload_kind check, named as above (if a name differs, stop
--    and report it).
-- select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
-- from pg_constraint
-- where conrelid in ('public.pharmacist_workload'::regclass, 'public.upload_batches'::regclass)
--   and contype = 'c'
-- order by 1, 2;
--
-- 2. Rows by type (must be identical before and after).
-- select 'pharmacist_workload' as source, workload_type as kind, count(*) as rows,
--        coalesce(sum(item_count), 0) as items, min(day)::text as first_day, max(day)::text as last_day
-- from public.pharmacist_workload group by workload_type
-- union all
-- select 'upload_batches', upload_kind, count(*), null, min(uploaded_at)::date::text, max(uploaded_at)::date::text
-- from public.upload_batches group by upload_kind
-- order by 1, 2;
--
-- 3. Medication reconciliation fingerprint (must be identical before and after).
-- select md5(string_agg(day::text || '|' || pharmacist_id || '|' || item_count, ',' order by day, pharmacist_id))
-- from public.pharmacist_workload
-- where workload_type = 'medication_reconciliation';
