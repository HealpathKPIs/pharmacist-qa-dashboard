alter table public.daily_patients
  add column if not exists audit_type text not null default 'clinical';

alter table public.qa_errors
  add column if not exists audit_type text not null default 'clinical';

alter table public.upload_batches
  add column if not exists audit_type text not null default 'clinical';

alter table public.daily_patients
  drop constraint if exists daily_patients_audit_type_check,
  add constraint daily_patients_audit_type_check
    check (audit_type in ('clinical', 'non_medical'));

alter table public.qa_errors
  drop constraint if exists qa_errors_audit_type_check,
  add constraint qa_errors_audit_type_check
    check (audit_type in ('clinical', 'non_medical'));

alter table public.upload_batches
  drop constraint if exists upload_batches_audit_type_check,
  add constraint upload_batches_audit_type_check
    check (audit_type in ('clinical', 'non_medical'));

create index if not exists daily_patients_audit_type_day_idx
  on public.daily_patients (audit_type, day);

create index if not exists qa_errors_audit_type_day_idx
  on public.qa_errors (audit_type, day);

create index if not exists qa_errors_audit_type_actor_idx
  on public.qa_errors (audit_type, pharmacist_name);

create index if not exists qa_errors_audit_type_issue_idx
  on public.qa_errors (audit_type, issue_type);

create index if not exists upload_batches_audit_type_uploaded_at_idx
  on public.upload_batches (audit_type, uploaded_at desc);
