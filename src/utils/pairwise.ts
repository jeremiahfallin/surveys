import { PairwiseStats, PairwiseVote, PairwiseOptionStats } from "@/types/poll";

const DEFAULT_PARTICIPANT_STATS: PairwiseOptionStats = {
  mu: 0, // Initial mean score
  sigma: 1,
  beta: 0.5, // Initial uncertainty in score
  gamma: 0.1, // Learning rate
  wins: 0,
  comparisons: 0,
  timestamp: new Date(),
};

export function initializeParticipantStats(): PairwiseOptionStats {
  return { ...DEFAULT_PARTICIPANT_STATS };
}

export function updatePairwiseStats(
  currentStats: PairwiseStats["global"],
  vote: PairwiseVote,
  userId: string
): PairwiseStats {
  const newStats: PairwiseStats = {
    system: "bradley-terry",
    global: {
      participants: { ...currentStats.participants },
      annotators: { ...currentStats.annotators },
    },
    currentComparison: undefined,
  };

  // Convert number indices to string IDs
  const winnerId = vote.winner;
  const loserId = vote.loser;

  // Initialize stats for new participants
  if (!newStats.global.participants[winnerId]) {
    newStats.global.participants[winnerId] = initializeParticipantStats();
  }
  if (!newStats.global.participants[loserId]) {
    newStats.global.participants[loserId] = initializeParticipantStats();
  }
  if (!newStats.global.annotators[userId]) {
    newStats.global.annotators[userId] = {
      reliability: 1.0,
      comparisons: 0,
    };
  }

  const winnerStats = newStats.global.participants[winnerId];
  const loserStats = newStats.global.participants[loserId];
  const annotatorStats = newStats.global.annotators[userId];

  // Calculate probability of observed outcome using Bradley-Terry model
  const p =
    1 / (1 + Math.exp((loserStats.mu - winnerStats.mu) / winnerStats.beta));

  // Weight update by annotator reliability
  const updateWeight = annotatorStats.reliability;

  // Update participant scores
  const muDelta = winnerStats.gamma * (1 - p) * updateWeight;
  winnerStats.mu += muDelta;
  loserStats.mu -= muDelta;

  // Update comparison counts
  winnerStats.comparisons += 1;
  loserStats.comparisons += 1;
  winnerStats.wins += 1;
  annotatorStats.comparisons += 1;

  // Update timestamps
  winnerStats.timestamp = new Date();
  loserStats.timestamp = new Date();

  // Update annotator reliability based on agreement with model
  const agreementScore = 1 - Math.abs(1 - p); // High when annotator agrees with model
  const reliabilityUpdate = 0.1 * (agreementScore - annotatorStats.reliability);
  annotatorStats.reliability = Math.max(
    0.1,
    Math.min(1.0, annotatorStats.reliability + reliabilityUpdate)
  );

  return newStats;
}

export function getNextComparison(
  participants: number[],
  stats: PairwiseStats["global"]
): [number, number] {
  // Initialize scores for new participants
  const participantScores = participants.map((id) => ({
    id,
    stats: stats.participants[id] || initializeParticipantStats(),
  }));

  // Calculate information gain for each possible pair
  let maxGain = -1;
  let bestPair: [number, number] = [0, 1];

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const a = participantScores[i];
      const b = participantScores[j];

      // Calculate expected information gain
      const uncertaintyFactor = Math.sqrt(
        a.stats.beta ** 2 + b.stats.beta ** 2
      );
      const skillDiff = Math.abs(a.stats.mu - b.stats.mu);
      const comparisonFactor =
        1 / (1 + Math.min(a.stats.comparisons, b.stats.comparisons));

      const gain =
        uncertaintyFactor * (1 - Math.tanh(skillDiff)) * comparisonFactor;

      if (gain > maxGain) {
        maxGain = gain;
        bestPair = [i, j];
      }
    }
  }

  return bestPair;
}

export function getRankings(
  stats: PairwiseStats["global"]
): Array<{ id: string; score: number }> {
  return Object.entries(stats.participants)
    .map(([id, stats]) => ({
      id,
      score: stats.mu,
    }))
    .sort((a, b) => b.score - a.score);
}
