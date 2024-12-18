export type VotingFormat = "single" | "ranked" | "plurality" | "pairwise";

export interface PollOption {
  id: string;
  text: string;
  votes?: number;
  imageUrl?: string;
}

export interface Vote {
  userId: string;
  timestamp: Date;
}

export interface RankedVote extends Vote {
  rankings: Record<string, number>;
}

export interface PluralityVote extends Vote {
  selections: number[];
}

export interface PairwiseVote extends Vote {
  winner: number;
  loser: number;
}

export interface PairwiseStats {
  system: string;
  global: {
    participants: Record<number, PairwiseOptionStats>;
    annotators: Record<string, AnnotatorStats>;
  };
  currentComparison?: [number, number];
}

export interface Poll {
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
}

export interface PairwiseOptionStats {
  mu: number; // Mean
  sigma: number; // Standard deviation
  beta: number; // Precision
  gamma: number; // Learning rate
  wins: number;
  comparisons: number;
  timestamp: Date;
}

export interface AnnotatorStats {
  reliability: number; // Annotator quality (η_k)
  comparisons: Comparison[]; // Total comparisons
  alpha: number;
  beta: number;
}

export interface Comparison {
  winner: number; // ID of winner
  loser: number; // ID of loser
  annotator: string; // ID of annotator
}
