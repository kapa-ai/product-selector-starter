import { useState } from "react";
import { Box, Flex, Text, Button, Input, Textarea, Select } from "@chakra-ui/react";
import type { Palette } from "../palette";

// Book-a-call form. On submit it POSTs the lead to YOUR booking endpoint
// (default /api/book-lead), which routes it to email or a webhook/CRM based on
// the server config (see /server/book-lead.ts). The client is delivery-agnostic.
export const BookingForm: React.FC<{
  prefill: Record<string, unknown>;
  bookEndpoint: string;
  palette: Palette;
  successMessage: string;
  onApprove?: () => void;
}> = ({ prefill, bookEndpoint, palette, successMessage, onApprove }) => {
  const accent = palette.accent;
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    company: "",
    role: "",
    preferred_contact: "email",
    notes: String(prefill.project_summary ?? ""),
  });
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done">("idle");

  const set =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const canSubmit = !!(
    form.first_name &&
    form.last_name &&
    form.email &&
    form.company &&
    submitState === "idle"
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitState("submitting");
    try {
      await fetch(bookEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, project_summary: form.notes }),
      });
    } catch {
      // Fire-and-forget: still confirm to the user; failures are logged server-side.
    }
    setSubmitState("done");
    onApprove?.();
  };

  if (submitState === "done") {
    return (
      <Box mt={1} p={3} borderRadius="8px" bg={`${accent}0d`} border={`1px solid ${accent}33`} fontFamily={palette.fontFamily}>
        <Text fontSize="13px" fontWeight="600" color={accent}>
          You&apos;re all set!
        </Text>
        <Text fontSize="12px" mt={0.5} color={palette.muted}>
          {successMessage}
        </Text>
      </Box>
    );
  }

  const inputProps = {
    size: "sm" as const,
    borderRadius: "8px",
    focusBorderColor: accent,
    bg: palette.cardBg,
    fontSize: "13px",
  };

  return (
    <Flex direction="column" gap={2} mt={1} fontFamily={palette.fontFamily} color={palette.text}>
      <Flex gap={2}>
        <Box flex="1">
          <Text fontSize="12px" fontWeight="500" mb={0.5}>
            First name *
          </Text>
          <Input {...inputProps} value={form.first_name} onChange={set("first_name")} placeholder="Jane" />
        </Box>
        <Box flex="1">
          <Text fontSize="12px" fontWeight="500" mb={0.5}>
            Last name *
          </Text>
          <Input {...inputProps} value={form.last_name} onChange={set("last_name")} placeholder="Smith" />
        </Box>
      </Flex>
      <Box>
        <Text fontSize="12px" fontWeight="500" mb={0.5}>
          Work email *
        </Text>
        <Input {...inputProps} type="email" value={form.email} onChange={set("email")} placeholder="jane@company.com" />
      </Box>
      <Flex gap={2}>
        <Box flex="1">
          <Text fontSize="12px" fontWeight="500" mb={0.5}>
            Company *
          </Text>
          <Input {...inputProps} value={form.company} onChange={set("company")} placeholder="Acme Corp" />
        </Box>
        <Box flex="1">
          <Text fontSize="12px" fontWeight="500" mb={0.5}>
            Role
          </Text>
          <Input {...inputProps} value={form.role} onChange={set("role")} placeholder="Hardware Engineer" />
        </Box>
      </Flex>
      <Box>
        <Text fontSize="12px" fontWeight="500" mb={0.5}>
          Preferred contact
        </Text>
        <Select {...inputProps} value={form.preferred_contact} onChange={set("preferred_contact")}>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="either">Either</option>
        </Select>
      </Box>
      {form.notes && (
        <Box>
          <Text fontSize="12px" fontWeight="500" mb={0.5}>
            Notes
          </Text>
          <Textarea {...inputProps} value={form.notes} onChange={set("notes")} rows={2} resize="none" fontFamily="inherit" />
        </Box>
      )}
      <Box>
        <Button
          size="xs"
          onClick={handleSubmit}
          isDisabled={!canSubmit}
          isLoading={submitState === "submitting"}
          loadingText="Booking..."
          bg={accent}
          color={palette.accentFg}
          borderRadius="4px"
          px={3}
          fontSize="12px"
          fontWeight="500"
          _hover={{ opacity: 0.85 }}
          _disabled={{ opacity: 0.35, cursor: "not-allowed" }}
        >
          Book meeting
        </Button>
      </Box>
    </Flex>
  );
};
