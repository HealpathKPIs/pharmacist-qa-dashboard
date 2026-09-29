"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth-server";
import {
  createComparisonKey,
  removeExtraSpaces,
} from "@/lib/excel-normalization";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// Non-Medical QA roster only. These actions never touch QA or case records;
// deactivating an agent only hides them from Non-Medical calculations.

const ROSTER_PATH = "/settings/non-medical-agents";
const MAX_NAME_LENGTH = 80;

function textField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? removeExtraSpaces(value) : "";
}

function idField(formData: FormData, name: string) {
  const value = Number(formData.get(name));

  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isValidName(name: string) {
  return name.length > 0 && name.length <= MAX_NAME_LENGTH;
}

function formatRows(rows: number) {
  return `${new Intl.NumberFormat("en-US").format(rows)} QA ${rows === 1 ? "row" : "rows"}`;
}

function finish(
  message: string,
  type: "error" | "success" = "success",
): never {
  revalidatePath(ROSTER_PATH);
  redirect(`${ROSTER_PATH}?${type}=${encodeURIComponent(message)}`);
}

function isDuplicateName(error: PostgrestError | null) {
  return error?.code === "23505";
}

async function getAgent(agentId: number) {
  const { data } = await getSupabaseAdminClient()
    .from("non_medical_agents")
    .select("active, display_name")
    .eq("id", agentId)
    .maybeSingle();

  return data ? { active: data.active, name: data.display_name } : null;
}

// Returns the agent that already owns this spelling, if any.
async function findNameOwner(name: string) {
  const { data } = await getSupabaseAdminClient()
    .from("non_medical_agent_aliases")
    .select("agent_id")
    .eq("alias_key", createComparisonKey(name))
    .maybeSingle();

  return data ? { id: data.agent_id, name: (await getAgent(data.agent_id))?.name ?? null } : null;
}

export async function createNonMedicalAgentAction(formData: FormData) {
  await requireAdmin();

  const displayName = textField(formData, "displayName");
  const extraAliases = [
    ...new Map(
      String(formData.get("aliases") ?? "")
        .split(/[,\n]/)
        .map(removeExtraSpaces)
        .filter(Boolean)
        .map((alias) => [createComparisonKey(alias), alias] as const),
    ).entries(),
  ]
    .filter(([aliasKey]) => aliasKey !== createComparisonKey(displayName))
    .map(([, alias]) => alias);

  if (!isValidName(displayName) || extraAliases.some((alias) => !isValidName(alias))) {
    finish(`Enter a name of 1 to ${MAX_NAME_LENGTH} characters.`, "error");
  }

  for (const name of [displayName, ...extraAliases]) {
    const owner = await findNameOwner(name);

    if (owner) {
      finish(`"${name}" already belongs to ${owner.name ?? "another agent"}.`, "error");
    }
  }

  const supabase = getSupabaseAdminClient();
  const { data: agent, error } = await supabase
    .from("non_medical_agents")
    .insert({ active: true, display_name: displayName })
    .select("id")
    .single();

  if (error || !agent) {
    finish(
      isDuplicateName(error)
        ? `"${displayName}" already belongs to another agent.`
        : (error?.message ?? "The agent could not be added."),
      "error",
    );
  }

  if (extraAliases.length > 0) {
    const { error: aliasError } = await supabase
      .from("non_medical_agent_aliases")
      .insert(extraAliases.map((alias) => ({ agent_id: agent.id, alias })));

    if (aliasError) {
      finish(
        `${displayName} was added, but the other spellings could not be saved: ${aliasError.message}`,
        "error",
      );
    }
  }

  finish(`Added ${displayName}. They count in Non-Medical QA immediately.`);
}

export async function renameNonMedicalAgentAction(formData: FormData) {
  await requireAdmin();

  const agentId = idField(formData, "agentId");
  const displayName = textField(formData, "displayName");

  if (!agentId || !isValidName(displayName)) {
    finish(`Enter a name of 1 to ${MAX_NAME_LENGTH} characters.`, "error");
  }

  const previousName = (await getAgent(agentId))?.name;

  if (!previousName) {
    finish("The agent was not found.", "error");
  }

  if (previousName === displayName) {
    finish("The name is unchanged.");
  }

  // The database keeps the old name as an alias, so existing records keep
  // matching, and rejects a name that belongs to another agent.
  const { error } = await getSupabaseAdminClient()
    .from("non_medical_agents")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", agentId);

  if (error) {
    finish(
      isDuplicateName(error)
        ? `"${displayName}" already belongs to another agent.`
        : error.message,
      "error",
    );
  }

  finish(
    `Renamed ${previousName} to ${displayName}. "${previousName}" stays as an alias, so existing records keep matching.`,
  );
}

export async function addNonMedicalAgentAliasAction(formData: FormData) {
  await requireAdmin();

  const agentId = idField(formData, "agentId");
  const alias = textField(formData, "alias");

  if (!agentId || !isValidName(alias)) {
    finish(`Enter a spelling of 1 to ${MAX_NAME_LENGTH} characters.`, "error");
  }

  const agentName = (await getAgent(agentId))?.name;

  if (!agentName) {
    finish("The agent was not found.", "error");
  }

  const owner = await findNameOwner(alias);

  if (owner) {
    finish(
      owner.id === agentId
        ? `"${alias}" is already linked to ${agentName}.`
        : `"${alias}" already belongs to ${owner.name ?? "another agent"}.`,
      "error",
    );
  }

  const { error } = await getSupabaseAdminClient()
    .from("non_medical_agent_aliases")
    .insert({ agent_id: agentId, alias });

  if (error) {
    finish(
      isDuplicateName(error)
        ? `"${alias}" already belongs to another agent.`
        : error.message,
      "error",
    );
  }

  finish(`Linked "${alias}" to ${agentName}. Matching records now count for them.`);
}

export async function removeNonMedicalAgentAliasAction(formData: FormData) {
  await requireAdmin();

  const aliasId = idField(formData, "aliasId");

  if (!aliasId) {
    finish("The alias was not found.", "error");
  }

  const supabase = getSupabaseAdminClient();
  const { data: usage } = await supabase
    .from("non_medical_alias_usage")
    .select("alias, qa_error_records")
    .eq("alias_id", aliasId)
    .maybeSingle();

  if (!usage) {
    finish("The alias was not found.", "error");
  }

  if (usage.qa_error_records > 0 && formData.get("confirm") !== "on") {
    finish(
      `Confirm the removal: ${formatRows(usage.qa_error_records)} use "${usage.alias}" and will stop counting.`,
      "error",
    );
  }

  // The database refuses to remove the alias equal to the current display name.
  const { error } = await supabase
    .from("non_medical_agent_aliases")
    .delete()
    .eq("id", aliasId);

  if (error) {
    finish(
      error.code === "23514"
        ? "The current display name cannot be removed. Rename the agent first."
        : error.message,
      "error",
    );
  }

  finish(`Removed "${usage.alias}".`);
}

export async function setNonMedicalAgentActiveAction(formData: FormData) {
  await requireAdmin();

  const agentId = idField(formData, "agentId");
  const active = formData.get("active") === "true";

  if (!agentId) {
    finish("The agent was not found.", "error");
  }

  const agentName = (await getAgent(agentId))?.name;

  if (!agentName) {
    finish("The agent was not found.", "error");
  }

  const { error } = await getSupabaseAdminClient()
    .from("non_medical_agents")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", agentId);

  if (error) {
    finish(error.message, "error");
  }

  finish(
    active
      ? `Reactivated ${agentName}. Their records count in Non-Medical QA again.`
      : `Deactivated ${agentName}. Their records are kept and hidden from Non-Medical calculations.`,
  );
}

// One person listed twice: every spelling of the merged agent moves to the
// kept agent, and the merged agent leaves the list. QA records are unchanged.
export async function mergeNonMedicalAgentsAction(formData: FormData) {
  await requireAdmin();

  const mergeAgentId = idField(formData, "mergeAgentId");
  const keepAgentId = idField(formData, "keepAgentId");

  if (!mergeAgentId || !keepAgentId) {
    finish("Choose the agent to merge and the agent to keep.", "error");
  }

  if (mergeAgentId === keepAgentId) {
    finish("Choose two different agents.", "error");
  }

  if (formData.get("confirm") !== "on") {
    finish("Confirm the merge: tick the box before merging.", "error");
  }

  const supabase = getSupabaseAdminClient();
  const [mergeAgent, keepAgent, usageResult] = await Promise.all([
    getAgent(mergeAgentId),
    getAgent(keepAgentId),
    supabase
      .from("non_medical_alias_usage")
      .select("qa_error_records")
      .eq("agent_id", mergeAgentId),
  ]);

  if (!mergeAgent || !keepAgent) {
    finish("The agent was not found.", "error");
  }

  const { error } = await supabase.rpc("qa_non_medical_merge_agents", {
    keep_agent_id: keepAgentId,
    merge_agent_id: mergeAgentId,
  });

  if (error) {
    finish(error.message, "error");
  }

  const movedRows = (usageResult.data ?? []).reduce(
    (total, row) => total + row.qa_error_records,
    0,
  );

  finish(
    `Merged ${mergeAgent.name} into ${keepAgent.name}. Their ${formatRows(movedRows)} now ${
      keepAgent.active
        ? `count for ${keepAgent.name}.`
        : `belong to ${keepAgent.name}, who is inactive, so they stay hidden from Non-Medical calculations.`
    }`,
  );
}
