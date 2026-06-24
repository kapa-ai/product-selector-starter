import { createRoot } from "react-dom/client";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
// The Kapa SDK's stylesheet as a string (see vite.config inlineKapaCss) so we
// can inject it INTO the shadow root rather than leaving it as a sibling file
// that could never cross the shadow boundary.
import kapaCss from "virtual:kapa-css";
import { Widget } from "./Widget";
import type { WidgetConfig } from "./config/types";

let mounted = false;

/**
 * Mounts the widget inside a Shadow DOM root so the host page's CSS can never
 * touch it (and vice-versa). Two things make this work with Chakra/Emotion:
 *
 *   1. Emotion's <style> tags are injected INTO the shadow root via a custom
 *      cache `container`. Styles in document.head do not cross the shadow
 *      boundary, so without this nothing inside the widget would be styled.
 *   2. Chakra emits its design tokens as CSS custom properties. By default they
 *      attach to `:root`, which matches nothing inside a shadow tree — so we
 *      point `cssVarsRoot` at `:host` (the shadow host element), from which the
 *      variables cascade into the whole widget.
 *
 * The host element is position:fixed with a very high z-index so the bubble
 * floats above the host page.
 */
export function mountWidget(config: WidgetConfig): void {
  if (mounted) return;
  mounted = true;

  const host = document.createElement("div");
  host.id = "product-selector-root";
  Object.assign(host.style, {
    position: "fixed",
    zIndex: "2147483000",
    bottom: "0",
    right: "0",
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // The SDK's static stylesheet (.kapa-* classes, keyframes) injected into the
  // shadow root. Emotion/Chakra styles arrive separately via the cache below.
  const sdkStyle = document.createElement("style");
  sdkStyle.textContent = kapaCss;
  shadow.appendChild(sdkStyle);

  // Separate slots: one for Emotion's injected styles, one for the React tree.
  const styleSlot = document.createElement("div");
  const appSlot = document.createElement("div");
  shadow.appendChild(styleSlot);
  shadow.appendChild(appSlot);

  // Inherited CSS properties (line-height, font, color, letter-spacing, …) cross
  // the shadow boundary via the host element, so an aggressive host page (e.g.
  // `div { line-height: 3 }`) would leak into any SDK text that doesn't set its
  // own. Establish a clean typographic baseline on this in-shadow wrapper — host
  // selectors can't target it, and an explicit value beats the inherited one.
  Object.assign(appSlot.style, {
    lineHeight: "1.5",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    fontWeight: "400",
    fontStyle: "normal",
    letterSpacing: "normal",
    wordSpacing: "normal",
    textTransform: "none",
    textAlign: "left",
    textIndent: "0",
    whiteSpace: "normal",
    color: "#0d0d0f",
  });

  const cache = createCache({ key: "psw", container: styleSlot });

  const theme = extendTheme({
    config: { initialColorMode: "light", useSystemColorMode: false },
  });

  createRoot(appSlot).render(
    <CacheProvider value={cache}>
      <ChakraProvider theme={theme} cssVarsRoot=":host, :root">
        <Widget config={config} portalContainer={appSlot} />
      </ChakraProvider>
    </CacheProvider>,
  );
}
