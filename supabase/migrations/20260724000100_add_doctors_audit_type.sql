alter table public.daily_patients
  drop constraint if exists daily_patients_audit_type_check,
  add constraint daily_patients_audit_type_check
    check (audit_type in ('clinical', 'non_medical', 'doctors'));

alter table public.qa_errors
  drop constraint if exists qa_errors_audit_type_check,
  add constraint qa_errors_audit_type_check
    check (audit_type in ('clinical', 'non_medical', 'doctors'));

alter table public.upload_batches
  drop constraint if exists upload_batches_audit_type_check,
  add constraint upload_batches_audit_type_check
    check (audit_type in ('clinical', 'non_medical', 'doctors'));
