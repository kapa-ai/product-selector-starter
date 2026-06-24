# Deployment

Getting the agent onto your site is two pieces: the **widget** (the agent UI and
tools) and the **token endpoint** (a small backend that holds your secret Kapa
key). This guide covers how to add the widget — pick the path that matches your
stack — and the endpoint requirements that apply to all of them.

## Choosing how to embed

| Your site | Use | Why |
| --- | --- | --- |
| CMS / no-code (WordPress, Webflow, Shopify, …) | **A. Script tag** | Paste two lines into a custom-code block; the bundle carries its own React + SDK. |
| A frontend you build yourself (React, no CMS) | **B. Import the code** | Render the agent in your own component tree — tightest integration, no extra artifact. |
| Neither is possible (rare) | **C. iframe** | Last resort — see "Do you need an iframe?" below. |

### A. Script tag — for CMS / no-code sites

`dist/product-selector.js` is a single self-contained file (see "What gets
bundled"). Serve it from your site and add:

```html
<script src="/product-selector.js" defer></script>
<script>
  ProductSelector.init({
    projectId: "your-kapa-project-id",
    integrationId: "your-kapa-integration-id",
    sessionEndpoint: "/api/agent-session",
    bookEndpoint: "/api/book-lead",
    accentColor: "#0D2B73",
    logo: "/logo.svg",
    title: "Product Selector",
  });
</script>
```

`ProductSelector.init()` is safe to call once. It appends a floating bubble to
the bottom-right; clicking it opens the agent panel, isolated from your page's
CSS by a Shadow DOM root (see below).

### B. Import the code — for a frontend you build yourself

If you own the frontend you don't need the IIFE bundle. Two options:

- **Render the components directly.** Reuse the setup in `src/Widget.tsx` —
  `AgentProvider` wrapping `AgentPanel`, with your tools and `customInstructions`
  — inside your own React tree. Your app already handles bundling and styling, so
  you can drop the Shadow DOM if you don't need the isolation.
- **Call `init()` from your bundle.** Import the `init` entry and call it once on
  load; this mounts the same Shadow-DOM bubble as the script path, just from your
  build instead of a separate file.

Either way, point `sessionEndpoint` at your token endpoint.

### C. Do you need an iframe? (Almost certainly not.)

An iframe embeds the widget as a separate document via `<iframe>`. People reach
for it "for isolation" — but this widget already gets the isolation that matters
from **Shadow DOM** (your CSS and the widget's can't touch each other), and the
script tag works on every CMS. So an iframe usually just adds cost:

- The bubble lives on your page while the panel lives in the frame, so you need
  cross-frame messaging to open/close, resize, and handle focus and mobile.
- You have to host a separate widget page.
- Passing config and reading page context gets more awkward.

Consider an iframe **only** if one of these holds:

- A strict Content-Security-Policy blocks adding first-party/inline scripts but
  allows framed content.
- You must run the widget's JavaScript in a hard sandbox (e.g. alongside
  untrusted third-party code) — something Shadow DOM does not provide.
- You genuinely cannot add anything to the host page except an `<iframe>`.

If none of those apply, use A or B.

## What gets bundled

`dist/product-selector.js` is a **single, self-contained IIFE** (~470 KB
gzipped) that includes React, Chakra UI, and the Kapa Agent SDK. The host page
needs **no** build step, framework, or other dependency — just the script tag.

## Style isolation (Shadow DOM)

The widget mounts inside a **Shadow DOM** root, so:

- The host page's CSS — even aggressive `!important` rules — cannot affect the
  widget.
- The widget's CSS cannot leak onto the host page.

This is handled in `src/mount.tsx`:

1. **Emotion cache → shadow root.** Chakra/Emotion styles are injected inside
   the shadow boundary (styles in `document.head` don't cross it).
2. **`cssVarsRoot=":host"`.** Chakra's design-token CSS variables default to
   `:root`, which matches nothing inside a shadow tree — pinning them to `:host`
   makes them cascade through the widget.
3. **SDK stylesheet injected inline.** The Kapa SDK's `style.css` is bundled as a
   string and injected into the shadow root (see `vite.config.ts → inlineKapaCss`).

No portal escaping to worry about: the panel and all overlays render inside the
shadow root.

## Token endpoint requirement

`sessionEndpoint` must point at a backend that holds your **secret** Kapa API key
and returns a session token. Never put the API key in `init()` or any client
code. See [`/server`](../server/README.md) for ready-to-deploy handlers.

If you host the widget and your backend on the **same origin**, the default
relative paths (`/api/agent-session`, `/api/book-lead`) work and you can omit
`sessionEndpoint` / `bookEndpoint`. Cross-origin embeds need CORS — set
`ALLOWED_ORIGIN` on the server.

## Versioning tip

Serve the bundle from a versioned path (e.g. `/product-selector.v1.js`) or set
sensible cache headers, so you can ship updates without stale-cache surprises.
