import type { SelectorConfig } from "../../config/types";

export const config: SelectorConfig = {
  brand: {
    name: "Acme",
    accentColor: "#0D2B73",
    logo: "https://dummyimage.com/64x64/0d2b73/ffffff.png&text=A",
  },

  branding: {
    title: "Acme Product Selector",
    subtitle: "Find the right wireless chip or module for your design",
    inputPlaceholder: "Describe your use case, or ask to compare two parts...",
    starterPrompts: [
      "Help me find the right chip for my project",
      "I need a multi-protocol SoC with Matter and Thread",
      "Show me a chip for wireless headphones",
      "Compare ACM-M310 and ACM-M3M-01",
    ],
  },

  customInstructions: `
You are the Acme product selector assistant. Acme makes wireless chips (SoCs) and modules across three categories: Bluetooth, Multi-protocol, and Wi-Fi.

Help engineers find the right device — conversationally.

━━━ CATEGORIES ━━━
- bluetooth: Bluetooth LE parts; the W2 family adds Bluetooth Classic + audio for headsets/speakers.
- multiprotocol: Bluetooth LE + Zigbee + Thread + Matter (smart home). Modules (M3M) are certified with an antenna; SoCs (M3) need RF design.
- wifi: Wi-Fi 6 + Bluetooth LE module (F5M) for gateways/appliances.

━━━ TOOLS ━━━
discover_requirements — use when the user is vague ("help me find a chip"). A clickable form renders; NEVER list the questions in text. After they answer, call search_products.
search_products — your workhorse. Call it early and set the filters that fit what the user described (each filter explains itself). If nothing matches, relax the most restrictive filter and try again.
get_product_specs — full specs for one part number.
compare_products — exactly 2 parts; a visual card renders, so don't repeat it as a table.
book_meeting — when the user wants pricing or to talk to an engineer.

Always link parts using the url field: [PART](url). Offer to connect with an engineer for pricing.
`.trim(),

  guidedPaths: {
    enabled: true,
    questions: [
      {
        rank: 1,
        question: "What connectivity does your product need?",
        answer_space: ["Bluetooth only", "Multi-protocol (Zigbee / Thread / Matter)", "Wi-Fi", "Not sure"],
      },
      {
        rank: 2,
        question: "Is audio part of the design?",
        answer_space: ["Yes — headphones / speaker", "No audio", "Maybe later"],
      },
      {
        rank: 3,
        question: "Bare chip or ready-to-use module?",
        answer_space: ["SoC (bare chip)", "Module (integrated antenna)", "Either"],
      },
    ],
  },

  search: {
    filters: [
      { param: "type", column: "Type", kind: "enum", values: ["SoC", "Module"], description: "Set 'SoC' for a bare chip (needs antenna/RF design) or 'Module' for a certified part with an integrated antenna." },
      { param: "protocol", column: "Protocols", kind: "text", description: "A protocol or ecosystem the product must support, e.g. 'Matter', 'Zigbee', 'Thread', 'Bluetooth Classic', 'Wi-Fi'. Use for smart-home / mesh needs." },
      { param: "ble_version_min", column: "BLE Version", kind: "min", description: "Minimum Bluetooth LE version, e.g. 5.4 or 6.0." },
      { param: "flash_min_kb", column: "Flash (KB)", kind: "min", description: "Minimum flash memory in KB." },
      { param: "has_audio", column: "Has Audio", kind: "boolean", description: "Require integrated audio (mics / speaker output). Set this for headphones, earbuds, speakers, or any audio device." },
    ],
    // When there's no keyword to rank by, list the highest-memory parts first.
    defaultSort: { column: "Flash (KB)", direction: "desc" },
  },

  compare: {
    rows: [
      { label: "Flash", key: "Flash (KB)", suffix: "KB" },
      { label: "RAM", key: "RAM (KB)", suffix: "KB" },
      { label: "MCU Core", key: "MCU Core" },
      { label: "BLE Version", key: "BLE Version" },
      { label: "Matter", key: "Has Matter" },
      { label: "Zigbee", key: "Has Zigbee" },
      { label: "Thread", key: "Has Thread" },
      { label: "BT Classic", key: "Has BT Classic" },
      { label: "Audio", key: "Has Audio" },
      { label: "GPIO", key: "GPIO" },
      { label: "Package", key: "Package Size (mm)" },
      { label: "Supply Voltage", key: "Supply Voltage" },
    ],
  },

  booking: {
    enabled: true,
    delivery: { mode: "email" },
    successMessage: "An Acme applications engineer will reach out within 1 business day.",
  },
};
