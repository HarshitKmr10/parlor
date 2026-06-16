'use client';

// ─── Imports ─────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Text, Table, Flex } from '@radix-ui/themes';

import { useCvaTopQueriesData } from 'hooks/useCvaTopQueriesData';
import Shimmer from 'components/common/Shimmer';
import FileIcon from 'components/icons/FileIcon';
import OccuranceIcon from 'components/icons/OccurancesIcon';

// ─── Props ───────────────────────────────────────────────────────
interface Props {
  orgId: string;
  timeframe: string;
}

export function TopQueries({
  timeframe,
  orgId,
}: Props) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<'answered' | 'unanswered'>('answered');
  const [page, setPage] = useState(1);
  const observer = useRef<IntersectionObserver | null>(null);
  const {
    data: queries,
    loading,
    hasMore,
  } = useCvaTopQueriesData(orgId, timeframe, activeFilter, page);

  const lastRowRef = useCallback(
    (node: HTMLElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prev) => prev + 1);
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  // Reset on filter or time change
  useEffect(() => {
    setPage(1);
  }, [activeFilter, timeframe]);

  const renderShimmerLoading = () => (
    <Table.Body>
      {[...Array(6)].map((_, index) => (
        <Table.Row key={index}>
          <Table.Cell>
            <Flex align="center" gap="3">
              <Shimmer width="1.5rem" height="1.5rem" />
              <Shimmer width="8rem" height="1.5rem" />
            </Flex>
          </Table.Cell>
          <Table.Cell>
            <Flex align="center" justify="end" gap="2">
              <Shimmer width="6rem" height="1.5rem" />
            </Flex>
          </Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  );

  const FilterButtons = () => (
    <Flex gap="2" className="rounded-md bg-[#F7F8FA] p-1">
      <button
        onClick={() => setActiveFilter('answered')}
        className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
          activeFilter === 'answered' ? 'bg-[#181B1F] text-white' : 'text-gray-500'
        }`}
      >
        {t('dashboard.answered')}
      </button>
      <button
        onClick={() => setActiveFilter('unanswered')}
        className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
          activeFilter === 'unanswered' ? 'bg-[#181B1F] text-white' : 'text-gray-500'
        }`}
      >
        {t('dashboard.unanswered')}
      </button>
    </Flex>
  );

  const noData = !loading && (!queries || queries.length === 0);


  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      <Flex justify="between" align="center" mb="0">
        <Text size="4" weight="medium">
          {t('dashboard.topQueries')}
        </Text>
        <FilterButtons />
      </Flex>

      <Box className="h-[241px] overflow-y-auto">
        <Table.Root>
          {/* No Data */}
          {noData && (
            <Table.Body>
              <Table.Row>
                <Table.Cell colSpan={4} style={{ boxShadow: 'none' }}>
                  <Flex justify="center" align="center" className="h-[200px]">
                    <Text size="2" color="gray">
                      {t('dashboard.noDataFound')}
                    </Text>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          )}
          <Table.Body>
            {queries.map((item, index) => (
              <Table.Row key={index}>
                <Table.Cell className="w-[70%]">
                  <Flex align="center" gap="3">
                    <Flex
                      align={'center'}
                      justify={'center'}
                      className="h-6 w-6 rounded bg-[#EEF4FF]"
                    >
                      <FileIcon />
                    </Flex>
                    <div
                      ref={index === queries.length - 1 ? lastRowRef : null}
                      className="flex items-center justify-between"
                    >
                      <Text size="2" weight="regular" className="text-neutral-l2">
                        {item.query}
                      </Text>
                    </div>
                  </Flex>
                </Table.Cell>
                <Table.Cell className="w-[30%]">
                  <Flex align="center" justify="end" gap="2">
                    <Box className="flex items-center gap-2">
                      <OccuranceIcon />
                      <Text size="2" weight="regular" className="text-neutral-l2">
                        {item.count} times
                      </Text>
                    </Box>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
          {loading && page === 1 && renderShimmerLoading()}
        </Table.Root>
        {loading && page > 1 && (
          <Box className="px-4 py-2">
            <Shimmer width="100%" height="2rem" />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default TopQueries;
