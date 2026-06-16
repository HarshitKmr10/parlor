'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Table, Text, Flex } from '@radix-ui/themes';
import {
  useTopReportedIssues,
  TopReportedIssueData,
} from '@/hooks/voice-virtial-agent/useTopReportedIssues';
import Shimmer from 'components/common/Shimmer';

// ─── Types & Interfaces ─────────────────────────────────────────────────────

/**
 * Props for the IssueDetailsTable component
 */
interface Props {
  orgId: string;
  timeframe: string;
}

// ─── Component Implementation ────────────────────────────────────────────────

/**
 * IssueDetailsTable Component
 *
 * Displays a table of top reported issues with various metrics including
 * issue title, type, count, employee count, IPE, and resolution rate.
 * Supports infinite scroll pagination and loading states.
 *
 * @param orgId - Organization ID for data filtering
 * @param timeframe - Time range filter for the issues
 */
const IssueDetailsTable = ({ orgId, timeframe }: Props) => {
  // ─── State Management ─────────────────────────────────────────────────────

  const [page, setPage] = useState(1);
  const [issues, setIssues] = useState<TopReportedIssueData[]>([]);

  // ─── Refs & Observers ─────────────────────────────────────────────────────

  const observer = useRef<IntersectionObserver | null>(null);

  // ─── Custom Hook Integration ──────────────────────────────────────────────

  const { data, loading, hasMore } = useTopReportedIssues({
    orgId,
    timeframe,
    page,
    pageSize: 10,
  });

  // ─── Intersection Observer for Infinite Scroll ────────────────────────────

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

  // ─── Effects ──────────────────────────────────────────────────────────────

  /**
   * Update issues when new data comes in from the API
   */
  useEffect(() => {
    if (data) {
      if (page === 1) {
        // Reset issues for first page
        setIssues(data);
      } else {
        // Append new issues for subsequent pages
        setIssues((prev) => [...prev, ...data]);
      }
    }
  }, [data, page]);

  /**
   * Reset pagination when orgId or timeframe changes
   */
  useEffect(() => {
    setPage(1);
    setIssues([]);
  }, [orgId, timeframe]);

  // ─── Loading Component ────────────────────────────────────────────────────

  /**
   * Renders shimmer loading animation for table rows
   */
  const renderShimmerLoading = () => (
    <Table.Body>
      {[...Array(6)].map((_, index) => (
        <Table.Row key={index}>
          {[...Array(6)].map((_, col) => (
            <Table.Cell key={col}>
              <Shimmer width="6rem" height="1.5rem" />
            </Table.Cell>
          ))}
        </Table.Row>
      ))}
    </Table.Body>
  );

  // ─── Render States ────────────────────────────────────────────────────────

  const noData = !loading && (!issues || issues.length === 0);

  // ─── Main Component Render ────────────────────────────────────────────────

  return (
    <Box className="mb-6 w-full rounded-lg border bg-white p-4">
      {/* Header */}
      <Flex justify="between" align="center" mb="3">
        <Text size="4" weight="medium">
          Top Reported Issues
        </Text>
      </Flex>

      {/* Table container with scroll */}
      <Box className="max-h-[400px] overflow-y-auto">
        <Table.Root>
          {/* Table Header */}
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Issue Description
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Category
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Severity
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Occurrences
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Affected Users
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Resolution Rate
                </Text>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          {/* No Data State */}
          {noData && (
            <Table.Body>
              <Table.Row>
                <Table.Cell colSpan={6} style={{ boxShadow: 'none' }}>
                  <Flex justify="center" align="center" className="h-[220px]">
                    <Text size="2" color="gray">
                      No data found
                    </Text>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          )}

          {/* Table Body with Data */}
          <Table.Body>
            {issues.map((item, index) => (
              <Table.Row key={`${item.issue_description}-${index}`}>
                <Table.Cell ref={index === issues.length - 1 ? lastRowRef : null}>
                  <Text size="2" weight="regular" className="cursor-help text-neutral-l2">
                    {item.issue_description}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="regular" className="capitalize text-neutral-l2">
                    {item.category}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    size="2"
                    weight="regular"
                    className={`rounded-full px-2 py-1 text-xs ${
                      item.severity === 'High'
                        ? 'bg-red-100 text-red-700'
                        : item.severity === 'Medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {item.severity}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="regular" className="text-neutral-l2">
                    {item.total_occurrences}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="regular" className="text-neutral-l2">
                    {item.affected_users_count}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="regular" className="text-neutral-l2">
                    {item.resolution_rate}%
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>

          {/* Loading State for Initial Load */}
          {loading && page === 1 && renderShimmerLoading()}
        </Table.Root>

        {/* Loading State for Pagination */}
        {loading && page > 1 && (
          <Box className="px-4 py-2">
            <Shimmer width="100%" height="2rem" />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default IssueDetailsTable;
