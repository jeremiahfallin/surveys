"use client";
import { Box, Flex, Text, Select } from "@radix-ui/themes";
import { Poll } from "@/types/poll";
import { useState } from "react";
import { calculateIRVResults } from "@/utils/voting";

interface PollResultsProps {
  poll: Poll;
}

export function PollResults({ poll }: PollResultsProps) {
  const [winnersCount, setWinnersCount] = useState(1);

  const renderProgressBar = (percentage: number) => (
    <Box
      style={{
        width: "100%",
        height: "8px",
        backgroundColor: "var(--gray-4)",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          width: `${percentage}%`,
          height: "100%",
          backgroundColor: "var(--accent-9)",
          transition: "width 0.3s ease",
        }}
      />
    </Box>
  );

  switch (poll.votingFormat) {
    case "single": {
      const totalVotes = poll.options.reduce(
        (sum, option) => sum + (option.votes || 0),
        0
      );

      return (
        <Flex direction="column" gap="3">
          {poll.options.map((option) => {
            const votes = option.votes || 0;
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            return (
              <Box key={option.id}>
                <Flex justify="between" mb="2">
                  <Text>{option.text}</Text>
                  <Text>
                    {votes} vote{votes !== 1 ? "s" : ""} (
                    {Math.round(percentage)}%)
                  </Text>
                </Flex>
                {renderProgressBar(percentage)}
              </Box>
            );
          })}
        </Flex>
      );
    }

    case "ranked": {
      if (!poll.rankedVotes?.length) return <Text>No votes yet</Text>;

      const totalVotes = poll.rankedVotes.length;
      const winners = calculateIRVResults(
        poll.rankedVotes,
        poll.options,
        winnersCount
      );
      if (!winners.length) return <Text>No results available</Text>;

      return (
        <Box>
          <Flex justify="between" align="center" mb="4">
            <Text>Show top:</Text>
            <Select.Root
              value={winnersCount.toString()}
              onValueChange={(value) => setWinnersCount(parseInt(value))}
            >
              <Select.Trigger />
              <Select.Content>
                {Array.from(
                  { length: Math.min(poll.options.length, 5) },
                  (_, i) => (
                    <Select.Item key={i + 1} value={(i + 1).toString()}>
                      {i + 1}
                    </Select.Item>
                  )
                )}
              </Select.Content>
            </Select.Root>
          </Flex>

          <Flex direction="column" gap="3">
            {winners.map((winner, position) => {
              const option = poll.options[winner.index];
              const percentage = (winner.votes / totalVotes) * 100;

              return (
                <Box key={winner.index}>
                  <Flex justify="between" mb="2">
                    <Text>
                      #{position + 1}: {option.text}
                    </Text>
                    <Text>
                      Won in round {winner.round} with {winner.votes} vote
                      {winner.votes !== 1 ? "s" : ""} ({Math.round(percentage)}
                      %)
                    </Text>
                  </Flex>
                  {renderProgressBar(percentage)}
                </Box>
              );
            })}
          </Flex>
        </Box>
      );
    }

    case "plurality": {
      if (!poll.pluralityVotes?.length) return <Text>No votes yet</Text>;

      const voteCounts = poll.options.map((option) => ({
        text: option.text,
        count: poll.pluralityVotes!.filter((vote) =>
          vote.selections.includes(poll.options.indexOf(option))
        ).length,
      }));

      const maxCount = Math.max(...voteCounts.map((v) => v.count));

      return (
        <Flex direction="column" gap="3">
          {voteCounts.map((option, index) => {
            const percentage =
              maxCount > 0 ? (option.count / maxCount) * 100 : 0;
            return (
              <Box key={index}>
                <Flex justify="between" mb="2">
                  <Text>{option.text}</Text>
                  <Text>
                    {option.count} selection{option.count !== 1 ? "s" : ""}
                  </Text>
                </Flex>
                {renderProgressBar(percentage)}
              </Box>
            );
          })}
        </Flex>
      );
    }

    case "pairwise": {
      if (!poll.pairwiseStats?.global?.participants)
        return <Text>No comparisons yet</Text>;

      const ratings = Object.entries(poll.pairwiseStats.global.participants)
        .map(([id, stats]) => ({
          text: poll.options[Number(id)]?.text,
          rating: stats.mu,
          imageUrl: poll.options[Number(id)]?.imageUrl,
          comparisons: stats.comparisons,
          wins: stats.wins,
          losses: stats.comparisons - stats.wins,
        }))
        .filter((option) => option.text)
        .sort((a, b) => b.rating - a.rating);

      const maxRating = Math.max(...ratings.map((r) => r.rating));
      const minRating = Math.min(...ratings.map((r) => r.rating));
      const range = maxRating - minRating;

      const totalComparisons =
        ratings.reduce((sum, r) => sum + r.comparisons, 0) / 2;

      return (
        <Flex direction="column" gap="3">
          <Text>Total comparisons: {totalComparisons}</Text>
          {ratings.map((option, index) => {
            const percentage =
              range > 0 ? ((option.rating - minRating) / range) * 100 : 50;
            const winRate =
              option.comparisons > 0
                ? Math.round((option.wins / option.comparisons) * 100)
                : 0;

            return (
              <Box key={index}>
                <Flex justify="between" mb="2">
                  <Text>{option.text}</Text>
                  <Flex gap="3">
                    <Text>Rating: {option.rating.toFixed(2)}</Text>
                    <Text>
                      • W/L: {option.wins}/{option.losses} ({winRate}%)
                    </Text>
                    <Text>• {option.comparisons} total</Text>
                  </Flex>
                </Flex>
                {renderProgressBar(percentage)}
              </Box>
            );
          })}
        </Flex>
      );
    }
  }
}
