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

function dynamicGamma(comparisons: number): number {
  return Math.min(0.5, 0.1 + 0.05 * Math.log(comparisons + 1));
}

function initializeAnnotatorStats(annotatorId: string): AnnotatorStats {
  return {
    id: annotatorId,
    reliability: 1, // Start with maximum reliability
    alpha: 1, // Beta distribution alpha parameter
    beta: 1, // Beta distribution beta parameter
    comparisons: [],
  };
}

function updateAnnotatorReliability(
  annotator: AnnotatorStats,
  winner: number,
  loser: number,
  globalStats: PairwiseStats["global"]
): void {
  const winnerStats = globalStats.participants[winner];
  const loserStats = globalStats.participants[loser];

  if (!winnerStats || !loserStats) return;

  const expectedProb = 1 / (1 + Math.exp(loserStats.mu - winnerStats.mu));
  const agreement = expectedProb > 0.5 ? 1 : 0;

  annotator.alpha += agreement;
  annotator.beta += 1 - agreement;
  annotator.reliability = annotator.alpha / (annotator.alpha + annotator.beta);
}

function calculateInformationGain(
  a: PairwiseOptionStats,
  b: PairwiseOptionStats,
  annotator: AnnotatorStats,
  gamma: number
): number {
  // Probability of each outcome
  const eta = annotator.alpha / (annotator.alpha + annotator.beta);
  const probWinA =
    eta * (1 / (1 + Math.exp(b.mu - a.mu))) +
    (1 - eta) * (Math.exp(b.mu - a.mu) / (1 + Math.exp(b.mu - a.mu)));

  const probLoseA = 1 - probWinA;

  // Information gain for this pair and annotator
  const infoGain =
    probWinA * Math.log(probWinA / eta) +
    probLoseA * Math.log(probLoseA / (1 - eta));

  // Tradeoff between pair uncertainty and annotator exploration
  return gamma * infoGain + (1 - gamma) * Math.abs(a.mu - b.mu);
}

export function getBestPair(
  globalStats: PairwiseStats["global"],
  annotator: AnnotatorStats,
  globalHistory: Map<string, { count: number; annotators: Set<string> }>,
  gamma: number
): [number, number] | null {
  const participantIds = Object.keys(globalStats.participants).map(Number);
  const pairs: [number, number][] = [];
  const pairScores: Map<string, number> = new Map();

  participantIds.forEach((aId, i) => {
    participantIds.slice(i + 1).forEach((bId) => {
      const pairKey = `${Math.min(aId, bId)}-${Math.max(aId, bId)}`;
      if (
        globalHistory.has(pairKey) &&
        globalHistory.get(pairKey)!.annotators.has(annotator.id)
      ) {
        return;
      }

      const aStats = globalStats.participants[aId];
      const bStats = globalStats.participants[bId];

      const score = calculateInformationGain(aStats, bStats, annotator, gamma);
      pairs.push([aId, bId]);
      pairScores.set(pairKey, score);
    });
  });

  pairs.sort((pair1, pair2) => {
    const score1 = pairScores.get(
      `${Math.min(pair1[0], pair1[1])}-${Math.max(pair1[0], pair1[1])}`
    )!;
    const score2 = pairScores.get(
      `${Math.min(pair2[0], pair2[1])}-${Math.max(pair2[0], pair2[1])}`
    )!;
    return score2 - score1;
  });

  // Weighted random sampling among top pairs
  const topPairs = pairs.slice(0, 10);
  const weights = topPairs.map(
    ([a, b]) => pairScores.get(`${Math.min(a, b)}-${Math.max(a, b)}`) || 0
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const rand = Math.random() * totalWeight;
  let cumulativeWeight = 0;
  for (let i = 0; i < topPairs.length; i++) {
    cumulativeWeight += weights[i];
    if (rand < cumulativeWeight) return topPairs[i];
  }

  return null;
}

export function processComparison(
  comparison: Comparison,
  globalStats: PairwiseStats["global"]
): {
  winnerStats: PairwiseOptionStats;
  loserStats: PairwiseOptionStats;
  annotatorStats: AnnotatorStats;
} {
  const { winner, loser, annotator: annotatorId } = comparison;

  if (!globalStats.participants[winner]) {
    globalStats.participants[winner] = initializeParticipantStats();
  }
  if (!globalStats.participants[loser]) {
    globalStats.participants[loser] = initializeParticipantStats();
  }
  if (!globalStats.annotators[annotatorId]) {
    globalStats.annotators[annotatorId] = {
      id: annotatorId,
      reliability: 1,
      alpha: 1,
      beta: 1,
      comparisons: [],
    };
  }

  const winnerStats = globalStats.participants[winner];
  const loserStats = globalStats.participants[loser];
  const annotatorStats = globalStats.annotators[annotatorId];

  updateAnnotatorReliability(annotatorStats, winner, loser, globalStats);

  const weight = annotatorStats.reliability;
  const probability = 1 / (1 + Math.exp(loserStats.mu - winnerStats.mu));
  const gradient =
    dynamicGamma(winnerStats.comparisons) * (1 - probability) * weight;

  winnerStats.mu += gradient / winnerStats.beta;
  loserStats.mu -= gradient / loserStats.beta;

  winnerStats.beta = Math.max(winnerStats.beta * 0.9, 0.1);
  loserStats.beta = Math.max(loserStats.beta * 0.9, 0.1);

  winnerStats.comparisons++;
  loserStats.comparisons++;
  winnerStats.wins++;

  annotatorStats.comparisons.push(comparison);

  return {
    winnerStats,
    loserStats,
    annotatorStats,
  };
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
    Object.assign(annotator, initializeAnnotatorStats(annotator.id));
  });

  // Reprocess each comparison in sequence
  comparisons.forEach((comparison) => {
    processComparison(comparison, globalStats);
  });

  return globalStats;
}
