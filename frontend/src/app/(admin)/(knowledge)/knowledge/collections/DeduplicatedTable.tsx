import { Box, Text, Badge, Tooltip, Flex, Table } from '@radix-ui/themes';
import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import Spinner from 'components/spinner/spinner';
import Shimmer from 'components/common/Shimmer/Shimmer';
import { Loader2 } from 'lucide-react';
import { KBsGroup } from './KbsGroup';
import { useRouter } from 'next/navigation';
import { useDashboard } from 'hooks/useDashboard';
import { useGlobalContext } from 'contexts/store';
import { fetchRecommendations } from 'api/kbAssist';
import usePagination from './usePagination';
import CustomTable, { Column } from '@/components/common/CustomTable/CustomTable';
import { AnimatePresence, motion } from 'framer-motion';

interface DocAndIncidentData {
  access_url: string;
  category: string;
  id: string;
  name: string;
  score: number;
}

interface Article {
  id: string;
  metadata: {
    doc_and_incident_data: DocAndIncidentData[];
  };
  rank: number;
  recommendation: string;
  type: string;
  collection_name?: string;
  related_to_kb_ids: {
    id: string;
    title: string;
    access_url: string;
    number: string;
    collection_name?: string;
  }[];
}

const truncateName = (name: string | undefined | null, maxLength = 30) => {
  if (!name) return 'Untitled';
  if (name?.length <= maxLength) return name || '';
  return `${name?.slice(0, maxLength)}...`;
};

const SortIcon = () => (
  <svg width="13" height="9" viewBox="0 0 13 9" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.8335 8.5L10.1668 6.5L12.5002 8.5" stroke="#1C2024" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.83333 5.83333H0.5M5.83333 8.5H0.5M0.5 0.5H7.5M11.8333 0.5H10.3333M11.8333 3.16667H4.83333M0.5 3.16667H2" stroke="#1C2024" strokeLinecap="round"/>
  </svg>
);

const SparkleIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ color: '#6366F1' }}
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

interface Props {
  searchText?: string;
  collectionId?: string;
  language?: string;
  hasDuplicate?: boolean | null;
  scoreParams?: Record<string, number>;
}

type SortField = 'related_to_kb_ids';
type SortDirection = 'asc' | 'desc';

export function DeduplicatedTable({ searchText = "", collectionId, language, hasDuplicate, scoreParams }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useGlobalContext();
  const [isButtonLoading, setIsButtonLoading] = useState<string | null>(null);
  const { handleRecommendationAction, cancelRecommendationAction } = useDashboard();
  const { setPreviousPath } = useGlobalContext();
  
  // Cancel recommendation action when component unmounts
  useEffect(() => {
    return () => {
      cancelRecommendationAction();
    };
  }, [cancelRecommendationAction]);

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');


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

    // Map frontend sort field to backend sort field
    sortField;

    setIsLoading(true);
    fetchRecommendations(
      "merge", 
      user, 
      currentPage, 
      pageSize, 
      searchText, 
      currentController.signal,
      sortField || undefined,
      sortDirection
    )
      .then((data) => {
        // Only update state if this request hasn't been cancelled
        if (!currentController.signal.aborted) {
          setArticles(data.data as any);
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
  }, [user, currentPage, pageSize, searchText, sortField, sortDirection]);


  const handleMergeClick = async (article: Article) => {
    // Cancel any previous action before starting a new one
    cancelRecommendationAction();
    
    // Clear previous button loading state and set new one
    setIsButtonLoading(article.id);
    
    try {
      setPreviousPath(window.location.pathname + window.location.search);

      await handleRecommendationAction({
        id: article.id,
        type: 'merge',
        related_to_kb_ids: article.related_to_kb_ids,
        metadata: article.metadata,
      });

    } catch (error: any) {
      // Don't log or show error if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error('Error in merge:', error);
    } finally {
      // Only clear loading state if this button is still the one that's loading
      setIsButtonLoading((current) => current === article.id ? null : current);
    }
  };

  const handleCopy = (article: Article) => {
    const text = article?.related_to_kb_ids?.map((relatedDoc) => relatedDoc.title)?.join(', ');
    navigator.clipboard.writeText(text).catch(console.error);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, set to descending by default
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (error) return <Text color="red">{error}</Text>;

  const renderShimmerTable = () => (
    <Table.Root variant="surface" className="w-full rounded-sm px-2">
      <Table.Header>
        <Table.Row className="h-[36px] px-[9px] py-[2px]">
          <Table.ColumnHeaderCell className="relative py-2.5 px-2 text-xs font-semibold text-[#1C2024] align-middle w-[35%]">
            <Flex align="center" justify="between" className="ml-1">
              <Text size="1" weight="bold" className="text-neutral-11">
                {t('knowledge_assist.documentNames')}
              </Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className="absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-['']" />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className="relative py-2.5 px-2 text-xs font-semibold text-[#1C2024] align-middle w-[25%]">
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">
                {t('knowledge_assist.duplicateKBs')}
              </Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className="absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-['']" />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className="relative py-2.5 px-2 text-xs font-semibold text-[#1C2024] align-middle w-[20%]">
            <Text size="1" weight="bold" className="text-neutral-11">
              {t('knowledge_assist.collectionName', 'Collection Name')}
            </Text>
            <span className="absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-['']" />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className="relative py-2.5 px-2 text-xs font-semibold text-[#1C2024] align-middle w-[20%]">
            <Text size="1" weight="bold" className="text-neutral-11">
              {t('knowledge_assist.actions')}
            </Text>
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: 10 }).map((_, index) => (
          <Table.Row key={index} className="h-[36px]">
            <Table.Cell className="relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle w-[35%]">
              <Shimmer width="80%" height="16px" borderRadius="4px" />
              <span className="absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-['']" />
            </Table.Cell>
            <Table.Cell className="relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle w-[25%]">
              <Shimmer width="60%" height="24px" borderRadius="12px" />
              <span className="absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-['']" />
            </Table.Cell>
            <Table.Cell className="relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle w-[20%]">
              <Shimmer width="70%" height="16px" borderRadius="4px" />
              <span className="absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-['']" />
            </Table.Cell>
            <Table.Cell className="relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle w-[20%]">
              <Shimmer width="50%" height="24px" borderRadius="6px" />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );

  const SortableHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <Flex
      align="center"
      justify="between"
      className={`cursor-pointer hover:bg-gray-100 transition-colors ${className || ''}`}
      style={{ 
        width: '100%', 
        height: '100%',
        padding: '8px',
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
      header: <Text size="1" weight="bold" className="ml-1">{t('knowledge_assist.documentNames')}</Text>,
      accessor: 'id',
      width: 'w-[35%]',
      render: (article) => (
        <Text
          onCopy={() => handleCopy(article)}
          className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ml-3 max-w-[40rem]"
        >
          {article.related_to_kb_ids.map((relatedDoc) => truncateName(relatedDoc.title))?.join(', ')}
        </Text>
      ),
    },
    {
      header: <SortableHeader field="related_to_kb_ids" label={t('knowledge_assist.duplicateKBs')} />,
      accessor: 'related_to_kb_ids',
      width: 'w-[25%]',
      render: (article) => (
        <Flex align="center" display="inline-flex">
          <KBsGroup kbTickets={article.related_to_kb_ids} />
        </Flex>
      ),
    },
    {
      header: <Text size="1" weight="bold">{t('knowledge_assist.collectionName', 'Collection Name')}</Text>,
      accessor: 'collection_name',
      width: 'w-[20%]',
      render: (article) => (
        <Text className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ml-3">
          {article.collection_name || '-'}
        </Text>
      ),
    },
    {
      header: <Text size="1" weight="bold">{t('knowledge_assist.actions')}</Text>,
      accessor: 'id',
      width: 'w-[20%]',
      hideDivider: true,
      render: (article) => (
        <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Tooltip content={article.recommendation}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMergeClick(article);
              }}
              disabled={isButtonLoading === article.id}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent-9)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: 'white',
                border: 'none',
                cursor: isButtonLoading === article.id ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                opacity: isButtonLoading === article.id ? 0.6 : 1,
              }}
              className={isButtonLoading === article.id ? '' : 'hover:bg-[rgba(239,246,255,1)]'}
            >
              {isButtonLoading === article.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('knowledge_assist.merging')}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '16px' }}>✨</span>
                  <span>{t('knowledge_assist.mergeDocument')}</span>
                </div>
              )}
            </button>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const isEmpty = articles.length === 0;

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
              data={articles}
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
