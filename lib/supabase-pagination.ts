import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

// Must not exceed the Supabase API "Max Rows" setting (1000 by default).
const PAGE_SIZE = 1000;

type PageResponse<Row> = PromiseLike<{
  data: Row[] | null;
  error: PostgrestError | null;
}>;

// Reads every row of a query page by page, so results are never cut off by
// the API row limit. fetchPage must build a fresh query with a stable order
// (for example .order("id")) and apply .range(from, to).
export async function fetchAllPages<Row>(
  fetchPage: (from: number, to: number) => PageResponse<Row>,
): Promise<Row[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];

    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}
