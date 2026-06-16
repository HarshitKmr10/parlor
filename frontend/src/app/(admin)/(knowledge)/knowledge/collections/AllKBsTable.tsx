import { Box, Text, Flex, Tooltip, DropdownMenu, Table } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import ProgressCircle from 'components/dashboard/ProgressCircle';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Recommendation } from 'types/dashboard';
import { KBsGroup, KbTicket } from './KbsGroup';
import { useRouter } from 'next/navigation';
import { useGlobalContext } from 'contexts/store';
import { useDashboard } from 'hooks/useDashboard';
import Shimmer from 'components/common/Shimmer/Shimmer';
import { fetchAllDocuments } from 'api/kbAssist';
import usePagination from './usePagination';
import { LanguageFlagsList } from '@/components/common/LanguageFlag';
import CustomTable, { Column } from '@/components/common/CustomTable/CustomTable';
import NoPriorityIcon from '@/components/icons/NoPriorityIcon';
import { KbTranslateButton } from '@/components/knowledgeAssist/KnowledgeAssistTables/TranslateButton';
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
  url?: string;
  content?: string;
  language?: string;
  languages?: string[];
  recommendations?: Recommendation[];
  status: "inserted" | "processed" | "failed";
  error_message?: string;
}

const SortIcon = () => (
  <svg width="13" height="9" viewBox="0 0 13 9" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.8335 8.5L10.1668 6.5L12.5002 8.5" stroke="#1C2024" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.83333 5.83333H0.5M5.83333 8.5H0.5M0.5 0.5H7.5M11.8333 0.5H10.3333M11.8333 3.16667H4.83333M0.5 3.16667H2" stroke="#1C2024" strokeLinecap="round"/>
  </svg>
);

const cellBaseClass = 'relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle';
const dividerSpan = 'absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-[""]';

const SparkleIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ color: '#6366F1' }} // Purple color matching the text
  >
    <path
      d="M9 7.5L12 1.5L15 7.5L21 10.5L15 13.5L12 19.5L9 13.5L3 10.5L9 7.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ErrorIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ color: '#DC2626' }} // Red color for error
  >
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
    <path
      d="M12 8v4m0 4h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ImproveKBButton = ({
  article,
  onRecommendationAction,
}: {
  article: Article;
  onRecommendationAction: (recommendation: Recommendation) => void;
}) => {
  const { t } = useTranslation();
  
  return (
  <Box
    className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
    style={{
      position: 'absolute',
      right: '5px',
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      gap: '4px',
    }}
  >
    <button
      title="Improve KB"
      style={{
        padding: '6px 12px',
        borderRadius: '6px',
        backgroundColor: 'rgba(239, 246, 255, 0.9)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '14px',
        color: '#4F46E5',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontWeight: '500',
      }}
      onClick={(e) => {
        e.stopPropagation();
        const recommendation: Recommendation = {
          id: article.id,
          type: 'refactor' as const,
          title: article.name,
          content: article.content || '',
          kb_data: [
            {
              id: article.id,
              number: article.number,
              name: article.name,
              score: article.score || 0,
              access_url: article.url || '',
            },
          ],
          statistics: {
            score: article.score || 0,
            clarity: article.score || 0,
            correctness: article.score || 0,
            keyword_coverage: article.score || 0,
            engagement: article.score || 0,
          },
          rank: 0,
          related_to_kb_ids: [
            {
              id: article.id,
              title: article.name,
              access_url: article.url || '',
              number: article.number,
            },
          ],
          metadata: {
            doc_and_incident_data: [
              {
                id: article.id,
                name: article.name,
                score: article.score || 0,
                access_url: article.url || '',
              },
            ],
          },
        };

        onRecommendationAction(recommendation);
      }}
      className="hover:bg-[rgba(239,246,255,1)]"
    >
      <SparkleIcon />
      {t('knowledge_assist.improveKB')}
    </button>
  </Box>
  );
};


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

type SortField = 'score' | 'number' | 'name' | 'collection_name' | 'recommendations' | 'languages';
type SortDirection = 'asc' | 'desc';

export function AllKbsTable({ searchText = "", collectionId, language, hasDuplicate, scoreParams }: Props) {
  const { t } = useTranslation();
  const { user } = useGlobalContext();

  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [isLoadingMerge, setIsLoadingMerge] = useState<string | null>(null); // Track loading by article ID
  // Track loading state per article+language: format "articleId-langCode"
  const [isLoadingTranslate, setIsLoadingTranslate] = useState<string | null>(null);

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

    setIsLoading(true);
    fetchAllDocuments(
      user,
      "all",
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
    )
      .then((data) => {
        // Only update state if this request hasn't been cancelled
        if (!currentController.signal.aborted) {
          setArticles(data.data);
          setTotalCount(data.total_count);
        }
      })
      .catch((error) => {
        // Only set error if this request hasn't been cancelled
        if (!currentController.signal.aborted) {
          setError(error);
        }
      })
      .finally(() => {
        // Only update loading state if this request hasn't been cancelled
        if (!currentController.signal.aborted) {
          setIsLoading(false);
        }
      });

    // Cleanup function to cancel request if component unmounts
    return () => {
      currentController.abort();
    };
  }, [user, currentPage, pageSize, searchText, sortField, sortDirection, collectionId, language, hasDuplicate, scoreParams]);

  const filteredArticles = articles;
  const router = useRouter();
  const { setPreviousPath } = useGlobalContext();
  const { handleRecommendationAction, cancelRecommendationAction } = useDashboard();
  
  // Cancel recommendation action when component unmounts
  useEffect(() => {
    return () => {
      cancelRecommendationAction();
    };
  }, [cancelRecommendationAction]);
  
  const handleArticleClick = (article: any) => {
    router.push(`/knowledge/editor/edit-document?id=${article.id}`);
  };


  const handleMergeDocuments = useCallback(async (articleId: string, articleName: string, kbTickets: KbTicket[]) => {
    // Cancel any previous action before starting a new one
    cancelRecommendationAction();
    
    // Clear previous button loading state and set new one
    setIsLoadingMerge(articleId);
    
    try {
      setPreviousPath(window.location.pathname + window.location.search);

      await handleRecommendationAction({
        id: articleId,
        type: 'merge',
        recommendation: `Multiple KB Articles are present related to ${articleName}. Merge them into a single KB Article.`,
        rank: 0,
        related_to_kb_ids: kbTickets.map((kb) => ({
          id: kb.id,
          title: kb.name,
          access_url: kb.access_url,
          number: kb.number,
        })),
        kb_data: kbTickets.map((kb) => ({
          id: kb.id,
          number: kb.number,
          name: kb.name,
          score: kb.score,
          access_url: kb.access_url,
        })),
        metadata: {
          doc_and_incident_data: kbTickets,
        },
      });

    } catch (error: any) {
      // Don't log or show error if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error('Error in merge:', error);
    } finally {
      // Only clear loading state if this button is still the one that's loading
      setIsLoadingMerge((current) => current === articleId ? null : current);
    }
  }, [handleRecommendationAction, setPreviousPath, cancelRecommendationAction]);

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

  const renderShimmerTable = () => (
    <Table.Root variant="surface" className="w-full rounded-sm px-2">
      <Table.Header>
        <Table.Row className="h-[36px] px-[9px] py-[2px]">
          <Table.ColumnHeaderCell className={`w-[4%] ${cellBaseClass} text-center text-xs font-semibold`}>
            <Flex justify="center" align="center">
              <SortIcon />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[12%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.articleNumber')}</Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[25%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.articleName')}</Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.collection')}</Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.duplicateKB')}</Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.availableLanguages')}</Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass} text-xs font-semibold`}>
            <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.translationsSuggested')}</Text>
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: 10 }).map((_, index) => (
          <Table.Row key={index} className="h-[36px]">
            <Table.Cell className={`w-[4%] ${cellBaseClass} text-center`}>
              <Flex justify="center">
                <Shimmer width="16px" height="16px" borderRadius="50%" />
              </Flex>
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[12%] ${cellBaseClass}`}>
              <Shimmer width="80px" height="16px" borderRadius="4px" />
              <span className={dividerSpan} />
            </Table.Cell>
          <Table.Cell className={`w-[25%] ${cellBaseClass}`}>
              <Shimmer width="100%" height="16px" borderRadius="4px" />
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[15%] ${cellBaseClass}`}>
              <Shimmer width="120px" height="16px" borderRadius="4px" />
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[15%] ${cellBaseClass}`}>
              <Shimmer width="60px" height="20px" borderRadius="12px" />
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[15%] ${cellBaseClass}`}>
              <Flex gap="1">
                <Shimmer width="20px" height="14px" borderRadius="2px" />
                <Shimmer width="20px" height="14px" borderRadius="2px" />
                <Shimmer width="20px" height="14px" borderRadius="2px" />
              </Flex>
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[15%] ${cellBaseClass} text-left`}>
              <Shimmer width="100px" height="24px" borderRadius="6px" />
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
          {article.status === "inserted" ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-indigo-600" />
          ) : article.status === "failed" ? (
            <Tooltip content='Processing failed'>
              <span style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}>
                <ErrorIcon />
              </span>
            </Tooltip>
          ) : (
            <Tooltip content={(article.score * 10)?.toString() || '0'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}>
                <ProgressCircle progress={article.score * 10 || 0} size={16} />
              </span>
            </Tooltip>
          )}
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
        <Box className="group" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '22rem' }}>
          <Text
            title={article.name}
            style={{
              cursor: article.status === "inserted" || article.status === "failed" ? 'default' : 'pointer',
              display: 'inline-block',
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: article.status === "failed" ? '#DC2626' : undefined,
            }}
            className={article.status === "inserted" || article.status === "failed" ? '' : 'hover:text-blue-600 hover:underline'}
            onClick={(e) => {
              e.stopPropagation();
              if (article.status !== "inserted" && article.status !== "failed") {
                handleArticleClick(article);
              }
            }}
          >
            {article.name}
          </Text>

          {article.status !== "inserted" && article.status !== "failed" && (
            <ImproveKBButton
              article={article}
              onRecommendationAction={((recommendation) => {
                router.push(`/knowledge/editor/edit-document?id=${recommendation.id}`);
              })}
            />
          )}
        </Box>
      ),
    },
    {
      header: <SortableHeader field="collection_name" label={t('knowledge_assist.collection')} />,
      accessor: 'collection_name',
      width: 'w-[15%]',
      render: (article) => <Text>{article.collection_name}</Text>,
    },
    {
      header: <SortableHeader field="recommendations" label={t('knowledge_assist.duplicateKB')} />,
      accessor: 'duplicate_kbs',
      width: 'w-[15%]',
      render: (article) => (
        <Box 
          display="inline" 
          style={{ display: 'flex', alignItems: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          <Box style={{ position: 'relative' }} className="group">
            {article.recommendations?.some(rec => rec.type === 'merge' && !rec.resolved) ? (
              <KBsGroup
                articleId={article.recommendations.find(rec => rec.type === 'merge' && !rec.resolved)?.id}
                articleName={article.name}
                isMerging={isLoadingMerge === article.id}
                onMergeDocuments={handleMergeDocuments}
                kbTickets={article.recommendations.find(rec => rec.type === 'merge' && !rec.resolved)?.related_to_kb_ids}
              />
            ) : (
              <NoPriorityIcon width={12} height={12} />
            )}
          </Box>
        </Box>
      ),
    },
    {
      header: <SortableHeader field="languages" label={t('knowledge_assist.availableLanguages')} />,
      accessor: 'languages',
      width: 'w-[15%]',
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
      width: 'w-[15%]',
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
            <Flex direction="column" align="center" justify="center" style={{ height: '50vh' }}>
              <img src="/searpa@empty-state-dashboard-grey-2J7JBGUB.svg" alt="No data" width={160} height={160} />
              <Text>{t('knowledge_assist.noArticlesFound')}</Text>
            </Flex>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1}}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <CustomTable
              data={sortedArticles}
              columns={columns}
              isLoading={false}
              rowKey={(article) => article.id}
              onRowClick={(article) => {
                if (article.status !== "inserted" && article.status !== "failed") {
                  handleArticleClick(article);
                }
              }}
              emptyMessage={''}
            />
            {paginationComponent}
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

// removed local TranslateButton in favor of KbTranslateButton
