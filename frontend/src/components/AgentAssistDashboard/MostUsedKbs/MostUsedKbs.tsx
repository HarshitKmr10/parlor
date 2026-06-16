'use client';

import { Box, Text, Table, Flex } from '@radix-ui/themes';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FileTextIcon } from '@radix-ui/react-icons';
import { TrendingUp, PhoneIcon, BarChart3Icon } from 'lucide-react';
import { useMostUsedKbs, MostUsedKbData } from '@/hooks/voice-virtial-agent/useMostUsedKbs';
import Shimmer from 'components/common/Shimmer';

// ─── Types & Interfaces ─────────────────────────────────────────────────────

/**
 * Props for the MostUsedKbs component
 */
interface MostUsedKbsProps {
  orgId: string;
  timeFilter: string;
}

// ─── Component Implementation ────────────────────────────────────────────────

/**
 * MostUsedKbs Component
 * 
 * Displays a list of most used knowledge bases with pagination capabilities.
 * Supports infinite scroll and shows loading states.
 * 
 * @param orgId - Organization ID for data filtering
 * @param timeFilter - Time range filter for the KBs
 */
const MostUsedKbs = ({ orgId, timeFilter }: MostUsedKbsProps) => {
  // ─── State Management ─────────────────────────────────────────────────────
  
  const [page, setPage] = useState<number>(1);
  const [kbs, setKbs] = useState<MostUsedKbData[]>([]);
  
  // ─── Refs & Observers ─────────────────────────────────────────────────────
  
  const observer = useRef<IntersectionObserver>();

  // ─── Custom Hook Integration ──────────────────────────────────────────────
  
  const { data, loading, hasMore, summary } = useMostUsedKbs({
    orgId,
    timeframe: timeFilter,
    page,
    pageSize: 10,
  });

  // ─── Intersection Observer for Infinite Scroll ────────────────────────────
  
  const lastKbElementRef = useCallback(
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
   * Update KBs when new data comes in from the API
   */
  useEffect(() => {
    if (data) {
      if (page === 1) {
        // Reset KBs for first page
        setKbs(data);
      } else {
        // Append new KBs for subsequent pages
        setKbs((prev) => [...prev, ...data]);
      }
    }
  }, [data, page]);

  /**
   * Reset pagination when timeframe changes
   */
  useEffect(() => {
    setPage(1);
    setKbs([]);
  }, [timeFilter]);

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
                <Shimmer width="4rem" height="2rem" />
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" justify="end" gap="2">
                <Shimmer width="4rem" height="2rem" />
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Flex align="center" justify="end" gap="2">
                <Shimmer width="4rem" height="2rem" />
              </Flex>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    );
  }, [loading]);

  // ─── Render States ────────────────────────────────────────────────────────
  
  // No data state
  if (!kbs.length && !loading) {
    return (
      <Box className="mb-6 rounded-lg border bg-white p-4">
        <Flex justify="between" align="center" mb="4">
          <Text size="4" weight="medium">
            Most Used Knowledge Bases
          </Text>
        </Flex>
        <Box className="flex h-[330px] items-center justify-center">
          <Text color="gray">No knowledge bases data available</Text>
        </Box>
      </Box>
    );
  }

  // Initial loading state
  if (loading && !kbs.length) {
    return (
      <Box className="mb-6 rounded-lg border bg-white p-4">
        <Flex justify="between" align="center" mb="4">
          <Text size="4" weight="medium">
            Most Used Knowledge Bases
          </Text>
        </Flex>
        <Box className="h-[330px] overflow-y-auto">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Knowledge Base</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="text-right">Total Uses</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="text-right">Unique Calls</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="text-right">Usage Rate</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            {renderShimmerLoading()}
          </Table.Root>
        </Box>
      </Box>
    );
  }

  // ─── Main Component Render ────────────────────────────────────────────────
  
  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      {/* Header with title */}
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="medium">
          Most Used Knowledge Bases
        </Text>
      </Flex>
      
      {/* Table container with scroll */}
      <Box className="h-[330px] overflow-y-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Knowledge Base</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell className="text-right">Total Uses</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell className="text-right">Unique Calls</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell className="text-right">Usage Rate</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {kbs.map((item, index) => (
              <Table.Row key={index}>
                <Table.Cell>
                  <Flex align="center" gap="3">
                    {/* KB icon */}
                    <Box className="flex h-8 w-8 items-center justify-center rounded bg-[#EEF4FF]">
                      <FileTextIcon className="text-blue-600" />
                    </Box>
                    {/* KB name with intersection observer for infinite scroll */}
                    <div
                      ref={index === kbs.length - 1 ? lastKbElementRef : null}
                      className="flex items-center justify-between"
                    >
                      <Text className="text-black-600 text-sm">{item.kb_name}</Text>
                    </div>
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Flex align="center" justify="end" gap="2">
                    <Box className="flex items-center gap-2">
                      <Text>{item.total_uses}</Text>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </Box>
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Flex align="center" justify="end" gap="2">
                    <Box className="flex items-center gap-2">
                      <PhoneIcon className="h-4 w-4 text-blue-500" />
                      <Text>{item.unique_calls}</Text>
                    </Box>
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Flex align="center" justify="end" gap="2">
                    <Box className="flex items-center gap-2">
                      <BarChart3Icon className="h-4 w-4 text-purple-500" />
                      <Text>{item.usage_rate.toFixed(1)}%</Text>
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

export default MostUsedKbs;