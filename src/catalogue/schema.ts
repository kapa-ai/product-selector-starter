// ─────────────────────────────────────────────────────────────────────────────
// Catalogue schema
//
// The catalogue is a SINGLE hardcoded file (each example's data.ts) generated
// from a spreadsheet. It uses a two-level model copied from the source data:
//
//   • Family  — a product line / series (summary-level specs)
//   • Part    — a specific orderable part number (full specs)
//
// Both rows are intentionally loosely typed: column names are preserved
// verbatim from the source spreadsheet (e.g. "Flash (KB)", "Temp Range (°C)")
// so the generator can map any catalogue without code changes. The only fixed
// field is `category`, the discriminator used for fast filtering.
//
// To use your own catalogue: put your .xlsx/.csv in catalogue/source/ and run
// `npm run generate:catalogue`. See scripts/generate-catalogue.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Top-level product categories. Override these to match your own taxonomy. */
export type ProductCategory = string;

/** A product family / series — summary-level row. */
export interface ProductFamily {
  category?: ProductCategory;
  [column: string]: string | null | undefined;
}

/** A specific orderable part number — full-spec row. */
export interface ProductPart {
  category?: ProductCategory;
  [column: string]: string | null | undefined;
}

export interface Catalogue {
  families: ProductFamily[];
  parts: ProductPart[];
  /** Display labels for category codes, e.g. { ble: "BLE", wifi: "Wi-Fi + BLE" }. */
  categoryLabels: Record<string, string>;
  /**
   * Column keys, by row type, that the search/compare tools read. Centralised
   * here so a company adapting the starter only edits ONE place when their
   * spreadsheet uses different column names.
   */
  fields: CatalogueFieldMap;
}

/**
 * Maps the generic concepts the tools need onto the verbatim column names in
 * your data. Keep the left-hand keys; change the right-hand strings to match
 * your spreadsheet headers.
 */
export interface CatalogueFieldMap {
  /** Family: the family/series name column. */
  familyName: string;
  /** Part: the orderable part-number column. */
  partNumber: string;
  /** Part: the column holding a product page URL (optional). */
  partUrl?: string;
  /** Free-text columns searched by the `keyword` filter (joined + lowercased). */
  keyword: string[];
}
