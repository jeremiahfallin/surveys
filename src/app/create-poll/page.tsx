"use client";
import { CreatePollForm } from "@/components/CreatePollForm";
import { Box, Heading } from "@radix-ui/themes";

export default function CreatePollPage() {
  return (
    <Box>
      <Heading as="h1">Create a New Poll</Heading>
      <CreatePollForm />
    </Box>
  );
}
