"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { Box, Container, Flex, Grid, Heading, Text, Button } from "@radix-ui/themes";
import { PollCard } from "@/components/PollCard";
import Link from "next/link";
import type { PollCardProps as Poll } from "@/components/PollCard";

export default function Home() {
  const [trendingPolls, setTrendingPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrendingPolls() {
      try {
        const pollsQuery = query(
          collection(db, "polls"),
          orderBy("createdAt", "desc"),
          limit(3)
        );

        const querySnapshot = await getDocs(pollsQuery);
        const fetchedPolls = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            options: data.options,
            createdAt: data.createdAt?.toDate() || new Date(),
            votingFormat: data.votingFormat,
            rankedVotes: data.rankedVotes,
            pluralityVotes: data.pluralityVotes,
            pairwiseStats: data.pairwiseStats,
            singleVoteUsers: data.singleVoteUsers || [],
          };
        });

        setTrendingPolls(fetchedPolls);
      } catch (err) {
        console.error("Error fetching trending polls:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTrendingPolls();
  }, []);

  return (
    <Container>
      <Box className="py-16">
        {/* Hero Section */}
        <Flex direction="column" align="center" gap="4" className="text-center mb-16">
          <Heading size="9">Make Better Decisions Together</Heading>
          <Text size="5" color="gray">
            Create polls with multiple voting formats and get instant results
          </Text>
          <Flex gap="4" mt="6">
            <Button asChild size="4">
              <Link href="/create-poll">Create a Poll</Link>
            </Button>
            <Button asChild size="4" variant="soft">
              <Link href="/polls">Browse All Polls</Link>
            </Button>
          </Flex>
        </Flex>

        {/* Trending Polls Section */}
        <Box className="mt-16">
          <Heading size="6" mb="6">
            Trending Polls
          </Heading>
          {loading ? (
            <Text>Loading trending polls...</Text>
          ) : (
            <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="4">
              {trendingPolls.map((poll) => (
                <PollCard key={poll.id} {...poll} />
              ))}
            </Grid>
          )}
        </Box>
      </Box>
    </Container>
  );
}
