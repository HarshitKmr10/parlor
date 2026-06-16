'use client';

import React, { useState, useEffect } from 'react';
import { Flex, Text, Box } from '@radix-ui/themes';
import withAuth from 'components/withAuth';
import KnowledgeBaseTabs from './KnowledgeBaseTabs';
import { ArrowLeftIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { aiAgentInstance, serviceDeskInstance } from 'api/common/axiosInstance';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from 'constants/dashboard';
import FilterDropdown, { FilterState } from '@/components/knowledge/FilterDropdown';

interface FormValues {
  search: string;
}

// forms
import { useForm } from 'react-hook-form';
import SearchBar from 'components/voicevirtualagent/SearchBar';
import useDebounce from 'hooks/useDebounce';

function KnowledgeBaseCollections() {
  const { t } = useTranslation();
  const router = useRouter();
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('allkbs');
  const [ticketFeaturesEnabled, setTicketFeaturesEnabled] = useState(true);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    scoreRanges: [],
    collectionIds: [],
    languages: [],
    hasDuplicate: null,
  });

  // Setup react-hook-form for the search input
  const { register, watch } = useForm<FormValues>({ defaultValues: { search: '' } });
  const searchValue = watch('search');

  const debouncedSearchValue = useDebounce<string>(searchValue, 300);

  // Fetch collections on mount (uses Knowledge Assist collections endpoint with RBAC)
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setIsLoadingCollections(true);
        const response = await serviceDeskInstance.get(API_ENDPOINTS.KNOWLEDGE_ASSIST_COLLECTIONS);
        if (response.status === 200 && response.data.success) {
          setCollections(response.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching collections:', error);
      } finally {
        setIsLoadingCollections(false);
      }
    };
    fetchCollections();
  }, []);

  useEffect(() => {
    const fetchTicketFeatures = async () => {
      try {
        const response = await aiAgentInstance.get('/api/v1/knowledgeassist/ticket_features');
        const enabled = response?.data?.data?.ticket_features_enabled;
        setTicketFeaturesEnabled(enabled !== false);
      } catch (error) {
        // Default to enabled on error (fail open)
        console.error('Error fetching ticket feature access:', error);
        setTicketFeaturesEnabled(true);
      }
    };
    fetchTicketFeatures();
  }, []);

  // Convert selected collection IDs to comma-separated string for API
  const collectionIdString =
    filters.collectionIds?.length > 0 ? filters.collectionIds.join(',') : undefined;

  // Convert languages to comma-separated string
  const languagesString = filters.languages?.length > 0 ? filters.languages.join(',') : undefined;

  // Convert score ranges to API parameters
  // Note: Scores are on a 0-10 scale (0.25, 0.50, 7.5, etc.)
  const getScoreParams = () => {
    if (filters.scoreRanges.length === 0) return {};

    // Map each selected range to min/max values (divide by 10 for 0-10 scale)
    const ranges = filters.scoreRanges.map((label) => {
      switch (label) {
        case '0 - 25':
          return { min: 0, max: 2.5 };
        case '25 - 50':
          return { min: 2.5, max: 5.0 };
        case '50 - 75':
          return { min: 5.0, max: 7.5 };
        case '75 - 90':
          return { min: 7.5, max: 9.0 };
        case '90+':
          return { min: 9.0, max: 10 };
        default:
          return { min: 0, max: 0 };
      }
    });

    // Find the overall min and max from all selected ranges
    const minScore = Math.min(...ranges.map(r => r.min));
    const maxScore = Math.max(...ranges.map(r => r.max));

    const params: Record<string, number> = {};
    if (minScore > 0) {
      params.score_gte = minScore;
    }
    if (maxScore > 0 && maxScore < 10) {
      params.score_lte = maxScore;
    }

    return params;
  };

  // Check if we should show the filter (hide when Create KB tab is active)
  const shouldShowFilter = activeTab !== 'create' && activeTab !== 'deduplicated';

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <Flex direction="column" className="h-full">
      <Flex
        align="center"
        justify="between"
        className="h-14 flex-shrink-0 border-b border-[var(--gray-8)]"
        px="4"
      >
        <Flex align="center" gap="3">
          <ArrowLeftIcon
            className="cursor-pointer"
            onClick={() => router.push('/knowledge/dashboard')}
          />
          <Text size="4" weight="medium">
            {t('knowledge_assist.documentInventory')}
          </Text>
        </Flex>
        <Flex gap="2" align="center">
          {shouldShowFilter && (
            <FilterDropdown
              filters={filters}
              onFiltersChange={setFilters}
              collections={collections}
              isLoadingCollections={isLoadingCollections}
              submenuPosition="left"
              activeTab={activeTab}
            />
          )}
          <Box>
            <SearchBar register={register} placeholder="Search" />
          </Box>
        </Flex>
      </Flex>
      <KnowledgeBaseTabs
        searchText={debouncedSearchValue}
        collectionId={collectionIdString}
        language={languagesString}
        hasDuplicate={filters.hasDuplicate}
        scoreParams={getScoreParams()}
        ticketFeaturesEnabled={ticketFeaturesEnabled}
        onTabChange={handleTabChange}
      />
      <ToastContainer />
    </Flex>
  );
}

export default withAuth(KnowledgeBaseCollections);
