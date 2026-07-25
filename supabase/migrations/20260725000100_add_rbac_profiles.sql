create type public.app_role as enum (
  'admin',
  'clinical_manager',
  'non_medical_manager',
  'doctors_manager'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Service role can manage profiles"
  on public.profiles
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'QA User'
    ),
    coalesce(new.email, ''),
    'clinical_manager'::public.app_role,
    true
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Preserve access during migration from the former shared-password system.
-- The oldest existing Supabase Auth user becomes the initial administrator.
with ranked_users as (
  select
    id,
    email,
    raw_user_meta_data,
    row_number() over (order by created_at, id) as user_number
  from auth.users
)
insert into public.profiles (id, full_name, email, role, active)
select
  id,
  coalesce(
    nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(email, ''), '@', 1),
    'QA User'
  ),
  coalesce(email, ''),
  case
    when user_number = 1 then 'admin'::public.app_role
    else 'clinical_manager'::public.app_role
  end,
  true
from ranked_users
on conflict (id) do nothing;
