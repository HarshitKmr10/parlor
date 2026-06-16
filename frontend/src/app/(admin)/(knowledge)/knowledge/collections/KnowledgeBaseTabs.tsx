import React, { useState, useEffect } from 'react';
import { Box, Tabs } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useRouter } from 'next/navigation';
import { DeduplicatedTable } from './DeduplicatedTable';
import { TranslateTable } from './TranslateTable';
import { AllKbsTable } from './AllKBsTable';
import { CreateKB } from './CreateKBTable';
import { LowScoringTable } from './LowScoringTable';


interface Props {
  searchText: string;
  collectionId?: string;
  language?: string;
  hasDuplicate?: boolean | null;
  scoreParams?: Record<string, number>;
  ticketFeaturesEnabled?: boolean;
  onTabChange?: (tab: string) => void;
}


function KnowledgeBaseTabs({ searchText, collectionId, language, hasDuplicate, scoreParams, ticketFeaturesEnabled = true, onTabChange }: Props) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams.get('tab');

  const [selectedTab, setSelectedTabState] = useState(tabFromUrl || 'allkbs');
  
  const setSelectedTab = (tab: string) => {
    setSelectedTabState(tab);
    const newSearchParams = new URLSearchParams();
    newSearchParams.set('tab', tab);
    router.replace(`?${newSearchParams.toString()}`);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  useEffect(() => {
    const uploadCount = searchParams.get('uploadCount');
    if (uploadCount) {
      // toast.success(
      //   `Successfully uploaded ${uploadCount} file${parseInt(uploadCount) > 1 ? 's' : ''}!`,
      // );

      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete('uploadCount');
      router.replace(`?${newSearchParams.toString()}`);
    }
  }, [searchParams, router]);

  // Sync selectedTab with URL param when URL changes externally
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== selectedTab) {
      setSelectedTabState(tabFromUrl);
      if (onTabChange) {
        onTabChange(tabFromUrl);
      }
    }
  }, [tabFromUrl, selectedTab, onTabChange]);

  useEffect(() => {
    if (!ticketFeaturesEnabled && selectedTab === 'create') {
      setSelectedTab('allkbs');
    }
  }, [ticketFeaturesEnabled, selectedTab]);

  // Notify parent of initial tab
  useEffect(() => {
    if (onTabChange) {
      onTabChange(selectedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'allkbs':
        return (
          <AllKbsTable
            searchText={searchText}
            collectionId={collectionId}
            language={language}
            hasDuplicate={hasDuplicate}
            scoreParams={scoreParams}
          />
        );
      case 'lowscoring':
        return (
          <LowScoringTable
            searchText={searchText}
            collectionId={collectionId}
            language={language}
            hasDuplicate={hasDuplicate}
            scoreParams={scoreParams}
          />
        );
      case 'deduplicated':
        return (
          <DeduplicatedTable
            searchText={searchText}
            collectionId={collectionId}
            language={language}
            hasDuplicate={hasDuplicate}
            scoreParams={scoreParams}
          />
        );
      case 'translated':
        return (
          <TranslateTable
            searchText={searchText}
            collectionId={collectionId}
            language={language}
            hasDuplicate={hasDuplicate}
            scoreParams={scoreParams}
          />
        );
      case 'create':
        if (!ticketFeaturesEnabled) {
          return null;
        }
        return <CreateKB searchText={searchText} collectionId={collectionId} />;
      default:
        return (
          <AllKbsTable
            searchText={searchText}
            collectionId={collectionId}
            language={language}
            hasDuplicate={hasDuplicate}
            scoreParams={scoreParams}
          />
        );
    }
  };

  return (
    <>
      <Tabs.Root
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List className="shrink-0 border-b border-gray-200 bg-white">
          <Tabs.Trigger value="allkbs">{t('knowledge_assist.allDocuments')}</Tabs.Trigger>
          <Tabs.Trigger value="lowscoring">{t('knowledge_assist.lowScoringDocuments')}</Tabs.Trigger>
          <Tabs.Trigger value="deduplicated">{t('knowledge_assist.duplicateDocuments')}</Tabs.Trigger>
          <Tabs.Trigger value="translated">{t('knowledge_assist.translateDocuments')}</Tabs.Trigger>
          {ticketFeaturesEnabled ? (
            <Tabs.Trigger value="create">{t('knowledge_assist.createDocument')}</Tabs.Trigger>
          ) : null}
        </Tabs.List>

        <Box className="min-h-0 overflow-auto" mb="15">
          {renderTabContent()}
        </Box>
      </Tabs.Root>
    </>
  );
}

export default KnowledgeBaseTabs;
