import { useState } from "react";
import { Box, Flex, Text, Badge, Button } from "@chakra-ui/react";
import type { CompareRow } from "../../config/types";
import type { Palette } from "../palette";

type Row = Record<string, string | null>;

// Deterministic results list rendered when the agent calls search_products.
// It shows the EXACT rows the lookup returned, in rank order — the user is
// guaranteed to see the authoritative set, not the model's retelling. The first
// `maxResults` are shown, with a "Show all" toggle that reveals the rest from
// the already-returned data (no extra round-trip).
export const SearchResults: React.FC<{
  result: unknown;
  palette: Palette;
  categoryLabels: Record<string, string>;
  partNumberKey: string;
  familyKey: string;
  urlKey?: string;
  specRows: CompareRow[];
  maxResults: number;
}> = ({ result, palette, categoryLabels, partNumberKey, familyKey, urlKey, specRows, maxResults }) => {
  const [showAll, setShowAll] = useState(false);
  const data = result as { parts?: Row[]; total_matched?: number } | null;
  const parts = data?.parts ?? [];
  if (parts.length === 0) return null;

  const total = data?.total_matched ?? parts.length;
  const visible = showAll ? parts : parts.slice(0, maxResults);
  const hiddenInReturned = parts.length - visible.length;
  const beyondReturned = total - parts.length; // matched but over the result cap

  return (
    <Box mt={2} fontFamily={palette.fontFamily} fontSize="xs">
      <Text color={palette.muted} mb={1.5}>
        {total} {total === 1 ? "match" : "matches"}
        {total > visible.length ? ` · showing ${visible.length}` : ""}
      </Text>

      <Flex direction="column" gap={1.5}>
        {visible.map((row, i) => {
          const name = row[partNumberKey] ?? row[familyKey] ?? "—";
          const url = urlKey ? row[urlKey] : null;
          const catLabel = categoryLabels[row.category ?? ""] ?? row.category ?? "";
          return (
            <Box
              key={`${name}-${i}`}
              border={`1px solid ${palette.border}`}
              borderRadius={`${palette.radiusMd}px`}
              bg={palette.cardBg}
              px={3}
              py={2}
            >
              <Flex align="center" gap={2} justify="space-between">
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <Text fontWeight="700" color={palette.accent} _hover={{ textDecoration: "underline" }}>
                      {name}
                    </Text>
                  </a>
                ) : (
                  <Text fontWeight="700" color={palette.text}>
                    {name}
                  </Text>
                )}
                {catLabel && (
                  <Badge
                    fontSize="9px"
                    px={1.5}
                    py={0}
                    borderRadius="4px"
                    bg={palette.subtleBg}
                    color={palette.muted}
                    textTransform="uppercase"
                    letterSpacing="0.5px"
                  >
                    {catLabel}
                  </Badge>
                )}
              </Flex>
              {specRows.length > 0 && (
                <Flex gap={3} mt={1} flexWrap="wrap">
                  {specRows.map(({ label, key, suffix }) => {
                    const val = row[key];
                    if (!val || val === "0" || val === "null") return null;
                    return (
                      <Text key={key} color={palette.faint}>
                        {label}:{" "}
                        <Text as="span" color={palette.text} fontWeight="500">
                          {suffix ? `${val} ${suffix}` : val}
                        </Text>
                      </Text>
                    );
                  })}
                </Flex>
              )}
            </Box>
          );
        })}
      </Flex>

      {hiddenInReturned > 0 && (
        <Button
          mt={2}
          size="xs"
          variant="outline"
          onClick={() => setShowAll(true)}
          borderColor={palette.border}
          color={palette.text}
          borderRadius={`${palette.radiusMd}px`}
          _hover={{ borderColor: palette.muted }}
        >
          Show all {parts.length}
        </Button>
      )}
      {showAll && beyondReturned > 0 && (
        <Text color={palette.faint} mt={1.5}>
          {beyondReturned} more match your filters — refine to see them.
        </Text>
      )}
    </Box>
  );
};
