// ─────────────────────────────────────────────────────────────────────────────
// Booking endpoint — receives the lead from BookingForm and delivers it.
//
// Choose a destination with the BOOKING_MODE env var:
//   "email"      → sends the lead to an inbox via Resend (free tier, no SMTP)
//   "webhook"    → POSTs the lead JSON to BOOKING_WEBHOOK_URL (Zapier, Make, or
//                  any system of your choice — including a CRM's inbound webhook)
//   "hubspot"    → finds/creates a company by email domain, creates a contact,
//                  then creates a Lead associated to the contact
//   "salesforce" → finds an Account by email domain, then creates a Lead
//
// Web standard (Request → Response): runs on Vercel/Netlify/Cloudflare/Deno/Bun.
// ─────────────────────────────────────────────────────────────────────────────
interface Lead {
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  role?: string;
  preferred_contact?: string;
  project_summary?: string;
  notes?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let lead: Lead;
  try {
    lead = (await req.json()) as Lead;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!lead.email) return json({ error: "email is required" }, 400);

  const mode = process.env.BOOKING_MODE ?? "email";
  try {
    switch (mode) {
      case "email":
        await deliverEmail(lead);
        break;
      case "webhook":
        await deliverWebhook(lead);
        break;
      case "hubspot":
        await deliverHubSpot(lead);
        break;
      case "salesforce":
        await deliverSalesforce(lead);
        break;
      default:
        return json({ error: `Unknown BOOKING_MODE: ${mode}` }, 500);
    }
  } catch (err) {
    console.error("book-lead delivery failed:", err);
    return json({ error: "Delivery failed" }, 502);
  }
  return json({ ok: true }, 200);
}

// ── email (Resend) ───────────────────────────────────────────────────────────
// NOTE: email delivery is OPTIONAL and is the simplest way to receive leads —
// no CRM integration required. If you just want leads in an inbox, use this (or
// "webhook") and ignore the HubSpot/Salesforce adapters entirely. Reach for a
// CRM mode only when you specifically want leads created in HubSpot/Salesforce.
//
// Free tier: 3,000 emails/mo. Get a key at resend.com → API Keys.
//   RESEND_API_KEY       required
//   BOOKING_EMAIL_TO     required (where leads land)
//   BOOKING_EMAIL_FROM   optional (default Resend's sandbox sender for testing)
async function deliverEmail(lead: Lead): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BOOKING_EMAIL_TO;
  const from = process.env.BOOKING_EMAIL_FROM ?? "onboarding@resend.dev";
  if (!apiKey || !to) throw new Error("RESEND_API_KEY and BOOKING_EMAIL_TO must be set");

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "(no name)";
  const rows = Object.entries(lead)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:2px 8px;color:#888">${k}</td><td style="padding:2px 8px">${escapeHtml(String(v))}</td></tr>`)
    .join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      reply_to: lead.email,
      subject: `New product-selector lead: ${name}${lead.company ? ` (${lead.company})` : ""}`,
      html: `<h2>New lead from the product selector</h2><table>${rows}</table>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend error: ${res.status} ${await res.text()}`);
}

// ── webhook ──────────────────────────────────────────────────────────────────
//   BOOKING_WEBHOOK_URL  required — any endpoint that accepts a JSON POST.
async function deliverWebhook(lead: Lead): Promise<void> {
  const url = process.env.BOOKING_WEBHOOK_URL;
  if (!url) throw new Error("BOOKING_WEBHOOK_URL must be set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!res.ok) throw new Error(`Webhook error: ${res.status}`);
}

// ── HubSpot ──────────────────────────────────────────────────────────────────
// Flow: find a company by email domain → create a contact (associated to the
// company if found) → create a Lead associated to the contact.
//
// Env: HUBSPOT_ACCESS_TOKEN — a Private App token with scopes
//      crm.objects.contacts.write, crm.objects.companies.read,
//      crm.objects.leads.write.
//
// HubSpot association type ids (HUBSPOT_DEFINED):
const HS_CONTACT_TO_COMPANY = 279;
const HS_LEAD_TO_CONTACT = 578;
// The Leads object lives under a date-versioned path. If this 404s, check the
// current version in the HubSpot docs (or try /crm/v3/objects/leads).
const HS_LEADS_PATH = "/crm/objects/2026-03/leads";

async function hubspot(token: string, path: string, body: unknown): Promise<any> {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HubSpot ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function deliverHubSpot(lead: Lead): Promise<void> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN must be set");
  const domain = emailDomain(lead.email);

  // 1. Find a company by domain.
  let companyId: string | undefined;
  if (domain) {
    const search = await hubspot(token, "/crm/v3/objects/companies/search", {
      filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
      properties: ["domain"],
      limit: 1,
    });
    companyId = search.results?.[0]?.id;
  }

  // 2. Create the contact, associating it to the company if we found one.
  const contact = await hubspot(token, "/crm/v3/objects/contacts", {
    properties: {
      email: lead.email,
      firstname: lead.first_name,
      lastname: lead.last_name,
      company: lead.company,
      jobtitle: lead.role,
    },
    associations: companyId
      ? [
          {
            to: { id: companyId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: HS_CONTACT_TO_COMPANY }],
          },
        ]
      : [],
  });

  // 3. Create the Lead, associated to the contact. The hs_associated_* and
  //    hs_lead_name display fields are derived by HubSpot from the contact, so
  //    we only set writable properties here.
  await hubspot(token, HS_LEADS_PATH, {
    associations: [
      {
        to: { id: contact.id },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: HS_LEAD_TO_CONTACT }],
      },
    ],
    properties: {
      hs_lead_name: fullName(lead),
      hs_lead_type: "NEW BUSINESS",
      hs_lead_label: "WARM",
      hs_lead_source: "OTHER_CAMPAIGNS",
      // Create this custom-ish source-detail value inside your HubSpot account.
      hs_object_source_detail_1: "Lead generated from the Kapa widget",
    },
  });
}

// ── Salesforce ───────────────────────────────────────────────────────────────
// Flow: find an Account by email domain (SOQL on Website) → create a Lead,
// attaching AccountId only if a match was found.
//
// Env: SALESFORCE_INSTANCE_URL  e.g. https://yourorg.my.salesforce.com
//      SALESFORCE_ACCESS_TOKEN  OAuth bearer token
//      SALESFORCE_API_VERSION   optional, default v60.0
async function deliverSalesforce(lead: Lead): Promise<void> {
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
  const token = process.env.SALESFORCE_ACCESS_TOKEN;
  const version = process.env.SALESFORCE_API_VERSION ?? "v60.0";
  if (!instanceUrl || !token) {
    throw new Error("SALESFORCE_INSTANCE_URL and SALESFORCE_ACCESS_TOKEN must be set");
  }
  const auth = { Authorization: `Bearer ${token}` };
  const domain = emailDomain(lead.email);

  // 1. Find an Account whose Website contains the email domain.
  let accountId: string | undefined;
  if (domain) {
    const soql = `SELECT Id,Name,Website FROM Account WHERE Website LIKE '%${domain.replace(/'/g, "")}%' LIMIT 1`;
    const res = await fetch(`${instanceUrl}/services/data/${version}/query?q=${encodeURIComponent(soql)}`, {
      headers: auth,
    });
    if (!res.ok) throw new Error(`Salesforce query → ${res.status} ${await res.text()}`);
    const data = await res.json();
    accountId = data.records?.[0]?.Id;
  }

  // 2. Create the Lead. AccountId is added only when an Account matched.
  //    Note: the standard Lead object has no AccountId field by default — keep
  //    this only if your org has added one; otherwise drop it.
  const body: Record<string, unknown> = {
    FirstName: lead.first_name,
    LastName: lead.last_name || "(unknown)",
    Company: lead.company || "(unknown)",
    Email: lead.email,
    Title: lead.role,
    Description: lead.project_summary ?? lead.notes,
    LeadSource: "Kapa Widget",
  };
  if (accountId) body.AccountId = accountId;

  const res = await fetch(`${instanceUrl}/services/data/${version}/sobjects/Lead`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Salesforce Lead → ${res.status} ${await res.text()}`);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function emailDomain(email?: string): string | undefined {
  const at = email?.split("@")[1]?.trim().toLowerCase();
  return at || undefined;
}

function fullName(lead: Lead): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email || "Lead";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

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
