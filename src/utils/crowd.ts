import {
  AnnotatorStats,
  Comparison,
  PairwiseStats,
  PairwiseOptionStats,
} from "@/types/poll";

// Utility to initialize a participant's stats
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

// Utility to initialize an annotator's stats
function initializeAnnotatorStats(): AnnotatorStats {
  return {
    reliability: 0.75, // Start with reasonable trust
    comparisons: 0,
  };
}

// Update reliability based on agreement with inferred preference
function updateAnnotatorReliability(
  annotator: AnnotatorStats,
  observed: boolean,
  expected: boolean
): void {
  const alpha = 0.1; // Learning rate for reliability
  const agreement = observed === expected ? 1 : 0;
  annotator.reliability += alpha * (agreement - annotator.reliability);
}

// Process a single comparison
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

  // Compute the Bradley-Terry probability
  const p =
    annotatorStats.reliability *
      (1 /
        (1 + Math.exp((loserStats.mu - winnerStats.mu) / winnerStats.beta))) +
    (1 - annotatorStats.reliability) *
      (1 -
        1 /
          (1 + Math.exp((loserStats.mu - winnerStats.mu) / winnerStats.beta)));

  // Update scores using Bayesian-style updates
  const muDelta = winnerStats.gamma * (1 - p);
  winnerStats.mu += muDelta;
  winnerStats.wins += 1;
  winnerStats.comparisons += 1;
  winnerStats.timestamp = new Date();

  loserStats.mu -= muDelta;
  loserStats.comparisons += 1;
  loserStats.timestamp = new Date();

  // Update annotator reliability
  const truePreference = true; // Assuming the comparison is correctly labeled
  updateAnnotatorReliability(annotatorStats, p > 0.5, truePreference);
  annotatorStats.comparisons += 1;

  return {
    winnerStats,
    loserStats,
    annotatorStats,
  };
}
