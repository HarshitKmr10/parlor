'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Table, Text, Flex } from '@radix-ui/themes';
import { useAgentAssistIssueDetails } from 'hooks/AgentAssistDashboard/useAgentAssistIssueDetails';
import Shimmer from 'components/common/Shimmer';

interface Props {
  orgId: string;
  timeframe: string;
  isVersionV3?: boolean;
}

const AgentAssistIssueTable = ({ orgId, timeframe, isVersionV3 }: Props) => {
  const [page, setPage] = useState(1);
  const [allIssues, setAllIssues] = useState<any[]>([]);
  const [lastProcessedPage, setLastProcessedPage] = useState(0);
  const observer = useRef<IntersectionObserver | null>(null);

  const { data, loading, error } = useAgentAssistIssueDetails(orgId, timeframe, isVersionV3, page, 10);

  useEffect(() => {
    if (data?.issues && data.page && data.page !== lastProcessedPage) {
      if (data.page === 1) {
        // First page, replace all issues
        setAllIssues(data.issues);
        setLastProcessedPage(1);
      } else {
        // Append new issues for infinite scroll only if this is a new page
        setAllIssues((prev) => {
          // Check if any of the new issues already exist to prevent duplicates
          const existingIssues = new Set(prev.map(item => `${item.issue}-${item.issue_type}`));
          const newIssues = data.issues.filter(
            item => !existingIssues.has(`${item.issue}-${item.issue_type}`)
          );
          return [...prev, ...newIssues];
        });
        setLastProcessedPage(data.page);
      }
    }
  }, [data, lastProcessedPage]);

  const lastRowRef = useCallback(
    (node: HTMLElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && data && page < data.total_pages) {
          setPage((prev) => prev + 1);
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, data, page],
  );

  useEffect(() => {
    setPage(1);
    setAllIssues([]);
    setLastProcessedPage(0);
  }, [orgId, timeframe]);

  const noData = !loading && allIssues.length === 0;

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

  return (
    <Box className="mb-6 rounded-lg border bg-white p-4 w-full">
      <Flex justify="between" align="center" mb="3">
        <Text size="4" weight="medium">
          Issue Details
        </Text>
        {data && (
          <Text size="2" color="gray">
            Total: {data.total} issues
          </Text>
        )}
      </Flex>

      <Box className="max-h-[400px] overflow-y-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Issue
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Issue Type
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Issue Count
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Agent Count
                </Text>
              </Table.ColumnHeaderCell>
             
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Resolution Rate
                </Text>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          {/* No Data */}
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

          <Table.Body>
            {allIssues.map((item, index) => (
              <Table.Row key={`${item.issue}-${index}`}>
                <Table.Cell ref={index === (allIssues.length - 1) ? lastRowRef : null}>
                  <Text size="2" weight="regular" className="text-neutral-l2">
                    {item.issue}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="regular" className="text-neutral-l2 capitalize">
                    {item.issue_type || 'N/A'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="regular" className="text-neutral-l2">
                    {item.issue_count}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="regular" className="text-neutral-l2">
                    {item.employee_count}
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
};

export default AgentAssistIssueTable;
