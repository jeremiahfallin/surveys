"use client";
import { useEffect, useState, use } from "react";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  increment,
  collection,
  Timestamp,
} from "firebase/firestore";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  Select,
  Radio,
  Checkbox,
} from "@radix-ui/themes";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { VotingFormat } from "@/components/CreatePollForm";

interface FirestoreVote {
  userId: string;
  timestamp: Timestamp;
}

interface FirestoreRankedVote extends FirestoreVote {
  rankings: number[];
}

interface FirestorePluralityVote extends FirestoreVote {
  selections: number[];
}

interface FirestorePairwiseVote extends FirestoreVote {
  winner: number;
  loser: number;
}

interface Vote {
  userId: string;
  timestamp: Date;
}

interface RankedVote extends Vote {
  rankings: number[];
}

interface PluralityVote extends Vote {
  selections: number[];
}

interface PairwiseVote extends Vote {
  winner: number;
  loser: number;
}

interface PollOption {
  text: string;
  votes: number | Record<string, number>;
}

type RatingSystem = "elo" | "bradley-terry" | "trueskill";

interface BaseStats {
  wins: number;
  comparisons: number;
  timestamp: Date;
}

interface EloStats extends BaseStats {
  rating: number;
  kFactor: number;
}

interface BradleyTerryStats extends BaseStats {
  mu: number; // Mean skill rating
  sigma: number; // Uncertainty
  beta: number; // Smoothing parameter
  gamma: number; // Learning rate
}

interface TrueSkillStats extends BaseStats {
  mu: number; // Mean skill
  sigma: number; // Standard deviation
  beta: number; // Skill class width
  tau: number; // Dynamics factor
  draw_prob: number; // Draw probability
}

type PairwiseStats = {
  system: RatingSystem;
  stats: Record<number, EloStats | BradleyTerryStats | TrueSkillStats>;
};

interface Poll {
  id: string;
  title: string;
  description: string;
  options: PollOption[];
  createdAt: Date;
  createdBy: string;
  votingFormat: VotingFormat;
  singleVoteUsers?: string[];
  rankedVotes?: RankedVote[];
  pluralityVotes?: PluralityVote[];
  pairwiseVotes?: PairwiseVote[];
  pairwiseStats?: PairwiseStats;
  ratingSystem?: RatingSystem;
}

// Rating system configurations
const RATING_CONFIGS = {
  elo: {
    initialRating: 1500,
    kFactor: 32,
  },
  "bradley-terry": {
    initialMu: 0,
    initialSigma: 1.0,
    beta: 0.5,
    gamma: 0.1,
  },
  trueskill: {
    initialMu: 25,
    initialSigma: 8.333,
    beta: 4.166,
    tau: 0.0833,
    drawProbability: 0.1,
  },
};

function initializeStats(
  system: RatingSystem,
  optionCount: number
): PairwiseStats {
  const stats: Record<number, EloStats | BradleyTerryStats | TrueSkillStats> =
    {};

  for (let i = 0; i < optionCount; i++) {
    switch (system) {
      case "elo":
        stats[i] = {
          rating: RATING_CONFIGS.elo.initialRating,
          kFactor: RATING_CONFIGS.elo.kFactor,
          wins: 0,
          comparisons: 0,
          timestamp: new Date(),
        };
        break;

      case "bradley-terry":
        stats[i] = {
          mu: RATING_CONFIGS["bradley-terry"].initialMu,
          sigma: RATING_CONFIGS["bradley-terry"].initialSigma,
          beta: RATING_CONFIGS["bradley-terry"].beta,
          gamma: RATING_CONFIGS["bradley-terry"].gamma,
          wins: 0,
          comparisons: 0,
          timestamp: new Date(),
        };
        break;

      case "trueskill":
        stats[i] = {
          mu: RATING_CONFIGS.trueskill.initialMu,
          sigma: RATING_CONFIGS.trueskill.initialSigma,
          beta: RATING_CONFIGS.trueskill.beta,
          tau: RATING_CONFIGS.trueskill.tau,
          draw_prob: RATING_CONFIGS.trueskill.drawProbability,
          wins: 0,
          comparisons: 0,
          timestamp: new Date(),
        };
        break;
    }
  }

  return {
    system,
    stats,
  };
}

function updateRatings(
  winner: number,
  loser: number,
  currentStats: PairwiseStats,
  isDraw: boolean = false
): PairwiseStats {
  const system = currentStats.system;
  const stats = { ...currentStats.stats };

  switch (system) {
    case "elo": {
      const winnerStats = stats[winner] as EloStats;
      const loserStats = stats[loser] as EloStats;

      const expectedWinner =
        1 / (1 + Math.pow(10, (loserStats.rating - winnerStats.rating) / 400));
      const expectedLoser = 1 - expectedWinner;

      const actualWinner = isDraw ? 0.5 : 1;
      const actualLoser = isDraw ? 0.5 : 0;

      stats[winner] = {
        ...winnerStats,
        rating:
          winnerStats.rating +
          winnerStats.kFactor * (actualWinner - expectedWinner),
        wins: winnerStats.wins + (isDraw ? 0.5 : 1),
        comparisons: winnerStats.comparisons + 1,
        timestamp: new Date(),
      };

      stats[loser] = {
        ...loserStats,
        rating:
          loserStats.rating +
          loserStats.kFactor * (actualLoser - expectedLoser),
        wins: loserStats.wins + (isDraw ? 0.5 : 0),
        comparisons: loserStats.comparisons + 1,
        timestamp: new Date(),
      };
      break;
    }

    case "bradley-terry": {
      const winnerStats = stats[winner] as BradleyTerryStats;
      const loserStats = stats[loser] as BradleyTerryStats;

      const p =
        1 / (1 + Math.exp((loserStats.mu - winnerStats.mu) / winnerStats.beta));
      const s = isDraw ? 0.5 : 1;

      const muDelta = winnerStats.gamma * (s - p);
      const sigmaSquaredDelta = winnerStats.gamma * p * (1 - p);

      stats[winner] = {
        ...winnerStats,
        mu: winnerStats.mu + muDelta,
        sigma: Math.sqrt(
          Math.max(0.01, winnerStats.sigma ** 2 - sigmaSquaredDelta)
        ),
        wins: winnerStats.wins + (isDraw ? 0.5 : 1),
        comparisons: winnerStats.comparisons + 1,
        timestamp: new Date(),
      };

      stats[loser] = {
        ...loserStats,
        mu: loserStats.mu - muDelta,
        sigma: Math.sqrt(
          Math.max(0.01, loserStats.sigma ** 2 - sigmaSquaredDelta)
        ),
        wins: loserStats.wins + (isDraw ? 0.5 : 0),
        comparisons: loserStats.comparisons + 1,
        timestamp: new Date(),
      };
      break;
    }

    case "trueskill": {
      const winnerStats = stats[winner] as TrueSkillStats;
      const loserStats = stats[loser] as TrueSkillStats;

      // TrueSkill update equations (simplified version)
      const c = Math.sqrt(
        2 * winnerStats.beta ** 2 +
          winnerStats.sigma ** 2 +
          loserStats.sigma ** 2
      );
      const t = (winnerStats.mu - loserStats.mu) / c;

      const v = isDraw
        ? Math.exp((-t * t) / 2) / Math.sqrt(2 * Math.PI) / 0.5
        : Math.exp((-t * t) / 2) / Math.sqrt(2 * Math.PI) / (1 - 0.5);

      const w = v * (v + t);

      const muUpdate = Math.sqrt(winnerStats.sigma ** 2 / c) * (isDraw ? 0 : v);
      const sigmaUpdate = (winnerStats.sigma ** 2 * w) / c ** 2;

      stats[winner] = {
        ...winnerStats,
        mu: winnerStats.mu + muUpdate,
        sigma: Math.sqrt(winnerStats.sigma ** 2 * (1 - sigmaUpdate)),
        wins: winnerStats.wins + (isDraw ? 0.5 : 1),
        comparisons: winnerStats.comparisons + 1,
        timestamp: new Date(),
      };

      stats[loser] = {
        ...loserStats,
        mu: loserStats.mu - muUpdate,
        sigma: Math.sqrt(loserStats.sigma ** 2 * (1 - sigmaUpdate)),
        wins: loserStats.wins + (isDraw ? 0.5 : 0),
        comparisons: loserStats.comparisons + 1,
        timestamp: new Date(),
      };
      break;
    }
  }

  return {
    system,
    stats,
  };
}

function getInformationGain(
  optionA: EloStats | BradleyTerryStats | TrueSkillStats,
  optionB: EloStats | BradleyTerryStats | TrueSkillStats,
  system: RatingSystem
): number {
  switch (system) {
    case "elo": {
      const statsA = optionA as EloStats;
      const statsB = optionB as EloStats;
      const ratingDiff = Math.abs(statsA.rating - statsB.rating);
      return (
        (1 / (1 + Math.min(statsA.comparisons, statsB.comparisons))) *
        (1 - Math.tanh(ratingDiff / 400))
      );
    }

    case "bradley-terry": {
      const statsA = optionA as BradleyTerryStats;
      const statsB = optionB as BradleyTerryStats;
      const totalUncertainty = Math.sqrt(statsA.sigma ** 2 + statsB.sigma ** 2);
      const skillDiff = Math.abs(statsA.mu - statsB.mu);
      return (
        (totalUncertainty * (1 - Math.tanh(skillDiff))) /
        (1 + Math.min(statsA.comparisons, statsB.comparisons))
      );
    }

    case "trueskill": {
      const statsA = optionA as TrueSkillStats;
      const statsB = optionB as TrueSkillStats;
      const totalUncertainty = Math.sqrt(statsA.sigma ** 2 + statsB.sigma ** 2);
      const skillDiff = Math.abs(statsA.mu - statsB.mu);
      return (
        (totalUncertainty * (1 - Math.tanh(skillDiff / statsA.beta))) /
        (1 + Math.min(statsA.comparisons, statsB.comparisons))
      );
    }
  }
}

function getRatingValue(
  stats: EloStats | BradleyTerryStats | TrueSkillStats
): number {
  if ("rating" in stats) {
    return stats.rating; // Elo
  } else if ("mu" in stats) {
    return stats.mu; // Bradley-Terry or TrueSkill
  }
  return 0;
}

function getUncertainty(
  stats: EloStats | BradleyTerryStats | TrueSkillStats
): number {
  if ("sigma" in stats) {
    return stats.sigma; // Bradley-Terry or TrueSkill
  }
  return 0; // Elo doesn't have uncertainty
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
  const [selectedOption, setSelectedOption] = useState<number>(-1);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [rankings, setRankings] = useState<number[]>([]);
  const [currentComparison, setCurrentComparison] = useState<
    [number, number] | null
  >(null);
  const [isVoting, setIsVoting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchPoll() {
      try {
        const pollDoc = await getDoc(
          doc(collection(db, "polls"), resolvedParams.id)
        );

        if (!pollDoc.exists()) {
          setError("Poll not found");
          return;
        }

        const data = pollDoc.data();
        setPoll({
          id: pollDoc.id,
          title: data.title,
          description: data.description,
          options: data.options,
          votingFormat: data.votingFormat,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          singleVoteUsers: data.singleVoteUsers || [],
          rankedVotes: (data.rankedVotes || []).map(
            (vote: FirestoreRankedVote) => ({
              ...vote,
              timestamp: vote.timestamp.toDate(),
            })
          ),
          pluralityVotes: (data.pluralityVotes || []).map(
            (vote: FirestorePluralityVote) => ({
              ...vote,
              timestamp: vote.timestamp.toDate(),
            })
          ),
          pairwiseVotes: (data.pairwiseVotes || []).map(
            (vote: FirestorePairwiseVote) => ({
              ...vote,
              timestamp: vote.timestamp.toDate(),
            })
          ),
          pairwiseStats: data.pairwiseStats || {},
          ratingSystem: data.ratingSystem,
        });

        // Initialize rankings if needed
        if (data.votingFormat === "ranked") {
          setRankings(new Array(data.options.length).fill(-1));
        }

        // Initialize first comparison if needed
        if (data.votingFormat === "pairwise") {
          setCurrentComparison([0, 1]);
        }
      } catch (err) {
        console.error("Error fetching poll:", err);
        setError("Failed to load poll. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchPoll();
  }, [resolvedParams.id]);

  const getNextPairwiseComparison = (
    optionCount: number,
    currentStats: PairwiseStats
  ): [number, number] => {
    let maxGain = -1;
    let bestPair: [number, number] = [0, 1];

    // Find pair with highest information gain
    for (let i = 0; i < optionCount; i++) {
      for (let j = i + 1; j < optionCount; j++) {
        const gain = getInformationGain(
          currentStats.stats[i],
          currentStats.stats[j],
          currentStats.system
        );
        if (gain > maxGain) {
          maxGain = gain;
          bestPair = [i, j];
        }
      }
    }

    return bestPair;
  };

  const handleVote = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }

    if (!poll) return;

    setIsVoting(true);

    try {
      const pollRef = doc(collection(db, "polls"), resolvedParams.id);
      const now = new Date();

      switch (poll.votingFormat) {
        case "single":
          if (selectedOption === -1) {
            alert("Please select an option");
            return;
          }
          if (poll.singleVoteUsers?.includes(user.uid)) {
            alert("You can only vote once in a single vote poll");
            return;
          }
          await updateDoc(pollRef, {
            [`options.${selectedOption}.votes`]: increment(1),
            singleVoteUsers: arrayUnion(user.uid),
          });
          break;

        case "ranked":
          if (rankings.some((r) => r === -1)) {
            alert("Please rank all options");
            return;
          }
          if (hasDuplicateRankings(rankings)) {
            alert("Each option must have a unique ranking");
            return;
          }
          await updateDoc(pollRef, {
            rankedVotes: arrayUnion({
              userId: user.uid,
              rankings,
              timestamp: now,
            }),
          });
          break;

        case "plurality":
          if (selectedOptions.length === 0) {
            alert("Please select at least one option");
            return;
          }
          await updateDoc(pollRef, {
            pluralityVotes: arrayUnion({
              userId: user.uid,
              selections: selectedOptions,
              timestamp: now,
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

          // Initialize or get current stats
          const ratingSystem = poll.ratingSystem || "bradley-terry";
          const currentStats =
            poll.pairwiseStats ||
            initializeStats(ratingSystem, poll.options.length);

          // Ensure stats exist for both options
          if (!currentStats.stats[winner] || !currentStats.stats[loser]) {
            const initialStats = initializeStats(
              ratingSystem,
              poll.options.length
            );
            currentStats.stats = initialStats.stats;
          }

          // Update ratings
          const newStats = updateRatings(winner, loser, currentStats);

          await updateDoc(pollRef, {
            pairwiseVotes: arrayUnion({
              userId: user.uid,
              winner,
              loser,
              timestamp: now,
            }),
            pairwiseStats: {
              system: ratingSystem,
              stats: newStats.stats,
            },
          });

          // Get next comparison using information gain
          const nextPair = getNextPairwiseComparison(
            poll.options.length,
            newStats
          );
          setCurrentComparison(nextPair);
          break;
      }

      // Refresh poll data
      const updatedPollDoc = await getDoc(pollRef);
      const updatedData = updatedPollDoc.data();
      if (!updatedData) return;

      setPoll((prev) => ({
        ...prev!,
        ...updatedData,
        // Convert timestamps back to Date objects
        createdAt: updatedData.createdAt?.toDate() || prev!.createdAt,
        rankedVotes: (updatedData.rankedVotes || []).map(
          (vote: FirestoreRankedVote) => ({
            ...vote,
            timestamp: vote.timestamp?.toDate() || new Date(),
          })
        ),
        pluralityVotes: (updatedData.pluralityVotes || []).map(
          (vote: FirestorePluralityVote) => ({
            ...vote,
            timestamp: vote.timestamp?.toDate() || new Date(),
          })
        ),
        pairwiseVotes: (updatedData.pairwiseVotes || []).map(
          (vote: FirestorePairwiseVote) => ({
            ...vote,
            timestamp: vote.timestamp?.toDate() || new Date(),
          })
        ),
        pairwiseStats: updatedData.pairwiseStats || {},
      }));

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

  const renderVotingInterface = () => {
    if (!poll) return null;

    switch (poll.votingFormat) {
      case "single":
        return (
          <Flex direction="column" gap="3">
            {poll.options.map((option, index) => (
              <Box key={index}>
                <Flex gap="2" align="center">
                  <Radio
                    name="poll-option"
                    checked={selectedOption === index}
                    onChange={() => setSelectedOption(index)}
                    disabled={hasVoted}
                    value={index.toString()}
                  />
                  <Text>{option.text}</Text>
                </Flex>
              </Box>
            ))}
          </Flex>
        );

      case "ranked":
        return (
          <Flex direction="column" gap="3">
            {poll.options.map((option, index) => (
              <Box key={index}>
                <Flex justify="between" align="center">
                  <Text>{option.text}</Text>
                  <Select.Root
                    value={rankings[index].toString()}
                    onValueChange={(value) => {
                      const newRank = parseInt(value);
                      const newRankings = [...rankings];

                      // Find if this rank is already used
                      const existingIndex = rankings.findIndex(
                        (r) => r === newRank
                      );
                      if (existingIndex !== -1 && existingIndex !== index) {
                        // Swap rankings
                        newRankings[existingIndex] = rankings[index];
                      }

                      newRankings[index] = newRank;
                      setRankings(newRankings);
                    }}
                    disabled={hasVoted}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      {poll.options.map((_, i) => (
                        <Select.Item key={i} value={i.toString()}>
                          {`${i + 1}${getOrdinalSuffix(i + 1)} Choice`}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
              </Box>
            ))}
            {hasDuplicateRankings(rankings) && (
              <Text color="red" size="2">
                Each option must have a unique ranking
              </Text>
            )}
          </Flex>
        );

      case "plurality":
        return (
          <Flex direction="column" gap="3">
            {poll.options.map((option, index) => (
              <Box key={index}>
                <Flex gap="2" align="center">
                  <Checkbox
                    checked={selectedOptions.includes(index)}
                    onCheckedChange={(e) => {
                      if (e) {
                        setSelectedOptions([...selectedOptions, index]);
                      } else {
                        setSelectedOptions(
                          selectedOptions.filter((i) => i !== index)
                        );
                      }
                    }}
                    disabled={hasVoted}
                  />
                  <Text>{option.text}</Text>
                </Flex>
              </Box>
            ))}
          </Flex>
        );

      case "pairwise":
        if (!currentComparison) return null;
        const [optionA, optionB] = currentComparison;
        return (
          <Flex direction="column" gap="3">
            <Text>Which option do you prefer?</Text>
            <Flex gap="4" justify="center">
              <Button
                onClick={() => setSelectedOption(optionA)}
                variant={selectedOption === optionA ? "solid" : "soft"}
                disabled={hasVoted}
              >
                {poll.options[optionA].text}
              </Button>
              <Button
                onClick={() => setSelectedOption(optionB)}
                variant={selectedOption === optionB ? "solid" : "soft"}
                disabled={hasVoted}
              >
                {poll.options[optionB].text}
              </Button>
            </Flex>
          </Flex>
        );
    }
  };

  const renderResults = () => {
    if (!poll) return null;

    switch (poll.votingFormat) {
      case "single":
        return Object.values(poll.options).map((option, index) => {
          const votes = option.votes as number;
          const percentage =
            totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          return (
            <Box key={index}>
              <Flex justify="between" mb="2">
                <Text>{option.text}</Text>
                <Text>
                  {votes} votes ({percentage}%)
                </Text>
              </Flex>
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
            </Box>
          );
        });

      case "ranked":
        const scores = poll.options.map((_, index) => {
          let score = 0;
          poll.rankedVotes?.forEach((vote) => {
            score += poll.options.length - vote.rankings[index];
          });
          return { index, score };
        });
        scores.sort((a, b) => b.score - a.score);

        return scores.map(({ index, score }) => (
          <Box key={index}>
            <Flex justify="between" mb="2">
              <Text>{poll.options[index].text}</Text>
              <Text>Score: {score}</Text>
            </Flex>
          </Box>
        ));

      case "plurality":
        return poll.options.map((option, index) => {
          const votes =
            poll.pluralityVotes?.filter((vote) =>
              vote.selections.includes(index)
            ).length || 0;
          const percentage =
            totalVoters > 0 ? Math.round((votes / totalVoters) * 100) : 0;

          return (
            <Box key={index}>
              <Flex justify="between" mb="2">
                <Text>{option.text}</Text>
                <Text>
                  {votes} votes ({percentage}%)
                </Text>
              </Flex>
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
            </Box>
          );
        });

      case "pairwise":
        if (!poll.pairwiseStats) {
          const initialStats = initializeStats(
            poll.ratingSystem || "bradley-terry",
            poll.options.length
          );
          return renderPairwiseResults(initialStats, poll.options);
        }
        return renderPairwiseResults(poll.pairwiseStats, poll.options);
    }
  };

  function renderPairwiseResults(
    pairwiseStats: PairwiseStats,
    options: PollOption[]
  ) {
    // Sort options by their rating
    const ratings = Object.entries(pairwiseStats?.stats || {})
      .map(([index, stats]) => ({
        index: parseInt(index),
        rating: getRatingValue(stats),
        uncertainty: getUncertainty(stats),
        wins: stats.wins,
        comparisons: stats.comparisons,
      }))
      .sort((a, b) => b.rating - a.rating);

    return ratings.map(({ index, rating, uncertainty, wins, comparisons }) => (
      <Box key={index}>
        <Flex justify="between" mb="2">
          <Text>{options[index].text}</Text>
          <Flex gap="3">
            <Text>
              Rating: {rating.toFixed(2)} ±{uncertainty.toFixed(2)}
            </Text>
            <Text>
              Wins: {wins}/{comparisons}
            </Text>
          </Flex>
        </Flex>
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
              width: `${((rating + 2) / 4) * 100}%`,
              height: "100%",
              backgroundColor: "var(--accent-9)",
              transition: "width 0.3s ease",
            }}
          />
        </Box>
      </Box>
    ));
  }

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

  const totalVotes =
    poll.votingFormat === "single"
      ? Object.values(poll.options).reduce(
          (sum, option) => sum + (option.votes as number),
          0
        )
      : 0;
  const totalVoters = poll.singleVoteUsers?.length || 0;
  const hasVoted = Boolean(user && poll.singleVoteUsers?.includes(user.uid));

  const getUserVoteCount = () => {
    if (!user || !poll) return 0;

    switch (poll.votingFormat) {
      case "single":
        return poll.singleVoteUsers?.includes(user.uid) ? 1 : 0;
      case "ranked":
        return (
          poll.rankedVotes?.filter((vote) => vote.userId === user.uid).length ||
          0
        );
      case "plurality":
        return (
          poll.pluralityVotes?.filter((vote) => vote.userId === user.uid)
            .length || 0
        );
      case "pairwise":
        return (
          poll.pairwiseVotes?.filter((vote) => vote.userId === user.uid)
            .length || 0
        );
      default:
        return 0;
    }
  };

  return (
    <Box>
      <Card size="3">
        <Flex direction="column" gap="4">
          <Box>
            <Heading size="8" mb="2">
              {poll.title}
            </Heading>
            <Text color="gray" size="2">
              Created {formatDistanceToNow(poll.createdAt)} ago
            </Text>
            <Text color="gray" size="2">
              Voting format: {poll.votingFormat}
            </Text>
            {user && (
              <Text color="gray" size="2">
                Your votes: {getUserVoteCount()}
              </Text>
            )}
          </Box>

          <Text>{poll.description}</Text>

          {(!hasVoted || poll.votingFormat !== "single") &&
            renderVotingInterface()}

          <Box>
            <Heading size="3" mb="4">
              Results
            </Heading>
            <Flex direction="column" gap="3">
              {renderResults()}
            </Flex>
          </Box>

          {(!hasVoted || poll.votingFormat !== "single") && (
            <Button
              onClick={handleVote}
              disabled={
                isVoting ||
                (poll.votingFormat === "single" && selectedOption === -1)
              }
            >
              {isVoting ? "Submitting Vote..." : "Submit Vote"}
            </Button>
          )}

          {hasVoted && poll.votingFormat === "single" && (
            <Text color="gray">You have already voted in this poll</Text>
          )}
        </Flex>
      </Card>
    </Box>
  );
}

function getOrdinalSuffix(i: number): string {
  const j = i % 10,
    k = i % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function hasDuplicateRankings(rankings: number[]): boolean {
  const seen = new Set();
  for (const rank of rankings) {
    if (rank === -1) continue; // Skip unranked
    if (seen.has(rank)) return true;
    seen.add(rank);
  }
  return false;
}
