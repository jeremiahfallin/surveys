import { RankedVote } from "@/types/poll";

export function getOrdinalSuffix(i: number): string {
  const j = i % 10,
    k = i % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function hasDuplicateRankings(rankings: number[]): boolean {
  const seen = new Set();
  for (const rank of rankings) {
    if (rank === -1) continue; // Skip unranked
    if (seen.has(rank)) return true;
    seen.add(rank);
  }
  return false;
}

function addComparisonToGlobalHistory(
  globalHistory: Map<string, { userIds: Set<string>; count: number }>,
  winner: number,
  loser: number,
  userId: string
): void {
  const key = `${Math.min(winner, loser)}-${Math.max(winner, loser)}`; // Ensure unique key regardless of order
  if (!globalHistory.has(key)) {
    globalHistory.set(key, { userIds: new Set(), count: 0 });
  }

  const entry = globalHistory.get(key)!;
  entry.userIds.add(userId); // Track which user made the comparison
  entry.count += 1; // Increment the count of evaluations
}

interface PairwiseVote {
  winner: number;
  loser: number;
  userId: string;
}

function createGlobalHistory(
  pairwiseVotes: PairwiseVote[]
): Map<string, { userIds: Set<string>; count: number }> {
  const globalHistory = new Map<
    string,
    { userIds: Set<string>; count: number }
  >();
  pairwiseVotes.forEach((vote) => {
    addComparisonToGlobalHistory(
      globalHistory,
      vote.winner,
      vote.loser,
      vote.userId
    );
  });
  return globalHistory;
}

export function calculateCoombsResults(
  rankings: RankedVote[],
  options: Array<{ text: string }>,
  winnersNeeded: number = 1
) {
  if (!rankings.length || !options.length || winnersNeeded <= 0) return [];

  const initialCounts = options.reduce((acc, option) => {
    acc[option.text] = 0;
    return acc;
  }, {} as Record<string, number>);

  const tallyFirstChoiceVotes = (
    votes: RankedVote[],
    eliminated: Set<string>
  ) => {
    const counts = { ...initialCounts };
    votes.forEach((vote) => {
      // Find the highest ranked non-eliminated option
      const firstChoice = Object.entries(vote.rankings)
        .filter(([option]) => !eliminated.has(option))
        .sort(([, rankA], [, rankB]) => rankA - rankB)[0];
      if (firstChoice) {
        const [option] = firstChoice;
        counts[option] = (counts[option] || 0) + 1;
      }
    });
    return counts;
  };

  const tallyLastPlaceVotes = (
    votes: RankedVote[],
    eliminated: Set<string>
  ) => {
    const counts = { ...initialCounts };
    votes.forEach((vote) => {
      const validRankings = Object.entries(vote.rankings).filter(
        ([option]) => !eliminated.has(option)
      );

      if (validRankings.length === 0) return;

      // Find the lowest ranked (highest number) non-eliminated option
      const lastPlace = validRankings.reduce((max, curr) =>
        curr[1] > max[1] ? curr : max
      );

      counts[lastPlace[0]] = (counts[lastPlace[0]] || 0) + 1; // Initialize to 0 if undefined
    });
    return counts;
  };

  const redistributeVotes = (votes: RankedVote[], eliminated: Set<string>) => {
    votes.forEach((vote) => {
      const adjustedRankings: Record<string, number> = {};

      // Filter out eliminated options and sort by original ranking
      const validOptions = Object.entries(vote.rankings)
        .filter(([option]) => !eliminated.has(option))
        .sort(([, rankA], [, rankB]) => rankA - rankB);

      // Reassign ranks starting from 0
      validOptions.forEach(([option], index) => {
        adjustedRankings[option] = index;
      });

      vote.rankings = adjustedRankings;
    });
  };

  const eliminated = new Set<string>();
  const winners: Array<{ index: number; votes: number }> = [];
  let remainingOptions = options.length;

  while (remainingOptions > winnersNeeded) {
    // First check if we have a winner with majority
    const firstChoiceCounts = tallyFirstChoiceVotes(rankings, eliminated);
    const majorityThreshold = rankings.length / 2;

    const potentialWinner = Object.entries(firstChoiceCounts)
      .filter(([option]) => !eliminated.has(option))
      .find(([, votes]) => votes > majorityThreshold);

    if (potentialWinner) {
      // We found a winner with majority
      const [winnerOption, votes] = potentialWinner;
      winners.push({
        index: options.findIndex((opt) => opt.text === winnerOption),
        votes: votes,
      });
      eliminated.add(winnerOption);
      remainingOptions--;
      continue;
    }

    // No majority winner, eliminate the option with most last-place votes
    const lastPlaceCounts = tallyLastPlaceVotes(rankings, eliminated);
    const sortedLastPlace = Object.entries(lastPlaceCounts)
      .filter(([option]) => !eliminated.has(option))
      .sort((a, b) => b[1] - a[1]); // Sort by most last-place votes
    if (sortedLastPlace.length === 0) break;

    const [loserOption] = sortedLastPlace[0];
    eliminated.add(loserOption);
    remainingOptions--;
    redistributeVotes(rankings, eliminated);
  }

  // Add any remaining options as winners if needed
  const finalCounts = tallyFirstChoiceVotes(rankings, eliminated);
  Object.entries(finalCounts)
    .filter(([option]) => !eliminated.has(option))
    .sort((a, b) => b[1] - a[1]) // Sort by most votes
    .slice(0, winnersNeeded - winners.length)
    .forEach(([option, votes]) => {
      winners.push({
        index: options.findIndex((opt) => opt.text === option),
        votes: votes || 0, // Ensure votes is not undefined
      });
    });

  return winners;
}
