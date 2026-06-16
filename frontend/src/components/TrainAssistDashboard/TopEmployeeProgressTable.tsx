'use client';
import React, { useState, useCallback } from 'react';
import { Box, Text, Table, Flex } from '@radix-ui/themes';
import Shimmer from 'components/common/Shimmer';
import CustomAvatar from 'components/CustomAvatar';
import { useEmployeeProgress } from '../../hooks/train-assist/useEmployeeProgress';

interface TopEmployeeProgressTableProps {
  orgId?: string;
}

const TopEmployeeProgressTable: React.FC<TopEmployeeProgressTableProps> = ({
  orgId,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

  const { employees, loading } = useEmployeeProgress({
    orgId,
    isActive: activeTab === 'active',
  });

  const renderShimmerLoading = useCallback(() => {
    return (
      <Table.Body className="w-full">
        {[...Array(6)].map((_, index) => (
          <Table.Row key={index}>
            <Table.Cell>
              <Flex gap="3">
                <Shimmer
                  borderRadius="100%"
                  height="30px"
                  width="30px"
                />
                <Shimmer width="6rem" height="1.5rem" />
              </Flex>
            </Table.Cell>
            <Table.Cell>
              <Shimmer width="3rem" height="2rem" />
            </Table.Cell>
            <Table.Cell>
              <Shimmer width="3rem" height="2rem" />
            </Table.Cell>
            <Table.Cell>
              <Shimmer width="3rem" height="2rem" />
            </Table.Cell>
            <Table.Cell>
              <Shimmer width="3rem" height="2rem" />
            </Table.Cell>
            <Table.Cell>
              <Shimmer width="3rem" height="2rem" />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    );
  }, []);

  if (!employees?.length && !loading) {
    return (
      <Box className="mb-6 rounded-lg border bg-white p-4">
        <Flex justify="between" align="center" mb="4">
          <Text size="4" weight="medium" className="pl-3.5">
            Top Employee Progress
          </Text>
          <Flex gap="2">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 rounded-md text-sm ${
                activeTab === 'active'
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`px-3 py-1 rounded-md text-sm ${
                activeTab === 'inactive'
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              Inactive
            </button>
          </Flex>
        </Flex>
        <Box className="h-[330px] flex items-center justify-center">
          <Text color="gray">No employee data available</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="mb-6 rounded-lg border bg-white p-4">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="medium" className="pl-3.5">
          Top Employee Progress
        </Text>
        <Flex gap="2">
          <button
            onClick={() => setActiveTab('active')}
            className={`rounded-md px-3 py-1 text-sm ${
              activeTab === 'active' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab('inactive')}
            className={`rounded-md px-3 py-1 text-sm ${
              activeTab === 'inactive' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            }`}
          >
            Inactive
          </button>
        </Flex>
      </Flex>
      
      <Box className="h-[330px] overflow-y-auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Employees</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Topics</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Modules</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Quiz Score</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Simulations</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Avg Score</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          {loading ? (
            <>{renderShimmerLoading()}</>
          ) : (
            <Table.Body>
              {employees?.map((employee) => (
                <Table.Row key={employee.id}>
                  <Table.Cell>
                    <Flex gap="3">
                      <CustomAvatar
                        alt={employee.name}
                        name={employee.name}
                        extra="rounded-full bg-gray-200 text-xs"
                        height="30px"
                        width="30px"
                        src={null}
                      />
                      <Text>{employee.name}</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" justify="start">
                      <Text>{employee.topics}</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" justify="start">
                      <Text>{employee.modulesStarted}</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" justify="start">
                      <Text>{employee.avgQuizScore}</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" justify="start">
                      <Text>{employee.simulationsDone}</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" justify="start">
                      <Text>{employee.avgScore}</Text>
                    </Flex>
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

export default TopEmployeeProgressTable; 