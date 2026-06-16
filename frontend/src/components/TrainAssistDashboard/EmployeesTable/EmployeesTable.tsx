'use client';

import React, { useState, useCallback } from 'react';
import { Box, Text, Table, Flex, Spinner } from '@radix-ui/themes';
import Shimmer from 'components/common/Shimmer';
import CustomAvatar from 'components/CustomAvatar';
import { useEmployeeProgress } from 'hooks/train-assist/useEmployeeProgress';
import { DownloadIcon } from 'lucide-react';
import { useTrainAssistExport } from 'hooks/train-assist/useTrainAssistExport';
import clsx from 'clsx';

interface EmployeesTableProps {
  orgId?: string;
  timeframe: string;
  tagId?: string;
}

const EmployeesTable: React.FC<EmployeesTableProps> = ({ orgId, timeframe, tagId }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

  const { employees, loading } = useEmployeeProgress({
    orgId,
    isActive: activeTab === 'active',
    timeframe,
    tagId
  });

  const { downloadTrainAssistMetrics, loading: metricLoading } = useTrainAssistExport();

  const handleExport = useCallback(async () => {
    try {
      await downloadTrainAssistMetrics({
        orgId: orgId || '',
        period: timeframe,
        tagId: tagId === "all" ? "" : tagId
      });
    } catch (err) {
      alert('Failed to download file');
    }
  }, [timeframe]);

  const noData = !loading && (!employees || employees.length === 0);

  const renderShimmerLoading = () => (
    <Table.Body>
      {[...Array(4)].map((_, index) => (
        <Table.Row key={index}>
          <Table.Cell>
            <Flex gap="3">
              <Shimmer borderRadius="10%" height="24px" width="24px" />
              <Shimmer width="6rem" height="1.5rem" />
            </Flex>
          </Table.Cell>
          {[...Array(4)].map((_, i) => (
            <Table.Cell key={i}>
              <Shimmer width="3rem" height="2rem" />
            </Table.Cell>
          ))}
        </Table.Row>
      ))}
    </Table.Body>
  );

  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      {/* Header */}
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="medium" className="pl-3.5">
          Top Employee Progress
        </Text>

        <Flex
          onClick={() => !noData ? handleExport(): () => {}}
          justify="center"
          align="center"
          className={clsx("h-8 cursor-pointer rounded-md border border-gray-300 px-3 transition hover:bg-gray-50", noData && "opacity-5 cursor-not-allowed")}
        >
          {metricLoading ? (
            <Spinner />
          ) : (
            <>
              <DownloadIcon className="h-3.5 w-3.5" />
              <Text className="ml-2 text-sm font-medium">Export</Text>
            </>
          )}
        </Flex>
      </Flex>

      {/* Table */}
      <Box className="h-[241px] overflow-y-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  Employees
                </Text>
              </Table.ColumnHeaderCell>

              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  Modules Completed
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  Avg Quiz Score
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  Simulations
                </Text>
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <Text size="2" weight="regular" className="leading-[100%] text-gray-600">
                  Completion Rate
                </Text>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          {/* Loading */}
          {loading && renderShimmerLoading()}

          {/* No Data */}
          {noData && (
            <Table.Body>
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Flex justify="center" align="center" className="h-[160px]">
                    <Text size="2" color="gray">
                      No data found
                    </Text>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          )}

          {/* Data */}
          {!loading && employees?.length > 0 && (
            <Table.Body>
              {employees.map((employee) => (
                <Table.Row key={employee.id}>
                  <Table.Cell>
                    <Flex gap="2" align="center">
                      <CustomAvatar
                        alt={employee.name}
                        name={employee.name}
                        extra="rounded-sm bg-gray-200 text-xs"
                        height="24px"
                        width="24px"
                        src={null}
                      />
                      <Text size="2" weight="regular" className="text-neutral-l2">
                        {employee.name}
                      </Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="regular" className="text-neutral-l2">
                      {employee.modulesStarted}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="regular" className="text-neutral-l2">
                      {employee.avgQuizScore}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="regular" className="text-neutral-l2">
                      {employee.simulationsDone}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" weight="regular" className="text-neutral-l2">
                      {employee.avgScore}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          )}
        </Table.Root>
      </Box>
    </Box>
  );
};

export default EmployeesTable;
