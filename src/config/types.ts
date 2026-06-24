import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Two layers of configuration:
//
//   WidgetConfig    — passed at RUNTIME by the host page to ProductSelector.init().
//                     Just the few things that vary per deployment / are secret-
//                     adjacent (Kapa ids, the token endpoint, optional brand
//                     overrides).
//
//   SelectorConfig  — edited at BUILD TIME in src/selector.config.ts. This is
//                     where a company tailors the agent: branding copy, the
//                     system prompt, guided-path questions, compare layout, and
//                     how "book a call" is delivered. No engine code changes.
// ─────────────────────────────────────────────────────────────────────────────

/** Runtime options passed to ProductSelector.init() — safe to expose. */
export interface WidgetConfig {
  /** Kapa project id (admin panel → Projects). */
  projectId: string;
  /** Kapa agent integration id (admin panel → Integrations). */
  integrationId: string;
  /**
   * URL of YOUR deployed token endpoint (see /server). Exchanges your secret
   * Kapa API key for a short-lived session token. Default: "/api/agent-session".
   */
  sessionEndpoint?: string;
  /**
   * URL of YOUR booking endpoint (see /server/book-lead). Receives the lead
   * form and routes it to email / webhook / CRM. Default: "/api/book-lead".
   */
  bookEndpoint?: string;
  /** Optional runtime overrides of the build-time branding. */
  accentColor?: string;
  logo?: string;
  title?: string;
}

/** A single guided-path question shown as clickable radio options. */
export interface GuidedQuestion {
  rank: number;
  question: string;
  answer_space: string[];
}

/** A row in the side-by-side comparison card. `key` is a catalogue column. */
export interface CompareRow {
  label: string;
  /** The part column to read (verbatim spreadsheet header). */
  key: string;
  /** Optional unit/suffix appended to non-empty values, e.g. "KB", "dBm". */
  suffix?: string;
}

/**
 * A domain-specific search filter. Each becomes a parameter on the
 * `search_products` tool and is applied generically over the catalogue, so the
 * SAME engine works for chips, pumps, espresso machines, anything — you just
 * declare the filters that make sense for your products.
 *
 * `param`  = the tool parameter name the agent sets.
 * `column` = the verbatim catalogue column it reads.
 * `kind`:
 *   "text"    free-text substring match
 *   "enum"    one of `values` (substring match, case-insensitive)
 *   "boolean" require the column to equal `trueValue` (default "Yes")
 *   "min"     numeric: column's value must be >= the param
 *   "max"     numeric: column's value must be <= the param
 */
export type SearchFilter =
  | { param: string; column: string; kind: "text"; description: string }
  | { param: string; column: string; kind: "enum"; values: string[]; description: string }
  | { param: string; column: string; kind: "boolean"; trueValue?: string; description: string }
  | { param: string; column: string; kind: "min"; description: string }
  | { param: string; column: string; kind: "max"; description: string };

export type BookingDelivery =
  | { mode: "email" }
  | { mode: "webhook" }
  | { mode: "none" };

export interface SelectorConfig {
  /** Brand metadata (can be overridden at runtime by WidgetConfig). */
  brand: {
    name: string;
    accentColor: string;
    logo: string;
  };

  /** Copy shown in the panel header and empty state. */
  branding: {
    title: string;
    subtitle?: string;
    inputPlaceholder?: string;
    /** Quick-start prompts shown before the first message. */
    starterPrompts?: string[];
  };

  /** The system prompt that teaches the agent your catalogue + tool hygiene. */
  customInstructions: string;

  /** Kapa model id. Defaults to the SDK default if omitted. */
  model?: string;

  /** Guided paths: toggle + the questions presented as radio buttons. */
  guidedPaths: {
    enabled: boolean;
    /** Tool description the model sees — when to launch the guided flow. */
    toolDescription?: string;
    questions: GuidedQuestion[];
  };

  /** Search: the domain-specific filters exposed on the search_products tool. */
  search: {
    filters: SearchFilter[];
    /** How many results the UI shows before the "Show all" expander. Default 15. */
    maxResults?: number;
    /**
     * Hard ceiling on rows returned to the agent/UI per query (bounds token
     * cost on huge result sets). Default 50. The true total is always reported.
     */
    resultLimit?: number;
    /**
     * Ordering used when the query has no keyword to rank by. Sorts on the
     * numeric value of `column`. Without it, results keep catalogue order.
     */
    defaultSort?: { column: string; direction: "asc" | "desc" };
  };

  /** Side-by-side comparison: which spec rows to render. */
  compare: {
    rows: CompareRow[];
  };

  /** Book-a-call behaviour. */
  booking: {
    enabled: boolean;
    /** Tool description the model sees. */
    toolDescription?: string;
    /** Where leads go. The matching server route must be configured (see /server). */
    delivery: BookingDelivery;
    /** Message shown after a successful submission. */
    successMessage?: string;
  };
}

/** Props passed to a tool's custom inline renderer. */
export interface ToolRenderProps {
  status: string;
  result: unknown;
  args: Record<string, unknown>;
  onApprove?: () => void;
}

export type ToolRenderer = (props: ToolRenderProps) => ReactNode | null;
