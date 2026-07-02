alter table public.upload_batches
  add column if not exists source_file text;

update public.upload_batches
set source_file = file_name
where source_file is null;

alter table public.upload_batches
  alter column source_file set not null;

alter table public.upload_batches
  add column if not exists inserted_daily_patients int not null default 0,
  add column if not exists inserted_qa_errors int not null default 0,
  add column if not exists skipped_rows int not null default 0,
  add column if not exists failed_rows int not null default 0;
