# Product Selector Starter

An **embeddable product-selector agent** built on the [Kapa Agent SDK](https://docs.kapa.ai/dev/agent/). Drop one `<script>` tag on any website and visitors get a chat bubble that opens a conversational assistant which can:

- 🔎 **Search your catalogue** with precise, deterministic lookups (no hallucinated specs)
- 🆚 **Compare two products** side-by-side in a visual card
- 🧭 **Guide unsure visitors** through a short set of clickable questions (toggleable)
- 📅 **Book a sales call**, delivering the lead to your inbox, a webhook, or your CRM

It ships with **three ready-made example domains** — wireless chips, water pumps, and espresso machines — all driven by the *same* engine, to show how generic it is. Switch between them by changing one import, or swap in your own data.

> This is a **starter / example** meant to get a working selector live fast. The
> five built-in tools cover the common cases; you can add your own Kapa tools in
> `src/agent/tools.tsx` whenever you need more.

## What the built-in tools do

Five tools ship ready to use — the agent calls them as the conversation needs,
and each renders its own UI. (Add your own in `src/agent/tools.tsx`.)

| Tool | What it does |
| --- | --- |
| `search_products` | Precise, deterministic filtering over your catalogue → a ranked, capped results list with "Show all". |
| `get_product_specs` | Full spec sheet for one product. |
| `compare_products` | Side-by-side visual comparison of two products. |
| `discover_requirements` | A short guided questionnaire (toggleable) for unsure visitors; answers drive the next search. |
| `book_meeting` | An approval-gated contact form; the lead goes to email / webhook / your CRM. |

The examples below are from the shipped **Acme** semiconductor example. (The grey
line under each agent reply — e.g. `discover_requirements (user_context: …)` — is
the built-in, collapsible tool-call disclosure showing exactly what the agent
called.)

**Guided discovery** — when a visitor is unsure, the agent launches clickable
questions and turns the answers into a search:

<img src="docs/img/acme-guided-discovery.png" alt="Guided discovery: clickable questions" width="420" />

**Side-by-side comparison** — `compare_products` renders a visual spec card; the
agent adds a one-line takeaway instead of re-typing the table:

<img src="docs/img/acme-compare.png" alt="Side-by-side product comparison card" width="420" />

**Book a call** — `book_meeting` shows the contact form immediately; the lead is
routed to your inbox, a webhook, or your CRM:

<img src="docs/img/acme-contact-sales.png" alt="Book-a-call contact form" width="420" />

## Quick start

```bash
npm install
cp .env.example .env        # add your Kapa + Resend keys
npm run dev                 # open the local playground (index.html)
```

The playground renders the widget over a deliberately ugly host page to prove
the styling is fully isolated (see "How it works").

**The dev server is self-contained:** `npm run dev` also serves the `/server`
handlers at `/api/agent-session` and `/api/book-lead` via Vite middleware, so a
real conversation works locally with no separate backend. For that you need a
valid `KAPA_API_KEY` (server, in `.env`) plus `PROJECT_ID` and
`INTEGRATION_ID` (read by the playground's `init()`). Without them the
bubble still renders, but a sent message will stall — the token can't be minted.
The same handlers deploy to production separately; the secret key never enters
the browser bundle.

## Build & add it to your site

```bash
npm run build               # → dist/product-selector.js (single self-contained file)
```

`dist/product-selector.js` is one self-contained file. **Add it to your website
exactly like any other script** — serve it alongside your existing static assets
and include the two lines below. If you already run a website, you already have
everywhere you need to put this; there's no special CDN or hosting to set up.

```html
<script src="/product-selector.js" defer></script>
<script>
  ProductSelector.init({
    projectId: "your-kapa-project-id",
    integrationId: "your-kapa-integration-id",
    sessionEndpoint: "/api/agent-session",   // your token endpoint (see /server)
    bookEndpoint: "/api/book-lead",
    accentColor: "#0D2B73",
    logo: "/logo.svg",
    title: "Product Selector",
  });
</script>
```

The only backend you need is the small token endpoint in [`/server`](server/README.md)
(it keeps your Kapa API key off the browser). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
for all `init()` options.

## Try the other examples

Each example is a `data.ts` (catalogue) + `config.ts` (branding, prompt,
filters, compare rows, booking) under `src/examples/`. Switch the active one by
editing the two imports in `src/selector.config.ts`:

```ts
export { catalogue } from "./examples/water-pumps/data";
export { config as selectorConfig } from "./examples/water-pumps/config";
```

Options: `semiconductors` · `water-pumps` · `espresso-machines`.

## Your product data: connect a PIM/database, or use a spreadsheet

All catalogue lookups (`search` / `specs` / `compare`) go through one place —
`src/catalogue/lookup.ts` — so you choose where the data lives:

- **Recommended: integrate your PIM / product database.** Most companies already
  keep their catalogue in a PIM or product DB. Wiring the selector to that gives a
  single source of truth that's always current — price changes, new SKUs, and
  availability show up with no rebuilds. The lookup functions are the integration
  seam: back them with a call to your own `/api/catalogue` endpoint (which queries
  your PIM/DB), or run the query directly. See the swap-in note at the top of
  `src/catalogue/lookup.ts`. Your declared `search.filters` stay identical — only
  the data source changes.
- **No PIM/DB available? Use the static spreadsheet approach.** Drop your
  `.xlsx`/`.csv` in `catalogue/source/` and run `npm run generate:catalogue` to
  bake it into a single typed data file (what the examples ship with). Quickest way
  to get live; just re-run the generator whenever the catalogue changes.

## Make it yours

1. **Catalogue** — connect your PIM/database, or generate from a spreadsheet (see above).
2. **Config** — edit your example's `config.ts`: branding, the system prompt
   (`customInstructions`), the search **filters**, guided-path questions, the
   compare spec-rows, and booking. See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md).
3. **Backend** — deploy the two endpoints in [`/server`](server/README.md) and
   set your env vars.

## How it works

```
ProductSelector.init(config)
        │
        ▼
  src/embed.tsx ──► src/mount.tsx ──► Shadow DOM root
                          │             • Emotion cache → shadow root
                          │             • Chakra cssVarsRoot=":host"
                          │             • Kapa stylesheet injected inline
                          ▼
                    src/Widget.tsx
                          │  AgentProvider (Kapa) + FAB + AgentPanel
                          ▼
                  src/agent/tools.tsx ──► precise lookups over the active
                          │               example's data.ts
                          ▼
        compare / guided-questions / booking render components
        (styled from the SDK's resolved theme — no hardcoded palette)
```

The widget mounts inside a **Shadow DOM** root so the host page's CSS can never
touch it and vice-versa. Catalogue lookups run **client-side against the single
hardcoded data file** — the agent only picks filter parameters; it never invents
specs.

## Project layout

```
src/
  embed.tsx            init() entry → window.ProductSelector
  mount.tsx            Shadow DOM + Emotion + Chakra + SDK CSS injection
  Widget.tsx           AgentProvider + FAB bubble + AgentPanel
  selector.config.ts   ◄── picks the active example (one-line switch)
  config/types.ts      config + runtime types
  examples/            three domains, same engine:
    semiconductors/    data.ts (catalogue) + config.ts (branding/prompt/filters)
    water-pumps/       data.ts + config.ts
    espresso-machines/ data.ts + config.ts
  catalogue/
    schema.ts          generic family/part model
    lookup.ts          precise, config-driven search / specs / compare
  agent/
    tools.tsx          the 5 example tools (extend with your own here)
    palette.ts         derives colours from the SDK's resolved theme
    components/        CompareCard · QuestionForm · BookingForm
scripts/
  generate-catalogue.ts  spreadsheet → an example's data.ts
server/
  agent-session.ts     Kapa token endpoint (required)
  book-lead.ts         booking delivery: email / webhook / HubSpot / Salesforce
docs/
  CUSTOMIZATION.md · DEPLOYMENT.md
```

Built with [Kapa Agent SDK](https://docs.kapa.ai/dev/agent/) · Vite · Chakra UI.
