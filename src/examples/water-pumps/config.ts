import type { SelectorConfig } from "../../config/types";

export const config: SelectorConfig = {
  brand: {
    name: "FlowMax",
    accentColor: "#0E7490",
    logo: "https://dummyimage.com/64x64/0e7490/ffffff.png&text=F",
  },

  branding: {
    title: "FlowMax Pump Selector",
    subtitle: "Find the right water pump for your application",
    inputPlaceholder: "Describe your application — flow, head, power — or compare two models...",
    starterPrompts: [
      "Help me choose a pump",
      "I need to irrigate a field — about 300 L/min",
      "Booster pump for a two-bathroom house under $300",
      "Compare FM-AJ-1500 and FM-AJ-2200",
    ],
  },

  customInstructions: `
You are the FlowMax pump selector assistant. FlowMax makes water pumps for Domestic, Agricultural, and Industrial use.

Help buyers find the right pump — conversationally. Key concepts:
- Flow rate (L/min): how much water per minute.
- Max head (m): how high the pump can push water (vertical lift / pressure).
- Self-priming pumps can draw water without being manually filled.
- Booster = household pressure; Centrifugal = high flow (irrigation/transfer); Submersible = boreholes, wells, drainage.

━━━ TOOLS ━━━
discover_requirements — use when the buyer is unsure ("help me choose"). A clickable form renders; NEVER list the questions in text. After answers, call search_products.
search_products — your workhorse. Call it early and set the filters that fit what the buyer described (each filter explains itself). If nothing matches, relax the most restrictive filter and try again.
get_product_specs — full specs for one model.
compare_products — exactly 2 models; a visual card renders, so don't repeat it as a table.
book_meeting — when the buyer wants a quote, bulk pricing, or to talk to sales.

Always link models using the url field: [MODEL](url). Note pricing is indicative — offer to connect with sales for a firm quote.
`.trim(),

  guidedPaths: {
    enabled: true,
    questions: [
      {
        rank: 1,
        question: "What will you use the pump for?",
        answer_space: ["Home water pressure", "Irrigation / agriculture", "Borehole / deep well", "Drainage / flooding", "Not sure"],
      },
      {
        rank: 2,
        question: "How high does the water need to be pushed (head)?",
        answer_space: ["Low (under 20 m)", "Medium (20–60 m)", "High (over 60 m)", "Not sure"],
      },
      {
        rank: 3,
        question: "What's your budget?",
        answer_space: ["Under $300", "$300–$700", "Over $700", "No fixed budget"],
      },
    ],
  },

  search: {
    filters: [
      { param: "type", column: "Type", kind: "enum", values: ["Booster", "Centrifugal", "Submersible"], description: "Pump type: Booster (household water pressure), Centrifugal (high-flow irrigation / transfer), or Submersible (boreholes, wells, drainage)." },
      { param: "flow_min_lpm", column: "Flow Rate (L/min)", kind: "min", description: "Minimum flow rate in litres per minute." },
      { param: "head_min_m", column: "Max Head (m)", kind: "min", description: "Minimum max head (vertical lift) in metres." },
      { param: "power_max_w", column: "Power (W)", kind: "max", description: "Maximum motor power in watts." },
      { param: "self_priming", column: "Self Priming", kind: "boolean", description: "Require a self-priming pump." },
      { param: "price_max_usd", column: "Price (USD)", kind: "max", description: "Maximum price in USD." },
    ],
    // No keyword? Show the most affordable pumps first.
    defaultSort: { column: "Price (USD)", direction: "asc" },
  },

  compare: {
    rows: [
      { label: "Type", key: "Type" },
      { label: "Flow Rate", key: "Flow Rate (L/min)", suffix: "L/min" },
      { label: "Max Head", key: "Max Head (m)", suffix: "m" },
      { label: "Power", key: "Power (W)", suffix: "W" },
      { label: "Inlet/Outlet", key: "Inlet/Outlet (in)", suffix: "in" },
      { label: "Material", key: "Material" },
      { label: "Voltage", key: "Voltage (V)", suffix: "V" },
      { label: "Self Priming", key: "Self Priming" },
      { label: "Price", key: "Price (USD)", suffix: "USD" },
    ],
  },

  booking: {
    enabled: true,
    delivery: { mode: "email" },
    successMessage: "A FlowMax sales rep will reach out within 1 business day with a quote.",
  },
};
