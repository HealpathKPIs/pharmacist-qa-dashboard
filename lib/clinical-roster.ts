import "server-only";

import { createComparisonKey } from "@/lib/excel-normalization";
import type { ReconciliationRosterEntry } from "@/lib/reconciliation-validation";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchAllPages } from "@/lib/supabase-pagination";

// The Clinical pharmacist roster applies to Clinical QA only. Non-Medical and
// Doctors never read these tables.

export type ClinicalPharmacistAlias = {
  alias: string;
  aliasKey: string;
  id: number;
  isDisplayName: boolean;
  qaErrorRecords: number;
};

export type ClinicalPharmacist = {
  active: boolean;
  aliases: ClinicalPharmacistAlias[];
  createdAt: string;
  displayName: string;
  id: number;
  qaErrorRecords: number;
  updatedAt: string;
  workloadRecords: number;
};

export type UnmatchedClinicalName = {
  firstDay: string;
  lastDay: string;
  pharmacistName: string;
  records: number;
};

export async function getClinicalRoster(): Promise<ClinicalPharmacist[]> {
  const supabase = getSupabaseAdminClient();
  const [pharmacistsResult, aliasesResult, workloadRows] = await Promise.all([
    supabase
      .from("clinical_pharmacists")
      .select("active, created_at, display_name, id, updated_at")
      .order("display_name"),
    supabase
      .from("clinical_alias_usage")
      .select("alias, alias_id, alias_key, pharmacist_id, qa_error_records")
      .order("alias"),
    fetchAllPages((from, to) =>
      supabase
        .from("pharmacist_workload")
        .select("id, pharmacist_id")
        .order("id")
        .range(from, to),
    ),
  ]);

  if (pharmacistsResult.error) {
    throw new Error(pharmacistsResult.error.message);
  }

  if (aliasesResult.error) {
    throw new Error(aliasesResult.error.message);
  }

  const workloadRecords = new Map<number, number>();

  for (const row of workloadRows) {
    workloadRecords.set(row.pharmacist_id, (workloadRecords.get(row.pharmacist_id) ?? 0) + 1);
  }

  return (pharmacistsResult.data ?? []).map((pharmacist) => {
    const displayNameKey = createComparisonKey(pharmacist.display_name);
    const aliases = (aliasesResult.data ?? [])
      .filter((alias) => alias.pharmacist_id === pharmacist.id)
      .map((alias) => ({
        alias: alias.alias,
        aliasKey: alias.alias_key,
        id: alias.alias_id,
        isDisplayName: alias.alias_key === displayNameKey,
        qaErrorRecords: alias.qa_error_records,
      }))
      .sort(
        (left, right) =>
          Number(right.isDisplayName) - Number(left.isDisplayName) ||
          left.alias.localeCompare(right.alias),
      );

    return {
      active: pharmacist.active,
      aliases,
      createdAt: pharmacist.created_at,
      displayName: pharmacist.display_name,
      id: pharmacist.id,
      qaErrorRecords: aliases.reduce((total, alias) => total + alias.qaErrorRecords, 0),
      updatedAt: pharmacist.updated_at,
      workloadRecords: workloadRecords.get(pharmacist.id) ?? 0,
    };
  });
}

// Minimal roster for matching tracker headers (active and inactive).
export async function getClinicalRosterForMatching(): Promise<ReconciliationRosterEntry[]> {
  const supabase = getSupabaseAdminClient();
  const [pharmacistsResult, aliasesResult] = await Promise.all([
    supabase.from("clinical_pharmacists").select("active, display_name, id"),
    supabase.from("clinical_pharmacist_aliases").select("alias_key, pharmacist_id"),
  ]);

  if (pharmacistsResult.error) {
    throw new Error(pharmacistsResult.error.message);
  }

  if (aliasesResult.error) {
    throw new Error(aliasesResult.error.message);
  }

  return (pharmacistsResult.data ?? []).map((pharmacist) => ({
    active: pharmacist.active,
    aliasKeys: (aliasesResult.data ?? [])
      .filter((alias) => alias.pharmacist_id === pharmacist.id)
      .map((alias) => alias.alias_key),
    displayName: pharmacist.display_name,
    id: pharmacist.id,
  }));
}

export async function getActiveClinicalPharmacistNames(): Promise<string[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("clinical_pharmacists")
    .select("display_name")
    .eq("active", true)
    .order("display_name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((pharmacist) => pharmacist.display_name);
}

export async function getUnmatchedClinicalNames(): Promise<UnmatchedClinicalName[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("clinical_unmatched_names")
    .select("first_day, last_day, pharmacist_name, records")
    .order("records", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    firstDay: row.first_day,
    lastDay: row.last_day,
    pharmacistName: row.pharmacist_name,
    records: row.records,
  }));
}
