import { createToolHelper, type AgentTool } from "@kapaai/agent-react";
import { z } from "zod";
import { Suspense } from "react";
import type { Catalogue } from "../catalogue/schema";
import type { SelectorConfig } from "../config/types";
import { searchProducts, getProductSpecs, compareProducts } from "../catalogue/lookup";
import { CompareCard } from "./components/CompareCard";
import { SearchResults } from "./components/SearchResults";
import { QuestionForm } from "./components/QuestionForm";
import { BookingForm } from "./components/BookingForm";
import { ToolCall } from "./components/ToolCall";
import type { Palette } from "./palette";

export interface ToolRuntime {
  palette: Palette;
  bookEndpoint: string;
}

/**
 * Builds the agent's tools from the catalogue + config.
 *
 * These five tools (search / specs / compare / guided discovery / booking) are
 * an EXAMPLE set meant to get a working product selector live quickly. They're
 * the same across every deployment — only the catalogue data and config
 * (compare rows, guided questions, booking) change, so a company normally
 * customises via selector.config.ts without touching this file. You can of
 * course add your own tools here too: each is a Kapa AgentTool with a Zod
 * parameter schema, an `execute`, and an optional inline `render`.
 */
export function buildTools(
  catalogue: Catalogue,
  config: SelectorConfig,
  runtime: ToolRuntime,
): AgentTool<Record<string, never>>[] {
  const tool = createToolHelper<Record<string, never>>();
  const categories = Object.keys(catalogue.categoryLabels);
  const tools: AgentTool<Record<string, never>>[] = [];

  // ── search_products ─────────────────────────────────────────────────────
  // The parameter schema is built from the active example's declared filters,
  // so it adapts to any product domain without code changes here.
  const searchShape: Record<string, z.ZodTypeAny> = {
    keyword: z.string().optional().describe("Free-text search across names, descriptions, and other text fields."),
    result_type: z.enum(["families", "parts", "both"]).optional().describe("Return families, parts, or both (default)."),
  };
  // Only offer a category filter when the catalogue actually has categories
  // (filter-only catalogues have none).
  if (categories.length > 0) {
    searchShape.category = z
      .string()
      .optional()
      .describe(`Product category. One of: ${categories.join(", ")}, or "any" (default).`);
  }
  for (const f of config.search.filters) {
    let zt: z.ZodTypeAny;
    if (f.kind === "boolean") zt = z.boolean();
    else if (f.kind === "min" || f.kind === "max") zt = z.number();
    else if (f.kind === "enum") zt = z.enum(f.values as [string, ...string[]]);
    else zt = z.string();
    searchShape[f.param] = zt.optional().describe(f.description);
  }
  tools.push(
    tool({
      name: "search_products",
      displayName: "Search Products",
      description:
        "Search the product catalogue. Returns matching products ranked by relevance. The full ranked list is shown to the user as an interactive component. All parameters are optional.",
      parameters: z.object(searchShape),
      render: ({ args, result }) => (
        <ToolCall name="search_products" args={args} result={result} palette={runtime.palette}>
          <SearchResults
            result={result}
            palette={runtime.palette}
            categoryLabels={catalogue.categoryLabels}
            partNumberKey={catalogue.fields.partNumber}
            familyKey={catalogue.fields.familyName}
            urlKey={catalogue.fields.partUrl}
            specRows={config.compare.rows.slice(0, 3)}
            maxResults={config.search.maxResults ?? 6}
          />
        </ToolCall>
      ),
      execute: async (params) => searchProducts(catalogue, config.search, params as never),
    }),
  );

  // ── get_product_specs ───────────────────────────────────────────────────
  tools.push(
    tool({
      name: "get_product_specs",
      displayName: "Get Product Specs",
      description: "Return full specifications for a specific part number.",
      parameters: z.object({
        part_number: z.string().describe("The exact part number to look up."),
      }),
      execute: async (params) =>
        getProductSpecs(catalogue, String((params as { part_number: string }).part_number ?? "")),
    }),
  );

  // ── compare_products ──────────────────────────────────────────────────────
  tools.push(
    tool({
      name: "compare_products",
      displayName: "Compare Products",
      description:
        "Side-by-side visual comparison of exactly 2 part numbers. A comparison card is rendered automatically — do NOT repeat the data as a text table afterwards.",
      parameters: z.object({
        part_numbers: z.array(z.string()).length(2).describe("Array of exactly 2 part numbers to compare."),
      }),
      render: ({ args, result }) => (
        <ToolCall name="compare_products" args={args} result={result} palette={runtime.palette}>
          <CompareCard
            result={result}
            rows={config.compare.rows}
            palette={runtime.palette}
            categoryLabels={catalogue.categoryLabels}
          />
        </ToolCall>
      ),
      execute: async (params) =>
        compareProducts(
          catalogue,
          (params as { part_numbers: string[] }).part_numbers ?? [],
          config.compare.rows,
        ),
    }),
  );

  // ── discover_requirements (guided paths) ──────────────────────────────────
  if (config.guidedPaths.enabled && config.guidedPaths.questions.length > 0) {
    tools.push(
      tool({
        name: "discover_requirements",
        displayName: "Discover Requirements",
        description:
          config.guidedPaths.toolDescription ??
          "Launch a short guided flow (clickable questions) to identify the right product. Use when the user is unsure where to start or asks a vague/open-ended question.",
        parameters: z.object({
          user_context: z.string().optional().describe("Any context the user already provided about their project."),
        }),
        render: ({ status, args }) =>
          status === "completed" ? (
            <ToolCall name="discover_requirements" args={args} palette={runtime.palette}>
              <QuestionForm questions={config.guidedPaths.questions} palette={runtime.palette} />
            </ToolCall>
          ) : null,
        execute: async () => ({
          displayed: true,
          note: "A clickable form is now visible. After the user submits, immediately call search_products with filters derived from their answers. Do NOT list or repeat the questions or options.",
        }),
      }),
    );
  }

  // ── book_meeting ───────────────────────────────────────────────────────────
  if (config.booking.enabled && config.booking.delivery.mode !== "none") {
    const successMessage = config.booking.successMessage ?? "A representative will reach out within 1 business day.";
    tools.push(
      tool({
        name: "book_meeting",
        displayName: "Book Meeting",
        description:
          config.booking.toolDescription ??
          "Show a contact form to book a call with a sales/applications engineer (also for pricing). Call this DIRECTLY as soon as the visitor shows interest — the form itself collects their name, email, and company, so do NOT ask for contact details in chat first.",
        needsApproval: true,
        parameters: z.object({
          project_summary: z
            .string()
            .describe("A one-line summary of what the visitor wants, inferred from the conversation (the visitor does not need to provide this)."),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          email: z.string().optional(),
          company: z.string().optional(),
          role: z.string().optional(),
          preferred_contact: z.enum(["email", "phone", "either"]).optional(),
        }),
        render: ({ args, result, onApprove }) => (
          <ToolCall name="book_meeting" args={args} result={result} palette={runtime.palette}>
            <Suspense fallback={null}>
              <BookingForm
                prefill={args}
                bookEndpoint={runtime.bookEndpoint}
                palette={runtime.palette}
                successMessage={successMessage}
                onApprove={onApprove}
              />
            </Suspense>
          </ToolCall>
        ),
        // Runs after the visitor approves (submits) the form. Tell the model
        // exactly what happened so it doesn't ask them to fill it out again.
        execute: async () => ({
          submitted: true,
          note: "The contact form was shown and the visitor has ALREADY submitted their details — the request is complete and a confirmation is shown to them in the UI. Do NOT ask them to fill out a form or share any details. Reply with at most one short sentence confirming the request was received, or say nothing further.",
        }),
      }),
    );
  }

  return tools;
}
