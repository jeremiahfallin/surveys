"use client";
import {
  Box,
  Flex,
  Text,
  Select,
  Radio,
  Checkbox,
  Button,
} from "@radix-ui/themes";
import { Poll } from "@/types/poll";
import { getOrdinalSuffix } from "@/utils/voting";
import { PollImage } from "./PollImage";

interface VotingInterfaceProps {
  poll: Poll;
  selectedOption: number;
  setSelectedOption: (value: number) => void;
  selectedOptions: number[];
  setSelectedOptions: (value: number[]) => void;
  rankings: number[];
  setRankings: (value: number[]) => void;
  currentComparison: [number, number] | null;
  hasVoted: boolean;
  onVote: () => void;
  isVoting: boolean;
}

export function VotingInterface({
  poll,
  selectedOption,
  setSelectedOption,
  selectedOptions,
  setSelectedOptions,
  rankings,
  setRankings,
  currentComparison,
  hasVoted,
  onVote,
  isVoting,
}: VotingInterfaceProps) {
  const renderVotingInterface = () => {
    switch (poll.votingFormat) {
      case "single":
        return (
          <Flex direction="column" gap="3">
            {poll.options.map((option, index) => (
              <Box key={index}>
                <Flex gap="2" align="center">
                  <Radio
                    name="poll-option"
                    checked={selectedOption === index}
                    onChange={() => setSelectedOption(index)}
                    disabled={hasVoted}
                    value={index.toString()}
                  />
                  <Text>{option.text}</Text>
                </Flex>
              </Box>
            ))}
          </Flex>
        );

      case "ranked":
        return (
          <Flex direction="column" gap="3">
            {poll.options.map((option, index) => (
              <Box key={option.text}>
                <Flex justify="between" align="center">
                  <Text>{option.text}</Text>
                  <Select.Root
                    value={rankings[index].toString()}
                    onValueChange={(value) => {
                      const newRank = parseInt(value);
                      const newRankings = [...rankings];
                      const existingIndex = rankings.findIndex(
                        (r) => r === newRank
                      );
                      if (existingIndex !== -1 && existingIndex !== index) {
                        newRankings[existingIndex] = rankings[index];
                      }
                      newRankings[index] = newRank;
                      setRankings(newRankings);
                    }}
                    disabled={hasVoted}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      {poll.options.map((_, i) => (
                        <Select.Item key={i} value={i.toString()}>
                          {`${i + 1}${getOrdinalSuffix(i + 1)} Choice`}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
              </Box>
            ))}
          </Flex>
        );

      case "plurality":
        return (
          <Flex direction="column" gap="3">
            {poll.options.map((option, index) => (
              <Box key={index}>
                <Flex gap="2" align="center">
                  <Checkbox
                    checked={selectedOptions.includes(index)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedOptions([...selectedOptions, index]);
                      } else {
                        setSelectedOptions(
                          selectedOptions.filter((i) => i !== index)
                        );
                      }
                    }}
                    disabled={hasVoted}
                  />
                  <Text>{option.text}</Text>
                </Flex>
              </Box>
            ))}
          </Flex>
        );

      case "pairwise":
        if (!currentComparison)
          return (
            <Flex direction="column" gap="3">
              <Text>No more comparisons to make.</Text>
            </Flex>
          );
        const [optionA, optionB] = currentComparison;
        return (
          <Flex direction="column" gap="3">
            <Text>Which option do you prefer?</Text>
            <Flex gap="4" justify="center">
              <Flex direction="column" gap="2">
                <Button
                  onClick={() => setSelectedOption(optionA)}
                  variant={selectedOption === optionA ? "solid" : "soft"}
                  disabled={hasVoted}
                >
                  {poll.options[optionA].text}
                </Button>
                <PollImage
                  imageUrl={poll.options[optionA].imageUrl}
                  alt={poll.options[optionA].text}
                />
              </Flex>
              <Flex direction="column" gap="2">
                <Button
                  onClick={() => setSelectedOption(optionB)}
                  variant={selectedOption === optionB ? "solid" : "soft"}
                  disabled={hasVoted}
                >
                  {poll.options[optionB].text}
                </Button>
                <PollImage
                  imageUrl={poll.options[optionB].imageUrl}
                  alt={poll.options[optionB].text}
                />
              </Flex>
            </Flex>
          </Flex>
        );
    }
  };

  return (
    <Box>
      {renderVotingInterface()}
      {(!hasVoted || poll.votingFormat !== "single") && (
        <Box mt="4">
          <Button onClick={onVote} disabled={isVoting}>
            {isVoting ? "Submitting..." : "Submit Vote"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
