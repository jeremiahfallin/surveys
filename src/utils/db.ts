import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  arrayUnion,
  increment,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { Poll } from "@/types/poll";
import { getBestPair, processComparison } from "./pairwise";
import { reprocessComparisons } from "@/utils/pairwise";

export async function createPoll(poll: Omit<Poll, "id">) {
  const pollsRef = collection(db, "polls");
  return addDoc(pollsRef, {
    ...poll,
    createdAt: Timestamp.now(),
  });
}

export async function getPoll(id: string): Promise<Poll | null> {
  const pollDoc = await getDoc(doc(db, "polls", id));
  if (!pollDoc.exists()) return null;

  const data = pollDoc.data();
  return {
    id: pollDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
  } as Poll;
}

export async function getPolls(): Promise<Poll[]> {
  const pollsQuery = query(
    collection(db, "polls"),
    orderBy("createdAt", "desc")
  );

  const querySnapshot = await getDocs(pollsQuery);
  return querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Poll;
  });
}

export async function submitSingleVote(
  pollId: string,
  optionIndex: number,
  userId: string
) {
  const pollRef = doc(db, "polls", pollId);
  await updateDoc(pollRef, {
    [`options.${optionIndex}.votes`]: increment(1),
    singleVoteUsers: arrayUnion(userId),
  });
}

export async function submitRankedVote(
  pollId: string,
  rankings: Record<string, number>,
  userId: string
) {
  const pollRef = doc(db, "polls", pollId);
  await updateDoc(pollRef, {
    rankedVotes: arrayUnion({
      userId,
      rankings,
      timestamp: Timestamp.now(),
    }),
  });
}

export async function submitPluralityVote(
  pollId: string,
  selections: number[],
  userId: string
) {
  const pollRef = doc(db, "polls", pollId);
  await updateDoc(pollRef, {
    pluralityVotes: arrayUnion({
      userId,
      selections,
      timestamp: Timestamp.now(),
    }),
  });
}

export async function submitPairwiseVote(
  pollId: string,
  winner: number,
  loser: number,
  userId: string
) {
  const pollRef = doc(db, "polls", pollId);
  const pollDoc = await getDoc(pollRef);
  if (!pollDoc.exists()) throw new Error("Poll not found");

  const poll = {
    id: pollDoc.id,
    ...pollDoc.data(),
    createdAt: pollDoc.data()?.createdAt?.toDate() || new Date(),
  } as Poll;

  // Initialize or update pairwise stats
  const currentStats = poll.pairwiseStats || {
    system: "bradley-terry",
    global: {
      participants: {},
      annotators: {},
    },
  };

  // Add current comparison
  const comparison = {
    winner,
    loser,
    annotator: userId,
  };

  const history = [
    ...(poll.pairwiseVotes || []),
    {
      userId,
      winner,
      loser,
      timestamp: new Date(),
    },
  ];

  // Reprocess stats periodically
  const totalVotes = history.length;
  const allOptions = history.reduce<number[]>((prev, curr) => {
    const newArr = [...prev];
    if (!prev.includes(curr.winner)) {
      newArr.push(curr.winner);
    }
    if (!prev.includes(curr.loser)) {
      newArr.push(curr.loser);
    }
    return newArr;
  }, []);
  if (totalVotes % 10 === 0) {
    const comparisons = history.flatMap((vote) => {
      if (
        !allOptions.includes(vote.winner) ||
        !allOptions.includes(vote.loser)
      ) {
        return [];
      }
      return {
        winner: vote.winner,
        loser: vote.loser,
        annotator: vote.userId,
        timestamp: vote.timestamp,
      };
    });
    currentStats.global = reprocessComparisons(comparisons, {
      participants: {},
      annotators: {},
    });
  } else {
    // Process only the current comparison
    // Initialize participants if they don't exist
    if (!currentStats.global.participants[winner]) {
      currentStats.global.participants[winner] = {
        mu: 0,
        sigma: 1,
        beta: 1,
        gamma: 0.1,
        wins: 0,
        comparisons: 0,
        timestamp: new Date(),
      };
    }
    if (!currentStats.global.participants[loser]) {
      currentStats.global.participants[loser] = {
        mu: 0,
        sigma: 1,
        beta: 1,
        gamma: 0.1,
        wins: 0,
        comparisons: 0,
        timestamp: new Date(),
      };
    }

    const { winnerStats, loserStats, annotatorStats } = processComparison(
      comparison,
      currentStats.global
    );
    currentStats.global.participants[winner] = winnerStats;
    currentStats.global.participants[loser] = loserStats;
    currentStats.global.annotators[userId] = annotatorStats;
  }

  // Get next comparison
  const historyMap = new Map<
    string,
    { count: number; annotators: Set<string> }
  >();
  history.forEach((vote) => {
    const key = `${Math.min(vote.winner, vote.loser)}-${Math.max(
      vote.winner,
      vote.loser
    )}`;
    if (!historyMap.has(key)) {
      historyMap.set(key, { count: 0, annotators: new Set() });
    }
    const entry = historyMap.get(key)!;
    entry.count++;
    entry.annotators.add(vote.userId);
  });

  const gamma = 0.1;
  const nextPair = getBestPair(
    currentStats.global,
    currentStats.global.annotators[userId],
    historyMap,
    gamma
  );

  // Update database
  await updateDoc(pollRef, {
    pairwiseVotes: arrayUnion({
      userId,
      winner,
      loser,
      timestamp: Timestamp.now(),
    }),
    pairwiseStats: currentStats,
  });

  return {
    stats: currentStats,
    nextComparison: nextPair,
  };
}
