'use client';

import { Box, Text, Table, Flex } from '@radix-ui/themes';
import { useState, useRef, useEffect, useCallback } from 'react';
import { IdCardIcon } from '@radix-ui/react-icons';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useTopQueries, TopQueryData } from '@/hooks/voice-virtial-agent/useTopQueries';
import Shimmer from 'components/common/Shimmer';

// ─── Types & Interfaces ─────────────────────────────────────────────────────

/**
 * Props for the TopQueries component
 */
interface TopQueriesProps {
  orgId: string;
  timeFilter: string;
}

// ─── Component Implementation ────────────────────────────────────────────────

/**
 * TopQueries Component
 * 
 * Displays a list of top queries with pagination and filtering capabilities.
 * Supports infinite scroll and shows loading states.
 * 
 * @param orgId - Organization ID for data filtering
 * @param timeFilter - Time range filter for the queries
 */
const TopQueries = ({ orgId, timeFilter }: TopQueriesProps) => {
  // ─── State Management ─────────────────────────────────────────────────────
  
  const [page, setPage] = useState<number>(1);
  const [queries, setQueries] = useState<TopQueryData[]>([]);
  const [activeFilter, setActiveFilter] = useState('Answered');
  const [filterKey, setFilterKey] = useState(0);
  
  // ─── Refs & Observers ─────────────────────────────────────────────────────
  
  const observer = useRef<IntersectionObserver>();

  // ─── Custom Hook Integration ──────────────────────────────────────────────
  
  const { data, loading, hasMore } = useTopQueries({
    orgId,
    timeframe: timeFilter,
    answered: activeFilter === 'Answered',
    page,
    pageSize: 10,
    filterKey, // Force refetch when filters change
  });

  // ─── Intersection Observer for Infinite Scroll ────────────────────────────
  
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

  // ─── Effects ──────────────────────────────────────────────────────────────
  
  /**
   * Update queries when new data comes in from the API
   */
  useEffect(() => {
    if (data) {
      if (page === 1) {
        // Reset queries for first page
        setQueries(data);
      } else {
        // Append new queries for subsequent pages
        setQueries((prev) => [...prev, ...data]);
      }
    }
  }, [data, page]);

  /**
   * Reset pagination when filter or timeframe changes
   */
  useEffect(() => {
    // Reset pagination and clear existing queries immediately
    setPage(1);
    setQueries([]);
    // Increment filterKey to force fresh API call
    setFilterKey(prev => prev + 1);
  }, [activeFilter, timeFilter]);

  // ─── Loading Component ────────────────────────────────────────────────────
  
  /**
   * Renders shimmer loading animation for table rows
   */
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

  // ─── Filter Component ─────────────────────────────────────────────────────
  
  /**
   * Renders the Answered/Unanswered filter buttons
   */
  const FilterButtons = () => (
    <Flex gap="2">
      <button
        onClick={() => {
          setActiveFilter('Answered');
          // Reset pagination and force fresh API call
          setPage(1);
          setQueries([]);
          setFilterKey(prev => prev + 1);
        }}
        className={`rounded-md px-3 py-1 text-sm ${
          activeFilter === 'Answered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        Answered
      </button>
      <button
        onClick={() => {
          setActiveFilter('Unanswered');
          // Reset pagination and force fresh API call
          setPage(1);
          setQueries([]);
          setFilterKey(prev => prev + 1);
        }}
        className={`rounded-md px-3 py-1 text-sm ${
          activeFilter === 'Unanswered' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        }`}
      >
        Unanswered
      </button>
    </Flex>
  );

  // ─── Render States ────────────────────────────────────────────────────────
  
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

  // ─── Main Component Render ────────────────────────────────────────────────
  
  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      {/* Header with title and filter buttons */}
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="medium">
          Top Queries
        </Text>
        <FilterButtons />
      </Flex>
      
      {/* Table container with scroll */}
      <Box className="h-[330px] overflow-y-auto">
        <Table.Root>
          <Table.Body>
            {queries.map((item, index) => (
              <Table.Row key={index}>
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
                      <Text className="text-black-600 text-sm">{item.query}</Text>
                    </div>
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Flex align="center" justify="end" gap="2">
                    <Box className="flex items-center gap-2">
                      {/* Query count */}
                      <Text>{item?.total_count <= 1 ? `${item?.total_count} time`: `${item?.total_count} times`}</Text>
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
};

export default TopQueries;
