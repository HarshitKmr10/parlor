import {
  AlertDialog, Box, Button, Text, Spinner, Flex, Table,
} from '@radix-ui/themes';
import React, { useEffect, useState, useRef } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Loader2, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import Shimmer from 'components/common/Shimmer/Shimmer';
import { IncidentGroup } from 'components/dashboard/IncidentGroup';
import { Recommendation } from 'types/dashboard';
import { useGlobalContext } from 'contexts/store';
import { useDashboard } from 'hooks/useDashboard';
import { fetchRecommendations, ignoreRecommendation } from 'api/kbAssist';
import usePagination from './usePagination';
import { useTranslation } from 'react-i18next';
import CustomTable, { Column } from '@/components/common/CustomTable/CustomTable';
import NoPriorityIcon from '@/components/icons/NoPriorityIcon';
import { AnimatePresence, motion } from 'framer-motion';


interface Incident {
  id: string;
  incident_number: string;
  configuration_item: string;
}

interface ClusterIncident {
  id: string;
  impact: string | null;
  org_id: string;
  status: string;
  cluster: string;
  urgency: string | null;
  category: string;
  priority: string;
  opened_at: string;
  created_at: string;
  ci_location: string;
  resolved_at: string;
  subcategory: string;
  organizations: string | null;
  incident_class: string;
  incident_number: string;
  recommendations: string | null;
  assignment_group: string;
  long_description: string | null;
  short_description: string;
  configuration_item: string;
  knowledgebase_document_assist: string | null;
}

interface ClusterData {
  name: string;
  incidents: ClusterIncident[];
}

interface Article {
  id: string;
  recommendation: string;
  type: string;
  rank: number;
  related_to_kb_ids: string[];
  incidents: Incident[];
  metadata: {
    cluster_data: ClusterData;
    incident_count: number;
    preview: string;
  };
}

const cellBaseClass = 'relative py-2.5 px-2 text-xs font-normal text-[#1C2024] align-middle';
const dividerSpan = 'absolute top-[8px] bottom-[8px] right-0 w-px bg-gray-200 content-[""]';

const truncateName = (name: string | null | undefined, maxLength = 30) => {
  if (!name) return '';
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength)}...`;
};

interface Props {
  searchText?: string;
  collectionId?: string;
}

type SortField = 'incidents';
type SortDirection = 'asc' | 'desc';

export function CreateKB({ searchText = "", collectionId }: Props) {
  const { t } = useTranslation();
  const [isButtonLoading, setIsButtonLoading] = useState<string | null>(null);
  const [isIgnoring, setIsIgnoring] = useState<string | null>(null);
  const [confirmIgnore, setConfirmIgnore] = useState<Article | null>(null);

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { setTotalCount, currentPage, handlePageChange, pageSize, paginationComponent } = usePagination({ searchText });
  
  // AbortController ref to cancel previous requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const { user } = useGlobalContext();
  useEffect(() => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    setIsLoading(true);
    fetchRecommendations(
      "create_new_kb", 
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

  const { handleRecommendationAction, cancelRecommendationAction } = useDashboard();
  const { setPreviousPath } = useGlobalContext();
  
  // Cancel recommendation action when component unmounts
  useEffect(() => {
    return () => {
      cancelRecommendationAction();
    };
  }, [cancelRecommendationAction]);

  const handleCreateKBClick = async (article: Article) => {
    // Cancel any previous action before starting a new one
    cancelRecommendationAction();
    
    // Clear previous button loading state and set new one
    setIsButtonLoading(article.id);
    
    try {
      setPreviousPath(window.location.pathname + window.location.search);

      const createRecommendation: Recommendation = {
        id: article.id,
        type: 'create_new_kb',
        recommendation: `Multiple incidents in cluster ${article.metadata?.cluster_data?.name} related to ${article.metadata?.cluster_data?.incidents?.[0]?.short_description || 'issue'}`,
        metadata: {
          cluster_data: article.metadata?.cluster_data || {},
          incident_count: article.metadata?.cluster_data?.incidents?.length || 0,
          preview: article.metadata?.preview || ''
        },
        rank: 0,
        related_to_kb_ids: [],
        resolved: false,
      };

      await handleRecommendationAction(createRecommendation);

    } catch (error: any) {
      // Don't log or show error if request was aborted
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }
      console.error('Error in create KB:', error);
    } finally {
      // Only clear loading state if this button is still the one that's loading
      setIsButtonLoading((current) => current === article.id ? null : current);
    }
  };

  const handleIgnoreConfirm = async () => {
    if (!confirmIgnore) return;
    const article = confirmIgnore;
    console.log('[handleIgnoreConfirm] start', {
      id: article.id,
      cluster: article.metadata?.cluster_data?.name,
      incidentCount: article.metadata?.incident_count,
      currentPage,
      pageRowCount: articles.length,
    });
    setIsIgnoring(article.id);
    try {
      const result = await ignoreRecommendation(article.id);
      console.log('[handleIgnoreConfirm] api ok', { id: article.id, result });
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      toast.success(t('knowledge_assist.ignoredSuccess'));
      // If we just removed the last row on a non-first page, step back so we
      // don't leave the user staring at an empty page.
      if (articles.length === 1 && currentPage > 1) {
        console.log('[handleIgnoreConfirm] stepping page back', { from: currentPage, to: currentPage - 1 });
        handlePageChange(currentPage - 1);
      }
    } catch (e) {
      console.error('[handleIgnoreConfirm] failed', { id: article.id, err: e });
      toast.error(t('knowledge_assist.ignoredError'));
    } finally {
      console.log('[handleIgnoreConfirm] done', { id: article.id });
      setIsIgnoring(null);
      setConfirmIgnore(null);
    }
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
          <Table.ColumnHeaderCell className={`w-[25%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">
                {t('knowledge_assist.documentPreview')}
              </Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[15%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">
                {t('knowledge_assist.configurationItem')}
              </Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[20%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">
                {t('knowledge_assist.incident')}
              </Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[10%] ${cellBaseClass} text-xs font-semibold`}>
            <Flex align="center" justify="between">
              <Text size="1" weight="bold" className="text-neutral-11">
                {t('knowledge_assist.priority')}
              </Text>
              <ChevronDownIcon style={{ color: 'var(--gray-11)' }} />
            </Flex>
            <span className={dividerSpan} />
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell className={`w-[20%] ${cellBaseClass} text-xs font-semibold`}>
            <Text size="1" weight="bold" className="text-neutral-11">
              {t('knowledge_assist.actions')}
            </Text>
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: 10 }).map((_, index) => (
          <Table.Row key={index} className="h-[36px]">
            <Table.Cell className={`w-[25%] ${cellBaseClass}`}>
              <Shimmer width="200px" height="16px" borderRadius="4px" />
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[15%] ${cellBaseClass}`}>
              <Shimmer width="120px" height="16px" borderRadius="4px" />
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[20%] ${cellBaseClass}`}>
              <Flex gap="1">
                <Shimmer width="60px" height="18px" borderRadius="8px" />
                <Shimmer width="60px" height="18px" borderRadius="8px" />
                <Shimmer width="60px" height="18px" borderRadius="8px" />
              </Flex>
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[10%] ${cellBaseClass}`}>
              <Shimmer width="60px" height="16px" borderRadius="4px" />
              <span className={dividerSpan} />
            </Table.Cell>
            <Table.Cell className={`w-[20%] ${cellBaseClass}`}>
              <Shimmer width="120px" height="24px" borderRadius="6px" />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
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
      header: <Text size="1" weight="bold">{t('knowledge_assist.documentPreview')}</Text>,
      accessor: 'metadata',
      width: 'w-[25%]',
      render: (article) => (
        <Text title={article.metadata.preview || article.metadata.cluster_data.incidents[0]?.short_description}>
          {truncateName(article.metadata.preview || article.metadata.cluster_data.incidents[0]?.short_description, 50)}
        </Text>
      ),
    },
    {
      header: <Text size="1" weight="bold">{t('knowledge_assist.configurationItem')}</Text>,
      accessor: 'incidents',
      width: 'w-[15%]',
      render: (article) => <Text>{article.incidents[0]?.configuration_item}</Text>,
    },
    {
      header: <SortableHeader field="incidents" label={t('knowledge_assist.incident')} />,
      accessor: 'metadata',
      width: 'w-[20%]',
      render: (article) => (
        <IncidentGroup
          incidentTickets={article.metadata.cluster_data.incidents.map(incident => ({
            incident_number: incident.incident_number,
            incident_title: incident.short_description,
            category: incident.category
          }))}
        />
      ),
    },
    {
      header: <Text size="1" weight="bold">{t('knowledge_assist.priority')}</Text>,
      accessor: 'metadata',
      width: 'w-[10%]',
      render: (article) => {
        const priority = article.metadata.cluster_data.incidents[0]?.priority;
        return priority ? <Text>{priority}</Text> : <NoPriorityIcon />;
      },
    },
    {
      header: <Text size="1" weight="bold">{t('knowledge_assist.actions')}</Text>,
      accessor: 'id',
      width: 'w-[20%]',
      hideDivider: true,
      render: (article) => {
        const rowBusy = isButtonLoading === article.id || isIgnoring === article.id;
        return (
          <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateKBClick(article);
              }}
              disabled={rowBusy}
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
                cursor: rowBusy ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                opacity: rowBusy ? 0.6 : 1,
              }}
              className={rowBusy ? '' : 'hover:bg-[rgba(239,246,255,1)]'}
            >
              {isButtonLoading === article.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('knowledge_assist.creating')}</span>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px' }}>✨</span>
                  <span>{t('knowledge_assist.createDocument')}</span>
                </div>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmIgnore(article);
              }}
              disabled={rowBusy}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: 'var(--red-11)',
                border: 'none',
                cursor: rowBusy ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                opacity: rowBusy ? 0.6 : 1,
              }}
              className={rowBusy ? '' : 'hover:bg-[var(--red-3)]'}
            >
              {isIgnoring === article.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('knowledge_assist.ignoring')}</span>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <XCircle className="h-3.5 w-3.5" />
                  <span>{t('knowledge_assist.ignoreRecommendation')}</span>
                </div>
              )}
            </button>
          </Box>
        );
      },
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
      <AlertDialog.Root
        open={confirmIgnore !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmIgnore(null);
        }}
      >
        <AlertDialog.Content style={{ maxWidth: 480 }}>
          <AlertDialog.Title>{t('knowledge_assist.ignoreConfirmTitle')}</AlertDialog.Title>
          <AlertDialog.Description size="2">
            {t('knowledge_assist.ignoreConfirmBody')}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray" disabled={isIgnoring !== null}>
                {t('knowledge_assist.cancel')}
              </Button>
            </AlertDialog.Cancel>
            <Button
              color="red"
              onClick={handleIgnoreConfirm}
              disabled={isIgnoring !== null}
            >
              {isIgnoring !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('knowledge_assist.ignoring')}</span>
                </>
              ) : (
                t('knowledge_assist.ignoreConfirmAction')
              )}
            </Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  );
}
