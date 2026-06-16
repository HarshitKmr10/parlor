// new-frontend/src/app/(admin)/(knowledge)/knowledge/collections/TranslateTable.tsx

import { Box, Text, Tooltip, Flex, Table } from "@radix-ui/themes";
import ProgressCircle from "components/dashboard/ProgressCircle";
import React, { useEffect, useState, useRef } from "react";
import { Recommendation } from 'types/dashboard';
import { useGlobalContext } from 'contexts/store';
import Spinner from 'components/spinner/spinner';
import Shimmer from 'components/common/Shimmer/Shimmer';
import { useDashboard } from "hooks/useDashboard";
import { fetchAllDocuments } from "api/kbAssist";
import usePagination from "./usePagination";
import { LanguageFlagsList } from "@/components/common/LanguageFlag";
import { useTranslation } from 'react-i18next';
import CustomTable, { Column } from '@/components/common/CustomTable/CustomTable';
import { KbTranslateButton } from '@/components/knowledgeAssist/KnowledgeAssistTables/TranslateButton';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import NoPriorityIcon from '@/components/icons/NoPriorityIcon';
import { AnimatePresence, motion } from 'framer-motion';

interface Article {
  id: string;
  name: string;
  score: number;
  number: string;
  collection_name?: string;
  duplicate_kbs?: string[];
  available_languages?: string[];
  translations_suggested?: string[];
  status?: "inserted" | "processed" | "failed";
  url?: string;
  content?: string;
  language?: string;
  languages?: string[];
  recommendations?: Recommendation[];
}


// KbTranslateButton used below

const SortIcon = () => (
  <svg width="13" height="9" viewBox="0 0 13 9" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.8335 8.5L10.1668 6.5L12.5002 8.5" stroke="#1C2024" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.83333 5.83333H0.5M5.83333 8.5H0.5M0.5 0.5H7.5M11.8333 0.5H10.3333M11.8333 3.16667H4.83333M0.5 3.16667H2" stroke="#1C2024" strokeLinecap="round"/>
  </svg>
);

const getSuggestedLanguages = (article: Article) => {
  const languages = new Set<string>();

  // Check recommendations for missing_translation type
  article.recommendations?.forEach(rec => {
    if (rec.type === 'missing_translation' &&
      rec.metadata?.missing_language &&
      !rec.resolved) { // Only show unresolved recommendations
      languages.add(rec.metadata.missing_language);
    }
  });

  return Array.from(languages);
};

interface Props {
  searchText?: string;
  collectionId?: string;
  language?: string;
  hasDuplicate?: boolean | null;
  scoreParams?: Record<string, number>;
}

type SortField = 'score' | 'number' | 'name';
type SortDirection = 'asc' | 'desc';

export function TranslateTable({ searchText = "", collectionId, language, hasDuplicate, scoreParams }: Props) {
  const { t } = useTranslation();
  const { user } = useGlobalContext();
  const { setPreviousPath } = useGlobalContext();
  const { handleRecommendationAction, cancelRecommendationAction } = useDashboard();
  // Track loading state per article+language: format "articleId-langCode"
  const [isLoadingTranslate, setIsLoadingTranslate] = useState<string | null>(null);
  
  // Cancel recommendation action when component unmounts
  useEffect(() => {
    return () => {
      cancelRecommendationAction();
    };
  }, [cancelRecommendationAction]);
  
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleTranslate = async (article: Article, langCode: string) => {
    const loadingKey = `${article.id}-${langCode}`;
    
    // Cancel any previous action before starting a new one
    cancelRecommendationAction();
    
    // Clear previous button loading state and set new one
    setIsLoadingTranslate(loadingKey);
    
    try {
      setPreviousPath(window.location.pathname + window.location.search);

      const recommendation = article.recommendations?.find((rec) => {
        return rec.metadata?.missing_language === langCode;
      });

      if (recommendation) {
        await handleRecommendationAction({
          ...recommendation,
          related_to_kb_ids: [{
            id: article.id,
            number: article.number,
            title: article.name,
            access_url: article.url,
          }],
        });
      }
    } catch (error: any) {
      // Don't log or show error if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error('Error in translate:', error);
    } finally {
      // Only clear loading state if this button is still the one that's loading
      setIsLoadingTranslate((current) => current === loadingKey ? null : current);
    }
  };

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);


  const { setTotalCount, currentPage, pageSize, paginationComponent } = usePagination({ searchText });
  
  // AbortController ref to cancel previous requests
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchAllDocuments(
          user,
          "missing_translation",
          currentPage,
          pageSize,
          searchText,
          currentController.signal,
          sortField || undefined,
          sortDirection,
          collectionId,
          language,
          hasDuplicate,
          scoreParams
        );
        // Only update state if this request hasn't been cancelled
        if (!currentController.signal.aborted) {
          setArticles(data.data);
          setTotalCount(data.total_count);
        }
      } catch (error) {
        // Only set error if this request hasn't been cancelled
        if (!currentController.signal.aborted) {
          setError(error instanceof Error ? error.message : "An error occurred");
        }
      } finally {
        // Only update loading state if this request hasn't been cancelled
        if (!currentController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function to cancel request if component unmounts
    return () => {
      currentController.abort();
    };
  }, [user, currentPage, pageSize, searchText, sortField, sortDirection, collectionId, language, hasDuplicate, scoreParams]);

  // Filter articles to only show those with suggested translations
  const filteredArticles = articles.filter(article => {
    const suggestedLangs = getSuggestedLanguages(article);
    return suggestedLangs.length > 0 && article.status === "processed";
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, set to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // All sorting is handled by the API - no client-side sorting
  const sortedArticles = filteredArticles;

  if (error) return <Text color="red">{error}</Text>;

  const shimmerCellClass = "relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle";
  const shimmerHeaderClass = "relative py-2.5 px-2 text-xs font-semibold text-[#6B7280]";
  const renderDivider = () => (
    <span className="absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-['']" />
  );

  const renderShimmerTable = () => (
    <Table.Root variant="surface" className="w-full rounded-sm px-2">
      <Table.Header>
        <Table.Row className="h-[36px] px-[9px] py-[2px]">
          <Table.ColumnHeaderCell className={`${shimmerHeaderClass} w-[4%] text-center`}>
            <Flex justify="center" align="center" className="w-full h-full">
              <SortIcon />
            </Flex>
            {renderDivider()}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`${shimmerHeaderClass} w-[12%]`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.articleNumber')}</Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            {renderDivider()}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`${shimmerHeaderClass} w-[25%]`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.articleName')}</Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            {renderDivider()}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`${shimmerHeaderClass} w-[20%]`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.availableLanguages')}</Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            {renderDivider()}
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`${shimmerHeaderClass} w-[20%]`}>
            <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.translationsSuggested')}</Text>
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: 10 }).map((_, index) => (
          <Table.Row key={index} className="h-[36px]">
            <Table.Cell className={`${shimmerCellClass} w-[4%]`}>
              <Flex justify="center">
                <Shimmer width="16px" height="16px" borderRadius="50%" />
              </Flex>
              {renderDivider()}
            </Table.Cell>
            <Table.Cell className={`${shimmerCellClass} w-[12%]`}>
              <Shimmer width="80px" height="16px" borderRadius="4px" />
              {renderDivider()}
            </Table.Cell>
            <Table.Cell className={`${shimmerCellClass} w-[25%]`}>
              <Shimmer width="200px" height="16px" borderRadius="4px" />
              {renderDivider()}
            </Table.Cell>
            <Table.Cell className={`${shimmerCellClass} w-[20%]`}>
              <Flex gap="1">
                <Shimmer width="20px" height="14px" borderRadius="2px" />
                <Shimmer width="20px" height="14px" borderRadius="2px" />
                <Shimmer width="20px" height="14px" borderRadius="2px" />
              </Flex>
              {renderDivider()}
            </Table.Cell>
            <Table.Cell className={`${shimmerCellClass} w-[20%]`}>
              <Shimmer width="120px" height="28px" borderRadius="6px" />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );

  const ArticleHeader = () => (
    <Flex
      justify="center"
      align="center"
      className='cursor-pointer hover:bg-gray-100 transition-colors'
      style={{ 
        width: '100%', 
        height: '100%',
        padding: '8px',
        borderRadius: '4px',
      }}
      onClick={() => handleSort('score')}
    >
      <SortIcon />
    </Flex>
  );

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <Flex
      align="center"
      justify="between"
      className='cursor-pointer hover:bg-gray-100 transition-colors'
      style={{ 
        width: '100%', 
        height: '100%',
        padding: '8px',
        margin: '-8px',
        borderRadius: '4px',
      }}
      onClick={() => handleSort(field)}
    >
      {label.length > 0 && <Text size="1" weight="bold">{label}</Text>}
      <ChevronDownIcon />
    </Flex>
  );

  const columns: Column<Article>[] = [
    {
      header: <ArticleHeader />,
      accessor: 'score',
      width: 'w-[4%]',
      render: (article) => (
        <Box 
          display="inline" 
          style={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => e.stopPropagation()}
          onMouseLeave={(e) => e.stopPropagation()}
        >
          <Tooltip content={(article.score * 10)?.toString() || '0'}>
            <span style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}>
              <ProgressCircle progress={article.score * 10 || 0} size={16} />
            </span>
          </Tooltip>
        </Box>
      ),
    },
    {
      header: <SortableHeader field="number" label={t('knowledge_assist.articleNumber')} />,
      accessor: 'number',
      width: 'w-[12%]',
      render: (article) => (
        article.number ? <Text>{article.number}</Text> : <NoPriorityIcon width={12} height={12} />
      ),
    },
    {
      header: <SortableHeader field="name" label={t('knowledge_assist.articleName')} />,
      accessor: 'name',
      width: 'w-[25%]',
      render: (article) => (
        <Box className="group" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '32rem' }}>
        <Text
          title={article.name}
          style={{
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          {article.name}
        </Text>
        </Box>
      ),
    },
    {
      header: <Text size="2" weight="medium">{t('knowledge_assist.availableLanguages')}</Text>,
      accessor: 'languages',
      width: 'w-[20%]',
      align: 'left',
      render: (article) => (
        <Box style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', minHeight: '20px' }}>
          <LanguageFlagsList
            languages={article.languages || []}
            size="md"
            maxDisplay={5}
            showCount={true}
          />
        </Box>
      ),
    },
    {
      header: <Text size="1" weight="bold">{t('knowledge_assist.translationsSuggested')}</Text>,
      accessor: 'translations_suggested',
      width: 'w-[20%]',
      hideDivider: true,
      render: (article) => {
        const suggestedLangs = getSuggestedLanguages(article);
        const isArticleLoading = suggestedLangs.some(lang => isLoadingTranslate === `${article.id}-${lang}`);
        
        return (
          <Box 
            display="inline" 
            style={{ display: 'flex', alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <KbTranslateButton
              languages={suggestedLangs}
              label={t('knowledge_assist.translateTo')}
              onSelect={(langCode) => handleTranslate(article, langCode)}
              isLoading={isArticleLoading}
              loadingKey={isLoadingTranslate}
              articleId={article.id}
            />
          </Box>
        );
      },
    },
  ];

  const isEmpty = sortedArticles.length === 0;

  return (
    <Box style={{ minHeight: '50vh' }}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="shimmer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderShimmerTable()}
          </motion.div>
        ) : isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Flex direction='column' align="center" justify="center" style={{ height: '50vh' }}>
              <img src="/searpa@empty-state-dashboard-grey-2J7JBGUB.svg" alt="No data" width={160} height={160} />
              <Text>{t('knowledge_assist.noArticlesFound')}</Text>
            </Flex>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <CustomTable
              data={sortedArticles}
              columns={columns}
              isLoading={false}
              rowKey={(article) => article.id}
              emptyMessage={''}
              cursorPointer={false}
            />
            {paginationComponent}
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}