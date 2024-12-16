"use client";
import { useState, useEffect } from "react";
import { use } from "react";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  increment,
  Timestamp,
} from "firebase/firestore";
import { Box, Flex, Heading, Text, Tabs } from "@radix-ui/themes";
import { formatDistanceToNow } from "date-fns";
import { VotingInterface } from "@/components/VotingInterface";
import { PollResults } from "@/components/PollResults";
import { Poll } from "@/types/poll";
import { getNextPairwiseComparison } from "@/utils/voting";
import { submitPairwiseVote } from "@/utils/db";

function getAnonymousUserId(): string {
  const storageKey = "anonymous_user_id";
  let anonymousId = localStorage.getItem(storageKey);
  if (!anonymousId) {
    anonymousId = "anon_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(storageKey, anonymousId);
  }
  return anonymousId;
}

export default function PollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOption, setSelectedOption] = useState(-1);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [rankings, setRankings] = useState<number[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [currentComparison, setCurrentComparison] = useState<
    [number, number] | null
  >(null);
  const { user } = useAuth();
  console.log(user);

  useEffect(() => {
    async function fetchPoll() {
      try {
        const pollDoc = await getDoc(doc(db, "polls", resolvedParams.id));
        if (!pollDoc.exists()) {
          setError("Poll not found");
          return;
        }

        const data = pollDoc.data();
        const pollData = {
          id: pollDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Poll;
        setPoll({
          ...pollData,
        } as Poll);

        if (data.votingFormat === "ranked") {
          setRankings(new Array(data.options.length).fill(-1));
        } else if (data.votingFormat === "pairwise") {
          const history = pollData.pairwiseVotes || [];
          const scores = pollData.pairwiseStats?.global.participants
            ? Object.values(pollData.pairwiseStats.global.participants).map(
                (stat) => {
                  return stat.mu;
                }
              )
            : Array(pollData.options.length).fill(0);
          const effectiveUserId = user?.uid || getAnonymousUserId();
          const nextPair = getNextPairwiseComparison(
            pollData.options.length,
            effectiveUserId,
            history,
            scores
          );
          setCurrentComparison(nextPair);
        }
      } catch (err) {
        console.error("Error fetching poll:", err);
        setError("Failed to load poll");
      } finally {
        setLoading(false);
      }
    }

    fetchPoll();
  }, [resolvedParams.id]);

  const handleVote = async () => {
    if (!poll) return;

    const effectiveUserId = user?.uid || getAnonymousUserId();

    setIsVoting(true);
    try {
      const pollRef = doc(db, "polls", resolvedParams.id);

      switch (poll.votingFormat) {
        case "ranked": {
          if (rankings.some((r) => r === -1)) {
            alert("Please rank all options");
            return;
          }
          const rankingsMap: Record<string, number> = {};
          poll.options.forEach((option, index) => {
            rankingsMap[option.text] = rankings[index];
          });

          await updateDoc(pollRef, {
            rankedVotes: arrayUnion({
              userId: effectiveUserId,
              rankings: rankingsMap,
              timestamp: Timestamp.now(),
            }),
          });
          break;
        }

        case "single":
          if (selectedOption === -1) {
            alert("Please select an option");
            return;
          }
          await updateDoc(pollRef, {
            [`options.${selectedOption}.votes`]: increment(1),
            singleVoteUsers: arrayUnion(effectiveUserId),
          });
          break;

        case "plurality":
          if (selectedOptions.length === 0) {
            alert("Please select at least one option");
            return;
          }
          await updateDoc(pollRef, {
            pluralityVotes: arrayUnion({
              userId: effectiveUserId,
              selections: selectedOptions,
              timestamp: Timestamp.now(),
            }),
          });
          break;

        case "pairwise":
          if (!currentComparison) {
            alert("No comparison available");
            return;
          }
          const [optionA, optionB] = currentComparison;
          const winner = selectedOption;
          const loser = selectedOption === optionA ? optionB : optionA;

          const { stats, nextComparison } = await submitPairwiseVote(
            resolvedParams.id,
            winner,
            loser,
            effectiveUserId
          );

          setPoll({
            ...poll,
            pairwiseStats: stats,
          });
          setCurrentComparison(nextComparison);
          break;
      }

      // Refresh poll data
      const updatedDoc = await getDoc(pollRef);
      const updatedData = updatedDoc.data();
      setPoll({
        id: updatedDoc.id,
        ...updatedData,
        createdAt: updatedData?.createdAt?.toDate() || new Date(),
      } as Poll);

      // Reset selection states
      setSelectedOption(-1);
      setSelectedOptions([]);
      setRankings(new Array(poll.options.length).fill(-1));
    } catch (err) {
      console.error("Error voting:", err);
      alert("Failed to submit vote. Please try again.");
    } finally {
      setIsVoting(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <Text>Loading poll...</Text>
      </Box>
    );
  }

  if (error || !poll) {
    return (
      <Box>
        <Text color="red">{error || "Poll not found"}</Text>
      </Box>
    );
  }

  const hasVoted = Boolean(
    (user?.uid || getAnonymousUserId()) &&
      (poll.votingFormat === "single"
        ? poll.singleVoteUsers?.includes(user?.uid || getAnonymousUserId())
        : false)
  );

  return (
    <Flex justify="center" p="2">
      <Flex maxWidth={"600px"}>
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="2">
            <Heading size="8" mb="2">
              {poll.title}
            </Heading>
            <Text color="gray" size="2">
              Created {formatDistanceToNow(poll.createdAt)} ago
            </Text>
            <Text color="gray" size="2">
              Voting format: {poll.votingFormat}
            </Text>
          </Flex>

          <Text>{poll.description}</Text>

          <Tabs.Root defaultValue="vote">
            <Tabs.List>
              <Tabs.Trigger value="vote">Vote</Tabs.Trigger>
              <Tabs.Trigger value="results">Results</Tabs.Trigger>
            </Tabs.List>

            <Box mt="4">
              <Tabs.Content value="vote">
                <VotingInterface
                  poll={poll}
                  selectedOption={selectedOption}
                  setSelectedOption={setSelectedOption}
                  selectedOptions={selectedOptions}
                  setSelectedOptions={setSelectedOptions}
                  rankings={rankings}
                  setRankings={setRankings}
                  currentComparison={currentComparison}
                  hasVoted={hasVoted}
                  onVote={handleVote}
                  isVoting={isVoting}
                />
              </Tabs.Content>

              <Tabs.Content value="results">
                <PollResults poll={poll} />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Flex>
      </Flex>
    </Flex>
  );
}
