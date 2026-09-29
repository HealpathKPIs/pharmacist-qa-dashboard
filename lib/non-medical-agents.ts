import { createComparisonKey } from "@/lib/excel-normalization";

// Non-Medical agent roster (Settings > Non-Medical Agents). Only active agents
// count in Non-Medical QA; a stored name counts for the agent that owns its
// spelling (case and extra spaces are ignored, as in the database).
// Pure helpers, shared by the server and the upload page in the browser.

export type NonMedicalAgentAlias = {
  alias: string;
  aliasKey: string;
  firstDay: string | null;
  id: number;
  isDisplayName: boolean;
  lastDay: string | null;
  qaErrorRecords: number;
};

export type NonMedicalAgent = {
  active: boolean;
  aliases: NonMedicalAgentAlias[];
  createdAt: string;
  displayName: string;
  // First and last day of the agent's Non-Medical QA rows; null without rows.
  firstDay: string | null;
  id: number;
  lastDay: string | null;
  qaErrorRecords: number;
  updatedAt: string;
};

export type UnmatchedNonMedicalName = {
  agentName: string;
  firstDay: string;
  lastDay: string;
  records: number;
};

// Minimal roster for checking the agent names of an upload.
export type NonMedicalAgentMatchEntry = {
  active: boolean;
  aliasKeys: string[];
  displayName: string;
  id: number;
};

export type NonMedicalAgentRow = {
  active: boolean;
  created_at: string;
  display_name: string;
  id: number;
  updated_at: string;
};

export type NonMedicalAliasUsageRow = {
  agent_id: number;
  alias: string;
  alias_id: number;
  alias_key: string;
  first_day: string | null;
  last_day: string | null;
  qa_error_records: number;
};

function earliest(left: string | null, right: string | null) {
  return left === null || (right !== null && right < left) ? right : left;
}

function latest(left: string | null, right: string | null) {
  return left === null || (right !== null && right > left) ? right : left;
}

// Agents in the given order, each with its spellings (display name first)
// and the QA rows and dates of all its spellings together.
export function buildNonMedicalRoster(
  agentRows: readonly NonMedicalAgentRow[],
  aliasRows: readonly NonMedicalAliasUsageRow[],
): NonMedicalAgent[] {
  const aliasesByAgent = new Map<number, NonMedicalAliasUsageRow[]>();

  for (const alias of aliasRows) {
    const agentAliases = aliasesByAgent.get(alias.agent_id);

    if (agentAliases) {
      agentAliases.push(alias);
    } else {
      aliasesByAgent.set(alias.agent_id, [alias]);
    }
  }

  return agentRows.map((agent) => {
    const displayNameKey = createComparisonKey(agent.display_name);
    const aliases = (aliasesByAgent.get(agent.id) ?? [])
      .map((alias) => ({
        alias: alias.alias,
        aliasKey: alias.alias_key,
        firstDay: alias.first_day,
        id: alias.alias_id,
        isDisplayName: alias.alias_key === displayNameKey,
        lastDay: alias.last_day,
        qaErrorRecords: alias.qa_error_records,
      }))
      .sort(
        (left, right) =>
          Number(right.isDisplayName) - Number(left.isDisplayName) ||
          left.alias.localeCompare(right.alias),
      );

    return {
      active: agent.active,
      aliases,
      createdAt: agent.created_at,
      displayName: agent.display_name,
      firstDay: aliases.reduce<string | null>((day, alias) => earliest(day, alias.firstDay), null),
      id: agent.id,
      lastDay: aliases.reduce<string | null>((day, alias) => latest(day, alias.lastDay), null),
      qaErrorRecords: aliases.reduce((total, alias) => total + alias.qaErrorRecords, 0),
      updatedAt: agent.updated_at,
    };
  });
}

export type AgentNameCheck = {
  // The agent the name belongs to; null when it is not on the list.
  agentName: string | null;
  name: string;
  rows: number;
  status: "counted" | "inactive" | "not_on_list";
};

// Agent names of an upload's QA error rows against the roster, most rows
// first. Names that differ only in case or spaces are one name.
export function checkNonMedicalAgentNames(
  names: readonly string[],
  roster: readonly NonMedicalAgentMatchEntry[],
): AgentNameCheck[] {
  const agentByKey = new Map<string, NonMedicalAgentMatchEntry>();

  for (const agent of roster) {
    for (const aliasKey of agent.aliasKeys) {
      agentByKey.set(aliasKey, agent);
    }
  }

  const namesByKey = new Map<string, { name: string; rows: number }>();

  for (const name of names) {
    const key = createComparisonKey(name);
    const entry = namesByKey.get(key);

    if (entry) {
      entry.rows += 1;
    } else {
      namesByKey.set(key, { name, rows: 1 });
    }
  }

  return [...namesByKey.entries()]
    .map(([key, { name, rows }]): AgentNameCheck => {
      const agent = agentByKey.get(key);

      return {
        agentName: agent?.displayName ?? null,
        name,
        rows,
        status: !agent ? "not_on_list" : agent.active ? "counted" : "inactive",
      };
    })
    .sort((left, right) => right.rows - left.rows || left.name.localeCompare(right.name));
}
