import React, { useMemo } from 'react';
import {
  Box, Text, Flex, Button, ScrollArea, Badge, Spinner,
} from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import AISparkle from 'components/icons/AISparkle';
import { Recommendation } from 'types/dashboard';

// Types
type RecommendationType = 'merge' | 'create_new_kb' | 'refactor' | 'outdated' | 'missing_translation';

interface ActionConfig {
  primary: string;
  secondary: string;
  badgeColor: 'iris' | 'gray' | 'pink';
}

// Constants
const getActionConfig = (t: (key: string) => string): Record<RecommendationType, ActionConfig> => ({
  merge: {
    primary: t('knowledge_assist.duplicateArticles'),
    secondary: t('knowledge_assist.mergeAll'),
    badgeColor: 'iris',
  },
  create_new_kb: {
    primary: t('knowledge_assist.fromIncidents'),
    secondary: t('knowledge_assist.createDocument'),
    badgeColor: 'pink',
  },
  refactor: {
    primary: t('knowledge_assist.refactorArticle'),
    secondary: t('knowledge_assist.refactor'),
    badgeColor: 'gray',
  },
  outdated: {
    primary: t('knowledge_assist.outdatedArticle'),
    secondary: t('knowledge_assist.update'),
    badgeColor: 'gray',
  },
  missing_translation: {
    primary: t('knowledge_assist.missingTranslation'),
    secondary: t('knowledge_assist.translate'),
    badgeColor: 'gray',
  },
});

// Components
interface RecommendationCardProps extends Recommendation {
  onAction: (recommendation: Recommendation) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  type,
  onAction,
  ...props
}) => {
  const { t } = useTranslation();
  const config = getActionConfig(t)[type] || {
    primary: type,
    secondary: type,
    badgeColor: 'gray',
  };

  const handleAction = () => {
    onAction({ recommendation, type, ...props });
  };

  return (
    <Box
      className="outline-none border-b border-[var(--gray-8)] bg-[var(--gray-1)] first:mt-0 last:mb-0 hover:bg-[var(--gray-2)] transition-colors"
      p="2"
    >
      <Box p="3">
        <Text size="2" mb="3" className="line-clamp-3">
          {recommendation}
        </Text>
        <Flex justify="between" mt="3" align="center">
          <Badge
            variant="soft"
            size="2"
            color={config.badgeColor}
            className="select-none"
          >
            {config.primary}
          </Badge>

          <Button
            variant="solid"
            size="1"
            onClick={handleAction}
            radius="medium"
            className="min-w-[80px]"
          >
            {config.secondary}
          </Button>
        </Flex>
      </Box>
    </Box>
  );
};

// Main Component
interface AIRecommendationsProps {
  recommendations: Recommendation[];
  onAction: (recommendation: Recommendation) => void;
  className?: string;
  isLoading: boolean;
}

export function AIRecommendations({
  recommendations,
  onAction,
  className = '',
  isLoading,
}: AIRecommendationsProps) {
  const { t } = useTranslation();
  const sortedRecommendations = useMemo(
    () => [...recommendations].sort((a, b) => a.rank - b.rank),
    [recommendations],
  );

  if (isLoading) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        gap="3"
        className="h-full bg-[var(--gray-1)] p-4 text-center"
      >
        <Spinner size="2" />
        <Text size="3" color="gray">
          {t('knowledge_assist.loadingRecommendations')}
        </Text>
      </Flex>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        className="h-full bg-[var(--gray-1)] p-4 text-center"
      >
        <Text size="3" color="gray">
          {t('knowledge_assist.noRecommendationsAvailable')}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      className={`h-full bg-[var(--gray-1)] ${className}`}
    >
      <Box px="5" py="3" className="border-b border-[var(--gray-8)]">
        <Flex align="center" gap="2">
          <AISparkle />
          <Text size="5" weight="medium" color="gray">
            {t('knowledge_assist.aiRecommendations')}
          </Text>
          <Badge variant="soft" size="1">
            {recommendations.length}
          </Badge>
        </Flex>
      </Box>

      <Box className="divide-y divide-[var(--gray-8)] overflow-y-auto">
        {sortedRecommendations.map((rec) => (
          <RecommendationCard key={rec.id} {...rec} onAction={onAction} />
        ))}
      </Box>

      {/* <ScrollArea className="flex-grow">
        <Box className="divide-y divide-[var(--gray-8)]">
          {sortedRecommendations.map((rec) => (
            <RecommendationCard key={rec.id} {...rec} onAction={onAction} />
          ))}
        </Box>
      </ScrollArea> */}
    </Flex>
  );
}

// Memoized version for performance optimization
export const MemoizedAIRecommendations = React.memo(AIRecommendations);
