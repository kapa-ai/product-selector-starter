import { mountWidget } from "./mount";
import type { WidgetConfig } from "./config/types";

// Public entry point. The library build exposes this as a global:
//   <script src="product-selector.js"></script>
//   <script>ProductSelector.init({ projectId, integrationId, ... })</script>
//
// It's also importable in dev (index.html) and from bundled host apps.
export function init(config: WidgetConfig): void {
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountWidget(config), { once: true });
  } else {
    mountWidget(config);
  }
}

export type { WidgetConfig };
