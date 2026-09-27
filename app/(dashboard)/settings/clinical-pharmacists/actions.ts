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

// Clinical QA roster only. These actions never touch QA or patient records;
// deactivating a pharmacist only hides them from Clinical calculations.

const ROSTER_PATH = "/settings/clinical-pharmacists";
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

async function getPharmacistName(pharmacistId: number) {
  const { data } = await getSupabaseAdminClient()
    .from("clinical_pharmacists")
    .select("display_name")
    .eq("id", pharmacistId)
    .maybeSingle();

  return data?.display_name ?? null;
}

// Returns the name of the pharmacist that already owns this spelling, if any.
async function findNameOwner(name: string) {
  const { data } = await getSupabaseAdminClient()
    .from("clinical_pharmacist_aliases")
    .select("pharmacist_id")
    .eq("alias_key", createComparisonKey(name))
    .maybeSingle();

  return data ? { id: data.pharmacist_id, name: await getPharmacistName(data.pharmacist_id) } : null;
}

export async function createClinicalPharmacistAction(formData: FormData) {
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
      finish(`"${name}" already belongs to ${owner.name ?? "another pharmacist"}.`, "error");
    }
  }

  const supabase = getSupabaseAdminClient();
  const { data: pharmacist, error } = await supabase
    .from("clinical_pharmacists")
    .insert({ active: true, display_name: displayName })
    .select("id")
    .single();

  if (error || !pharmacist) {
    finish(
      isDuplicateName(error)
        ? `"${displayName}" already belongs to another pharmacist.`
        : (error?.message ?? "The pharmacist could not be added."),
      "error",
    );
  }

  if (extraAliases.length > 0) {
    const { error: aliasError } = await supabase
      .from("clinical_pharmacist_aliases")
      .insert(
        extraAliases.map((alias) => ({ alias, pharmacist_id: pharmacist.id })),
      );

    if (aliasError) {
      finish(
        `${displayName} was added, but the other spellings could not be saved: ${aliasError.message}`,
        "error",
      );
    }
  }

  finish(`Added ${displayName}. They count in Clinical QA immediately.`);
}

export async function renameClinicalPharmacistAction(formData: FormData) {
  await requireAdmin();

  const pharmacistId = idField(formData, "pharmacistId");
  const displayName = textField(formData, "displayName");

  if (!pharmacistId || !isValidName(displayName)) {
    finish(`Enter a name of 1 to ${MAX_NAME_LENGTH} characters.`, "error");
  }

  const previousName = await getPharmacistName(pharmacistId);

  if (!previousName) {
    finish("The pharmacist was not found.", "error");
  }

  if (previousName === displayName) {
    finish("The name is unchanged.");
  }

  // The database keeps the old name as an alias, so existing records keep
  // matching, and rejects a name that belongs to another pharmacist.
  const { error } = await getSupabaseAdminClient()
    .from("clinical_pharmacists")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", pharmacistId);

  if (error) {
    finish(
      isDuplicateName(error)
        ? `"${displayName}" already belongs to another pharmacist.`
        : error.message,
      "error",
    );
  }

  finish(
    `Renamed ${previousName} to ${displayName}. "${previousName}" stays as an alias, so existing records keep matching.`,
  );
}

export async function addClinicalPharmacistAliasAction(formData: FormData) {
  await requireAdmin();

  const pharmacistId = idField(formData, "pharmacistId");
  const alias = textField(formData, "alias");

  if (!pharmacistId || !isValidName(alias)) {
    finish(`Enter a spelling of 1 to ${MAX_NAME_LENGTH} characters.`, "error");
  }

  const pharmacistName = await getPharmacistName(pharmacistId);

  if (!pharmacistName) {
    finish("The pharmacist was not found.", "error");
  }

  const owner = await findNameOwner(alias);

  if (owner) {
    finish(
      owner.id === pharmacistId
        ? `"${alias}" is already linked to ${pharmacistName}.`
        : `"${alias}" already belongs to ${owner.name ?? "another pharmacist"}.`,
      "error",
    );
  }

  const { error } = await getSupabaseAdminClient()
    .from("clinical_pharmacist_aliases")
    .insert({ alias, pharmacist_id: pharmacistId });

  if (error) {
    finish(
      isDuplicateName(error)
        ? `"${alias}" already belongs to another pharmacist.`
        : error.message,
      "error",
    );
  }

  finish(`Linked "${alias}" to ${pharmacistName}. Matching records now count for them.`);
}

export async function removeClinicalPharmacistAliasAction(formData: FormData) {
  await requireAdmin();

  const aliasId = idField(formData, "aliasId");

  if (!aliasId) {
    finish("The alias was not found.", "error");
  }

  const supabase = getSupabaseAdminClient();
  const { data: usage } = await supabase
    .from("clinical_alias_usage")
    .select("alias, qa_error_records")
    .eq("alias_id", aliasId)
    .maybeSingle();

  if (!usage) {
    finish("The alias was not found.", "error");
  }

  if (usage.qa_error_records > 0 && formData.get("confirm") !== "on") {
    finish(
      `Confirm the removal: ${usage.qa_error_records} Clinical QA rows use "${usage.alias}" and will stop counting.`,
      "error",
    );
  }

  // The database refuses to remove the alias equal to the current display name.
  const { error } = await supabase
    .from("clinical_pharmacist_aliases")
    .delete()
    .eq("id", aliasId);

  if (error) {
    finish(
      error.code === "23514"
        ? "The current display name cannot be removed. Rename the pharmacist first."
        : error.message,
      "error",
    );
  }

  finish(`Removed "${usage.alias}".`);
}

export async function setClinicalPharmacistActiveAction(formData: FormData) {
  await requireAdmin();

  const pharmacistId = idField(formData, "pharmacistId");
  const active = formData.get("active") === "true";

  if (!pharmacistId) {
    finish("The pharmacist was not found.", "error");
  }

  const pharmacistName = await getPharmacistName(pharmacistId);

  if (!pharmacistName) {
    finish("The pharmacist was not found.", "error");
  }

  const { error } = await getSupabaseAdminClient()
    .from("clinical_pharmacists")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", pharmacistId);

  if (error) {
    finish(error.message, "error");
  }

  finish(
    active
      ? `Reactivated ${pharmacistName}. Their records count in Clinical QA again.`
      : `Deactivated ${pharmacistName}. Their records are kept and hidden from Clinical calculations.`,
  );
}
