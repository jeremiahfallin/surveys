"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  DocumentData,
} from "firebase/firestore";
import { PollCard } from "@/components/PollCard";
import { Box, Grid, Heading, Text } from "@radix-ui/themes";
import type { PollCardProps as Poll } from "@/components/PollCard";

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPolls() {
      try {
        const pollsQuery = query(
          collection(db, "polls"),
          orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(pollsQuery);
        const fetchedPolls = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          const poll = {
            id: doc.id,
            title: data.title,
            description: data.description,
            options: data.options,
            createdAt: data.createdAt?.toDate() || new Date(),
            votingFormat: data.votingFormat,
            rankedVotes: data.rankedVotes?.map((vote: DocumentData) => ({
              ...vote,
              timestamp: vote.timestamp?.toDate() || new Date(),
            })),
            pluralityVotes: data.pluralityVotes?.map((vote: DocumentData) => ({
              ...vote,
              timestamp: vote.timestamp?.toDate() || new Date(),
            })),
            pairwiseStats: data.pairwiseStats,
            singleVoteUsers: data.singleVoteUsers || [],
          };

          return poll;
        });

        setPolls(fetchedPolls);
      } catch (err) {
        console.error("Error fetching polls:", err);
        setError("Failed to load polls. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchPolls();
  }, []);

  if (loading) {
    return (
      <Box>
        <Text>Loading polls...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box p="2">
      <Heading size="8" mb="6">
        Active Polls
      </Heading>

      {polls.length === 0 ? (
        <Text>No polls available. Be the first to create one!</Text>
      ) : (
        <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="4">
          {polls.map((poll) => (
            <PollCard key={poll.id} {...poll} />
          ))}
        </Grid>
      )}
    </Box>
  );
}
