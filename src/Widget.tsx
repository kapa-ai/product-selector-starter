import { useCallback, useMemo, useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { AgentProvider, AgentPanel, resolveTheme, type AgentThemeConfig } from "@kapaai/agent-react";
import { IconMessageChatbot } from "@tabler/icons-react";
import type { WidgetConfig } from "./config/types";
import { selectorConfig, catalogue } from "./selector.config";
import { buildTools } from "./agent/tools";
import { derivePalette } from "./agent/palette";

const BUILTIN_TOOL_META = {
  search_knowledge_base: { displayName: "Search Knowledge Base" },
};

/**
 * The embeddable widget: a floating bubble that opens the Kapa agent in a side
 * panel. Runtime options (WidgetConfig) come from ProductSelector.init();
 * everything else comes from the build-time selectorConfig.
 */
export const Widget: React.FC<{
  config: WidgetConfig;
  portalContainer: HTMLElement;
}> = ({ config }) => {
  const [open, setOpen] = useState(false);

  const accent = config.accentColor ?? selectorConfig.brand.accentColor;
  const logo = config.logo ?? selectorConfig.brand.logo;
  const title = config.title ?? selectorConfig.branding.title;
  const sessionEndpoint = config.sessionEndpoint ?? "/api/agent-session";
  const bookEndpoint = config.bookEndpoint ?? "/api/book-lead";

  const theme: AgentThemeConfig = useMemo(
    () => ({ accentColor: accent, colorScheme: "light" }),
    [accent],
  );
  const palette = useMemo(() => derivePalette(resolveTheme(theme), accent), [theme, accent]);

  const tools = useMemo(
    () => buildTools(catalogue, selectorConfig, { palette, bookEndpoint }),
    [palette, bookEndpoint],
  );

  const getSessionToken = useCallback(async () => {
    const res = await fetch(sessionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: config.projectId }),
    });
    if (!res.ok) throw new Error(`Session request failed: ${res.status}`);
    return res.json();
  }, [sessionEndpoint, config.projectId]);

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  return (
    <AgentProvider
      getSessionToken={getSessionToken}
      projectId={config.projectId}
      integrationId={config.integrationId}
      tools={tools}
      model={selectorConfig.model ?? "kapa-agent-1.0"}
      builtinToolMeta={BUILTIN_TOOL_META}
      theme={theme}
      customInstructions={selectorConfig.customInstructions}
    >
      <Box fontFamily="Inter, system-ui, sans-serif">
        {!open && (
          <Button
            position="fixed"
            bottom="24px"
            right="24px"
            onClick={() => setOpen(true)}
            bg={accent}
            color={palette.accentFg}
            borderRadius="full"
            h="52px"
            px={5}
            boxShadow="0 4px 16px rgba(0,0,0,0.25)"
            _hover={{ opacity: 0.9 }}
            fontWeight="600"
            fontSize="sm"
            leftIcon={
              logo ? (
                <Box as="img" src={logo} alt="" w="18px" h="18px" borderRadius="3px" objectFit="contain" />
              ) : (
                <IconMessageChatbot size={18} />
              )
            }
          >
            {title}
          </Button>
        )}

        <AgentPanel
          open={open}
          onClose={() => setOpen(false)}
          width={isMobile ? window.innerWidth : 480}
          top={0}
          branding={{
            title: (
              <Flex align="center" gap={1.5}>
                {logo && <Box as="img" src={logo} alt="" w="16px" h="16px" borderRadius="3px" objectFit="contain" />}
                <Text as="span">{title}</Text>
              </Flex>
            ),
            subtitle: selectorConfig.branding.subtitle || "What can I help with?",
            examplePrompts: selectorConfig.branding.starterPrompts ?? [],
            inputPlaceholder: selectorConfig.branding.inputPlaceholder || "Ask a question...",
          }}
        />
      </Box>
    </AgentProvider>
  );
};
