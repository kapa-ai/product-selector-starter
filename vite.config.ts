import { defineConfig, loadEnv, type Plugin, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { ServerResponse } from "node:http";
import agentSession from "./server/agent-session";
import bookLead from "./server/book-lead";

// Dev-only: serve the SAME /server handlers at /api/* during `npm run dev`, so a
// local `npm run dev` is a complete, working environment (token minting + lead
// booking). In production these handlers deploy separately (see server/README);
// the secret API key never ships in the browser bundle. This middleware is not
// included in the built widget.
function devApi(): Plugin {
  const routes: Record<string, (req: Request) => Promise<Response>> = {
    "/api/agent-session": agentSession,
    "/api/book-lead": bookLead,
  };
  return {
    name: "dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req: Connect.IncomingMessage, res: ServerResponse, next) => {
        const path = (req.url ?? "").split("?")[0];
        const handler = routes[path];
        if (!handler) return next();

        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = Buffer.concat(chunks);

        const webReq = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
        });

        const webRes = await handler(webReq);
        res.statusCode = webRes.status;
        webRes.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await webRes.arrayBuffer()));
      });
    },
  };
}

// Exposes the Kapa SDK's stylesheet as `import kapaCss from "virtual:kapa-css"`,
// resolved from the installed package (its exports map blocks a direct deep
// import). We inject this string into the shadow root at mount time so the
// .kapa-* styles live inside the shadow boundary.
function inlineKapaCss(): Plugin {
  const virtualId = "virtual:kapa-css";
  const resolvedId = "\0" + virtualId;
  return {
    name: "inline-kapa-css",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const require = createRequire(import.meta.url);
      const entry = require.resolve("@kapaai/agent-react");
      const css = readFileSync(join(dirname(entry), "style.css"), "utf8");
      return `export default ${JSON.stringify(css)};`;
    },
  };
}

// The SDK also imports its style.css as a side-effect, which Vite would emit as
// a separate file. Since we inline it (above), drop the stray .css asset to keep
// the bundle a single self-contained .js file.
function stripCssAssets(): Plugin {
  return {
    name: "strip-css-assets",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (name.endsWith(".css")) delete bundle[name];
      }
    },
  };
}

// Two modes:
//   `vite`        → dev server using index.html (local playground)
//   `vite build`  → library build producing a single embeddable IIFE bundle
//                   that any website can drop in via <script src="product-selector.js">.
export default defineConfig(({ command, mode }) => {
  // Make .env values (KAPA_API_KEY, RESEND_*, BOOKING_*) visible to the dev API
  // handlers via process.env during `npm run dev`.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  // Expose ONLY the two non-secret ids to the dev playground (index.html), so
  // .env can use plain PROJECT_ID / INTEGRATION_ID without Vite's VITE_ prefix.
  // Nothing else from .env is injected into client code — secrets stay server-side.
  const clientEnv = {
    "import.meta.env.PROJECT_ID": JSON.stringify(process.env.PROJECT_ID ?? ""),
    "import.meta.env.INTEGRATION_ID": JSON.stringify(process.env.INTEGRATION_ID ?? ""),
  };

  return {
  plugins: [react(), inlineKapaCss(), stripCssAssets(), devApi()],
  define:
    command === "build"
      ? // React must run in production mode inside the embedded bundle.
        { "process.env.NODE_ENV": '"production"', ...clientEnv }
      : clientEnv,
  build: {
    lib: {
      entry: resolve(__dirname, "src/embed.tsx"),
      name: "ProductSelector",
      formats: ["iife"],
      fileName: () => "product-selector.js",
    },
    rollupOptions: {
      // Bundle everything (including React) so the script works on any site,
      // even ones with no build step and no React of their own.
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  };
});
