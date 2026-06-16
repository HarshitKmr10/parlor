// new-frontend/src/app/(admin)/(knowledge)/knowledge/collections/LowScoringTable.tsx

import { Box, Text, Tooltip, Flex, Table } from '@radix-ui/themes';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import ProgressCircle from 'components/dashboard/ProgressCircle';
import { useRouter } from 'next/navigation';
import Shimmer from 'components/common/Shimmer/Shimmer';
import React, { useEffect, useState, useRef } from 'react';
import { Article, fetchAllDocuments } from 'api/kbAssist';
import { useGlobalContext } from 'contexts/store';
import usePagination from './usePagination';
import CustomTable, { Column } from '@/components/common/CustomTable/CustomTable';
import { useTranslation } from 'react-i18next';
import NoPriorityIcon from '@/components/icons/NoPriorityIcon';
import { AnimatePresence, motion } from 'framer-motion';


const truncateName = (name: string, maxLength = 30) => {
    if (name.length <= maxLength) return name;
    return `${name.slice(0, maxLength)}...`;
};

const SortIcon = () => (
  <svg width="13" height="9" viewBox="0 0 13 9" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.8335 8.5L10.1668 6.5L12.5002 8.5" stroke="#1C2024" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.83333 5.83333H0.5M5.83333 8.5H0.5M0.5 0.5H7.5M11.8333 0.5H10.3333M11.8333 3.16667H4.83333M0.5 3.16667H2" stroke="#1C2024" strokeLinecap="round"/>
  </svg>
);

const SparkleIcon = () => (
  <svg
    width="14"
    height="14"
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

const ErrorIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ color: '#DC2626' }}
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

const ImproveKBButton = ({ article }: { article: Article }) => {
    const { t } = useTranslation();
    const router = useRouter();

    return (
        <button
            title="Improve KB"
            style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 246, 255, 0.9)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: '#4F46E5',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 500,
                whiteSpace: 'nowrap',
            }}
            onClick={(e) => {
                e.stopPropagation();
                router.push(`/knowledge/editor/edit-document?id=${article.id}`);
            }}
            className="hover:bg-[rgba(239,246,255,1)]"
        >
            <SparkleIcon />
            {t('knowledge_assist.improveKB')}
        </button>
    );
};

interface Props {
    searchText?: string;
    collectionId?: string;
    language?: string;
    hasDuplicate?: boolean | null;
    scoreParams?: Record<string, number>;
}

type SortField = 'score' | 'number' | 'name' | 'collection_name';
type SortDirection = 'asc' | 'desc';

export function LowScoringTable({ searchText = "", collectionId, language, hasDuplicate, scoreParams }: Props) {
    const { t } = useTranslation();
    const { user } = useGlobalContext();
    const router = useRouter();

    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // For low scoring documents, use documents_type=all with score_lte=7.5
                const lowScoringParams = { score_lte: 7.5, ...scoreParams };
                const data = await fetchAllDocuments(
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
                    lowScoringParams
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

    // No client-side filtering needed - API returns low scoring documents (score_lte=7.5)
    const filteredArticles = articles;

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

    // Server-side sorting is now handled by the API
    // Data comes pre-sorted from the backend
    const sortedArticles = filteredArticles;

    if (error) return <Text color="red">Error fetching articles: {error}</Text>;

    const handleArticleClick = (article: Article) => {
        if (article.status !== "inserted" && article.status !== "failed") {
            router.push(`/knowledge/editor/edit-document?id=${article.id}`);
        }
    };

    const cellBaseClass = 'relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle';
    const dividerSpan = "absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-['']";

    const renderShimmerTable = () => (
        <Table.Root variant="surface" className="w-full rounded-sm px-2">
            <Table.Header>
                <Table.Row className="h-[36px] px-[9px] py-[2px]">
                    <Table.ColumnHeaderCell className={`w-[4%] ${cellBaseClass} text-center`}>
                        <Flex justify="center" align="center" className="w-full h-full">
                            <SortIcon />
                        </Flex>
                        <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass}`}>
                        <Flex align="center" justify="between">
                            <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.articleNumber')}</Text>
                            <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
                        </Flex>
                        <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[35%] ${cellBaseClass}`}>
                        <Flex align="center" justify="between">
                            <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.articleName')}</Text>
                            <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
                        </Flex>
                        <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[20%] ${cellBaseClass}`}>
                        <Flex align="center" justify="between">
                            <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.collection')}</Text>
                            <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
                        </Flex>
                        <span className={dividerSpan} />
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={`w-[18%] ${cellBaseClass}`}>
                        <Text size="1" weight="bold" className="text-neutral-11">{t('knowledge_assist.actions')}</Text>
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
                        <Table.Cell className={`w-[15%] ${cellBaseClass}`}>
                            <Shimmer width="80px" height="16px" borderRadius="4px" />
                            <span className={dividerSpan} />
                        </Table.Cell>
                        <Table.Cell className={`w-[35%] ${cellBaseClass}`}>
                            <Shimmer width="200px" height="16px" borderRadius="4px" />
                            <span className={dividerSpan} />
                        </Table.Cell>
                        <Table.Cell className={`w-[20%] ${cellBaseClass}`}>
                            <Shimmer width="120px" height="16px" borderRadius="4px" />
                            <span className={dividerSpan} />
                        </Table.Cell>
                        <Table.Cell className={`w-[18%] ${cellBaseClass}`}>
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
            width: 'w-[15%]',
            render: (article) => (
                article.number ? <Text>{article.number}</Text> : <NoPriorityIcon width={12} height={12} />
              ),
        },
        {
            header: <SortableHeader field="name" label={t('knowledge_assist.articleName')} />,
            accessor: 'name',
            width: 'w-[35%]',
            render: (article) => (
                <Box className="group" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '30rem' }}>
                <Text
                    title={article.name}
                    style={{
                        cursor: article.status === "inserted" || article.status === "failed" ? 'default' : 'pointer',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: article.status === "failed" ? '#DC2626' : undefined,
                    }}
                    className={article.status === "inserted" || article.status === "failed" ? '' : 'hover:text-blue-600 hover:underline'}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (article.status !== "inserted" && article.status !== "failed") {
                            handleArticleClick(article);
                        }
                    }}
                >{article.name}</Text>
                </Box>
            ),
        },
        {
            header: <SortableHeader field="collection_name" label={t('knowledge_assist.collection')} />,
            accessor: 'collection_name',
            width: 'w-[20%]',
            render: (article) => <Text>{article.collection_name}</Text>,
        },
        {
            header: <Text size="1" weight="bold">{t('knowledge_assist.actions')}</Text>,
            accessor: 'id',
            width: 'w-[18%]',
            hideDivider: true,
            render: (article) => (
                <Box display="inline" style={{ display: 'flex', alignItems: 'center' }}>
                    {article.status !== "inserted" && article.status !== "failed" && (
                        <ImproveKBButton article={article} />
                    )}
                </Box>
            ),
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
                            onRowClick={handleArticleClick}
                            emptyMessage={''}
                        />
                        {paginationComponent}
                    </motion.div>
                )}
            </AnimatePresence>
        </Box>
    );
}