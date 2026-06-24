# Catalogue source

Drop your product catalogue here as a single `.xlsx` or `.csv` file, then run:

```bash
npm run generate:catalogue
```

This reads the first spreadsheet found in this folder and writes an example's
`data.ts` (set `CONFIG.outFile` in `scripts/generate-catalogue.ts` to choose
which — it defaults to `src/examples/semiconductors/data.ts`). The matching
`config.ts` is hand-written and is not overwritten.

## Expected shape

- A workbook with two sheets named **`Families`** (summary rows) and **`Parts`**
  (full-spec rows). A plain CSV is treated as the `Parts` sheet.
- A **`category`** column on each row (the filter discriminator). If absent,
  every row falls back to `CONFIG.defaultCategory`.
- Any other columns are preserved verbatim and become available to the tools and
  the compare card.

Adjust sheet names, the category column, category labels, and the field map in
the `CONFIG` block at the top of `scripts/generate-catalogue.ts` to match your
file.

> The shipped example `data.ts` files are hand-authored fictional samples.
> Running the generator overwrites the one you target.
