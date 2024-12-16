import {
  AnnotatorStats,
  Comparison,
  PairwiseStats,
  PairwiseOptionStats,
} from "@/types/poll";

function initializeParticipantStats(): PairwiseOptionStats {
  return {
    mu: 0, // Start at neutral score
    sigma: 1,
    beta: 1, // High uncertainty initially
    gamma: 0.1, // Learning rate
    wins: 0,
    comparisons: 0,
    timestamp: new Date(),
  };
}

function initializeAnnotatorStats(): AnnotatorStats {
  return {
    reliability: 1, // Start with maximum reliability
    alpha: 1, // Beta distribution alpha parameter
    beta: 1, // Beta distribution beta parameter
    comparisons: 0,
  };
}

function updateAnnotatorQuality(
  annotator: AnnotatorStats,
  observed: boolean,
  expected: boolean
): void {
  const agreement = observed === expected ? 1 : 0;

  // Update `alpha` and `beta` based on agreement or disagreement
  annotator.alpha += agreement; // Increment alpha for agreements
  annotator.beta += 1 - agreement; // Increment beta for disagreements
}

export function processComparison(
  comparison: Comparison,
  globalStats: PairwiseStats["global"]
): {
  winnerStats: PairwiseOptionStats;
  loserStats: PairwiseOptionStats;
  annotatorStats: AnnotatorStats;
} {
  const { winner, loser, annotator } = comparison;

  // Initialize participant and annotator stats if not already present
  if (!globalStats.participants[winner]) {
    globalStats.participants[winner] = initializeParticipantStats();
  }
  if (!globalStats.participants[loser]) {
    globalStats.participants[loser] = initializeParticipantStats();
  }
  if (!globalStats.annotators[annotator]) {
    globalStats.annotators[annotator] = initializeAnnotatorStats();
  }

  const winnerStats = globalStats.participants[winner];
  const loserStats = globalStats.participants[loser];
  const annotatorStats = globalStats.annotators[annotator];

  // Compute the probability using the Crowd-BT model
  const eta =
    annotatorStats.alpha / (annotatorStats.alpha + annotatorStats.beta);
  const probability =
    eta * (1 / (1 + Math.exp(loserStats.mu - winnerStats.mu))) +
    (1 - eta) *
      (Math.exp(loserStats.mu - winnerStats.mu) /
        (1 + Math.exp(loserStats.mu - winnerStats.mu)));

  // Update scores based on the probability
  const dynamicGamma = Math.min(0.1, 1 / (1 + winnerStats.comparisons));
  const gradient = dynamicGamma * (1 - probability);

  winnerStats.mu += gradient * (1 / winnerStats.beta);
  loserStats.mu -= gradient * (1 / loserStats.beta);

  // Adjust beta to decrease uncertainty over time
  winnerStats.beta = Math.max(winnerStats.beta * 0.9, 0.1);
  loserStats.beta = Math.max(loserStats.beta * 0.9, 0.1);

  winnerStats.comparisons += 1;
  loserStats.comparisons += 1;

  // Update annotator reliability
  updateAnnotatorQuality(annotatorStats, probability > 0.5, true);
  annotatorStats.comparisons += 1;

  return {
    winnerStats,
    loserStats,
    annotatorStats,
  };
}

export function getNextComparison(
  participants: number[],
  stats: PairwiseStats["global"]
): [number, number] {
  const participantScores = participants.map((id) => ({
    id,
    stats: stats.participants[id] || initializeParticipantStats(),
  }));

  let maxGain = -1;
  let bestPair: [number, number] = [0, 1];

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const a = participantScores[i];
      const b = participantScores[j];

      const uncertaintyFactor = Math.sqrt(
        a.stats.beta ** 2 + b.stats.beta ** 2
      );
      const skillDiff = Math.abs(a.stats.mu - b.stats.mu);
      const gain = uncertaintyFactor * Math.exp(-skillDiff / 2);

      if (gain > maxGain) {
        maxGain = gain;
        bestPair = [a.id, b.id];
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

export function reprocessComparisons(
  comparisons: Comparison[],
  globalStats: PairwiseStats["global"]
): PairwiseStats["global"] {
  // Reset all participants and annotators stats
  Object.values(globalStats.participants).forEach((participant) => {
    Object.assign(participant, initializeParticipantStats());
  });
  Object.values(globalStats.annotators).forEach((annotator) => {
    Object.assign(annotator, initializeAnnotatorStats());
  });

  // Reprocess each comparison in sequence
  comparisons.forEach((comparison) => {
    processComparison(comparison, globalStats);
  });

  return globalStats;
}
