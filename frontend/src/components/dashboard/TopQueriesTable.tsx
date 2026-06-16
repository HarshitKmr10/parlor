'use client';

import { Box, Text, Table, Flex } from '@radix-ui/themes';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileTextIcon } from '@radix-ui/react-icons';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { useGlobalContext } from 'contexts/store';
import Shimmer from 'components/common/Shimmer';
interface TopQueriesTableProps {
  timeFilter: string;
  isVersionV3?: boolean;
}

interface QueryItem {
  query: string;
  count: number;
}

export function TopQueriesTable({ timeFilter, isVersionV3 }: TopQueriesTableProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const observer = useRef<IntersectionObserver>();
  const { user } = useGlobalContext();
  const org_id = user?.org_id;
  const [activeFilter, setActiveFilter] = useState('Answered');

  const lastQueryElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  useEffect(() => {
    setLoading(true);
    let endpoint =
      activeFilter === 'Answered'
        ? '/analytics/recurring_incidents/answered'
        : '/analytics/recurring_incidents/unanswered';

    if (isVersionV3) {
      endpoint = 
      activeFilter === 'Answered'
        ? '/analytics/v3/recurring_incidents/answered'
        : '/analytics/v3/recurring_incidents/unanswered';
    }

    let queryParams = `org_id=${org_id}&page=${page}&order=desc`;

    // Handle new date range format
    if (timeFilter?.includes(':')) {
      const [start, end] = timeFilter.split(':');
      const startDate = new Date(start).toISOString().split('T')[0];
      const endDate = new Date(end).toISOString().split('T')[0];
      queryParams += `&period=${startDate}:${endDate}`;
    } else {
      // Fallback to legacy period format
      queryParams += `&period=${timeFilter.replace('d', '')}`;
    }

    serviceDeskInstance
      .get(`${endpoint}?${queryParams}`)
      .then((response) => {
        const newQueries = response.data.data.recurring_incidents || [];
        setQueries((prev) => [...prev, ...newQueries]);
        setHasMore(newQueries.length > 0);
        setLoading(false);
        console.log('newQueries', newQueries);
      })
      .catch((error) => {
        console.error('Error fetching queries:', error);
        setLoading(false);
      });
  }, [page, org_id, activeFilter, timeFilter, isVersionV3]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
    setQueries([]);
  }, [activeFilter, timeFilter]);

  const renderShimmerLoading = useCallback(() => {
    return (
      <Table.Body className="w-full">
        {[...Array(6)].map((_, index) => (
          <Table.Row key={index}>
            <Table.Cell>
              <Flex align="center" gap="3">
                <Shimmer width="2rem" height="2rem" />
                <Shimmer width="8rem" height="2rem" />
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" justify="end" gap="2">
                <Shimmer width="6rem" height="2rem" />
              </Flex>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    );
  }, [loading]);

  const FilterButtons = () => {
    const { t } = useTranslation();
    return (
      <Flex gap="2">
        <button
          onClick={() => setActiveFilter('Answered')}
          className={`rounded-md px-3 py-1 text-sm ${
            activeFilter === 'Answered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
        >
          {t('dashboard.answered')}
        </button>
        <button
          onClick={() => setActiveFilter('Unanswered')}
          className={`rounded-md px-3 py-1 text-sm ${
            activeFilter === 'Unanswered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
        >
          {t('dashboard.unanswered')}
        </button>
      </Flex>
    );
  };

  if (!queries.length && !loading) {
    return (
      <Box className="mb-6 rounded-lg border bg-white p-4">
        <Flex justify="between" align="center" mb="4">
          <Text size="4" weight="medium">
            {t('dashboard.topQueries')}
          </Text>
          <FilterButtons />
        </Flex>
        <Box className="flex h-[330px] items-center justify-center">
          <Text color="gray">{t('dashboard.noQueriesDataAvailable')}</Text>
        </Box>
      </Box>
    );
  }

  if (loading && !queries.length) {
    return (
      <Box className="mb-6 rounded-lg border bg-white p-4">
        <Flex justify="between" align="center" mb="4">
          <Text size="4" weight="medium">
            {t('dashboard.topQueries')}
          </Text>
          <FilterButtons />
        </Flex>
        <Box className="h-[330px] overflow-y-auto">
          <Table.Root>
            {renderShimmerLoading()}
          </Table.Root>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="medium">
          Top Queries
        </Text>
        <FilterButtons />
      </Flex>
      <Box className="h-[330px] overflow-y-auto">
        <Table.Root>
            <Table.Body>
              {queries.map((item, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    <Flex align="center" gap="3">
                      <Box className="flex h-8 w-8 items-center justify-center rounded bg-[#EEF4FF]">
                        <FileTextIcon className="text-blue-600" />
                      </Box>
                      <div
                        ref={index === queries.length - 1 ? lastQueryElementRef : null}
                        className="flex items-center justify-between"
                      >
                        <Text className="text-black-600 text-sm">{item.query}</Text>
                      </div>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" justify="end" gap="2">
                      <Box className="flex items-center gap-2">
                        <Text>{item.count} {t('dashboard.times')}</Text>
                        {activeFilter === 'Answered' ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                      </Box>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
            {loading && <>{renderShimmerLoading()}</>}
        </Table.Root>
      </Box>
    </Box>
  );
}
