# Customization

Each product domain is an **example** under `src/examples/<name>/`, made of two
files: `data.ts` (the catalogue) and `config.ts` (everything the agent does).
The active example is chosen in **`src/selector.config.ts`** — change those two
imports to switch between `semiconductors`, `water-pumps`, and `espresso-machines`
(or your own). Almost everything you'll want to change lives in your example's
`config.ts` — no engine code required. The quick wins:

| Want to change... | Edit | How |
| --- | --- | --- |
| **Which domain is live** | `selector.config.ts` | Point the two imports at another `examples/<name>/`. |
| **The products** | `catalogue/source/` + `npm run generate:catalogue` | Drop in your spreadsheet, regenerate the example's `data.ts`. |
| **Brand look** (colour, logo, title) | `config.ts → brand` (or `init()`) | One hex + one logo URL drives the bubble, buttons, and panel theme. |
| **What the agent says / how it picks products** | `config.ts → customInstructions` | The system prompt — your taxonomy + filter hygiene. |
| **Which filters search exposes** | `config.ts → search.filters` | Declare the parameters the agent can filter on — no code. |
| **Welcome copy & example chips** | `config.ts → branding` | Title, subtitle, placeholder, starter prompts. |
| **Guided questions** (on/off + content) | `config.ts → guidedPaths` | Flip `enabled`; edit the `questions` array. |
| **Comparison table rows** | `config.ts → compare.rows` | Pick which spec columns the side-by-side card shows. |
| **Where "book a call" leads go** | `config.ts → booking` + `/server` env | email / webhook / CRM. |

A more complete reference follows.

Two layers: **`config.ts`** (`SelectorConfig`, build-time content) and
**`ProductSelector.init()`** (runtime, per-deployment).

## `config.ts` (`SelectorConfig`)

### `brand`
| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Company name (used in copy). |
| `accentColor` | string (hex) | Drives the bubble, buttons, highlights, and the SDK theme. |
| `logo` | string (URL) | Shown on the bubble and panel header. |

`accentColor` / `logo` / `title` can be overridden at runtime by `init()`.

### `branding`
| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Panel header + bubble label. |
| `subtitle` | string? | Shown under the title in the empty state. |
| `inputPlaceholder` | string? | Chat input placeholder. |
| `starterPrompts` | string[]? | Quick-start chips shown before the first message. |

### `customInstructions` (string) — **the most important field**
The system prompt. Teach the agent your catalogue taxonomy and, crucially,
**filter hygiene**: how to map a user's words onto `search_products` parameters.
The shipped prompts are good templates — keep the structure (categories → key
concepts → tool usage → style) and rewrite for your products.

### `search.filters` (`SearchFilter[]`) — what `search_products` can filter on
This is what makes the engine domain-agnostic. Each filter becomes a parameter
on the `search_products` tool and is applied generically over your catalogue —
no lookup code to write. Each entry is `{ param, column, kind, description }`:

| `kind` | Param type | Matching |
| --- | --- | --- |
| `text` | string | case-insensitive substring of `column` |
| `enum` | one of `values` | substring of `column` |
| `boolean` | boolean | `column` equals `trueValue` (default `"Yes"`) |
| `min` | number | largest number in `column` ≥ value |
| `max` | number | smallest number in `column` ≤ value |

`param` is the name the agent uses; `column` is the verbatim catalogue header it
reads; `description` is what the model sees. (`category`, `keyword`, and
`result_type` are always available and don't need declaring.)

```ts
// espresso example
filters: [
  { param: "type", column: "Type", kind: "enum",
    values: ["Manual", "Semi-automatic", "Super-automatic"], description: "Machine type." },
  { param: "built_in_grinder", column: "Built-in Grinder", kind: "boolean", description: "Require a built-in grinder." },
  { param: "price_max_usd", column: "Price (USD)", kind: "max", description: "Maximum price in USD." },
]
```

Keep the filter `param` names and `customInstructions` filter-hygiene in sync so
the model knows when to use each.

**Results, ranking & completeness.** `search_products` scans the whole catalogue
(deterministic, exhaustive), ranks the matches, and renders them as an
interactive list — the user always sees the authoritative set, not the model's
retelling. Three optional `search` fields tune this:

| Field | Default | Notes |
| --- | --- | --- |
| `maxResults` | 15 | How many rows the list shows before a "Show all N" toggle (reveals the rest client-side — nothing is hidden). |
| `resultLimit` | 50 | Hard ceiling on rows returned per query (bounds token cost). The **true total is always reported**; beyond the cap the user is asked to refine. |
| `defaultSort` | — | `{ column, direction }` ordering when there's no keyword to rank by (e.g. price ascending). Without it, results keep catalogue order. |

Ranking is deterministic: with a keyword, by weighted field hits (earlier
`fields.keyword` columns score higher); otherwise by `defaultSort`; always
tie-broken by catalogue position.

### `model` (string?)
Kapa model id. Defaults to `kapa-agent-1.0`.

### `guidedPaths`
| Field | Type | Notes |
| --- | --- | --- |
| `enabled` | boolean | **The toggle.** `false` removes the `discover_requirements` tool entirely. |
| `toolDescription` | string? | What the model sees — when to launch the flow. |
| `questions` | `GuidedQuestion[]` | Each: `{ rank, question, answer_space: string[] }`. Rendered as clickable radio options. |

When the visitor submits, their answers are sent back into the chat and the
agent calls `search_products` with derived filters (guided by your prompt).

### `compare.rows` (`CompareRow[]`)
Which spec rows the side-by-side card shows. Each `{ label, key, suffix? }` where
`key` is a **verbatim catalogue column name** (e.g. `"Flash (KB)"`) and `suffix`
is appended to non-empty values (e.g. `"KB"`).

### `booking`
| Field | Type | Notes |
| --- | --- | --- |
| `enabled` | boolean | `false` removes the `book_meeting` tool. |
| `toolDescription` | string? | What the model sees. |
| `delivery` | `{ mode: "email" \| "webhook" \| "none" }` | Must match your server's `BOOKING_MODE` (`email`/`webhook`/`hubspot`/`salesforce`). `"none"` disables the tool. Email or webhook is the simplest option — a CRM integration is optional. |
| `successMessage` | string? | Confirmation shown after submission. |

## `init()` runtime options (`WidgetConfig`)

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| `projectId` | ✅ | — | Kapa project id. |
| `integrationId` | ✅ | — | Kapa agent integration id. |
| `sessionEndpoint` | — | `/api/agent-session` | Your deployed token endpoint. |
| `bookEndpoint` | — | `/api/book-lead` | Your deployed booking endpoint. |
| `accentColor` | — | `brand.accentColor` | Runtime override. |
| `logo` | — | `brand.logo` | Runtime override. |
| `title` | — | `branding.title` | Runtime override. |

## Catalogue field map (`examples/<name>/data.ts → fields`)

Each `data.ts` carries a `fields` map so the tools know which columns to read:

```ts
fields: {
  familyName: "Product Family",  // family/series name column
  partNumber: "Part Number",     // orderable product/part column
  partUrl: "url",                // product page URL column (optional)
  keyword: ["Product Family", "Protocols", "Use Cases", "Description"], // free-text search columns
}
```

If your spreadsheet uses different headers, set them in the `CONFIG.fields`
block of `scripts/generate-catalogue.ts` before generating.

> Adapting to a brand-new domain is **config only**: write `data.ts` (or
> generate it), then declare your `search.filters`, `compare.rows`, and
> `customInstructions` in `config.ts`. You should not need to touch
> `src/catalogue/lookup.ts` or `src/agent/tools.tsx`.
