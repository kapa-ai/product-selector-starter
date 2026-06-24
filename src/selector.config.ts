// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE EXAMPLE — switch the whole product domain by changing the import below.
//
// Three ready-made examples ship in src/examples/, all driven by the same
// engine to show how generic it is:
//   • semiconductors     — wireless chips & modules (families + parts)
//   • water-pumps        — pumps by flow / head / power / price
//   • espresso-machines  — machines by type / features / price
//
// To use your OWN catalogue: either edit the active example's data.ts +
// config.ts, or generate data into a new example folder
// (see scripts/generate-catalogue.ts) and point these two imports at it.
// ─────────────────────────────────────────────────────────────────────────────
export { catalogue } from "./examples/semiconductors/data";
export { config as selectorConfig } from "./examples/semiconductors/config";
