import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { IconChevronRight } from "@tabler/icons-react";
import type { Palette } from "../palette";

function summariseArgs(args: Record<string, unknown> | undefined): string {
  const entries = Object.entries(args ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "no arguments";
  return entries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(", ");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "\n… (truncated)" : s;
}

// Wraps a tool's rendered output with a collapsible header that exposes the
// exact arguments the agent passed and the raw response — useful for trust /
// debugging. Collapsed by default so it stays out of the way.
export const ToolCall: React.FC<{
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  palette: Palette;
  children: React.ReactNode;
}> = ({ name, args, result, palette, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <Box fontFamily={palette.fontFamily}>
      <Flex
        as="button"
        onClick={() => setOpen((o) => !o)}
        align="center"
        gap={1}
        fontSize="11px"
        color={palette.muted}
        _hover={{ color: palette.text }}
        mb={1}
        maxW="100%"
      >
        <IconChevronRight
          size={12}
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.1s", flexShrink: 0 }}
        />
        <Text as="span" fontWeight="600" flexShrink={0}>
          {name}
        </Text>
        <Text as="span" noOfLines={1} opacity={0.8}>
          ({summariseArgs(args)})
        </Text>
      </Flex>

      {open && (
        <Box
          mb={2}
          p={2}
          borderRadius={`${palette.radiusMd}px`}
          bg={palette.subtleBg}
          border={`1px solid ${palette.border}`}
          fontSize="11px"
          overflowX="auto"
        >
          <Text color={palette.faint} fontWeight="600" mb={0.5}>
            arguments
          </Text>
          <Box as="pre" color={palette.text} whiteSpace="pre-wrap" m={0}>
            {JSON.stringify(args ?? {}, null, 2)}
          </Box>
          {result !== undefined && (
            <>
              <Text color={palette.faint} fontWeight="600" mt={2} mb={0.5}>
                response
              </Text>
              <Box as="pre" color={palette.text} whiteSpace="pre-wrap" m={0}>
                {truncate(JSON.stringify(result, null, 2), 1500)}
              </Box>
            </>
          )}
        </Box>
      )}

      {children}
    </Box>
  );
};
