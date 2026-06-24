import { Box, Flex, Text, Badge } from "@chakra-ui/react";
import type { ComparedPart } from "../../catalogue/lookup";
import type { CompareRow } from "../../config/types";
import type { Palette } from "../palette";

// Visual side-by-side comparison of (up to) 2 products. Rendered automatically
// when the agent calls compare_products — the model is told NOT to also repeat
// the data as a text table. Colours come from the SDK's resolved theme palette.
export const CompareCard: React.FC<{
  result: unknown;
  rows: CompareRow[];
  palette: Palette;
  categoryLabels: Record<string, string>;
}> = ({ result, rows, palette, categoryLabels }) => {
  const data = result as { comparison?: ComparedPart[] } | null;
  const parts = data?.comparison ?? [];
  if (parts.length === 0) return null;

  return (
    <Flex gap={2} mt={2} flexWrap="wrap" fontFamily={palette.fontFamily}>
      {parts.map((part, i) => (
        <ProductCard
          key={part.part_number ?? i}
          part={part}
          rows={rows}
          palette={palette}
          categoryLabel={categoryLabels[part.category ?? ""] ?? part.category ?? ""}
          isFirst={i === 0}
        />
      ))}
    </Flex>
  );
};

function formatValue(value: string | null | undefined, suffix?: string): string {
  if (value === null || value === undefined || value === "" || value === "0" || value === "null") {
    return "—";
  }
  return suffix ? `${value} ${suffix}` : value;
}

const ProductCard: React.FC<{
  part: ComparedPart;
  rows: CompareRow[];
  palette: Palette;
  categoryLabel: string;
  isFirst: boolean;
}> = ({ part, rows, palette, categoryLabel, isFirst }) => {
  if (part.error) {
    return (
      <Box flex="1" minW="160px" border="1px solid" borderColor={palette.error} borderRadius={`${palette.radiusMd}px`} p={4}>
        <Text fontSize="xs" color={palette.error}>
          {part.error}
        </Text>
      </Box>
    );
  }

  const headerBg = isFirst ? palette.accent : palette.subtleBg;
  const headerFg = isFirst ? palette.accentFg : palette.text;

  return (
    <Box
      flex="1"
      minW="160px"
      border="1.5px solid"
      borderColor={isFirst ? palette.accent : palette.border}
      borderRadius={`${palette.radiusMd}px`}
      overflow="hidden"
      fontSize="xs"
    >
      <Box bg={headerBg} px={3} py={2}>
        {part.url ? (
          <a href={part.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <Text fontWeight="700" fontSize="xs" color={headerFg} wordBreak="break-all" _hover={{ textDecoration: "underline" }}>
              {part.part_number}
            </Text>
          </a>
        ) : (
          <Text fontWeight="700" fontSize="xs" color={headerFg} wordBreak="break-all">
            {part.part_number}
          </Text>
        )}
        <Flex align="center" gap={1} mt={0.5} flexWrap="wrap">
          {categoryLabel && (
            <Badge
              fontSize="9px"
              px={1.5}
              py={0}
              borderRadius="4px"
              bg={isFirst ? "rgba(255,255,255,0.25)" : palette.border}
              color={isFirst ? palette.accentFg : palette.muted}
              textTransform="uppercase"
              letterSpacing="0.5px"
            >
              {categoryLabel}
            </Badge>
          )}
          {part.family && (
            <Text fontSize="10px" color={isFirst ? palette.accentFg : palette.muted} opacity={isFirst ? 0.85 : 1} noOfLines={1}>
              {part.family}
            </Text>
          )}
          {part.type && (
            <Text fontSize="10px" color={isFirst ? palette.accentFg : palette.faint} opacity={isFirst ? 0.7 : 1} noOfLines={1}>
              {part.type}
            </Text>
          )}
        </Flex>
      </Box>

      <Box>
        {rows.map(({ label, key, suffix }, i) => (
          <Flex
            key={key}
            px={3}
            py={1.5}
            align="center"
            justify="space-between"
            gap={2}
            bg={i % 2 === 0 ? palette.cardBg : palette.subtleBg}
            borderTop={`1px solid ${palette.border}`}
          >
            <Text color={palette.faint} whiteSpace="nowrap" flexShrink={0}>
              {label}
            </Text>
            <Text fontWeight="500" color={palette.text} textAlign="right">
              {formatValue(part.specs?.[key], suffix)}
            </Text>
          </Flex>
        ))}
      </Box>

      {part.url && (
        <Box px={3} py={2} borderTop={`1px solid ${palette.border}`} bg={palette.cardBg}>
          <a href={part.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <Text fontSize="10px" color={palette.accent} fontWeight="600" _hover={{ textDecoration: "underline" }}>
              View product details →
            </Text>
          </a>
        </Box>
      )}
    </Box>
  );
};
