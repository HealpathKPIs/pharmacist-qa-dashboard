-- Non-Medical agent roster with alias-based name matching: the same design as
-- the Clinical pharmacist roster (20260927000100).
--
-- Run as ONE script in the Supabase SQL Editor. It is wrapped in a single
-- transaction: if any statement or check fails, everything is rolled back.
--
-- Additive only:
--   * Creates new objects: 2 tables, 3 functions (2 trigger functions and the
--     merge function), and 3 read-only views.
--   * Seeds the roster once, only while it is empty: every agent name already
--     in Non-Medical QA becomes an active agent, so the dashboards show the
--     same numbers as before. The script checks this before it commits.
--   * Does NOT insert, update, or delete any row in qa_errors, daily_patients,
--     upload_batches, app_settings, profiles, the Clinical roster, auth.users,
--     or auth.identities.
--
-- Rerunnable: every statement uses IF NOT EXISTS, CREATE OR REPLACE, or
-- DROP ... IF EXISTS, and the seed runs only when the roster is empty.
--
-- Module isolation: every view that reads qa_errors filters
-- audit_type = 'non_medical'. Clinical and Doctors rows are never read.
--
-- Requires public.qa_name_key from 20260927000100 (already applied).

begin;

-- ---------------------------------------------------------------------------
-- 1. Roster: one row per Non-Medical agent. The id never changes, so it is
--    safe to rename an agent.
-- ---------------------------------------------------------------------------
create table if not exists public.non_medical_agents (
  id bigint generated always as identity primary key,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint non_medical_agents_display_name_check
    check (public.qa_name_key(display_name) <> '')
);

-- ---------------------------------------------------------------------------
-- 2. Aliases: every spelling an agent may appear under in QA files.
--    alias_key is unique, so one spelling belongs to exactly one agent and a
--    record can never be counted twice.
-- ---------------------------------------------------------------------------
create table if not exists public.non_medical_agent_aliases (
  id bigint generated always as identity primary key,
  agent_id bigint not null
    references public.non_medical_agents (id) on delete restrict,
  alias text not null,
  alias_key text generated always as (public.qa_name_key(alias)) stored,
  created_at timestamptz not null default now(),
  constraint non_medical_agent_aliases_alias_check
    check (public.qa_name_key(alias) <> '')
);

create unique index if not exists non_medical_agent_aliases_alias_key_idx
  on public.non_medical_agent_aliases (alias_key);

create index if not exists non_medical_agent_aliases_agent_id_idx
  on public.non_medical_agent_aliases (agent_id);

-- ---------------------------------------------------------------------------
-- 3. Guards, as for Clinical pharmacists.
--    a) The display name is always one of the agent's aliases. On insert or
--       rename it is added automatically. A name that already belongs to
--       another agent is rejected. A rename never removes old aliases, so
--       records stored under the old name keep matching.
--    b) The alias equal to the current display name cannot be deleted or
--       changed, except by the merge in section 4.
-- ---------------------------------------------------------------------------
create or replace function public.qa_non_medical_sync_display_alias()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_id bigint;
begin
  select a.agent_id
    into owner_id
  from public.non_medical_agent_aliases a
  where a.alias_key = public.qa_name_key(new.display_name);

  if owner_id is null then
    insert into public.non_medical_agent_aliases (agent_id, alias)
    values (new.id, new.display_name);
  elsif owner_id <> new.id then
    raise exception 'The name "%" already belongs to another Non-Medical agent.',
      new.display_name
      using errcode = '23505';
  end if;

  return null;
end;
$$;

drop trigger if exists qa_non_medical_sync_display_alias
  on public.non_medical_agents;

create trigger qa_non_medical_sync_display_alias
  after insert or update of display_name on public.non_medical_agents
  for each row
  execute function public.qa_non_medical_sync_display_alias();

create or replace function public.qa_non_medical_protect_display_alias()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- qa_non_medical_merge_agents moves every alias of the agent it merges,
  -- the display name included, and then removes that agent.
  if tg_op = 'UPDATE'
    and old.agent_id::text
      = pg_catalog.current_setting('qa.non_medical_merge_agent_id', true) then
    return new;
  end if;

  if exists (
    select 1
    from public.non_medical_agents p
    where p.id = old.agent_id
      and public.qa_name_key(p.display_name) = old.alias_key
  ) then
    if tg_op = 'DELETE' then
      raise exception 'The current display name cannot be removed from its aliases.'
        using errcode = '23514';
    end if;

    if new.agent_id <> old.agent_id
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

drop trigger if exists qa_non_medical_protect_display_alias
  on public.non_medical_agent_aliases;

create trigger qa_non_medical_protect_display_alias
  before update or delete on public.non_medical_agent_aliases
  for each row
  execute function public.qa_non_medical_protect_display_alias();

-- ---------------------------------------------------------------------------
-- 4. Merge two agents who are the same person (for example a misspelled name
--    that was seeded as its own agent). Every alias of merge_agent_id moves to
--    keep_agent_id, then merge_agent_id leaves the roster. QA records are
--    never changed; they now match the kept agent.
-- ---------------------------------------------------------------------------
create or replace function public.qa_non_medical_merge_agents(
  merge_agent_id bigint,
  keep_agent_id bigint
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if merge_agent_id = keep_agent_id then
    raise exception 'Choose two different agents.'
      using errcode = '22023';
  end if;

  perform 1 from public.non_medical_agents where id = keep_agent_id for update;

  if not found then
    raise exception 'The agent to keep was not found.'
      using errcode = 'P0002';
  end if;

  perform 1 from public.non_medical_agents where id = merge_agent_id for update;

  if not found then
    raise exception 'The agent to merge was not found.'
      using errcode = 'P0002';
  end if;

  -- Lets the guard in section 3 move the display name alias as well. The
  -- setting is local to this transaction and cleared right after the move.
  perform pg_catalog.set_config(
    'qa.non_medical_merge_agent_id', merge_agent_id::text, true);

  update public.non_medical_agent_aliases
  set agent_id = keep_agent_id
  where agent_id = merge_agent_id;

  perform pg_catalog.set_config('qa.non_medical_merge_agent_id', '', true);

  delete from public.non_medical_agents
  where id = merge_agent_id;
end;
$$;

revoke all on function public.qa_non_medical_sync_display_alias()
  from public, anon, authenticated;
revoke all on function public.qa_non_medical_protect_display_alias()
  from public, anon, authenticated;
revoke all on function public.qa_non_medical_merge_agents(bigint, bigint)
  from public, anon, authenticated;

grant execute on function public.qa_non_medical_merge_agents(bigint, bigint)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Security: server-side (service role) access only, like the QA tables.
-- ---------------------------------------------------------------------------
alter table public.non_medical_agents enable row level security;
alter table public.non_medical_agent_aliases enable row level security;

revoke all on table public.non_medical_agents from anon, authenticated;
revoke all on table public.non_medical_agent_aliases from anon, authenticated;

grant all on table public.non_medical_agents to service_role;
grant all on table public.non_medical_agent_aliases to service_role;

drop policy if exists "Service role can manage non-medical agents"
  on public.non_medical_agents;

create policy "Service role can manage non-medical agents"
  on public.non_medical_agents
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage non-medical agent aliases"
  on public.non_medical_agent_aliases;

create policy "Service role can manage non-medical agent aliases"
  on public.non_medical_agent_aliases
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 6. Read-only views (security_invoker: they run with the caller's rights).
--    Only the service role can read them.
-- ---------------------------------------------------------------------------

-- Non-Medical QA errors under the agent's current display name. Non-Medical
-- rows only. The columns match clinical_qa_errors_resolved (qa_errors calls
-- every actor pharmacist_name), so the dashboard reads both views the same
-- way. Rows whose stored name matches no alias are not included; they are
-- listed in non_medical_unmatched_names instead.
-- Each stored spelling is matched once per query, not once per QA row, which
-- keeps the view fast on the large Non-Medical table.
create or replace view public.non_medical_qa_errors_resolved
with (security_invoker = true)
as
with agent_names as materialized (
  select
    n.pharmacist_name,
    p.id as agent_id,
    p.display_name,
    p.active
  from (
    select distinct x.pharmacist_name
    from public.qa_errors x
    where x.audit_type = 'non_medical'
  ) n
  join public.non_medical_agent_aliases a
    on a.alias_key = public.qa_name_key(n.pharmacist_name)
  join public.non_medical_agents p
    on p.id = a.agent_id
)
select
  e.id,
  e.audit_type,
  e.day,
  m.display_name as pharmacist_name,
  e.pharmacist_name as stored_pharmacist_name,
  e.pharmacist_name_raw,
  e.patient_id,
  e.issue_type,
  e.score,
  e.issue_details,
  e.source_file,
  e.uploaded_at,
  m.agent_id as pharmacist_id,
  m.active as pharmacist_active
from public.qa_errors e
join agent_names m
  on m.pharmacist_name = e.pharmacist_name
where e.audit_type = 'non_medical';

-- Stored Non-Medical names that match no alias (for example a new agent or a
-- typo in a QA file). Shown in Settings so nothing is excluded silently.
create or replace view public.non_medical_unmatched_names
with (security_invoker = true)
as
select
  n.pharmacist_name,
  n.records,
  n.first_day,
  n.last_day
from (
  select
    e.pharmacist_name,
    count(*)::integer as records,
    min(e.day) as first_day,
    max(e.day) as last_day
  from public.qa_errors e
  where e.audit_type = 'non_medical'
  group by e.pharmacist_name
) n
where not exists (
  select 1
  from public.non_medical_agent_aliases a
  where a.alias_key = public.qa_name_key(n.pharmacist_name)
);

-- Non-Medical QA rows and their dates behind each alias. Settings shows them
-- and warns before an alias that still has records is removed.
create or replace view public.non_medical_alias_usage
with (security_invoker = true)
as
select
  a.id as alias_id,
  a.agent_id,
  a.alias,
  a.alias_key,
  a.created_at,
  coalesce(u.records, 0)::integer as qa_error_records,
  u.first_day,
  u.last_day
from public.non_medical_agent_aliases a
left join (
  select
    public.qa_name_key(n.pharmacist_name) as name_key,
    sum(n.records) as records,
    min(n.first_day) as first_day,
    max(n.last_day) as last_day
  from (
    select
      e.pharmacist_name,
      count(*) as records,
      min(e.day) as first_day,
      max(e.day) as last_day
    from public.qa_errors e
    where e.audit_type = 'non_medical'
    group by e.pharmacist_name
  ) n
  group by public.qa_name_key(n.pharmacist_name)
) u
  on u.name_key = a.alias_key;

revoke all on table public.non_medical_qa_errors_resolved from anon, authenticated;
revoke all on table public.non_medical_unmatched_names from anon, authenticated;
revoke all on table public.non_medical_alias_usage from anon, authenticated;

grant select on table public.non_medical_qa_errors_resolved to service_role;
grant select on table public.non_medical_unmatched_names to service_role;
grant select on table public.non_medical_alias_usage to service_role;

-- ---------------------------------------------------------------------------
-- 7. Seed the roster once, only while it is empty: one active agent for every
--    name in Non-Medical QA. Names that differ only in case or spaces become
--    one agent, under the most used spelling. The display-name alias of each
--    agent is created by the trigger in section 3.
--    The check stops the script unless every Non-Medical QA row then counts,
--    exactly once, so the dashboards keep their current numbers.
-- ---------------------------------------------------------------------------
do $$
declare
  qa_rows bigint;
  matched_rows bigint;
  counted_rows bigint;
begin
  if exists (select 1 from public.non_medical_agents) then
    return;
  end if;

  insert into public.non_medical_agents (display_name, active)
  select distinct on (s.name_key) s.spelling, true
  from (
    select
      public.qa_name_key(n.pharmacist_name) as name_key,
      pg_catalog.btrim(
        pg_catalog.regexp_replace(n.pharmacist_name, '\s+', ' ', 'g')
      ) as spelling,
      n.records
    from (
      select e.pharmacist_name, count(*) as records
      from public.qa_errors e
      where e.audit_type = 'non_medical'
      group by e.pharmacist_name
    ) n
  ) s
  where s.name_key <> ''
  order by s.name_key, s.records desc, s.spelling;

  select count(*)
    into qa_rows
  from public.qa_errors
  where audit_type = 'non_medical';

  select count(*), count(*) filter (where pharmacist_active)
    into matched_rows, counted_rows
  from public.non_medical_qa_errors_resolved;

  if matched_rows <> qa_rows or counted_rows <> qa_rows then
    raise exception
      'Seed check failed: % Non-Medical QA rows, % matched to an agent, % to an active agent. Nothing was saved.',
      qa_rows, matched_rows, counted_rows;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Self-test of the guards and the merge, on temporary test agents. Every
--    test change is undone at the end of the block. A failed check stops the
--    script, so nothing is saved.
-- ---------------------------------------------------------------------------
do $$
declare
  first_id bigint;
  second_id bigint;
  third_id bigint;
  rejected boolean;
begin
  begin
    insert into public.non_medical_agents (display_name)
    values ('QA Self Test Agent One')
    returning id into first_id;

    insert into public.non_medical_agents (display_name)
    values ('QA Self Test Agent Two')
    returning id into second_id;

    if not exists (
      select 1
      from public.non_medical_agent_aliases
      where agent_id = first_id
        and alias_key = 'qa self test agent one'
    ) then
      raise exception 'Self-test failed: the display name was not added as a spelling.';
    end if;

    update public.non_medical_agents
    set display_name = 'QA Self Test Agent Renamed'
    where id = first_id;

    if (
      select count(*)
      from public.non_medical_agent_aliases
      where agent_id = first_id
    ) <> 2 then
      raise exception 'Self-test failed: a rename did not keep the old name.';
    end if;

    rejected := false;

    begin
      update public.non_medical_agents
      set display_name = 'qa self test agent two'
      where id = first_id;
    exception
      when unique_violation then
        rejected := true;
    end;

    if not rejected then
      raise exception 'Self-test failed: the name of another agent was accepted.';
    end if;

    rejected := false;

    begin
      delete from public.non_medical_agent_aliases
      where agent_id = second_id;
    exception
      when check_violation then
        rejected := true;
    end;

    if not rejected then
      raise exception 'Self-test failed: a display name spelling was removed.';
    end if;

    perform public.qa_non_medical_merge_agents(second_id, first_id);

    if exists (select 1 from public.non_medical_agents where id = second_id)
      or (
        select count(*)
        from public.non_medical_agent_aliases
        where agent_id = first_id
      ) <> 3 then
      raise exception 'Self-test failed: the merge did not move every spelling.';
    end if;

    insert into public.non_medical_agents (display_name)
    values ('QA Self Test Agent Three')
    returning id into third_id;

    rejected := false;

    begin
      update public.non_medical_agent_aliases
      set agent_id = third_id
      where agent_id = first_id
        and alias_key = 'qa self test agent renamed';
    exception
      when check_violation then
        rejected := true;
    end;

    if not rejected then
      raise exception 'Self-test failed: a display name spelling moved outside a merge.';
    end if;

    rejected := false;

    begin
      perform public.qa_non_medical_merge_agents(first_id, first_id);
    exception
      when invalid_parameter_value then
        rejected := true;
    end;

    if not rejected then
      raise exception 'Self-test failed: an agent was merged into itself.';
    end if;

    raise exception using errcode = 'QAT01', message = 'Self-test passed.';
  exception
    when sqlstate 'QAT01' then
      null; -- Every test change above is undone here.
  end;
end;
$$;

commit;

-- Makes the new tables, views and function visible to the API right away.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Result (read-only). The SQL Editor shows this row after the script.
-- Expected on the first run: active_agents = agents,
-- rows_counted = non_medical_qa_rows, unmatched_names = 0.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.non_medical_agents) as agents,
  (select count(*) from public.non_medical_agents where active) as active_agents,
  (select count(*) from public.qa_errors where audit_type = 'non_medical')
    as non_medical_qa_rows,
  (select count(*) from public.non_medical_qa_errors_resolved where pharmacist_active)
    as rows_counted,
  (select count(*) from public.non_medical_unmatched_names) as unmatched_names;
