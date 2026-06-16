import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Flex,
  Text,
  Button,
  Badge,
  Select,
  IconButton,
} from '@radix-ui/themes';
import AISparkle from 'components/icons/AISparkle';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SimilarDocumentsTable from './SimilarDocumentsTable';
import SuccessDialog from './SuccessDialog';
import EditorPanel from './EditorPanel';
import clsx from 'clsx';
import { useDashboard } from 'hooks/useDashboard';
import ComparisonSummary from '../common/ComparisonSummary';
interface MergeViewProps {
  isLoadingForMerge: boolean;
  showSuccessDialogForMerge: boolean;
  setShowSuccessDialogForMerge: (open: boolean) => void;
  isEditingForMerge: boolean;
  setIsEditingForMerge: (open: boolean) => void;
  enabledCompareForMerge: boolean;
}

const MergeView: React.FC<MergeViewProps> = ({
  isLoadingForMerge,
  showSuccessDialogForMerge,
  setShowSuccessDialogForMerge,
  isEditingForMerge,
  setIsEditingForMerge,
  enabledCompareForMerge,
}) => {
  const { t } = useTranslation();
  const { selectedRecommendation: recommendation, setSelectedRecommendation } = useDashboard();

  const [currentKbIndex, setCurrentKbIndex] = useState(0);

  const sortedArticles = useMemo(
    () => recommendation?.kb_data ? [...recommendation.kb_data].sort((a, b) => b.score - a.score) : [],
    [recommendation?.kb_data],
  );

  const openArticle = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener noreferrer');
  }, []);

  const handleContentChange = useCallback((newContent: string) => {
    if (recommendation) {
      setSelectedRecommendation({
        ...recommendation,
        content: newContent
      });
    }
    setIsEditingForMerge(true);
  }, [recommendation, setSelectedRecommendation]);

  const handlePrevKb = useCallback(() => {
    setCurrentKbIndex((prev) =>
      (prev > 0 ? prev - 1 : sortedArticles.length - 1));
  }, [sortedArticles.length]);

  const handleNextKb = useCallback(() => {
    setCurrentKbIndex((prev) =>
      (prev < sortedArticles.length - 1 ? prev + 1 : 0));
  }, [sortedArticles.length]);

  const currentKbNumber = useMemo(
    () => sortedArticles[currentKbIndex]?.id || '',
    [currentKbIndex, sortedArticles],
  );
  const currentKbUrl = useMemo(
    () => sortedArticles[currentKbIndex]?.access_url || '',
    [currentKbIndex, sortedArticles],
  );

  return (
    <Flex className="p-4 flex-1 min-h-0">
      <Flex direction="row" gap="4" className="flex-1">
        {/* Left Panel - Similar Documents */}
        <Flex direction="column" className={clsx(enabledCompareForMerge ? 'w-1/2' : 'w-3/5', 'flex-1 min-h-0')}>
          <Flex justify="between" p="2">
            <Flex align="center" gap="2">
              <AISparkle />
              <Text size="5" weight="bold">
                {t('knowledge_assist.aiRecommendedKB')}
              </Text>
              {isEditingForMerge && (
                <Badge size="1" color="orange" variant="soft">
                  {t('knowledge_assist.editing')}
                </Badge>
              )}
            </Flex>
            <Button
              variant="soft"
              disabled={isLoadingForMerge}
              onClick={() => setIsEditingForMerge(!isEditingForMerge)}
            >
              {isEditingForMerge ? t('knowledge_assist.preview') : t('knowledge_assist.edit')}
            </Button>
          </Flex>
          <EditorPanel
            content={recommendation?.content || ''}
            onChange={handleContentChange}
            disabled={isLoadingForMerge || !isEditingForMerge}
          />
        </Flex>

        {/* Right Panel - AI Recommended KB */}

        <Flex direction="column" className={`${enabledCompareForMerge ? 'w-1/2' : 'w-2/5'} overflow-y-auto pb-10`}>
          {enabledCompareForMerge ? (
            <>
              <Flex justify="between" p="2">
                <Flex align="center" gap="2">
                  <Text size="5" weight="bold">
                    {t('knowledge_assist.oldKB')}
                  </Text>
                  <Badge size="1" color="gray" variant="outline">
                    {t('knowledge_assist.viewOnly')}
                  </Badge>
                </Flex>
                <Flex align="center" gap="2">
                  <IconButton size="2" variant="outline" onClick={handlePrevKb}>
                    <ChevronLeft className="h-4 w-4" />
                  </IconButton>
                  <Select.Root
                    value={currentKbNumber}
                    onValueChange={(value) => {
                      const index = sortedArticles.findIndex(
                        (article) => article.id === value,
                      );
                      if (index !== -1) setCurrentKbIndex(index);
                    }}
                  >
                    <Select.Trigger className="w-44 min-w-44 max-w-44" />
                    <Select.Content position="popper" >
                      {sortedArticles.map((article, index) => (
                        <Select.Item
                          key={index}
                          value={article.id}
                          className="w-full max-w-80 truncate"
                        >
                          {article.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                  <IconButton size="2" variant="outline" onClick={handleNextKb}>
                    <ChevronRight className="h-4 w-4" />
                  </IconButton>
                </Flex>
              </Flex>
              {/* <DocumentDisplay url={currentKbUrl} /> */}
              <EditorPanel
                content={sortedArticles[currentKbIndex].content}
                key={currentKbIndex}
                onChange={() => { }}
                disabled={true}
              />
            </>
          ) : (
            <Flex direction="column" gap="4">
              {/* Comparison Summary */}
              {recommendation?.comparison_summary && (
                <ComparisonSummary summary={recommendation.comparison_summary} />
              )}

              {/* Similar Documents */}
              <Flex direction="column">
                <Flex align="center" gap="2" mb="2" p="2">
                  <Text size="5" weight="bold">
                    {t('knowledge_assist.similarDocuments')}
                  </Text>
                  <Badge variant="soft" size="1">
                    {sortedArticles.length}
                  </Badge>
                </Flex>
                <SimilarDocumentsTable
                  articles={sortedArticles}
                  onArticleClick={openArticle}
                />
              </Flex>
            </Flex>
          )}
        </Flex>
      </Flex>

      <SuccessDialog
        open={showSuccessDialogForMerge}
        onOpenChange={setShowSuccessDialogForMerge}
        onClose={() => {
          setShowSuccessDialogForMerge(false);
          // onSetView(VIEWS.DASHBOARD);
        }}
      />
    </Flex>
  );
};

export default React.memo(MergeView);
