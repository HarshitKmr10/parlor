'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Table, Text, Flex } from '@radix-ui/themes';
import { useCvaIssueDetailsData } from 'hooks/useCvaIssueDetailsData';
import Shimmer from 'components/common/Shimmer';

interface Props {
  orgId: string;
  timeframe: string;
}

const IssueDetailsTable = ({ orgId, timeframe }: Props) => {
  const [page, setPage] = useState(1);
  const observer = useRef<IntersectionObserver | null>(null);

  const { data: issues, loading, hasMore } = useCvaIssueDetailsData(orgId, timeframe, page);

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

  useEffect(() => {
    setPage(1);
  }, [orgId, timeframe]);

  const noData = !loading && (!issues || issues.length === 0);

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
          Issue Category
        </Text>
      </Flex>

      <Box className="max-h-[400px] overflow-y-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  Title
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
                  Employee
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="text-neutral-l2">
                  IPE
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
            {issues.map((item, index) => (
              <Table.Row key={`${item.issue}-${index}`}>
                <Table.Cell ref={index === issues.length - 1 ? lastRowRef : null}>
                  <Text size="2" weight="regular" className="text-neutral-l2">
                    {item.issue}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" weight="regular" className="text-neutral-l2 capitalize">
                    {item.issue_type}
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
                    {item.ipe}
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

export default IssueDetailsTable;
