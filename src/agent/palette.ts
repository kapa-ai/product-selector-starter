import type { ResolvedTheme } from "@kapaai/agent-react";

// A small set of semantic colours derived from the SDK's resolved theme, so the
// custom tool-render components (compare card, guided questions, booking form)
// match the agent panel exactly and follow the configured accent / colour
// scheme instead of hardcoded values. We don't reinvent the palette — we read
// it from the SDK.
export interface Palette {
  accent: string;
  accentFg: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  subtleBg: string;
  cardBg: string;
  radiusMd: number;
  fontFamily: string;
  error: string;
}

export function derivePalette(theme: ResolvedTheme, accentOverride?: string): Palette {
  const neutral = theme.colorScheme === "dark" ? theme.darkColors : theme.lightColors;
  return {
    accent: accentOverride ?? theme.primaryColors[6],
    accentFg: theme.accentForeground,
    text: neutral[9],
    muted: neutral[6],
    faint: neutral[5],
    border: neutral[3],
    subtleBg: neutral[1],
    cardBg: theme.white,
    radiusMd: theme.radius.md,
    fontFamily: theme.fontFamily,
    error: theme.status.error,
  };
}
