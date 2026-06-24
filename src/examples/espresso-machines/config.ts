import type { SelectorConfig } from "../../config/types";

export const config: SelectorConfig = {
  brand: {
    name: "Crema",
    accentColor: "#7C2D12",
    logo: "https://dummyimage.com/64x64/7c2d12/ffffff.png&text=C",
  },

  branding: {
    title: "Crema Machine Finder",
    subtitle: "Find your perfect espresso machine",
    inputPlaceholder: "Tell me how you like to make coffee, or compare two machines...",
    starterPrompts: [
      "Help me pick an espresso machine",
      "I want one-touch lattes under $1000",
      "A semi-automatic with a built-in grinder and touch screen",
      "Compare CR-BA-20 and CR-AU-30",
    ],
  },

  customInstructions: `
You are the Crema espresso-machine finder. Crema makes Manual, Semi-automatic, and Super-automatic machines.

Help shoppers find the right machine — conversationally. Key concepts:
- Manual (lever): full control, most hands-on, for enthusiasts.
- Semi-automatic: you grind/tamp; the machine pulls the shot. Great balance of control and ease.
- Super-automatic (bean-to-cup): grind, brew, and froth automatically — one-touch convenience.
- A built-in grinder means no separate grinder needed. A pressure gauge helps dial in shots. A touch screen eases operation. An automatic milk frother makes lattes hands-free.

━━━ TOOLS ━━━
discover_requirements — use when the shopper is unsure ("help me pick"). A clickable form renders; NEVER list the questions in text. After answers, call search_products.
search_products — call early. Map wants to filters: hands-on vs convenience → type; a budget → price_max_usd; "built-in grinder" → built_in_grinder true; "touch screen" → touch_screen true; "pressure gauge" → pressure_gauge true.
get_product_specs — full specs for one model.
compare_products — exactly 2 machines; a visual card renders, so don't repeat it as a table.
book_meeting — when the shopper wants a demo, bulk/office pricing, or to talk to the team.

Always link models using the url field: [MODEL](url).
`.trim(),

  guidedPaths: {
    enabled: true,
    questions: [
      {
        rank: 1,
        question: "How hands-on do you want to be?",
        answer_space: ["Full control (manual)", "A balance (semi-automatic)", "One-touch (super-automatic)", "Not sure"],
      },
      {
        rank: 2,
        question: "Do you want a grinder built in?",
        answer_space: ["Yes — all-in-one", "No — I have a grinder", "Doesn't matter"],
      },
      {
        rank: 3,
        question: "What's your budget?",
        answer_space: ["Under $500", "$500–$1000", "Over $1000", "No fixed budget"],
      },
    ],
  },

  search: {
    filters: [
      { param: "type", column: "Type", kind: "enum", values: ["Manual", "Semi-automatic", "Super-automatic"], description: "Machine type." },
      { param: "pressure_gauge", column: "Pressure Gauge", kind: "boolean", description: "Require a pressure gauge." },
      { param: "touch_screen", column: "Touch Screen", kind: "boolean", description: "Require a touch screen." },
      { param: "built_in_grinder", column: "Built-in Grinder", kind: "boolean", description: "Require a built-in grinder." },
      { param: "price_max_usd", column: "Price (USD)", kind: "max", description: "Maximum price in USD." },
    ],
    // No keyword? Show the most affordable machines first.
    defaultSort: { column: "Price (USD)", direction: "asc" },
  },

  compare: {
    rows: [
      { label: "Type", key: "Type" },
      { label: "Pressure Gauge", key: "Pressure Gauge" },
      { label: "Touch Screen", key: "Touch Screen" },
      { label: "Built-in Grinder", key: "Built-in Grinder" },
      { label: "Milk Frother", key: "Milk Frother" },
      { label: "Boiler", key: "Boiler Type" },
      { label: "Pressure", key: "Pressure (bar)", suffix: "bar" },
      { label: "Water Tank", key: "Water Tank (L)", suffix: "L" },
      { label: "Price", key: "Price (USD)", suffix: "USD" },
    ],
  },

  booking: {
    enabled: true,
    delivery: { mode: "email" },
    successMessage: "A Crema specialist will reach out within 1 business day.",
  },
};
