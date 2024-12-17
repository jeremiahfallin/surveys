"use client";
import {
  Card,
  Heading,
  Text,
  Box,
  Flex,
  Button,
  Progress,
} from "@radix-ui/themes";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { VotingFormat } from "@/components/CreatePollForm";
import { Timestamp } from "firebase/firestore";

interface BaseStats {
  wins: number;
  comparisons: number;
  timestamp: Timestamp;
}

interface EloStats extends BaseStats {
  rating: number;
  kFactor: number;
}

interface BradleyTerryStats extends BaseStats {
  mu: number;
  sigma: number;
  beta: number;
  gamma: number;
}

interface TrueSkillStats extends BaseStats {
  mu: number;
  sigma: number;
  beta: number;
  tau: number;
  drawProbability: number;
}

type RatingStats = EloStats | BradleyTerryStats | TrueSkillStats;

interface PairwiseStats {
  system: string;
  global: {
    participants: Record<string, RatingStats>;
    annotators: Record<string, RatingStats>;
  };
}

interface PollOption {
  text: string;
  votes: number;
  imageUrl?: string;
}

interface RankedVote {
  userId: string;
  rankings: number[];
  timestamp: Timestamp;
}

interface PluralityVote {
  userId: string;
  selections: number[];
  timestamp: Timestamp;
}

export interface PollCardProps {
  id: string;
  title: string;
  description: string;
  options: PollOption[];
  createdAt: Date;
  votingFormat: VotingFormat;
  rankedVotes?: RankedVote[];
  pluralityVotes?: PluralityVote[];
  pairwiseStats?: PairwiseStats;
  singleVoteUsers?: string[];
}

interface OptionDisplayProps {
  option: PollOption;
  value: number;
  maxValue: number;
}

function getRating(stats: RatingStats): number {
  if ("rating" in stats) {
    return stats.rating;
  }
  return stats.mu;
}

function OptionDisplay({ option, value, maxValue }: OptionDisplayProps) {
  return (
    <Box>
      <Flex justify="between" align="center" gap="2">
        <Flex gap="2" align="center" style={{ flex: 1 }}>
          {option.imageUrl && (
            <img
              src={option.imageUrl}
              alt={option.text}
              style={{
                width: "40px",
                height: "40px",
                objectFit: "cover",
                borderRadius: "4px",
              }}
            />
          )}
          <Text size="2" style={{ flex: 1 }}>
            {option.text}
          </Text>
        </Flex>
        <Text size="2">{value}</Text>
      </Flex>
      <Progress value={value} max={maxValue} />
    </Box>
  );
}

export function PollCard({
  id,
  title,
  description,
  options,
  createdAt,
  votingFormat,
  rankedVotes = [],
  pluralityVotes = [],
  pairwiseStats,
  singleVoteUsers = [],
}: PollCardProps) {
  const renderResults = () => {
    switch (votingFormat) {
      case "single": {
        const totalVotes = options.reduce(
          (sum, option) => sum + (option.votes || 0),
          0
        );
        const topOptions = [...options]
          .sort((a, b) => (b.votes || 0) - (a.votes || 0))
          .slice(0, 2);

        return (
          <Box>
            <Text size="2">
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""} •{" "}
              {singleVoteUsers.length} participant
              {singleVoteUsers.length !== 1 ? "s" : ""}
            </Text>
            {topOptions.map((option, i) => (
              <Box key={i} mt="2">
                <OptionDisplay
                  option={option}
                  value={option.votes || 0}
                  maxValue={totalVotes}
                />
              </Box>
            ))}
          </Box>
        );
      }

      case "ranked": {
        if (rankedVotes.length === 0) return <Text size="2">No votes yet</Text>;

        const scores = options
          .map((option, index) => {
            let score = 0;
            rankedVotes.forEach((vote) => {
              score += options.length - vote.rankings[index];
            });
            return { text: option.text, score };
          })
          .sort((a, b) => b.score - a.score);

        const maxScore = scores[0].score;

        return (
          <Box>
            <Text size="2">{rankedVotes.length} rankings submitted</Text>
            {scores.slice(0, 2).map((option, i) => (
              <Box key={i}>
                <Flex justify="between">
                  <Text size="2">{option.text}</Text>
                  <Text size="2">{option.score} points</Text>
                </Flex>
                <Progress value={option.score} max={maxScore} />
              </Box>
            ))}
          </Box>
        );
      }

      case "plurality": {
        if (pluralityVotes.length === 0)
          return <Text size="2">No votes yet</Text>;

        const voteCounts = options
          .map((option, index) => ({
            text: option.text,
            count: pluralityVotes.filter((vote) =>
              vote.selections.includes(index)
            ).length,
          }))
          .sort((a, b) => b.count - a.count);

        const maxCount = voteCounts[0].count;

        return (
          <Box>
            <Text size="2">
              {pluralityVotes.length} votes from{" "}
              {new Set(pluralityVotes.map((v) => v.userId)).size} participants
            </Text>
            {voteCounts.slice(0, 2).map((option, i) => (
              <Box key={i}>
                <Flex justify="between">
                  <Text size="2">{option.text}</Text>
                  <Text size="2">
                    {option.count} selection{option.count !== 1 ? "s" : ""}
                  </Text>
                </Flex>
                <Progress value={option.count} max={maxCount} />
              </Box>
            ))}
          </Box>
        );
      }

      case "pairwise": {
        if (!pairwiseStats) return null;

        const ratings = Object.entries(pairwiseStats.global.participants)
          .map(([index, stats]) => {
            return {
              text: options[parseInt(index.replace("option-", ""))]?.text,
              rating: getRating(stats),
              comparisons: stats.comparisons,
            };
          })
          .sort((a, b) => b.rating - a.rating);

        const totalComparisons =
          ratings.reduce((sum, r) => sum + r.comparisons, 0) / 2;
        const maxRating = Math.max(...ratings.map((r) => r.rating));
        const minRating = Math.min(...ratings.map((r) => r.rating));
        const ratingRange = maxRating - minRating;

        return (
          <Box>
            <Text size="2">{totalComparisons} comparisons made</Text>
            {ratings.slice(0, 2).map((option, i) => (
              <Box key={i}>
                <Flex justify="between">
                  <Text size="2">{option.text}</Text>
                  <Text size="2">Rating: {option.rating.toFixed(2)}</Text>
                </Flex>
                <Progress
                  value={(option.rating - minRating) / ratingRange}
                  max={1}
                />
              </Box>
            ))}
          </Box>
        );
      }
    }
  };

  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Box>
          <Heading size="4" mb="1">
            {title}
          </Heading>
          <Text color="gray" size="2">
            Created {formatDistanceToNow(createdAt)} ago • {votingFormat} format
          </Text>
        </Box>

        <Text>{description}</Text>

        {renderResults()}

        <Button asChild>
          <Link href={`/polls/${id}`}>View Poll</Link>
        </Button>
      </Flex>
    </Card>
  );
}
