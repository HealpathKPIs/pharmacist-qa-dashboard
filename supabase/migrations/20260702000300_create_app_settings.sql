create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

revoke all on public.app_settings from anon;
revoke all on public.app_settings from authenticated;
grant all on public.app_settings to service_role;

drop policy if exists "Service role can manage app settings" on public.app_settings;

create policy "Service role can manage app settings"
on public.app_settings
for all
to service_role
using (true)
with check (true);
