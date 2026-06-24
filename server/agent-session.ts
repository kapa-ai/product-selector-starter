// ─────────────────────────────────────────────────────────────────────────────
// Token endpoint — the ONE piece of backend the widget requires.
//
// The widget calls this (WidgetConfig.sessionEndpoint) to get a short-lived
// Kapa session token. Your SECRET Kapa API key lives here, server-side, and
// never reaches the browser.
//
// Written against the Web standard (Request → Response), so it runs as-is on
// Vercel, Netlify, Cloudflare Workers, Deno, and Bun. For an Express adapter,
// see server/README.md.
//
// Required env: KAPA_API_KEY   (admin panel → API Keys)
// Optional env: ALLOWED_ORIGIN — which website may call this endpoint (browser
//   CORS check). Default "*" (any). In production set it to your site's origin,
//   e.g. https://www.yoursite.com. Ignored if widget + backend share a domain.
// ─────────────────────────────────────────────────────────────────────────────
const KAPA_API_BASE = "https://api.kapa.ai/agent/v1";

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = process.env.KAPA_API_KEY;
  if (!apiKey) return json({ error: "KAPA_API_KEY is not set on the server" }, 500);

  let projectId: string | undefined;
  try {
    ({ projectId } = (await req.json()) as { projectId?: string });
  } catch {
    /* fall through to validation */
  }
  if (!projectId) return json({ error: "projectId is required" }, 400);

  const res = await fetch(`${KAPA_API_BASE}/projects/${projectId}/agent/sessions/`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) return json({ error: `Kapa API error: ${res.status}` }, res.status);

  // Body is the session token payload the SDK's getSessionToken expects.
  return json(await res.json(), 200);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
