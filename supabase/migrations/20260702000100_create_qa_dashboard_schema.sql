create table public.daily_patients (
  id bigint generated always as identity primary key,
  day date not null,
  patient_count int not null,
  source_file text,
  uploaded_at timestamptz default now()
);

create table public.qa_errors (
  id bigint generated always as identity primary key,
  pharmacist_name text not null,
  pharmacist_name_raw text,
  day date not null,
  patient_id text not null,
  issue_type text not null,
  score int not null,
  issue_details text,
  source_file text,
  uploaded_at timestamptz default now()
);

create table public.upload_batches (
  id bigint generated always as identity primary key,
  file_name text not null,
  rows_patients_inserted int,
  rows_errors_inserted int,
  uploaded_at timestamptz default now(),
  status text default 'success'
);

create index daily_patients_day_idx on public.daily_patients (day);
create index qa_errors_day_idx on public.qa_errors (day);
create index qa_errors_pharmacist_name_idx on public.qa_errors (pharmacist_name);
create index qa_errors_issue_type_idx on public.qa_errors (issue_type);
create index upload_batches_uploaded_at_idx on public.upload_batches (uploaded_at);

alter table public.daily_patients enable row level security;
alter table public.qa_errors enable row level security;
alter table public.upload_batches enable row level security;

revoke all on table public.daily_patients from anon, authenticated;
revoke all on table public.qa_errors from anon, authenticated;
revoke all on table public.upload_batches from anon, authenticated;

grant all on table public.daily_patients to service_role;
grant all on table public.qa_errors to service_role;
grant all on table public.upload_batches to service_role;

create policy "Service role can manage daily patients"
  on public.daily_patients
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role can manage QA errors"
  on public.qa_errors
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role can manage upload batches"
  on public.upload_batches
  for all
  to service_role
  using (true)
  with check (true);
