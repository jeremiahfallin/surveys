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
  stats: Record<
    string,
    {
      mu: number;
      sigma: number;
      beta: number;
      gamma: number;
      wins: number;
      comparisons: number;
      timestamp: Date;
    }
  >;
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
