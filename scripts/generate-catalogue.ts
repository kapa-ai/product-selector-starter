// ─────────────────────────────────────────────────────────────────────────────
// Catalogue generator:  spreadsheet (.xlsx / .csv)  →  an example's data.ts
//
// Usage:
//   1. Drop your file in catalogue/source/
//   2. Map your name/part columns in CONFIG.fields below.
//   3. Run:  npm run generate:catalogue
//
// The output is a single typed TS file the agent's tools read directly. The
// inference is fully DATA-DRIVEN (no domain knowledge): it picks a reasonable
// set of filters from many columns and only uses categories when your data has
// a real category column — otherwise it runs filter-only and prints candidate
// category columns for YOU to review (designating a category is a human call).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

type Row = Record<string, string | null>;

const CONFIG = {
  sourceDir: process.env.CATALOGUE_SRC ? resolve(process.env.CATALOGUE_SRC) : join(ROOT, "catalogue", "source"),
  outFile: process.env.CATALOGUE_OUT
    ? resolve(process.env.CATALOGUE_OUT)
    : join(ROOT, "src", "examples", "semiconductors", "data.ts"),
  schemaImport: "../../catalogue/schema",
  typesImport: "../../config/types",
  scaffoldConfig: true,

  /** Sheet names (case-insensitive). A CSV / single sheet is treated as parts. */
  familiesSheet: "Families",
  partsSheet: "Parts",

  /**
   * Category facet. If a column with this name exists in the data it's used as
   * the category. If not, the catalogue runs FILTER-ONLY and the generator
   * prints candidate columns you could designate (set this to one and re-run).
   */
  categoryColumn: "category",
  defaultCategory: "uncategorized",
  categoryLabels: {} as Record<string, string>,
  /**
   * OPTIONAL escape hatch for semantic groupings that no single column captures
   * (e.g. "multi-protocol = has Zigbee OR Matter"). Ships undefined on purpose —
   * this is domain logic YOU own, kept out of the generic generator. Example:
   *   deriveCategory: (row) => (row["Zigbee"] === "Y" ? "mesh" : "ble"),
   */
  deriveCategory: undefined as undefined | ((row: Row) => string | null),

  /** Cap on auto-selected filters (the rest of the columns are still in data). */
  maxFilters: 12,

  /** Map your workbook's name/part/url/keyword columns. */
  fields: {
    familyName: "Product Family",
    partNumber: "Part Number",
    partUrl: "url" as string | undefined,
    keyword: ["Product Family", "Protocols", "Use Cases", "Description"],
  },
};

function findSource(): string {
  if (!existsSync(CONFIG.sourceDir)) {
    throw new Error(`Source folder not found: ${CONFIG.sourceDir}\nAdd your .xlsx or .csv there.`);
  }
  const file = readdirSync(CONFIG.sourceDir).find((f) => /\.(xlsx|xls|csv)$/i.test(f));
  if (!file) throw new Error(`No .xlsx/.xls/.csv file found in ${CONFIG.sourceDir}`);
  return join(CONFIG.sourceDir, file);
}

function sheetRows(wb: XLSX.WorkBook, wanted: string): Row[] {
  const name = wb.SheetNames.find((s) => s.toLowerCase() === wanted.toLowerCase());
  if (!name) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: null, raw: false });
  return raw.map(normaliseRow);
}

function normaliseRow(r: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) {
    const key = k.trim().replace(/\s+/g, " "); // collapse newlines/extra spaces in headers
    if (v === null || v === undefined || v === "") out[key] = null;
    else out[key] = String(v).trim().replace(/\s+/g, " "); // tidy values too
  }
  return out;
}

// ── data-driven inference ─────────────────────────────────────────────────────
type InferredFilter =
  | { param: string; column: string; kind: "boolean"; trueValue: string; description: string }
  | { param: string; column: string; kind: "min" | "max"; description: string }
  | { param: string; column: string; kind: "enum"; values: string[]; description: string };

type CompareRow = { label: string; key: string; suffix?: string };

const NUMERIC_RE = /^\s*\d[\d.,]*\s*(?:[–-]\s*\d[\d.,]*\s*)?$/; // "512" or "512 – 1024"
const BOOL_TRUE = ["y", "yes", "true", "1"];
const BOOL_FALSE = ["n", "no", "false", "0"];

function uniqueColumns(rows: Row[]): string[] {
  const seen: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!seen.includes(k)) seen.push(k);
  return seen;
}

function slug(col: string): string {
  // Keep unit/paren content so e.g. "GSPI (48MHz)" and "GSPI (low speed)" don't collide.
  return col.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function labelAndSuffix(col: string): { label: string; suffix?: string } {
  const m = col.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { label: m[1].trim(), suffix: m[2].trim() } : { label: col };
}

interface ColProfile {
  col: string;
  values: string[];
  coverage: number;
  distinct: number;
  kind: "boolean" | "numeric" | "enum" | "text" | "skip";
  trueValue?: string;
  score: number; // usefulness as a filter: coverage × how well it splits the set
}

// Profile a column to decide if/how it makes a useful filter. Pure heuristics,
// no column-name or domain assumptions beyond a price→max hint.
function profileColumn(rows: Row[], col: string): ColProfile {
  const values = rows.map((r) => r[col]).filter((v): v is string => v != null && v !== "");
  const coverage = rows.length ? values.length / rows.length : 0;
  const set = new Set(values);
  const distinct = set.size;
  const lowers = [...set].map((v) => v.toLowerCase());
  const base: ColProfile = { col, values, coverage, distinct, kind: "skip", score: 0 };

  const allNumeric = values.length > 0 && values.every((v) => NUMERIC_RE.test(v));
  const idLike = allNumeric && distinct === values.length && distinct >= rows.length * 0.95;

  // Drop noise: sparse, constant, or identifier-like columns make poor filters.
  if (coverage < 0.5 || distinct <= 1 || idLike) return base;

  if (lowers.every((v) => BOOL_TRUE.includes(v) || BOOL_FALSE.includes(v)) && lowers.some((v) => BOOL_TRUE.includes(v))) {
    const trueValue = [...set].find((v) => BOOL_TRUE.includes(v.toLowerCase()))!;
    const trueCount = values.filter((v) => BOOL_TRUE.includes(v.toLowerCase())).length;
    const p = trueCount / values.length;
    // Boolean feature flags are valuable facets; don't punish imbalance to zero.
    return { ...base, kind: "boolean", trueValue, score: coverage * (0.6 + 0.4 * (1 - Math.abs(2 * p - 1))) };
  }
  if (allNumeric) {
    // Slightly below categorical facets so peripheral-count columns don't dominate.
    return { ...base, kind: "numeric", score: coverage * (distinct >= 3 ? 0.7 : 0.4) };
  }
  if (distinct >= 2 && distinct <= 8 && [...set].every((v) => v.length <= 24)) {
    const counts: Record<string, number> = {};
    for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
    const maxShare = Math.max(...Object.values(counts)) / values.length;
    return { ...base, kind: "enum", score: coverage * (0.6 + 0.4 * (1 - maxShare)) };
  }
  return { ...base, kind: "text" }; // high-cardinality free text → keyword, not a filter
}

function profileAll(rows: Row[], exclude: Set<string>): ColProfile[] {
  return uniqueColumns(rows)
    .filter((c) => !exclude.has(c))
    .map((c) => profileColumn(rows, c));
}

function selectFilters(profiles: ColProfile[], max: number): InferredFilter[] {
  const usable = profiles
    .filter((p) => (p.kind === "boolean" || p.kind === "numeric" || p.kind === "enum") && p.score > 0)
    .sort((a, b) => b.score - a.score);

  // Diversify: cap each type so one kind (e.g. peripheral counts) can't crowd
  // out the others, then fill remaining slots by score.
  const caps: Record<string, number> = { boolean: 6, numeric: 4, enum: 3 };
  const counts: Record<string, number> = { boolean: 0, numeric: 0, enum: 0 };
  const chosen: ColProfile[] = [];
  for (const p of usable) {
    if (chosen.length >= max) break;
    if (counts[p.kind] < caps[p.kind]) {
      chosen.push(p);
      counts[p.kind]++;
    }
  }
  for (const p of usable) {
    if (chosen.length >= max) break;
    if (!chosen.includes(p)) chosen.push(p);
  }

  const used = new Set<string>();
  const uniqueParam = (col: string): string => {
    let p = slug(col);
    const base = p;
    for (let i = 2; used.has(p); i++) p = `${base}_${i}`;
    used.add(p);
    return p;
  };

  return chosen
    .sort((a, b) => b.score - a.score)
    .map((p) => {
      const { label } = labelAndSuffix(p.col);
      const param = uniqueParam(p.col);
      if (p.kind === "boolean") return { param, column: p.col, kind: "boolean", trueValue: p.trueValue!, description: `Require ${label}.` };
      if (p.kind === "numeric") {
        const kind = /price|cost|budget/i.test(p.col) ? "max" : "min";
        return { param, column: p.col, kind, description: `${kind === "max" ? "Maximum" : "Minimum"} ${label}.` };
      }
      return { param, column: p.col, kind: "enum", values: [...new Set(p.values)], description: `Filter by ${label}.` };
    });
}

function selectCompareRows(profiles: ColProfile[], max: number): CompareRow[] {
  return profiles
    .filter((p) => p.kind === "boolean" || p.kind === "numeric" || p.kind === "enum")
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((p) => {
      const { label, suffix } = labelAndSuffix(p.col);
      return suffix ? { label, key: p.col, suffix } : { label, key: p.col };
    });
}

// Columns that look like a usable category facet — surfaced for human review.
function suggestCategoryColumns(profiles: ColProfile[]): { col: string; values: string[] }[] {
  return profiles
    .filter((p) => p.kind === "enum" && p.coverage >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((p) => ({ col: p.col, values: [...new Set(p.values)] }));
}

// ── scaffold a starter config.ts ──────────────────────────────────────────────
function writeStarterConfig(
  configPath: string,
  labels: Record<string, string>,
  filters: InferredFilter[],
  compareRows: CompareRow[],
  categoryHints: { col: string; values: string[] }[],
): void {
  const q = (s: string) => JSON.stringify(s);
  const hasCategories = Object.keys(labels).length > 0;

  const filterLines = filters
    .map((f) => {
      const extra =
        f.kind === "enum" ? `, values: ${JSON.stringify(f.values)}` : f.kind === "boolean" ? `, trueValue: ${q(f.trueValue)}` : "";
      return `      { param: ${q(f.param)}, column: ${q(f.column)}, kind: ${q(f.kind)}${extra}, description: ${q(f.description)} },`;
    })
    .join("\n");
  const compareLines = compareRows
    .map((r) => `      { label: ${q(r.label)}, key: ${q(r.key)}${r.suffix ? `, suffix: ${q(r.suffix)}` : ""} },`)
    .join("\n");

  const guided = hasCategories
    ? `{ rank: 1, question: "Which category best fits your need?", answer_space: ${JSON.stringify([...Object.values(labels), "Not sure"])} }`
    : `{ rank: 1, question: "TODO: what should we narrow down first? (e.g. main use case)", answer_space: ["Option A", "Option B", "Not sure"] }`;

  const categoryComment =
    !hasCategories && categoryHints.length
      ? `// No category column was found — running FILTER-ONLY. Columns you COULD\n` +
        `// designate as a category facet (REVIEW for usefulness — this is your\n` +
        `// decision, not automatic; set CONFIG.categoryColumn and re-generate):\n` +
        categoryHints.map((h) => `//   • ${h.col}: ${h.values.slice(0, 8).join(", ")}`).join("\n") +
        "\n"
      : "";

  const content = `import type { SelectorConfig } from ${q(CONFIG.typesImport)};

// STARTER CONFIG — auto-scaffolded. Review the inferred search.filters /
// compare.rows (a reasonable subset, not every column) and fill in the TODOs.
${categoryComment}export const config: SelectorConfig = {
  brand: {
    name: "TODO Your Company",
    accentColor: "#0D2B73",
    logo: "https://dummyimage.com/64x64/0d2b73/ffffff.png&text=T",
  },

  branding: {
    title: "TODO Product Selector",
    subtitle: "Find the right product for your needs",
    inputPlaceholder: "Describe what you need, or compare two products...",
    starterPrompts: ["Help me find the right product", "Compare two products"],
  },

  // TODO: teach the agent your taxonomy and how to map user words to the filters.
  customInstructions: \`
You are the TODO product selector assistant. Help users find the right product conversationally.
${hasCategories ? `Categories: ${Object.values(labels).join(", ")}.\n` : ""}
Use search_products early and map the user's needs to the available filters.
Use compare_products for exactly 2 items (a visual card renders — don't repeat it as a table).
Use book_meeting when the user wants pricing or to talk to sales.
\`.trim(),

  guidedPaths: {
    enabled: true,
    questions: [
      ${guided},
    ],
  },

  search: {
    filters: [
${filterLines || "      // no filters inferred — add some by hand"}
    ],
  },

  compare: {
    rows: [
${compareLines}
    ],
  },

  booking: {
    enabled: true,
    delivery: { mode: "email" },
    successMessage: "A representative will reach out within 1 business day.",
  },
};
`;
  writeFileSync(configPath, content);
}

function main(): void {
  const src = findSource();
  console.log(`Reading ${src}`);
  const wb = XLSX.read(readFileSync(src));

  let families = sheetRows(wb, CONFIG.familiesSheet);
  let parts = sheetRows(wb, CONFIG.partsSheet);
  if (parts.length === 0 && families.length === 0) parts = sheetRows(wb, wb.SheetNames[0]);

  const sample = parts.length ? parts : families;
  const columns = uniqueColumns(sample);

  // Category mode: derive hook > explicit column > none (filter-only).
  const hasCategoryColumn = columns.includes(CONFIG.categoryColumn);
  const useCategory = !!CONFIG.deriveCategory || hasCategoryColumn;
  if (useCategory) {
    for (const row of [...families, ...parts]) {
      const cat = CONFIG.deriveCategory ? CONFIG.deriveCategory(row) : row[CONFIG.categoryColumn];
      row.category = (cat ?? CONFIG.defaultCategory) as string;
      if (CONFIG.categoryColumn !== "category") delete row[CONFIG.categoryColumn];
    }
  }

  const labels: Record<string, string> = {};
  if (useCategory) {
    const cats = [...new Set([...families, ...parts].map((r) => r.category ?? CONFIG.defaultCategory))];
    for (const c of cats) labels[c] = CONFIG.categoryLabels[c] ?? c;
  }

  // Inference (over parts, the detailed rows).
  const exclude = new Set(
    ["category", CONFIG.fields.familyName, CONFIG.fields.partNumber, CONFIG.fields.partUrl, "Description", ...CONFIG.fields.keyword].filter(
      (c): c is string => !!c,
    ),
  );
  const profiles = profileAll(sample, exclude);
  const filters = selectFilters(profiles, CONFIG.maxFilters);
  const compareRows = selectCompareRows(profiles, 12);
  const categoryHints = suggestCategoryColumns(profiles);

  const fields = { ...CONFIG.fields };
  const banner =
    `// AUTO-GENERATED by scripts/generate-catalogue.ts — do not edit by hand.\n` +
    `// Source: ${src.replace(ROOT + "/", "")}\n` +
    `// ${families.length} families · ${parts.length} parts\n`;
  const body =
    `import type { Catalogue } from "${CONFIG.schemaImport}";\n\n` +
    `export const catalogue: Catalogue = {\n` +
    `  families: ${JSON.stringify(families, null, 2)},\n` +
    `  parts: ${JSON.stringify(parts, null, 2)},\n` +
    `  categoryLabels: ${JSON.stringify(labels, null, 2)},\n` +
    `  fields: ${JSON.stringify(fields, null, 2)},\n` +
    `};\n`;

  mkdirSync(dirname(CONFIG.outFile), { recursive: true });
  writeFileSync(CONFIG.outFile, banner + "\n" + body);
  console.log(
    `Wrote ${CONFIG.outFile.replace(ROOT + "/", "")} — ${families.length} families, ${parts.length} parts, ` +
      (useCategory ? `categories: ${Object.keys(labels).join(", ")}` : "no category facet (filter-only)"),
  );

  // Human-in-the-loop: surface category candidates rather than auto-picking one.
  if (!useCategory && categoryHints.length) {
    console.log(`\nNo category column found — running filter-only. Columns you COULD designate as a category`);
    console.log(`(review for usefulness — your call, not automatic; set CONFIG.categoryColumn and re-run):`);
    for (const h of categoryHints) console.log(`  • ${h.col}  →  ${h.values.slice(0, 8).join(", ")}`);
  }

  if (CONFIG.scaffoldConfig) {
    const configPath = join(dirname(CONFIG.outFile), "config.ts");
    if (existsSync(configPath)) {
      console.log(`\nconfig.ts exists — left untouched. Inferred filters: ${filters.map((f) => f.param).join(", ") || "(none)"}`);
    } else {
      writeStarterConfig(configPath, labels, filters, compareRows, categoryHints);
      console.log(`\nWrote starter config.ts — ${filters.length} filters (${filters.map((f) => f.param).join(", ")}), ${compareRows.length} compare rows. Review the TODOs.`);
    }
  }
}

main();
