// components/DashboardView.tsx
import React from 'react';
import { Flex, Box } from '@radix-ui/themes';
import { StatsOverview } from 'components/graphs/StatsOverview';
import { CommonIssues } from 'components/graphs/CommonIssues';
import { LowScoringArticles } from 'components/graphs/LowScoringArticles';
import { AIRecommendations } from 'components/graphs/AIRecommendations';
import KBQualityGraph from 'components/graphs/KBQualityGraph';
import { Recommendation } from 'types/dashboard';

interface DashboardViewProps {
  dashboardStats: any[];
  commonIssues: any[];
  lowScoringArticles: any[];
  kbQualityData: any[];
  recommendations: Recommendation[];
  onRecommendationAction: (recommendation: Recommendation) => void;
  onCommonIssueAction: (recommendation: Recommendation) => void;
  isDashboardDataLoading: boolean;
  isCommonIssuesLoading: boolean;
  ticketFeaturesEnabled?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = React.memo(({
  dashboardStats,
  commonIssues,
  lowScoringArticles,
  kbQualityData,
  recommendations,
  onRecommendationAction,
  onCommonIssueAction,
  isDashboardDataLoading,
  isCommonIssuesLoading,
  ticketFeaturesEnabled = true,
}) => (
  <Flex className="flex-grow overflow-hidden bg-[#F1F1FB]">
    <Box className="w-3/4 overflow-y-auto">
      <Box p="4">
        <Flex direction="column" gap="5">
        <StatsOverview stats={dashboardStats} isLoading={isDashboardDataLoading} />
          <Flex gap="4">
            <CommonIssues
              issues={commonIssues}
              onAction={onCommonIssueAction}
              isLoading={isCommonIssuesLoading}
              disabled={!ticketFeaturesEnabled}
            />
            <Box className="w-1/3">
              <LowScoringArticles articles={lowScoringArticles} isLoading={isDashboardDataLoading} />
            </Box>
          </Flex>
          <Flex gap="4">
            <Box className="w-full">
              <KBQualityGraph data={kbQualityData} isLoading={isDashboardDataLoading} />
            </Box>
          </Flex>
        </Flex>
      </Box>
    </Box>
    <Box className="w-1/4 border-l border-[var(--gray-8)]">
      <AIRecommendations
        recommendations={recommendations}
        onAction={onRecommendationAction}
        isLoading={isDashboardDataLoading}
      />
    </Box>
  </Flex>
));

DashboardView.displayName = 'DashboardView';
