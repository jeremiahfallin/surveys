"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
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
} from "@radix-ui/themes";
import { ImageUpload } from "./ImageUpload";

export type VotingFormat = "single" | "ranked" | "plurality" | "pairwise";

const VOTING_FORMAT_INFO = {
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

    if (!user) {
      alert("You must be signed in to create a poll");
      return;
    }

    if (options.some((option) => !option.text.trim())) {
      alert("All options must be filled out");
      return;
    }

    // Ensure minimum options for different voting formats
    const minOptions = votingFormat === "pairwise" ? 3 : 2;
    if (options.length < minOptions) {
      alert(
        `${VOTING_FORMAT_INFO[votingFormat].label} requires at least ${minOptions} options`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const pollData = {
        title,
        description,
        options: options.map((option) => ({
          text: option.text,
          votes: 0,
          ...(option.imageUrl && { imageUrl: option.imageUrl }),
        })),
        votingFormat,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        active: true,
        // Format-specific initial data
        ...(votingFormat === "single" && { singleVoteUsers: [] }),
        ...(votingFormat === "ranked" && { rankedVotes: [] }),
        ...(votingFormat === "plurality" && { pluralityVotes: [] }),
        ...(votingFormat === "pairwise" && {
          pairwiseVotes: [],
          pairwiseStats: {
            system: "bradley-terry",
            stats: options.reduce(
              (acc, _, i) => ({
                ...acc,
                [i]: {
                  mu: 0,
                  sigma: 1.0,
                  beta: 0.5,
                  gamma: 0.1,
                  wins: 0,
                  comparisons: 0,
                  timestamp: serverTimestamp(),
                },
              }),
              {}
            ),
          },
        }),
      };

      const pollRef = await addDoc(collection(db, "polls"), pollData);
      router.push(`/polls/${pollRef.id}`);
    } catch (error) {
      console.error("Error creating poll:", error);
      alert("Failed to create poll. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box p="2">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <label htmlFor="title">Poll Title</label>
          <TextField.Root
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="What's your poll about?"
          />
        </div>

        <div>
          <label htmlFor="description">Description</label>
          <TextArea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Provide more details about your poll"
          />
        </div>

        <div>
          <label htmlFor="votingFormat">Voting Format</label>
          <Select.Root
            value={votingFormat}
            onValueChange={(value: VotingFormat) => setVotingFormat(value)}
          >
            <Select.Trigger />
            <Select.Content>
              {Object.entries(VOTING_FORMAT_INFO).map(([value, { label }]) => (
                <Select.Item key={value} value={value}>
                  {label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <Text size="1" color="gray">
            {VOTING_FORMAT_INFO[votingFormat].description}
          </Text>
        </div>

        <Flex direction="column" gap="2" pb="2">
          <label>Options</label>
          <Flex direction="column" gap="4">
            {options.map((option, index) => (
              <Box key={index} className="p-4 border rounded-lg">
                <Flex direction="column" gap="2">
                  <TextField.Root
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
                    >
                      Remove Option
                    </Button>
                  )}
                </Flex>
              </Box>
            ))}

            <Box>
              <Button type="button" onClick={addOption} variant="soft">
                + Add Option
              </Button>
            </Box>
          </Flex>
        </Flex>

        <Box>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating Poll..." : "Create Poll"}
          </Button>
        </Box>
      </form>
    </Box>
  );
}
