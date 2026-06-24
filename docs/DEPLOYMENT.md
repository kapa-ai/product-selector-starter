# Deployment

How to get the agent running on your website. Two pieces: the **widget bundle**
(a single `<script>` on your page) and the **token endpoint** (a small backend
that holds your secret Kapa key). This guide covers both.

## The basics

```html
<script src="https://your-cdn.com/product-selector.js" defer></script>
<script>
  ProductSelector.init({
    projectId: "your-kapa-project-id",
    integrationId: "your-kapa-integration-id",
    sessionEndpoint: "https://your-backend.com/api/agent-session",
    bookEndpoint: "https://your-backend.com/api/book-lead",
    accentColor: "#0D2B73",
    logo: "https://your-site.com/logo.svg",
    title: "Product Selector",
  });
</script>
```

`ProductSelector.init()` is safe to call once. It appends a floating bubble to
the bottom-right; clicking it opens the agent panel.

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
