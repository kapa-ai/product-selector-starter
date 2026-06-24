import { useState } from "react";
import { Box, Flex, Text, Button } from "@chakra-ui/react";
import { useAgentChat } from "@kapaai/agent-react";
import type { GuidedQuestion } from "../../config/types";
import type { Palette } from "../palette";

// Guided-path UI: renders the configured questions as clickable radio options.
// Submitting sends the answers back into the conversation as a user message,
// which the agent uses to drive the next search_products call.
export const QuestionForm: React.FC<{ questions: GuidedQuestion[]; palette: Palette }> = ({
  questions,
  palette,
}) => {
  const accent = palette.accent;
  const { sendMessage, isStreaming } = useAgentChat();
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const isSingle = questions.length === 1;
  const allAnswered = questions.every((q) => selections[q.rank] !== undefined);

  const doSubmit = async (finalSelections: Record<number, string>) => {
    if (submitted) return;
    setSubmitted(true);
    const lines = questions.map((q) => `Q${q.rank}: ${finalSelections[q.rank]}`);
    await sendMessage(`My answers:\n${lines.join("\n")}`);
  };

  const handleOptionClick = (rank: number, opt: string) => {
    if (submitted) return;
    const next = { ...selections, [rank]: opt };
    setSelections(next);
    if (isSingle) doSubmit(next);
  };

  return (
    <Flex direction="column" gap={3} mt={1} fontFamily={palette.fontFamily}>
      {questions.map((q) => (
        <Box key={q.rank}>
          {!isSingle && (
            <Text fontSize="12px" fontWeight="600" mb={1.5} color={palette.text}>
              {q.rank}. {q.question}
            </Text>
          )}
          <Flex flexWrap="wrap" gap={1.5}>
            {q.answer_space.map((opt) => {
              const selected = selections[q.rank] === opt;
              return (
                <Box
                  key={opt}
                  as="button"
                  onClick={() => handleOptionClick(q.rank, opt)}
                  px="10px"
                  py="4px"
                  fontSize="12px"
                  fontWeight="500"
                  fontFamily="inherit"
                  lineHeight="1.4"
                  borderRadius="8px"
                  border="1px solid"
                  borderColor={selected ? accent : palette.border}
                  bg={selected ? `${accent}14` : "transparent"}
                  color={selected ? accent : palette.text}
                  cursor={submitted ? "default" : "pointer"}
                  transition="border-color 0.1s"
                  _hover={!submitted ? { borderColor: selected ? accent : palette.muted } : {}}
                >
                  {opt}
                </Box>
              );
            })}
          </Flex>
        </Box>
      ))}
      {!isSingle && (
        <Box>
          <Button
            size="sm"
            onClick={() => {
              if (allAnswered && !isStreaming && !submitted) doSubmit(selections);
            }}
            isDisabled={!allAnswered || isStreaming || submitted}
            bg={accent}
            color={palette.accentFg}
            borderRadius="4px"
            px={4}
            fontSize="13px"
            fontWeight="500"
            _hover={{ opacity: 0.85 }}
            _disabled={{ opacity: 0.35, cursor: "not-allowed" }}
          >
            {submitted ? "Submitted" : "Submit answers"}
          </Button>
        </Box>
      )}
    </Flex>
  );
};
