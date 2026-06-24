# Server

Two small endpoints the widget talks to. Both are written against the Web
standard (`Request → Response`), so they run unmodified on Vercel, Netlify,
Cloudflare Workers, Deno, and Bun.

| Endpoint            | File                | Purpose                                              |
| ------------------- | ------------------- | ---------------------------------------------------- |
| `/api/agent-session`| `agent-session.ts`  | Exchanges your secret Kapa API key for a session token (required). |
| `/api/book-lead`    | `book-lead.ts`      | Receives the "book a call" lead and delivers it (only if booking is enabled). |

The session endpoint is the **only** backend the agent strictly needs — your
Kapa API key must never ship to the browser.

## Environment

Copy `.env.example` to your host's environment settings. At minimum:

```
KAPA_API_KEY=...          # required (session endpoint)
BOOKING_MODE=email        # email | webhook
RESEND_API_KEY=...        # if email
BOOKING_EMAIL_TO=...       # if email
# BOOKING_WEBHOOK_URL=...  # if webhook
ALLOWED_ORIGIN=https://www.yoursite.com   # lock down in production
```

## Deploy on Vercel

Vercel serves files in an `api/` directory as functions. Re-export these handlers:

```ts
// api/agent-session.ts
export { default } from "../server/agent-session";
export const config = { runtime: "edge" };

// api/book-lead.ts
export { default } from "../server/book-lead";
export const config = { runtime: "edge" };
```

Then point the widget at them:

```js
ProductSelector.init({
  projectId: "...",
  integrationId: "...",
  sessionEndpoint: "https://your-app.vercel.app/api/agent-session",
  bookEndpoint: "https://your-app.vercel.app/api/book-lead",
});
```

## Use with Express (Node)

Wrap the Web-standard handler with a tiny adapter:

```ts
import express from "express";
import session from "./server/agent-session";

const app = express();
app.use(express.json());

app.post("/api/agent-session", async (req, res) => {
  const request = new Request("http://local/api/agent-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req.body),
  });
  const out = await session(request);
  res.status(out.status);
  out.headers.forEach((v, k) => res.setHeader(k, v));
  res.send(await out.text());
});
```

## Booking destinations

Set `BOOKING_MODE`:

- **`email`** — sends via [Resend](https://resend.com) (free tier, no SMTP). Set `RESEND_API_KEY` + `BOOKING_EMAIL_TO`.
- **`webhook`** — POSTs the lead JSON to `BOOKING_WEBHOOK_URL` (Zapier, Make, or any system you choose).
- **`hubspot`** — finds a company by the lead's email domain, creates a contact
  (associated to that company if found), then creates a **Lead** associated to
  the contact. Needs `HUBSPOT_ACCESS_TOKEN` (Private App with
  `crm.objects.contacts.write`, `crm.objects.companies.read`,
  `crm.objects.leads.write`).
- **`salesforce`** — runs a SOQL query to find an Account by the email domain,
  then creates a **Lead**, attaching `AccountId` only on a match. Needs
  `SALESFORCE_INSTANCE_URL` + `SALESFORCE_ACCESS_TOKEN` (optional
  `SALESFORCE_API_VERSION`).

Both CRM adapters are real implementations in `book-lead.ts`. A couple of
org-specific knobs are flagged in code comments:

- HubSpot: the Leads object uses a date-versioned path (`HS_LEADS_PATH`) and the
  association type ids (`HS_CONTACT_TO_COMPANY`, `HS_LEAD_TO_CONTACT`) are
  HubSpot defaults — adjust if your portal differs. `hs_object_source_detail_1`
  expects a source-detail value you create in your HubSpot account.
- Salesforce: the standard `Lead` object has no `AccountId` field by default —
  the adapter only sends it when an Account matches; drop it if your org hasn't
  added one.
