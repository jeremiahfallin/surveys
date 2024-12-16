import { Box, Container, Heading, Text, Button, Flex } from "@radix-ui/themes";
import Link from "next/link";

export default function Home() {
  return (
    <Container size="3">
      <Box className="py-20">
        <Flex direction="column" align="center" gap="6">
          <Heading size="9" align="center">
            Welcome to Voting App
          </Heading>

          <Text size="5" align="center" color="gray">
            Create and participate in polls with multiple voting formats: single
            choice, ranked choice, plurality, and pairwise comparisons.
          </Text>

          <Flex gap="4">
            <Button size="3" asChild>
              <Link href="/polls">View Polls</Link>
            </Button>
            <Button size="3" variant="soft" asChild>
              <Link href="/create-poll">Create Poll</Link>
            </Button>
          </Flex>

          <Box style={{ maxWidth: "600px" }} mt="8">
            <Flex direction="column" gap="4">
              <Feature
                title="Multiple Voting Formats"
                description="Choose from single vote, ranked choice, plurality, or pairwise comparison formats"
              />
              <Feature
                title="Real-time Results"
                description="Watch results update instantly as votes come in"
              />
              <Feature
                title="Image Support"
                description="Add images to poll options for better visualization"
              />
            </Flex>
          </Box>
        </Flex>
      </Box>
    </Container>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Box>
      <Heading size="4" mb="1">
        {title}
      </Heading>
      <Text color="gray" size="3">
        {description}
      </Text>
    </Box>
  );
}
