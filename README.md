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

## Build the embeddable bundle

```bash
npm run build               # → dist/product-selector.js (single self-contained file)
```

Host that file on any CDN/static host and embed it:

```html
<script src="https://your-cdn.com/product-selector.js" defer></script>
<script>
  ProductSelector.init({
    projectId: "your-kapa-project-id",
    integrationId: "your-kapa-integration-id",
    sessionEndpoint: "https://your-backend.com/api/agent-session",
    bookEndpoint: "https://your-backend.com/api/book-lead",
    accentColor: "#0D2B73",
    logo: "https://your-site.com/logo.svg",
    title: "Product Selector",
  });
</script>
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for all `init()` options.

## Try the other examples

Each example is a `data.ts` (catalogue) + `config.ts` (branding, prompt,
filters, compare rows, booking) under `src/examples/`. Switch the active one by
editing the two imports in `src/selector.config.ts`:

```ts
export { catalogue } from "./examples/water-pumps/data";
export { config as selectorConfig } from "./examples/water-pumps/config";
```

Options: `semiconductors` · `water-pumps` · `espresso-machines`.

## Make it yours

1. **Catalogue** — drop your `.xlsx`/`.csv` in `catalogue/source/`, point
   `CONFIG.outFile` in `scripts/generate-catalogue.ts` at your example's
   `data.ts`, and run `npm run generate:catalogue`.
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
