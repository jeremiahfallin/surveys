"use client";
import {
  Box,
  Flex,
  Text,
  Select,
  Radio,
  Checkbox,
  Button,
  RadioCards,
  Heading,
} from "@radix-ui/themes";
import { Poll } from "@/types/poll";
import { getOrdinalSuffix } from "@/utils/voting";
import { PollImage } from "./PollImage";

interface SingleChoiceProps {
  options: Poll["options"];
  selectedOption: number;
  setSelectedOption: (value: number) => void;
  hasVoted: boolean;
}

function SingleChoice({
  options,
  selectedOption,
  setSelectedOption,
  hasVoted,
}: SingleChoiceProps) {
  return (
    <Flex direction="column" gap="3">
      {options.map((option, index) => (
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
}

interface RankedChoiceProps {
  options: Poll["options"];
  rankings: number[];
  setRankings: (value: number[]) => void;
  hasVoted: boolean;
}

function RankedChoice({
  options,
  rankings,
  setRankings,
  hasVoted,
}: RankedChoiceProps) {
  return (
    <Flex direction="column" gap="3">
      {options.map((option, index) => (
        <Box key={option.text}>
          <Flex justify="between" align="center">
            <Text>{option.text}</Text>
            <Select.Root
              value={rankings[index].toString()}
              onValueChange={(value) => {
                const newRank = parseInt(value);
                const newRankings = [...rankings];
                const existingIndex = rankings.findIndex((r) => r === newRank);
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
                {options.map((_, i) => (
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
}

interface PluralityChoiceProps {
  options: Poll["options"];
  selectedOptions: number[];
  setSelectedOptions: (value: number[]) => void;
  hasVoted: boolean;
}

function PluralityChoice({
  options,
  selectedOptions,
  setSelectedOptions,
  hasVoted,
}: PluralityChoiceProps) {
  return (
    <Flex direction="column" gap="3">
      {options.map((option, index) => (
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
}

interface PairwiseChoiceProps {
  options: Poll["options"];
  currentComparison: [number, number] | null;
  selectedOption: number;
  setSelectedOption: (value: number) => void;
  isVoting: boolean;
}

function PairwiseChoice({
  options,
  currentComparison,
  selectedOption,
  setSelectedOption,
  isVoting,
}: PairwiseChoiceProps) {
  if (!currentComparison) {
    return (
      <Flex direction="column" gap="3">
        <Text>No more comparisons to make.</Text>
      </Flex>
    );
  }

  const [optionA, optionB] = currentComparison;
  return (
    <Flex direction="column" gap="3">
      <Text>Which option do you prefer?</Text>
      <RadioCards.Root
        size="1"
        disabled={isVoting}
        value={selectedOption.toString()}
        onValueChange={(value) => setSelectedOption(Number(value))}
      >
        <Flex justify="center" gap="4">
          <RadioCards.Item
            dir="column"
            value={optionA.toString()}
            disabled={isVoting}
          >
            <Flex direction="column" gap="2" align="center">
              <Heading>{options[optionA].text}</Heading>
              <PollImage
                imageUrl={options[optionA].imageUrl}
                alt={options[optionA].text}
              />
            </Flex>
          </RadioCards.Item>
          <RadioCards.Item value={optionB.toString()} disabled={isVoting}>
            <Flex direction="column" gap="2" align="center">
              <Heading>{options[optionB].text}</Heading>
              <PollImage
                imageUrl={options[optionB].imageUrl}
                alt={options[optionB].text}
              />
            </Flex>
          </RadioCards.Item>
        </Flex>
      </RadioCards.Root>
    </Flex>
  );
}

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
          <SingleChoice
            options={poll.options}
            selectedOption={selectedOption}
            setSelectedOption={setSelectedOption}
            hasVoted={hasVoted}
          />
        );

      case "ranked":
        return (
          <RankedChoice
            options={poll.options}
            rankings={rankings}
            setRankings={setRankings}
            hasVoted={hasVoted}
          />
        );

      case "plurality":
        return (
          <PluralityChoice
            options={poll.options}
            selectedOptions={selectedOptions}
            setSelectedOptions={setSelectedOptions}
            hasVoted={hasVoted}
          />
        );

      case "pairwise":
        return (
          <PairwiseChoice
            options={poll.options}
            currentComparison={currentComparison}
            selectedOption={selectedOption}
            setSelectedOption={setSelectedOption}
            isVoting={isVoting}
          />
        );
    }
  };

  const isVoteValid = () => {
    switch (poll.votingFormat) {
      case "single":
        return selectedOption !== -1;
      case "ranked":
        // Check if all options have unique rankings
        const uniqueRankings = new Set(rankings);
        return uniqueRankings.size === poll.options.length;
      case "plurality":
        return selectedOptions.length > 0;
      case "pairwise":
        return selectedOption !== -1;
      default:
        return false;
    }
  };

  return (
    <Box>
      {renderVotingInterface()}
      {(!hasVoted || poll.votingFormat !== "single") && (
        <Box mt="4">
          <Button onClick={onVote} disabled={isVoting || !isVoteValid()}>
            {isVoting ? "Submitting..." : "Submit Vote"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
