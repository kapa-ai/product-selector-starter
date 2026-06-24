# Product Selector Starter

## Customers know their need, not your catalogue. Stop making them search — let them talk.

Companies with large catalogues of technical products lose people at the very first step: a
visitor arrives with a need in their own words — *"I'm building a
battery-powered smart-home sensor that needs to speak Matter"* — and the website
answers with dozens of dense spec sheets and filter tables. They don't know
which filters even matter for *this* company's products, so they can't translate
their use case into the right query, and they give up.

Both sides lose, and neither understands why:

- **The visitor** concludes *"they don't make what I need."*
- **The company** wonders *"why aren't customers finding the products that solve their exact need?"*

The gap isn't the catalogue — it's the translation between a user's intent and
the company's way of describing its products.

## What this is

**Kapa Product Selector** bridges that gap: an embeddable, conversational agent
that understands the visitor's intent *and* your product catalogue. It maps
everyday language onto the filters that actually matter for your products,
searches your catalogue deterministically (no hallucinated specs), and walks the
visitor to the products that genuinely fit — then books a call if they want one.

Built on the [Kapa Agent SDK](https://docs.kapa.ai/dev/agent/), it drops onto any
site as a single `<script>` — a chat bubble that opens a sidebar assistant which can:

- 🔎 **Search your catalogue** with precise, deterministic lookups (no hallucinated specs)
- 🆚 **Compare two products** side-by-side in a visual card
- 🧭 **Guide unsure visitors** through a short set of clickable questions
- 📅 **Book a sales call**, routing the lead to your inbox, a webhook, or your CRM

## Clone it — you're ~90% there

This is a **working starter, not a framework to learn**. Clone it and the whole
thing already exists: the agent, the conversational UI, the five tools, the
embed, the lead-capture backend. The remaining ~10% is **configuration** —
pointing it at your catalogue and tailoring the system prompt, filters, and
branding to your company.

To make that concrete, it ships with **three example domains** — wireless chips,
water pumps, and espresso machines — all driven by the *same* engine. They exist
purely as starting points and inspiration, **not** as the product: pick the one
closest to your business, see how it's wired, then swap in your own data and
copy. You can also add your own Kapa tools in `src/agent/tools.tsx` when you need
more than the five built in.

## What's in this README

A quick map, in the order you'll most likely want it:

1. **What it is** — the problem and the solution (above).
2. **[Run it locally](#quick-start)** — a working version in three commands.
3. **[Make it yours](#make-it-yours)** — the ~10% of configuration for your company.
   - **[Your products](#your-products)** — connect a PIM/database (recommended) or a spreadsheet.
4. **[What to try](#what-the-agent-does-out-of-the-box)** — exercise the five built-in tool calls, and add your own.

Reference for when you need it: [add it to your site](#build--add-it-to-your-site) ·
[the example domains](#try-the-other-examples) · [how it works](#how-it-works) ·
[project layout](#project-layout).

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

## Make it yours

The repo is the 90%; this is the 10%. Three things to set for your company:

### Your products

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

### Branding, prompt & filters

Edit your example's `config.ts` — brand colour and logo, the welcome copy, the
system prompt (`customInstructions`), the search **filters**, guided-path
questions, the compare spec-rows, and booking. This is the main file you touch;
see [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for every field.

### Backend

Deploy the two endpoints in [`/server`](server/README.md) (token + lead capture)
and set your env vars.

## What the agent does out of the box

Every Product Selector comes with **five tools already wired into the agent** —
no setup required. The agent decides which to call as the conversation unfolds,
and each renders its own UI in the chat. (Need more? Add your own in
`src/agent/tools.tsx`.)

- **`search_products` — find the matching products.** Lets the agent query your
  catalogue/database with *exact* filters (e.g. "BLE 6.0 + Matter + ≥ 2 MB flash")
  and get back **every** match — deterministically, never guessed. Results render
  as a ranked, capped list with "Show all", so the visitor sees the real, complete
  set rather than the model's paraphrase.
- **`get_product_specs` — go deeper on one product.** Returns the full detail for a
  single product when a visitor wants to dig in — the equivalent of opening the
  data sheet, without leaving the conversation.
- **`compare_products` — put two side by side.** Renders a side-by-side card across
  the same parameters, so a visitor torn between two products that both seem to fit
  can glance at the real differences and decide.
- **`discover_requirements` — help people who don't know where to start.** Spins up
  a few guiding questions — what they're building, the requirements that matter to
  them, price sensitivity, and so on — and turns the answers into a targeted
  search. The on-ramp for visitors who can't yet put their need into words.
- **`book_meeting` — hand off to Sales at the right moment.** Once a visitor has the
  help they came for, connects them to your Sales team **with the full Kapa
  conversation attached as context**, routing the lead to your inbox, a webhook, or
  your CRM.

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

## Build & add it to your site

```bash
npm run build               # → dist/product-selector.js (single self-contained file)
```

How you add it depends on how your site is built:

**A — Script tag (CMS / no-code sites: WordPress, Webflow, Shopify, …).**
`dist/product-selector.js` is one self-contained file (React and the SDK bundled
in). Serve it from your site and paste two lines into your CMS's custom-code or
footer block — no build step on your side:

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

**B — Import the code (a frontend you build yourself: React, no CMS).** If you
own the frontend, skip the bundle and render the agent inside your own app —
reuse the `AgentProvider` + `AgentPanel` + tools setup from `src/Widget.tsx`, or
import and call `init()` from your own build. You get tighter integration with
your routing, state, and styling, and no separate artifact to host.

Either way, the only backend is the token endpoint in [`/server`](server/README.md)
(it keeps your Kapa API key off the browser). An **iframe** is a third option,
but you almost certainly don't need it — see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#choosing-how-to-embed) for the full
comparison and all `init()` options.

## Try the other examples

Each example is a `data.ts` (catalogue) + `config.ts` (branding, prompt,
filters, compare rows, booking) under `src/examples/`. Switch the active one by
editing the two imports in `src/selector.config.ts`:

```ts
export { catalogue } from "./examples/water-pumps/data";
export { config as selectorConfig } from "./examples/water-pumps/config";
```

Options: `semiconductors` · `water-pumps` · `espresso-machines`.

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
