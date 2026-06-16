'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Flex, Text, Table, Tooltip } from '@radix-ui/themes';
import { Info } from 'lucide-react';
import Shimmer from 'components/common/Shimmer/Shimmer';
import { VCPIssueDetail, VCPIssueDetailsResponse } from 'hooks/useVoiceCopilotDashboard';

interface IssueDetailsTableProps {
  data: VCPIssueDetailsResponse | null;
  loading: boolean;
  onPageChange?: (page: number) => void;
}

export default function IssueDetailsTable({ data, loading, onPageChange }: IssueDetailsTableProps) {
  const [issues, setIssues] = useState<VCPIssueDetail[]>([]);
  const [page, setPage] = useState(1);
  const observer = useRef<IntersectionObserver | null>(null);

  // Accumulate data on page change (infinite scroll)
  useEffect(() => {
    if (data?.issues) {
      if (data.pagination.page === 1) {
        setIssues(data.issues);
      } else {
        setIssues((prev) => [...prev, ...data.issues]);
      }
    }
  }, [data]);

  // Infinite scroll callback
  const lastRowRef = useCallback(
    (node: HTMLElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && data?.pagination.page && data.pagination.page < data.pagination.total_pages) {
          const nextPage = data.pagination.page + 1;
          setPage(nextPage);
          if (onPageChange) {
            onPageChange(nextPage);
          }
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, data, onPageChange]
  );

  const getResolutionColor = (rate: number) => {
    if (rate >= 70) return 'text-green-600';
    if (rate >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Box className="rounded-lg border bg-white p-4">
      <Flex justify="between" align="center" className="mb-4">
        <Text size="5" weight="medium">Issue Details</Text>
        {data?.pagination && (
          <Text size="2" className="text-gray-500">
            Showing {issues.length} of {data.pagination.total} grouped issues
          </Text>
        )}
      </Flex>

      <Box className="h-[500px] overflow-y-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell style={{ width: '40%' }}>
                <Text size="2" weight="regular" className="text-gray-600">Issue Description</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: '15%' }}>
                <Text size="2" weight="regular" className="text-gray-600">Category</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: '12%' }}>
                <Text size="2" weight="regular" className="text-gray-600">Occurrences</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: '13%' }}>
                <Text size="2" weight="regular" className="text-gray-600">Affected Users</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: '15%' }}>
                <Text size="2" weight="regular" className="text-gray-600">Resolution Rate</Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ width: '5%' }}>
                <Text size="2" weight="regular" className="text-gray-600"></Text>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {loading && issues.length === 0 ? (
              // Initial loading state
              [...Array(10)].map((_, index) => (
                <Table.Row key={index}>
                  <Table.Cell><Shimmer width="90%" height="1.5rem" /></Table.Cell>
                  <Table.Cell><Shimmer width="5rem" height="1.5rem" /></Table.Cell>
                  <Table.Cell><Shimmer width="3rem" height="1.5rem" /></Table.Cell>
                  <Table.Cell><Shimmer width="3rem" height="1.5rem" /></Table.Cell>
                  <Table.Cell><Shimmer width="4rem" height="1.5rem" /></Table.Cell>
                  <Table.Cell></Table.Cell>
                </Table.Row>
              ))
            ) : issues.length > 0 ? (
              <>
                {issues.map((issue, index) => {
                  const isLast = index === issues.length - 1;
                  return (
                    <Table.Row key={`${issue.issue}-${index}`} ref={isLast ? lastRowRef : null}>
                      <Table.Cell>
                        <Text size="2" className="text-neutral-l2">
                          {issue.issue}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" className="text-neutral-l2 capitalize">
                          {issue.issue_type}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" weight="medium" className="text-neutral-l2">
                          {issue.issue_count}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" className="text-neutral-l2">
                          {issue.employee_count}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" weight="bold" className={getResolutionColor(issue.resolution_rate)}>
                          {issue.resolution_rate}%
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        {issue.similar_queries && issue.similar_queries.length > 1 && (
                          <Tooltip
                            content={
                              <Box style={{ maxWidth: '300px' }}>
                                <Text size="1" weight="bold" className="mb-2">Similar queries:</Text>
                                <ul className="list-disc pl-4 space-y-1">
                                  {issue.similar_queries.slice(0, 5).map((query, idx) => (
                                    <li key={idx}>
                                      <Text size="1">{query}</Text>
                                    </li>
                                  ))}
                                </ul>
                              </Box>
                            }
                          >
                            <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                          </Tooltip>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}

                {/* Loading more indicator */}
                {loading && issues.length > 0 && (
                  <Table.Row>
                    <Table.Cell><Shimmer width="90%" height="1.5rem" /></Table.Cell>
                    <Table.Cell><Shimmer width="5rem" height="1.5rem" /></Table.Cell>
                    <Table.Cell><Shimmer width="3rem" height="1.5rem" /></Table.Cell>
                    <Table.Cell><Shimmer width="3rem" height="1.5rem" /></Table.Cell>
                    <Table.Cell><Shimmer width="4rem" height="1.5rem" /></Table.Cell>
                    <Table.Cell></Table.Cell>
                  </Table.Row>
                )}
              </>
            ) : (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Flex justify="center" align="center" className="py-8">
                    <Text size="2" color="gray">No issue details available</Text>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  );
}
