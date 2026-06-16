import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Box, Flex, Text, Badge, Tooltip } from '@radix-ui/themes';
import { ChevronRight } from 'lucide-react';
import { aiAgentInstance } from 'api/common/axiosInstance';
import InfoIcon from '@/components/icons/InfoIcon';
import DoubleChevronRightIcon from '@/components/icons/DoubleChevronRightIcon';
import { ScoreBreakdownDialog } from '../ScoreBreakdownDialog/ScoreBreakdownDialog';
import TemplateIcon from '@/components/icons/TemplateIcon';
import ChestIconImage from '@/components/icons/ChestIcon.png';

interface ScoreCardProps {
  documentId: string;
  onSeeBreakdown?: () => void;
  showBlurOverlay?: boolean;
  overlayMessage?: string;
  isRestrictedSource?: boolean;
}

interface ScoreData {
  score: number;
  sub_scores: {
    accuracy_clarity: number;
    redundancy: number;
    metadata_relevancy: number;
    structural_consistency: number;
    formatting: number;
    template_compliance: number;
  };
  weights?: {
    accuracy_clarity?: number;
    redundancy?: number;
    metadata_relevancy?: number;
    structural_consistency?: number;
    formatting?: number;
    template_compliance?: number;
  };
  template_name?: string;
}

const getScoreStatus = (score: number): { label: string; color: string } => {
  if (score >= 90) return { label: 'Excellent', color: '#008847' }; // dark green
  if (score >= 70) return { label: 'Good', color: '#B0C54A' }; // orange/gold
  if (score >= 40) return { label: 'Moderate', color: '#FF9254' }; // orange
  return { label: 'Low', color: '#EF4444' }; // red
};

const getScoreColor = (score: number): string => {
  if (score >= 90) return '#008847'; // dark green
  if (score >= 70) return '#B0C54A'; // orange/gold
  if (score >= 40) return '#FF9254'; // orange
  return '#EF4444'; // red
};

const MetricCircle = ({ label, value }: { label: string; value?: number }) => {
  const displayValue = value !== undefined ? Math.round(value) : '--';
  const color = value !== undefined ? getScoreColor(value) : '#D1D5DB';

  return (
    <Flex direction="column" align="center" justify="center" className="h-[65px] w-[70px]" gap="2">
      <Box
        className="flex h-[40px] w-[40px] items-center justify-center rounded-full"
        style={{
          border: `2px solid ${color}`,
        }}
      >
        <Text className="text-sm font-semibold" style={{ color }}>
          {displayValue}
        </Text>
      </Box>
      <Text className="text-xs font-semibold leading-4 text-[#1C2024]">{label}</Text>
    </Flex>
  );
};

export const ScoreCard: React.FC<ScoreCardProps> = ({
  documentId,
  onSeeBreakdown,
  showBlurOverlay = false,
  isRestrictedSource = false,
}) => {
  // overlayMessage={}
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchScores = async () => {
      try {
        setIsLoading(true);
        const response = await aiAgentInstance.get(
          `/api/v1/knowledgeassist/document/${documentId}/scores`,
        );
        setScoreData(response.data);
      } catch (error) {
        console.error('Error fetching document scores:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (documentId) {
      fetchScores();
    }
  }, [documentId]);

  if (isLoading || !scoreData) {
    return (
      <Box className="flex min-h-[200px] items-center justify-center rounded-xl bg-white p-5 shadow-sm">
        <Text>Loading scores...</Text>
      </Box>
    );
  }

  const score = scoreData.score;
  const status = getScoreStatus(score);
  const progressPercentage = Math.min(Math.max(score, 0), 100);
  const templateName = scoreData.template_name?.trim();
  const hasTemplateName = Boolean(templateName);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
    if (onSeeBreakdown) {
      onSeeBreakdown();
    }
  };

  return (
    <Box className="relative px-4 pb-0 pt-3">
      {/* Header */}
      <Flex justify="between" align="center" mb="5" mt="2">
        <Flex align="center" gap="1">
          <Text className="align-middle text-base font-medium leading-5 tracking-normal text-[#1C2024]">
            Content Score
          </Text>
          <Tooltip content="Overall quality score based on multiple metrics">
            <span className="cursor-pointer">
              <InfoIcon width={16} height={16} />
            </span>
          </Tooltip>
        </Flex>
        {!showBlurOverlay && (
          <button
            onClick={handleOpenDialog}
            className="bg-transparent flex cursor-pointer items-center gap-1 border-0 p-0 hover:opacity-80"
          >
            <Text className="text-[11px] font-medium leading-none tracking-normal text-[#014DC5]">
              See Breakdown
            </Text>
            <DoubleChevronRightIcon width={16} height={16} color="#014DC5" />
          </button>
        )}
      </Flex>

      <Flex align="center" dir="row" gap="3">
        <Flex align="center">
          <Box className="flex h-10 w-[116px] items-center rounded bg-[#014DC50D] p-2.5">
            <Text className="text-2xl font-semibold leading-none text-[#5B5BD6]">
              {Math.round(score)}
            </Text>
            <Text className="text-base font-normal leading-none text-[#BBBBBB]">/100</Text>
            <DoubleChevronRightIcon width={16} height={16} color="#014DC5" className="ml-4" />
          </Box>
        </Flex>

        <Flex direction="column" justify="between" align="end" className="h-10 min-w-[8rem] flex-1">
          <Badge
            size="2"
            className="rounded-md px-3 py-1 text-white"
            style={{
              backgroundColor: status.color,
            }}
          >
            {status.label}
          </Badge>
          <Box className="relative h-1 w-full min-w-full overflow-visible rounded bg-[#172B4D14]">
            <Box
              className="absolute left-0 top-0 h-full min-w-[8px] transition-all duration-300 ease-in-out"
              style={{
                width: `${progressPercentage}%`,
                background:
                  'linear-gradient(90deg, #FF6255 0%, #FF9254 26.22%, #FFCE5C 54.62%, #F2ED6F 79.75%, #C5DB5C 94.5%, #008847 109.25%)',
              }}
            />
          </Box>
        </Flex>
      </Flex>

      {/* Detailed Metrics */}
      <Flex justify="between" align="center" mt="4" gap="3" className="px-5 py-1">
        <MetricCircle label="Clarity" value={scoreData.sub_scores.accuracy_clarity} />
        <MetricCircle label="Redundancy" value={scoreData.sub_scores.redundancy} />
        <MetricCircle label="Metadata" value={scoreData.sub_scores.metadata_relevancy} />
        <MetricCircle label="Structure" value={scoreData.sub_scores.structural_consistency} />
        <MetricCircle label="Formatting" value={scoreData.sub_scores.formatting} />
      </Flex>

      {hasTemplateName && (
        <Flex
          direction="row"
          justify="between"
          className="mb-0 mt-6 h-[76px] w-full rounded-lg px-4 py-4"
          style={{
            background: 'linear-gradient(90deg, #E9F2FF 0%, #FCF7DE 100%)',
          }}
        >
          <Flex direction="column">
            <Text className="text-[14px] font-semibold text-[#1C2024]">
              Template : Nearest Match found
            </Text>
            <Text className="text-[14px] font-normal text-[#2C3E5D]">{templateName}</Text>
          </Flex>
          <TemplateIcon width={44} height={44} />
        </Flex>
      )}

      {/* Blur Overlay */}
      {showBlurOverlay && (
        <Box
          className="absolute bottom-24 left-0 right-0 top-10 z-10 flex h-40 items-center justify-center rounded-lg border border-[#DADEEC]"
          style={{
            background:
              'linear-gradient(0deg, rgba(217, 217, 217, 0.06), rgba(217, 217, 217, 0.06)), linear-gradient(180deg, rgba(91, 91, 214, 0) 0%, rgba(91, 91, 214, 0.04) 100%)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Flex
            align="center"
            justify="center"
            direction="column"
            gap="2"
            className={`w-[300px] max-w-[360px] px-1 py-2 ${
              isRestrictedSource ? 'h-auto' : 'h-7'
            }`}
          >
            {isRestrictedSource && (
              <Image src={ChestIconImage} alt="Chest icon" width={82} height={52} />
            )}
            <Text weight="bold" className="text-center text-xs font-normal text-[#374151]">
              {isRestrictedSource
                ? 'Quick heads up — ServiceNow files can’t be saved here. But no worries, your edits will still be in the downloaded version!'
                : 'Apply Changes to see updated scores'}
            </Text>
          </Flex>
        </Box>
      )}

      {/* Score Breakdown Dialog */}
      <ScoreBreakdownDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        scoreData={scoreData}
      />
    </Box>
  );
};

export default ScoreCard;
