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
import { Poll, GlobalStats } from "@/types/poll";
import { updatePairwiseStats, getNextComparison } from "./pairwise";

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
  winner: string,
  loser: string,
  userId: string
) {
  const pollRef = doc(db, "polls", pollId);
  const pollDoc = await getDoc(pollRef);
  if (!pollDoc.exists()) throw new Error("Poll not found");

  const poll = pollDoc.data() as Poll;
  const currentStats: GlobalStats = poll.pairwiseStats?.globalStats || {
    participants: {},
    annotators: {},
  };

  // Update stats with new vote
  const newStats = updatePairwiseStats(
    currentStats,
    { winner, loser, userId, timestamp: new Date() },
    userId
  );

  // Get next comparison
  const optionIds = poll.options.map((opt) => opt.id);
  const [nextA, nextB] = getNextComparison(optionIds, newStats);

  await updateDoc(pollRef, {
    pairwiseVotes: arrayUnion({
      userId,
      winner,
      loser,
      timestamp: Timestamp.now(),
    }),
    "pairwiseStats.globalStats": newStats,
    "pairwiseStats.currentComparison": [nextA, nextB],
  });

  return { newStats, nextComparison: [nextA, nextB] };
}
