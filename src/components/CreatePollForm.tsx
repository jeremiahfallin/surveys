"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "./AuthProvider";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Flex,
  TextArea,
  TextField,
  Select,
  Text,
  Card,
} from "@radix-ui/themes";
import { ImageUpload } from "./ImageUpload";
import { VotingFormat } from "@/types/poll";

interface VotingFormatInfo {
  label: string;
  description: string;
}

const VOTING_FORMAT_INFO: Record<VotingFormat, VotingFormatInfo> = {
  single: {
    label: "Single Vote",
    description: "Each voter can select one option only",
  },
  ranked: {
    label: "Ranked Choice",
    description: "Voters rank options in order of preference",
  },
  plurality: {
    label: "Plurality Voting",
    description: "Voters can vote for multiple options",
  },
  pairwise: {
    label: "Pairwise Comparison",
    description: "Options are compared head-to-head",
  },
};

interface PollOption {
  text: string;
  imageUrl?: string;
}

interface BradleyTerryStats {
  mu: number;
  sigma: number;
  beta: number;
  gamma: number;
  wins: number;
  comparisons: number;
  timestamp: Timestamp;
}

interface RankedVote {
  userId: string;
  rankings: number[];
  timestamp: Timestamp;
}

interface PluralityVote {
  userId: string;
  selections: number[];
  timestamp: Timestamp;
}

interface PollData {
  title: string;
  description: string;
  options: Array<{
    id: string;
    text: string;
    votes: number;
    imageUrl?: string;
  }>;
  votingFormat: VotingFormat;
  createdAt: Timestamp;
  createdBy: string;
  active: boolean;
  singleVoteUsers?: string[];
  rankedVotes?: RankedVote[];
  pluralityVotes?: PluralityVote[];
  pairwiseStats?: {
    system: string;
    stats: Record<string, BradleyTerryStats>;
  };
}

export function CreatePollForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<PollOption[]>([
    { text: "" },
    { text: "" },
  ]);
  const [votingFormat, setVotingFormat] = useState<VotingFormat>("single");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const addOption = () => {
    setOptions([...options, { text: "" }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, updates: Partial<PollOption>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (options.some((option) => !option.text.trim())) {
      alert("All options must be filled out");
      return;
    }

    const minOptions = votingFormat === "pairwise" ? 3 : 2;
    if (options.length < minOptions) {
      alert(
        `${VOTING_FORMAT_INFO[votingFormat].label} requires at least ${minOptions} options`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const pollData: PollData = {
        title,
        description,
        options: options.map((option, index) => ({
          id: `option-${index}`,
          text: option.text,
          votes: 0,
          ...(option.imageUrl && { imageUrl: option.imageUrl }),
        })),
        votingFormat,
        createdAt: Timestamp.now(),
        createdBy: user?.uid || "anonymous",
        active: true,
        ...(votingFormat === "single" && { singleVoteUsers: [] }),
        ...(votingFormat === "ranked" && { rankedVotes: [] }),
        ...(votingFormat === "plurality" && { pluralityVotes: [] }),
        ...(votingFormat === "pairwise" && {
          pairwiseStats: {
            system: "bradley-terry",
            stats: options.reduce<Record<string, BradleyTerryStats>>(
              (acc, _, i) => ({
                ...acc,
                [`option-${i}`]: {
                  mu: 0,
                  sigma: 1.0,
                  beta: 0.5,
                  gamma: 0.1,
                  wins: 0,
                  comparisons: 0,
                  timestamp: Timestamp.now(),
                },
              }),
              {}
            ),
          },
        }),
      };

      const pollRef = await addDoc(collection(db, "polls"), pollData);
      router.push(`/polls/${pollRef.id}`);
    } catch (error: unknown) {
      console.error("Error creating poll:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create poll. Please try again.";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="min-h-screen p-6 bg-gradient-to-b from-gray-900 to-gray-800">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
        <Card size="3">
          <Flex direction="column" gap="6" p="4">
            {/* Title Section */}
            <Box>
              <Text as="label" size="2" mb="2" weight="bold">
                Poll Title
              </Text>
              <TextField.Root
                size="3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="What's your poll about?"
              />
            </Box>

            {/* Description Section */}
            <Box>
              <Text as="label" size="2" mb="2" weight="bold">
                Description
              </Text>
              <TextArea
                size="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Provide more details about your poll"
              />
            </Box>

            {/* Voting Format Section */}
            <Flex direction="column" gap="2">
              <Text as="label" size="2" mb="2" weight="bold">
                Voting Format
              </Text>
              <Box>
                <Select.Root
                  value={votingFormat}
                  onValueChange={(value: VotingFormat) =>
                    setVotingFormat(value)
                  }
                >
                  <Select.Trigger />
                  <Select.Content>
                    {Object.entries(VOTING_FORMAT_INFO).map(
                      ([value, { label }]) => (
                        <Select.Item key={value} value={value}>
                          {label}
                        </Select.Item>
                      )
                    )}
                  </Select.Content>
                </Select.Root>
              </Box>
              <Text size="1" color="gray" mt="1">
                {VOTING_FORMAT_INFO[votingFormat].description}
              </Text>
            </Flex>

            {/* Options Section */}
            <Box>
              <Text as="label" size="2" mb="2" weight="bold">
                Options
              </Text>
              <Flex direction="column" gap="3">
                {options.map((option, index) => (
                  <Card key={index} variant="surface">
                    <Flex direction="column" gap="3" p="3">
                      <TextField.Root
                        size="3"
                        value={option.text}
                        onChange={(e) =>
                          updateOption(index, { text: e.target.value })
                        }
                        required
                        placeholder={`Option ${index + 1}`}
                      />

                      <ImageUpload
                        existingImageUrl={option.imageUrl}
                        onImageUploaded={(url) =>
                          updateOption(index, { imageUrl: url })
                        }
                      />

                      {options.length > 2 && (
                        <Button
                          type="button"
                          onClick={() => removeOption(index)}
                          variant="soft"
                          color="red"
                          size="2"
                        >
                          Remove Option
                        </Button>
                      )}
                    </Flex>
                  </Card>
                ))}

                <Button
                  type="button"
                  onClick={addOption}
                  variant="soft"
                  size="2"
                >
                  + Add Option
                </Button>
              </Flex>
            </Box>

            {/* Submit Button */}
            <Box>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="3"
                style={{ width: "100%" }}
              >
                {isSubmitting ? "Creating Poll..." : "Create Poll"}
              </Button>
            </Box>
          </Flex>
        </Card>
      </form>
    </Box>
  );
}
