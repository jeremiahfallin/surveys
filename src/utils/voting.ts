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

export function getNextPairwiseComparison(
  optionCount: number,
  userId: string,
  history: PairwiseVote[],
  scores: number[], // Current scores of options
  prioritizeUncertain: boolean = true // Whether to prioritize pairs with close scores
): [number, number] | null {
  // Helper function to create a unique key for a pair
  const getPairKey = (a: number, b: number) =>
    `${Math.min(a, b)}-${Math.max(a, b)}`;

  const globalHistory = createGlobalHistory(history);

  // Generate all possible pairs
  const availablePairs: [number, number][] = [];
  for (let a = 0; a < optionCount - 1; a++) {
    for (let b = a + 1; b < optionCount; b++) {
      const key = getPairKey(a, b);
      const entry = globalHistory.get(key);

      // Check if the pair has been evaluated by the current annotator
      if (!entry || !entry.userIds.has(userId)) {
        availablePairs.push([a, b]);
      }
    }
  }

  // If no available pairs, indicate completion
  if (availablePairs.length === 0) {
    return null; // Signal that no pairs are available
  }

  // Sort pairs based on evaluation count (prioritize less evaluated pairs)
  availablePairs.sort((pair1, pair2) => {
    const count1 =
      globalHistory.get(getPairKey(pair1[0], pair1[1]))?.count || 0;
    const count2 =
      globalHistory.get(getPairKey(pair2[0], pair2[1]))?.count || 0;
    return count1 - count2; // Prioritize pairs with lower evaluation counts
  });

  // If prioritizing uncertainty, further refine sorting based on score closeness
  if (prioritizeUncertain) {
    availablePairs.sort((pair1, pair2) => {
      const [a1, b1] = pair1;
      const [a2, b2] = pair2;
      return (
        Math.abs(scores[a1] - scores[b1]) - Math.abs(scores[a2] - scores[b2])
      );
    });
  }

  // Return the next best pair
  return availablePairs[0];
}

export function calculateIRVResults(
  rankings: RankedVote[],
  options: Array<{ text: string }>,
  winnersNeeded: number = 1
) {
  if (!rankings.length) return [];

  let eliminated: number[] = [];
  let winners: Array<{ index: number; round: number; votes: number }> = [];
  let round = 1;

  // Create a map of option text to index
  const optionToIndex = new Map(options.map((opt, index) => [opt.text, index]));

  while (
    winners.length < winnersNeeded &&
    eliminated.length < options.length - 1
  ) {
    const voteCounts = new Map<number, number>();
    for (let i = 0; i < options.length; i++) {
      if (!eliminated.includes(i)) {
        voteCounts.set(i, 0);
      }
    }

    // Count first-choice votes for each option
    rankings.forEach((vote) => {
      const validRankings = Object.entries(vote.rankings)
        .map(([text, rank]) => ({
          index: optionToIndex.get(text) ?? -1,
          rank,
        }))
        .filter(({ index }) => index !== -1 && !eliminated.includes(index))
        .sort((a, b) => a.rank - b.rank);

      if (validRankings.length > 0) {
        const topChoice = validRankings[0];
        voteCounts.set(
          topChoice.index,
          (voteCounts.get(topChoice.index) || 0) + 1
        );
      }
    });

    const totalVotes = Array.from(voteCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const majority = totalVotes / 2;

    // Find winner or loser
    const remainingVotes = Array.from(voteCounts.entries());
    if (remainingVotes.length === 0) break;

    const maxVotes = Math.max(...remainingVotes.map(([, votes]) => votes));
    const winner = remainingVotes.find(([, votes]) => votes === maxVotes);

    if (maxVotes > majority || remainingVotes.length === 1) {
      // We have a winner
      if (winner) {
        winners.push({
          index: winner[0],
          round,
          votes: winner[1],
        });
        eliminated.push(winner[0]);
      }
    } else {
      // Eliminate the option with the fewest votes
      const minVotes = Math.min(...remainingVotes.map(([, votes]) => votes));
      const losers = remainingVotes.filter(([, votes]) => votes === minVotes);
      if (losers.length > 0) {
        eliminated.push(losers[0][0]); // Eliminate one of the tied losers
      }
    }

    round++;
  }

  return winners.slice(0, winnersNeeded);
}
