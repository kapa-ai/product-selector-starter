// ─────────────────────────────────────────────────────────────────────────────
// Catalogue generator:  spreadsheet (.xlsx / .csv)  →  an example's data.ts
//
// Usage:
//   1. Drop your file in catalogue/source/ (e.g. catalogue/source/products.xlsx)
//   2. Adjust CONFIG below to match your workbook.
//   3. Run:  npm run generate:catalogue
//
// The output is a single typed TS file the agent's tools read directly — the
// "precise lookup into a hardcoded db" requirement. No runtime DB, no network.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const CONFIG = {
  /** Folder scanned for the source workbook (first .xlsx/.csv found is used). */
  sourceDir: process.env.CATALOGUE_SRC ? resolve(process.env.CATALOGUE_SRC) : join(ROOT, "catalogue", "source"),
  /**
   * Where the generated data file is written. Point this at the example you
   * want to populate (each example folder has a data.ts + a hand-written
   * config.ts). The active example is chosen in src/selector.config.ts.
   * Override either path with CATALOGUE_SRC / CATALOGUE_OUT env vars.
   */
  outFile: process.env.CATALOGUE_OUT
    ? resolve(process.env.CATALOGUE_OUT)
    : join(ROOT, "src", "examples", "semiconductors", "data.ts"),
  /** Import path to schema.ts, relative to outFile. */
  schemaImport: "../../catalogue/schema",
  /** Import path to config types, relative to the generated config.ts. */
  typesImport: "../../config/types",
  /**
   * When true and no config.ts exists next to the data file, write a starter
   * config.ts with search.filters + compare.rows inferred from the columns.
   * Never overwrites an existing config.ts.
   */
  scaffoldConfig: true,

  /** Sheet names (case-insensitive). A CSV file is treated as the parts sheet. */
  familiesSheet: "Families",
  partsSheet: "Parts",

  /**
   * Column whose value becomes each row's `category` discriminator. If the
   * column is missing, every row falls back to `defaultCategory`.
   */
  categoryColumn: "category",
  defaultCategory: "default",

  /** Human-readable labels per category code (edit to taste). */
  categoryLabels: {} as Record<string, string>,

  /** Field map written into the catalogue (see CatalogueFieldMap). */
  fields: {
    familyName: "Product Family",
    partNumber: "Part Number",
    partUrl: "url",
    keyword: ["Product Family", "Protocols", "Use Cases", "Description"],
  },
};

function findSource(): string {
  if (!existsSync(CONFIG.sourceDir)) {
    throw new Error(
      `Source folder not found: ${CONFIG.sourceDir}\n` +
        `Create it and add your .xlsx or .csv catalogue file.`,
    );
  }
  const file = readdirSync(CONFIG.sourceDir).find((f) => /\.(xlsx|xls|csv)$/i.test(f));
  if (!file) throw new Error(`No .xlsx/.xls/.csv file found in ${CONFIG.sourceDir}`);
  return join(CONFIG.sourceDir, file);
}

type Row = Record<string, string | null>;

function sheetRows(wb: XLSX.WorkBook, wanted: string): Row[] {
  const name = wb.SheetNames.find((s) => s.toLowerCase() === wanted.toLowerCase());
  if (!name) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], {
    defval: null,
    raw: false,
  });
  return raw.map((r) => normaliseRow(r));
}

function normaliseRow(r: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) {
    const key = k.trim();
    if (v === null || v === undefined || v === "") out[key] = null;
    else out[key] = String(v).trim();
  }
  // Promote the category column to the fixed `category` field.
  const cat = out[CONFIG.categoryColumn];
  out.category = (cat ?? CONFIG.defaultCategory) as string;
  if (CONFIG.categoryColumn !== "category") delete out[CONFIG.categoryColumn];
  return out;
}

// ── config inference ─────────────────────────────────────────────────────────
// Infer search.filters + compare.rows from the COLUMNS in the data we just
// wrote (and the categories), so a brand-new catalogue gets a working starter
// config without hand-writing it.

type InferredFilter =
  | { param: string; column: string; kind: "boolean"; description: string }
  | { param: string; column: string; kind: "min" | "max"; description: string }
  | { param: string; column: string; kind: "enum"; values: string[]; description: string };

const NUMERIC_RE = /^\s*\d[\d.,]*\s*(?:[–-]\s*\d[\d.,]*\s*)?$/; // "512" or "512 – 1024"
const BOOL_VALUES = new Set(["yes", "no", "true", "false"]);

function uniqueColumns(rows: Row[]): string[] {
  const seen: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!seen.includes(k)) seen.push(k);
  return seen;
}

function slug(col: string): string {
  return col
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function labelAndSuffix(col: string): { label: string; suffix?: string } {
  const m = col.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { label: m[1].trim(), suffix: m[2].trim() } : { label: col };
}

function inferFilters(parts: Row[], exclude: Set<string>): InferredFilter[] {
  const filters: InferredFilter[] = [];
  for (const col of uniqueColumns(parts)) {
    if (exclude.has(col)) continue;
    const vals = parts.map((r) => r[col]).filter((v): v is string => !!v);
    if (vals.length === 0) continue;
    const { label } = labelAndSuffix(col);

    if (vals.every((v) => BOOL_VALUES.has(v.toLowerCase()))) {
      filters.push({ param: slug(col), column: col, kind: "boolean", description: `Require ${label}.` });
    } else if (vals.every((v) => NUMERIC_RE.test(v))) {
      const kind = /price|cost|budget/i.test(col) ? "max" : "min";
      filters.push({
        param: slug(col),
        column: col,
        kind,
        description: `${kind === "max" ? "Maximum" : "Minimum"} ${label}.`,
      });
    } else {
      const distinct = [...new Set(vals)];
      if (distinct.length >= 2 && distinct.length <= 6 && distinct.every((v) => v.length <= 24)) {
        filters.push({ param: slug(col), column: col, kind: "enum", values: distinct, description: `Filter by ${label}.` });
      }
      // higher-cardinality free text is skipped — add a text filter by hand if needed
    }
  }
  return filters;
}

function inferCompareRows(parts: Row[], exclude: Set<string>): Array<{ label: string; key: string; suffix?: string }> {
  const rows: Array<{ label: string; key: string; suffix?: string }> = [];
  for (const col of uniqueColumns(parts)) {
    if (exclude.has(col)) continue;
    const { label, suffix } = labelAndSuffix(col);
    rows.push(suffix ? { label, key: col, suffix } : { label, key: col });
    if (rows.length >= 12) break;
  }
  return rows;
}

function writeStarterConfig(
  configPath: string,
  labels: Record<string, string>,
  filters: InferredFilter[],
  compareRows: Array<{ label: string; key: string; suffix?: string }>,
): void {
  const q = (s: string) => JSON.stringify(s);
  const filterLines = filters
    .map((f) => {
      const values = f.kind === "enum" ? `, values: ${JSON.stringify(f.values)}` : "";
      return `      { param: ${q(f.param)}, column: ${q(f.column)}, kind: ${q(f.kind)}${values}, description: ${q(f.description)} },`;
    })
    .join("\n");
  const compareLines = compareRows
    .map((r) => `      { label: ${q(r.label)}, key: ${q(r.key)}${r.suffix ? `, suffix: ${q(r.suffix)}` : ""} },`)
    .join("\n");
  const categoryAnswers = [...Object.values(labels), "Not sure"];
  const filterList = filters.map((f) => f.param).join(", ") || "(none inferred)";

  const content = `import type { SelectorConfig } from ${q(CONFIG.typesImport)};

// STARTER CONFIG — auto-scaffolded from your catalogue columns. Review the
// inferred search.filters and compare.rows, then fill in the TODOs (brand,
// copy, and especially customInstructions / filter hygiene).
export const config: SelectorConfig = {
  brand: {
    name: "TODO Your Company",
    accentColor: "#0D2B73",
    logo: "https://dummyimage.com/64x64/0d2b73/ffffff.png&text=T",
  },

  branding: {
    title: "TODO Product Selector",
    subtitle: "Find the right product for your needs",
    inputPlaceholder: "Describe what you need, or compare two products...",
    starterPrompts: [
      "Help me find the right product",
      "Compare two products",
    ],
  },

  // TODO: teach the agent your taxonomy and how to map user words to the
  // filters below (${filterList}).
  customInstructions: \`
You are the TODO product selector assistant. Help users find the right product conversationally.

Categories: ${Object.values(labels).join(", ")}.

Use search_products early and map the user's needs to the available filters.
Use compare_products for exactly 2 items (a visual card renders — don't repeat it as a table).
Use book_meeting when the user wants pricing or to talk to sales.
Always link products using the url field.
\`.trim(),

  guidedPaths: {
    enabled: true,
    questions: [
      {
        rank: 1,
        question: "Which category best fits your need?",
        answer_space: ${JSON.stringify(categoryAnswers)},
      },
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

  // CSV / single-sheet workbooks: treat the first sheet as parts.
  if (parts.length === 0 && families.length === 0) {
    const first = wb.SheetNames[0];
    parts = sheetRows(wb, first);
  }

  const categories: string[] = [
    ...new Set([...families, ...parts].map((r) => r.category ?? CONFIG.defaultCategory)),
  ];
  const labels: Record<string, string> = { ...CONFIG.categoryLabels };
  for (const c of categories) if (!(c in labels)) labels[c] = c;

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
    `  fields: ${JSON.stringify(CONFIG.fields, null, 2)},\n` +
    `};\n`;

  writeFileSync(CONFIG.outFile, banner + "\n" + body);
  console.log(
    `Wrote ${CONFIG.outFile.replace(ROOT + "/", "")} — ` +
      `${families.length} families, ${parts.length} parts, ` +
      `categories: ${categories.join(", ")}`,
  );

  // Scaffold a starter config.ts from the columns — but never clobber one that
  // already exists (the curated examples have hand-tuned configs).
  if (CONFIG.scaffoldConfig) {
    const configPath = join(dirname(CONFIG.outFile), "config.ts");
    const exclude = new Set(
      [
        "category",
        CONFIG.fields.familyName,
        CONFIG.fields.partNumber,
        CONFIG.fields.partUrl,
        "Description",
        ...CONFIG.fields.keyword,
      ].filter((c): c is string => !!c),
    );
    const filters = inferFilters(parts.length ? parts : families, exclude);
    const compareRows = inferCompareRows(parts.length ? parts : families, exclude);

    if (existsSync(configPath)) {
      console.log(
        `config.ts already exists — left untouched. Inferred filters you could add: ` +
          `${filters.map((f) => f.param).join(", ") || "(none)"}`,
      );
    } else {
      writeStarterConfig(configPath, labels, filters, compareRows);
      console.log(
        `Wrote starter ${configPath.replace(ROOT + "/", "")} — ` +
          `${filters.length} filters (${filters.map((f) => f.param).join(", ") || "none"}), ` +
          `${compareRows.length} compare rows. Review the TODOs.`,
      );
    }
  }
}

main();
