-- Standalone and atomic: safe to run directly in Supabase SQL Editor.
-- No statement in this transaction reads or writes Supabase migration history.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'manager',
  accessible_modules text[] not null default '{}'::text[],
  active boolean not null default false,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Make reruns safe after a partially-created legacy profiles table.
alter table public.profiles
  add column if not exists accessible_modules text[] not null default '{}'::text[],
  add column if not exists last_login timestamptz;

alter table public.profiles
  drop constraint if exists profiles_role_check,
  drop constraint if exists profiles_modules_check,
  drop constraint if exists profiles_primary_admin_check;

alter table public.profiles
  alter column role drop default,
  alter column role type text using role::text,
  alter column role set default 'manager',
  alter column active set default false;

create unique index if not exists profiles_email_idx
  on public.profiles (lower(email));

create index if not exists profiles_role_idx
  on public.profiles (role);

-- Normalize only legacy or invalid authorization states. A clean rerun is a no-op.
update public.profiles
set
  accessible_modules = case
    when lower(email) = 'ahmedramadan@healpath.care'
      then array['clinical', 'non_medical', 'doctors']
    when role = 'clinical_manager'
      then array['clinical']
    when role = 'non_medical_manager'
      then array['non_medical']
    when role = 'doctors_manager'
      then array['doctors']
    when role = 'admin'
      then array['clinical', 'non_medical', 'doctors']
    else accessible_modules
  end,
  role = case
    when lower(email) = 'ahmedramadan@healpath.care' then 'admin'
    else 'manager'
  end,
  active = case
    when lower(email) = 'ahmedramadan@healpath.care' then true
    else active
  end,
  updated_at = now()
where
  role not in ('admin', 'manager')
  or (role = 'admin' and lower(email) <> 'ahmedramadan@healpath.care')
  or (
    lower(email) = 'ahmedramadan@healpath.care'
    and (
      role <> 'admin'
      or not active
      or not (
        accessible_modules <@ array['clinical', 'non_medical', 'doctors']::text[]
        and accessible_modules @> array['clinical', 'non_medical', 'doctors']::text[]
      )
    )
  );

-- Invalid active managers fail closed instead of blocking the migration.
update public.profiles
set
  active = false,
  updated_at = now()
where
  role = 'manager'
  and active
  and cardinality(accessible_modules) = 0;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('admin', 'manager')),
  add constraint profiles_modules_check
    check (
      accessible_modules <@ array['clinical', 'non_medical', 'doctors']::text[]
      and (
        (
          role = 'admin'
          and accessible_modules @> array['clinical', 'non_medical', 'doctors']::text[]
        )
        or (
          role = 'manager'
          and (not active or cardinality(accessible_modules) > 0)
        )
      )
    ),
  add constraint profiles_primary_admin_check
    check (
      (
        lower(email) = 'ahmedramadan@healpath.care'
        and role = 'admin'
        and active
      )
      or (
        lower(email) <> 'ahmedramadan@healpath.care'
        and role = 'manager'
      )
    );

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Service role can manage profiles" on public.profiles;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create or replace function public.qa_rbac_set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.qa_rbac_set_profile_updated_at()
  from public, anon, authenticated;

drop trigger if exists qa_rbac_set_profile_updated_at on public.profiles;

create trigger qa_rbac_set_profile_updated_at
  before update on public.profiles
  for each row execute procedure public.qa_rbac_set_profile_updated_at();

create or replace function public.qa_rbac_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  is_primary_admin boolean :=
    lower(coalesce(new.email, '')) = 'ahmedramadan@healpath.care';
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    accessible_modules,
    active,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'QA User'
    ),
    normalized_email,
    case when is_primary_admin then 'admin' else 'manager' end,
    case
      when is_primary_admin
        then array['clinical', 'non_medical', 'doctors']::text[]
      else '{}'::text[]
    end,
    is_primary_admin,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.qa_rbac_handle_new_auth_user()
  from public, anon, authenticated;

drop trigger if exists qa_rbac_on_auth_user_created on auth.users;

create trigger qa_rbac_on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.qa_rbac_handle_new_auth_user();

-- Backfill profiles for Auth users created before this migration. This reads
-- auth.users but never inserts, updates, or deletes rows in the Auth schema.
insert into public.profiles (
  id,
  full_name,
  email,
  role,
  accessible_modules,
  active,
  created_at,
  updated_at
)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'QA User'
  ),
  lower(coalesce(users.email, '')),
  case
    when lower(coalesce(users.email, '')) = 'ahmedramadan@healpath.care'
      then 'admin'
    else 'manager'
  end,
  case
    when lower(coalesce(users.email, '')) = 'ahmedramadan@healpath.care'
      then array['clinical', 'non_medical', 'doctors']::text[]
    else '{}'::text[]
  end,
  lower(coalesce(users.email, '')) = 'ahmedramadan@healpath.care',
  coalesce(users.created_at, now()),
  now()
from auth.users as users
on conflict (id) do nothing;

commit;
