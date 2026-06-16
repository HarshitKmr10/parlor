import React from 'react';
import Image from 'next/image';
import { Dialog, Flex, Text, Box, Badge, IconButton, Tooltip } from '@radix-ui/themes';
import { X } from 'lucide-react';
import InfoIcon from '@/components/icons/InfoIcon';
import ChartBarIcon from '@/components/icons/ChartBarIcon';
import FormulaIcon from '@/components/icons/FormulaIcon';
import TemplateIcon from '@/components/icons/TemplateIcon';
import FormulaImage from './Formula.jpg';

interface ScoreBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scoreData: {
    score: number;
    sub_scores: {
      accuracy_clarity: number;
      redundancy: number;
      metadata_relevancy: number;
      structural_consistency: number;
      formatting: number;
      template_compliance?: number;
    };
    weights?: {
      accuracy_clarity?: number;
      redundancy?: number;
      metadata_relevancy?: number;
      structural_consistency?: number;
      formatting?: number;
      template_compliance?: number;
    };
  };
}

type ScoreKey =
  | 'accuracy_clarity'
  | 'redundancy'
  | 'metadata_relevancy'
  | 'structural_consistency'
  | 'formatting'
  | 'template_compliance';

const getScoreRating = (score: number): { label: string; color: string } => {
  if (score >= 90) return { label: 'Excellent', color: '#008847' };
  if (score >= 70) return { label: 'Good', color: '#B0C54A' };
  if (score >= 40) return { label: 'Moderate', color: '#CF9F02' };
  return { label: 'Low', color: '#E34935' };
};

const scoringFramework: Array<{
  criteria: string;
  key: ScoreKey;
  defaultWeight: string;
  tooltip: string;
}> = [
  {
    criteria: 'Clarity',
    key: 'accuracy_clarity',
    defaultWeight: '25%',
    tooltip:
      'Measures how easily the content can be read and understood. Includes grammar, sentence flow, choice of words, and logical progression of ideas.',
  },
  {
    criteria: 'Redundancy',
    key: 'redundancy',
    defaultWeight: '10%',
    tooltip:
      'Checks for unnecessary repetition or filler content. A lower score indicates more repeated or redundant information; a higher score means concise, to-the-point writing.',
  },
  {
    criteria: 'Metadata',
    key: 'metadata_relevancy',
    defaultWeight: '15%',
    tooltip:
      "Metadata Relevancy measures how well the document's metadata (ServiceNow category/CI, summary, tags, title) aligns with its content.",
  },
  {
    criteria: 'Structure',
    key: 'structural_consistency',
    defaultWeight: '15%',
    tooltip:
      'Assesses how well the content is organized - headings, subheadings, bullet points, and logical section flow. A high score indicates easy navigation and strong hierarchy.',
  },
  {
    criteria: 'Formatting',
    key: 'formatting',
    defaultWeight: '15%',
    tooltip:
      'Examines visual presentation — consistency of font, spacing, alignment, use of highlights, links, images, and callouts that improve readability and UX.',
  },
];

const aqiRanges = [
  { 
    range: '0-39', 
    rating: 'Low',
    tooltip: 'Hard to read, poorly structured, or visually inconsistent.'
  },
  { 
    range: '40-69', 
    rating: 'Moderate',
    tooltip: 'Understandable but lacking visual balance or metadata completeness.'
  },
  { 
    range: '70-89', 
    rating: 'Good',
    tooltip: 'Clear, concise, and well-structured with minor improvements needed.'
  },
  { 
    range: '90-100', 
    rating: 'Excellent',
    tooltip: 'Highly polished, well-formatted, concise, and UX-friendly.'
  },
];

export const ScoreBreakdownDialog: React.FC<ScoreBreakdownDialogProps> = ({
  open,
  onOpenChange,
  scoreData,
}) => {
  const rating = getScoreRating(scoreData.score);
  const overallScore = Math.round(scoreData.score);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-3xl rounded-xl bg-white p-6">
        {/* Header */}
        <Flex justify="between" align="center" mb="5">
          <Flex align="center" gap="2">
            <ChartBarIcon width={20} height={20} fill="#172B4D" />
            <Dialog.Title className="m-0 text-[20px] font-semibold text-[#172B4D]">
              Content Score
            </Dialog.Title>
          </Flex>
          <Dialog.Close>
            <IconButton variant="ghost" className="cursor-pointer">
              <X color="#2C3E5D" size={20} />
            </IconButton>
          </Dialog.Close>
        </Flex>

        {/* Content Score Section */}
        <Box mb="6" className="rounded-lg border border-[#DCDFE4] p-4">
          <Flex gap="9" className="mb-4 w-full">
            <Flex direction="column" gap="3" className="flex-1">
              <Flex direction="column" gap="2">
                <Flex justify="between" align="center">
                  <Text className="text-[14px] font-semibold text-[#1C2024]">Clarity</Text>
                  <Text className="text-base font-semibold text-[#172B4D]">
                    {Math.round(scoreData.sub_scores.accuracy_clarity)}
                    <span className="text-xs font-normal text-[#BBBBBB]">/100</span>
                  </Text>
                </Flex>
                <Flex justify="between" align="center">
                  <Text className="text-[14px] font-semibold text-[#1C2024]">Redundancy</Text>
                  <Text className="text-base font-semibold text-[#172B4D]">
                    {Math.round(scoreData.sub_scores.redundancy)}
                    <span className="text-xs font-normal text-[#BBBBBB]">/100</span>
                  </Text>
                </Flex>
                <Flex justify="between" align="center">
                  <Text className="text-[14px] font-semibold text-[#1C2024]">Metadata</Text>
                  <Text className="text-base font-semibold text-[#172B4D]">
                    {Math.round(scoreData.sub_scores.metadata_relevancy)}
                    <span className="text-xs font-normal text-[#BBBBBB]">/100</span>
                  </Text>
                </Flex>
                <Flex justify="between" align="center">
                  <Text className="text-[14px] font-semibold text-[#1C2024]">Structure</Text>
                  <Text className="text-base font-semibold text-[#172B4D]">
                    {Math.round(scoreData.sub_scores.structural_consistency)}
                    <span className="text-xs font-normal text-[#BBBBBB]">/100</span>
                  </Text>
                </Flex>
                <Flex justify="between" align="center">
                  <Text className="text-[14px] font-semibold text-[#1C2024]">Formatting</Text>
                  <Text className="text-base font-semibold text-[#172B4D]">
                    {scoreData.sub_scores.formatting
                      ? Math.round(scoreData.sub_scores.formatting)
                      : '--'}
                    <span className="text-xs font-normal text-[#BBBBBB]">/100</span>
                  </Text>
                </Flex>
              </Flex>
              {/* Formula */}

              {/* Individual Scores */}
            </Flex>

            {/* Circular Progress Indicator */}
            <Flex direction="column" align="center" justify="center" gap="3">
              <div className="relative flex h-32 w-32 items-center justify-center">
                {/* Dashed Circle Background */}
                <svg
                  className="absolute h-full w-full -rotate-90"
                  viewBox="0 0 100 100"
                  fill="none"
                >
                  {/* Filled background circle */}
                  <path
                    opacity="0.1"
                    d="M50 100C77.6142 100 100 77.6142 100 50C100 22.3858 77.6142 0 50 0C22.3858 0 0 22.3858 0 50C0 77.6142 22.3858 100 50 100Z"
                    fill={rating.color}
                  />
                  {/* Gray base stroke */}
                  <path
                    d="M50 3C62.4652 3 74.4198 7.95177 83.234 16.766C92.0482 25.5802 97 37.5348 97 50C97 62.4652 92.0482 74.4198 83.234 83.234C74.4198 92.0482 62.4652 97 50 97C37.5348 97 25.5802 92.0482 16.766 83.234C7.95177 74.4198 3 62.4652 3 50C3 37.5348 7.95177 25.5802 16.766 16.766C25.5802 7.95177 37.5348 3 50 3Z"
                    stroke="#DCDFE4"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="295.31 295.31"
                  />
                  {/* Progress stroke */}
                  <path
                    d="M50 3C62.4652 3 74.4198 7.95177 83.234 16.766C92.0482 25.5802 97 37.5348 97 50C97 62.4652 92.0482 74.4198 83.234 83.234C74.4198 92.0482 62.4652 97 50 97C37.5348 97 25.5802 92.0482 16.766 83.234C7.95177 74.4198 3 62.4652 3 50C3 37.5348 7.95177 25.5802 16.766 16.766C25.5802 7.95177 37.5348 3 50 3Z"
                    stroke={rating.color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="295.31 295.31"
                    strokeDashoffset={295.31 - (295.31 * overallScore) / 100}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>

                {/* Score Text */}
                <Text className="text-[28px] font-semibold text-[#172B4D]">{overallScore}</Text>
              </div>

              {/* Badge */}
              <Badge
                className="rounded-md px-4 py-1.5 text-white"
                style={{ backgroundColor: rating.color }}
              >
                {rating.label}
              </Badge>
            </Flex>
          </Flex>
          <Flex
            align="center"
            gap="3"
            className="mt-3 h-[72px] w-full rounded-lg bg-[#F7F8F9] px-5 py-4"
          >
            <div className="flex items-center gap-1  px-2 py-1 text-md text-[#1C2024] ">
              <FormulaIcon width={24} height={24} fill="#2C3E5D" />
              Formula :
            </div>
            <Image
              src={FormulaImage}
              alt="AQI = ∑(Score_i × Weight_i)"
              width={200}
              height={40}
              className="h-auto"
            />
            
          </Flex>
        </Box>

        {/* Template Section */}
       

        {/* Scoring Framework and AQI Range */}
        {/* Scoring Framework */}
        <Flex direction="column" gap="3" className="mb-7 flex-1">
          <Text className="mb-4 text-base font-semibold text-[#2C3E5D]">Scoring Framework</Text>
          <div className="rounded-lg border border-[#DCDFE4] p-5">
            <div className="mb-4 grid grid-cols-2 gap-0">
              <Text className="text-left text-[14px] font-semibold text-[#2C3E5D]">Criteria</Text>
              <Text className="text-right text-[14px] font-semibold text-[#2C3E5D]">Weight</Text>
            </div>
            {scoringFramework.map((item) => {
              const weightValue = scoreData?.weights?.[item.key];
              const weightDisplay =
                typeof weightValue === 'number' ? `${weightValue}%` : item.defaultWeight;
              return (
                <div key={item.criteria} className="mb-4 grid grid-cols-2 gap-0">
                  <Flex align="center" gap="1">
                    <Text className="text-[14px] font-normal text-[#2C3E5D]">
                      {item.criteria}
                    </Text>
                    <Tooltip
                      content={<div style={{ textAlign: 'center' }}>{item.tooltip}</div>}
                      side="top"
                    >
                      <span className="cursor-pointer">
                        <InfoIcon width={18} height={18} />
                      </span>
                    </Tooltip>
                  </Flex>
                  <Text className="text-right text-[14px] font-semibold text-[#2C3E5D]">
                    {weightDisplay}
                  </Text>
                </div>
              );
            })}
          </div>
        </Flex>

        {/* AQI Range */}
        <Flex direction="column" gap="3" className="flex-1">
          <Text className="mb-4 text-base font-semibold text-[#2C3E5D]">AQI Range</Text>
          <div className="rounded-lg border border-[#DCDFE4] p-5">
            <div className="mb-4 grid grid-cols-2 gap-0">
              <Text className="text-left text-[14px] font-semibold text-[#2C3E5D]">AQI Range</Text>
              <Text className="text-right text-[14px] font-semibold text-[#2C3E5D]">Rating</Text>
            </div>
            {aqiRanges.map((item) => (
              <div key={item.range} className="mb-4 grid grid-cols-2 gap-0">
                <Text className="text-left text-[14px] font-semibold  text-[#2C3E5D]">
                  {item.range}
                </Text>
                <Flex align="center" justify="end" gap="1">
                  <Text className="text-[14px] font-normal  text-[#2C3E5D]">{item.rating}</Text>
                  <Tooltip content={<div style={{ textAlign: 'center' }}>{item.tooltip}</div>} side="top">
                    <span className="cursor-pointer">
                      <InfoIcon width={18} height={18} />
                    </span>
                  </Tooltip>
                </Flex>
              </div>
            ))}
          </div>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default ScoreBreakdownDialog;
