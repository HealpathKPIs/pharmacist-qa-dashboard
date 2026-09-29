import "server-only";

import {
  buildNonMedicalRoster,
  type NonMedicalAgent,
  type NonMedicalAgentMatchEntry,
  type UnmatchedNonMedicalName,
} from "@/lib/non-medical-agents";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// The Non-Medical agent roster applies to Non-Medical QA only. Clinical and
// Doctors never read these tables.

export async function getNonMedicalRoster(): Promise<NonMedicalAgent[]> {
  const supabase = getSupabaseAdminClient();
  const [agentsResult, aliasesResult] = await Promise.all([
    supabase
      .from("non_medical_agents")
      .select("active, created_at, display_name, id, updated_at")
      .order("display_name"),
    supabase
      .from("non_medical_alias_usage")
      .select("agent_id, alias, alias_id, alias_key, first_day, last_day, qa_error_records")
      .order("alias"),
  ]);

  if (agentsResult.error) {
    throw new Error(agentsResult.error.message);
  }

  if (aliasesResult.error) {
    throw new Error(aliasesResult.error.message);
  }

  return buildNonMedicalRoster(agentsResult.data ?? [], aliasesResult.data ?? []);
}

// Minimal roster for checking the agent names of an upload (active and
// inactive).
export async function getNonMedicalRosterForMatching(): Promise<NonMedicalAgentMatchEntry[]> {
  const supabase = getSupabaseAdminClient();
  const [agentsResult, aliasesResult] = await Promise.all([
    supabase.from("non_medical_agents").select("active, display_name, id"),
    supabase.from("non_medical_agent_aliases").select("agent_id, alias_key"),
  ]);

  if (agentsResult.error) {
    throw new Error(agentsResult.error.message);
  }

  if (aliasesResult.error) {
    throw new Error(aliasesResult.error.message);
  }

  const aliasKeysByAgent = new Map<number, string[]>();

  for (const alias of aliasesResult.data ?? []) {
    aliasKeysByAgent.set(alias.agent_id, [
      ...(aliasKeysByAgent.get(alias.agent_id) ?? []),
      alias.alias_key,
    ]);
  }

  return (agentsResult.data ?? []).map((agent) => ({
    active: agent.active,
    aliasKeys: aliasKeysByAgent.get(agent.id) ?? [],
    displayName: agent.display_name,
    id: agent.id,
  }));
}

export async function getActiveNonMedicalAgentNames(): Promise<string[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("non_medical_agents")
    .select("display_name")
    .eq("active", true)
    .order("display_name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((agent) => agent.display_name);
}

export async function getUnmatchedNonMedicalNames(): Promise<UnmatchedNonMedicalName[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("non_medical_unmatched_names")
    .select("first_day, last_day, pharmacist_name, records")
    .order("records", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    agentName: row.pharmacist_name,
    firstDay: row.first_day,
    lastDay: row.last_day,
    records: row.records,
  }));
}
