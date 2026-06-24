// ─────────────────────────────────────────────────────────────────────────────
// Precise catalogue lookup — pure, deterministic functions over the hardcoded
// data file. This is the "exact lookup" the agent calls through its tools; the
// model never guesses specs, it only chooses filter parameters.
//
// The filters are DATA-DRIVEN: `search_products` reads the filter list from the
// active example's config (config.search.filters) and applies each one
// generically here. The same code works for chips, pumps, or espresso machines
// — only the declared filters differ.
//
// ── Performance & data source ────────────────────────────────────────────────
// The catalogue is bundled into the widget and lives in memory for the life of
// the page: loaded ONCE when the script loads, never re-fetched. So these
// lookups are plain in-memory array filters — effectively instant even for
// thousands of rows, with no per-query network call. (The latency you feel in
// the agent is the model's own round-trips, not the catalogue.)
//
// To back the catalogue with a live PIM/database instead, keep these function
// signatures and just change where the data comes from — fetch it ONCE and
// cache it in memory so you never refetch per query:
//
//   let cached: Catalogue | null = null;
//   async function load(): Promise<Catalogue> {
//     if (!cached) cached = await (await fetch("/api/catalogue")).json();
//     return cached;                       // reused for the rest of the session
//   }
//   // then call: searchProducts(await load(), filters, params)
//
// Or push filtering server-side: POST the same filter params to your own
// /api/catalogue/search endpoint and let SQL / your PIM run the query. Either
// way the tool layer and the declared search.filters stay exactly the same.
// ─────────────────────────────────────────────────────────────────────────────
import type { Catalogue, ProductFamily, ProductPart } from "./schema";
import type { SearchFilter, SelectorConfig } from "../config/types";

type SearchConfig = SelectorConfig["search"];

export interface SearchParams {
  category?: string;
  keyword?: string;
  result_type?: "families" | "parts" | "both";
  // plus one entry per declared SearchFilter (param → value)
  [param: string]: unknown;
}

const DEFAULT_MAX_RESULTS = 15;
const DEFAULT_RESULT_LIMIT = 50;

function contains(field: string | null | undefined, query: string): boolean {
  if (!field) return false;
  return field.toLowerCase().includes(query.toLowerCase());
}

/** Largest integer in a string like "512 – 2560" or "1024" (for `min` filters). */
function maxNumber(value: string | null | undefined): number {
  const nums = numbersIn(value);
  return nums.length ? Math.max(...nums) : NaN;
}

/** Smallest integer in a string (for `max` filters). */
function minNumber(value: string | null | undefined): number {
  const nums = numbersIn(value);
  return nums.length ? Math.min(...nums) : NaN;
}

function numbersIn(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .replace(/,(?=\d{3}\b)/g, "") // strip thousands separators
    .split(/[^\d.]+/)
    .map((s) => parseFloat(s))
    .filter((n) => !isNaN(n));
}

function keywordText(row: Record<string, string | null>, keys: string[]): string {
  return keys.map((k) => row[k]).filter(Boolean).join(" ").toLowerCase();
}

/** Apply one declared filter to a row. Absent cells are skipped, not failed. */
function passesFilter(row: Record<string, string | null>, f: SearchFilter, value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  const cell = row[f.column];
  if (cell === undefined || cell === null) return true; // row doesn't carry this column

  switch (f.kind) {
    case "text":
    case "enum":
      return contains(cell, String(value));
    case "boolean": {
      if (value !== true) return true; // false / "don't care" → no constraint
      const truthy = f.trueValue ?? "Yes";
      return cell.toLowerCase() === truthy.toLowerCase();
    }
    case "min": {
      const n = maxNumber(cell);
      return !isNaN(n) && n >= Number(value);
    }
    case "max": {
      const n = minNumber(cell);
      return !isNaN(n) && n <= Number(value);
    }
  }
}

function rowMatches(
  row: ProductFamily | ProductPart,
  params: SearchParams,
  filters: SearchFilter[],
  keywordKeys: string[],
): boolean {
  if (params.category && params.category !== "any" && row.category !== params.category) return false;
  if (params.keyword && !keywordText(row, keywordKeys).includes(String(params.keyword).toLowerCase())) {
    return false;
  }
  return filters.every((f) => passesFilter(row, f, params[f.param]));
}

/** Deterministic relevance score: weighted keyword-term hits across fields. */
function scoreRow(row: Record<string, string | null>, terms: string[], fields: string[]): number {
  if (!terms.length) return 0;
  let score = 0;
  const n = fields.length;
  fields.forEach((field, i) => {
    const cell = (row[field] ?? "").toLowerCase();
    if (!cell) return;
    const weight = n - i; // earlier fields (e.g. name) weighted higher
    for (const t of terms) if (cell.includes(t)) score += weight;
  });
  return score;
}

/**
 * Orders matched rows deterministically:
 *   1. if a keyword is present → by relevance score (desc)
 *   2. else if defaultSort is set → by that column's number (asc/desc)
 *   3. else → catalogue order
 * Always tie-broken by original index, so the order is fully reproducible.
 */
function rankRows<T extends Record<string, string | null>>(
  rows: T[],
  params: SearchParams,
  keywordKeys: string[],
  defaultSort?: SearchConfig["defaultSort"],
): T[] {
  const terms = String(params.keyword ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length) {
    return rows
      .map((row, i) => ({ row, i, s: scoreRow(row, terms, keywordKeys) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.row);
  }
  if (defaultSort) {
    const dir = defaultSort.direction === "desc" ? -1 : 1;
    return rows
      .map((row, i) => ({ row, i, n: maxNumber(row[defaultSort.column]) }))
      .sort((a, b) => {
        const an = isNaN(a.n) ? null : a.n;
        const bn = isNaN(b.n) ? null : b.n;
        if (an === null && bn === null) return a.i - b.i; // unknowns keep order
        if (an === null) return 1; // unknowns always last
        if (bn === null) return -1;
        return (an - bn) * dir || a.i - b.i;
      })
      .map((x) => x.row);
  }
  return rows;
}

export function searchProducts(catalogue: Catalogue, search: SearchConfig, params: SearchParams) {
  const filters = search.filters;
  const maxResults = search.maxResults ?? DEFAULT_MAX_RESULTS;
  const resultLimit = search.resultLimit ?? DEFAULT_RESULT_LIMIT;
  const { keyword: keywordKeys, familyName } = catalogue.fields;
  const resultType = params.result_type ?? "both";

  const families =
    resultType === "parts" ? [] : catalogue.families.filter((f) => rowMatches(f, params, filters, keywordKeys));

  const matchedParts =
    resultType === "families" ? [] : catalogue.parts.filter((p) => rowMatches(p, params, filters, keywordKeys));
  const total = matchedParts.length;
  const ranked = rankRows(matchedParts, params, keywordKeys, search.defaultSort);
  const returned = ranked.slice(0, resultLimit);

  // `note` steers the model: the authoritative ranked list is shown to the user
  // in the UI, so summarise rather than re-typing every row.
  const note =
    total === 0 && families.length === 0
      ? "No products matched. Relax a filter or broaden the keyword."
      : total > returned.length
        ? `${total} products matched; showing the top ${returned.length} (ranked). Suggest the user refine filters to narrow further. An interactive, complete list is displayed to them.`
        : total > maxResults
          ? `${total} products matched, ranked and shown to the user as a list (first ${maxResults} visible, with a "Show all" toggle). Summarise the top few; do not enumerate every row.`
          : undefined;

  return {
    total_matched: total,
    returned: returned.length,
    families_matched: families.length,
    families: families.map((f) => ({ name: f[familyName], ...f })),
    parts: returned,
    note,
  };
}

export function getProductSpecs(catalogue: Catalogue, partNumber: string) {
  const col = catalogue.fields.partNumber;
  const pn = partNumber.trim().toLowerCase();
  const part = catalogue.parts.find((p) => (p[col] ?? "").toLowerCase() === pn);
  if (!part) {
    return {
      error: `Product '${partNumber}' not found.`,
      suggestion: "Use search_products to find the right product first.",
    };
  }
  return part;
}

export interface ComparedPart {
  part_number?: string | null;
  url?: string | null;
  category?: string;
  family?: string | null;
  type?: string | null;
  specs?: Record<string, string | null>;
  error?: string;
}

export function compareProducts(
  catalogue: Catalogue,
  partNumbers: string[],
  rows: { key: string }[],
): { comparison: ComparedPart[] } {
  const { partNumber: pnCol, familyName, partUrl } = catalogue.fields;
  const comparison = partNumbers.map((pn) => {
    const part = catalogue.parts.find((p) => (p[pnCol] ?? "").toLowerCase() === pn.trim().toLowerCase());
    if (!part) return { error: `Product '${pn}' not found.` };
    const specs: Record<string, string | null> = {};
    for (const { key } of rows) specs[key] = part[key] ?? null;
    return {
      part_number: part[pnCol],
      url: partUrl ? (part[partUrl] ?? null) : null,
      category: part.category,
      family: part[familyName],
      type: part["Type"] ?? null,
      specs,
    };
  });
  return { comparison };
}
