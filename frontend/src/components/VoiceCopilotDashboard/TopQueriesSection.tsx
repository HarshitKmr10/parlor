'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Flex, Text, Table } from '@radix-ui/themes';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { IdCardIcon } from '@radix-ui/react-icons';
import { useVCPTopQueries } from 'hooks/useVoiceCopilotDashboard';
import Shimmer from 'components/common/Shimmer/Shimmer';

interface TopQueriesSectionProps {
  orgId: string;
  timeFilter: string;
}

export default function TopQueriesSection({ orgId, timeFilter }: TopQueriesSectionProps) {
  const [activeFilter, setActiveFilter] = useState<'Answered' | 'Unanswered'>('Answered');
  const [page, setPage] = useState(1);
  const [queries, setQueries] = useState<any[]>([]);
  const [filterKey, setFilterKey] = useState(0);

  const observer = useRef<IntersectionObserver | null>(null);

  const answered = activeFilter === 'Answered';

  const { data, loading, hasMore } = useVCPTopQueries(
    orgId,
    timeFilter,
    answered,
    page,
    10,
    filterKey
  );

  // Accumulate data on page change
  useEffect(() => {
    if (data) {
      if (page === 1) {
        setQueries(data);
      } else {
        setQueries((prev) => [...prev, ...data]);
      }
    }
  }, [data, page]);

  // Reset when filter changes
  useEffect(() => {
    setPage(1);
    setQueries([]);
    setFilterKey((prev) => prev + 1);
  }, [activeFilter, timeFilter]);

  // Infinite scroll callback
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
    [loading, hasMore]
  );

  const handleFilterChange = (filter: 'Answered' | 'Unanswered') => {
    setActiveFilter(filter);
    setPage(1);
    setQueries([]);
    setFilterKey((prev) => prev + 1);
  };

  // Filter buttons component
  const FilterButtons = () => (
    <Flex gap="2">
      <button
        onClick={() => handleFilterChange('Answered')}
        className={`rounded-md px-3 py-1 text-sm ${
          activeFilter === 'Answered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        Answered
      </button>
      <button
        onClick={() => handleFilterChange('Unanswered')}
        className={`rounded-md px-3 py-1 text-sm ${
          activeFilter === 'Unanswered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        Unanswered
      </button>
    </Flex>
  );

  // Shimmer loading component
  const renderShimmerLoading = () => (
    <Table.Body className="w-full">
      {[...Array(6)].map((_, index) => (
        <Table.Row key={index}>
          <Table.Cell>
            <Flex align="center" gap="3">
              <Shimmer width="2rem" height="2rem" />
              <Shimmer width="12rem" height="1rem" />
            </Flex>
          </Table.Cell>
          <Table.Cell>
            <Flex align="center" justify="end" gap="2">
              <Shimmer width="6rem" height="1rem" />
            </Flex>
          </Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  );

  // No data state
  if (!queries.length && !loading) {
    return (
      <Box className="mb-6 rounded-lg border bg-white p-4">
        <Flex justify="between" align="center" mb="4">
          <Text size="4" weight="medium">
            Top Queries
          </Text>
          <FilterButtons />
        </Flex>
        <Box className="flex h-[330px] items-center justify-center">
          <Text color="gray">No queries data available</Text>
        </Box>
      </Box>
    );
  }

  // Initial loading state
  if (loading && !queries.length) {
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
            {renderShimmerLoading()}
          </Table.Root>
        </Box>
      </Box>
    );
  }

  // Main render with data
  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      {/* Header with title and filter buttons */}
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="medium">
          Top Queries
        </Text>
        <FilterButtons />
      </Flex>

      {/* Table container with fixed height and scroll */}
      <Box className="h-[330px] overflow-y-auto">
        <Table.Root>
          <Table.Body>
            {queries.map((query, index) => (
              <Table.Row key={`${query.query}-${index}`}>
                <Table.Cell>
                  <Flex align="center" gap="3">
                    {/* Query icon */}
                    <Box className="flex h-8 w-8 items-center justify-center rounded bg-[#EEF4FF]">
                      <IdCardIcon className="text-blue-600" />
                    </Box>
                    {/* Query text with intersection observer for infinite scroll */}
                    <div
                      ref={index === queries.length - 1 ? lastQueryElementRef : null}
                      className="flex items-center justify-between"
                    >
                      <Text className="text-sm text-black-600">{query.query}</Text>
                    </div>
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Flex align="center" justify="end" gap="2">
                    <Box className="flex items-center gap-2">
                      {/* Query count */}
                      <Text>
                        {query.total_count <= 1
                          ? `${query.total_count} time`
                          : `${query.total_count} times`}
                      </Text>
                      {/* Trending icon based on filter */}
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
          {/* Show loading shimmer for pagination */}
          {loading && <>{renderShimmerLoading()}</>}
        </Table.Root>
      </Box>
    </Box>
  );
}
