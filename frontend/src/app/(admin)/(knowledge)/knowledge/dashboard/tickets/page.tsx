'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Table,
  Text,
  Select,
  IconButton,
  Spinner,
} from '@radix-ui/themes';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { ArrowLeftIcon, Download } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { aiAgentInstance } from 'api/common/axiosInstance';

interface Ticket {
  id: string;
  description: string;
  resolutionDate: string;
  suggestedKBMatch: string;
  suggestedKBMatchNumber?: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  limit: number;
}

interface TicketsResponse {
  data: {
    tickets: Ticket[];
    pagination: PaginationInfo;
  };
}

export default function TicketsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get('type') || 'without-kb';
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrevious: false,
    limit: 10,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isDownloading, setIsDownloading] = useState(false);

  const title = type === 'without-kb' ? 'Tickets Without KB Articles' : 'Tickets Missing KB Links';

  const fetchTickets = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await aiAgentInstance.get(
        `/api/v1/knowledgeassist/tickets?type=${type}&page=${page}&limit=${limit}`
      );

      if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TicketsResponse = response.data;
      setTickets(data.data.tickets);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets(currentPage, rowsPerPage);
  }, [type, currentPage, rowsPerPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRowsPerPageChange = (value: string) => {
    const newLimit = parseInt(value);
    setRowsPerPage(newLimit);
    setCurrentPage(1);
  };

  const handleBack = () => {
    router.push('/knowledge/dashboard');
  };

  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true);
      
      const response = await aiAgentInstance.get(
        `/api/v1/knowledgeassist/tickets/export?type=${type}`,
        {
          responseType: 'blob',
        }
      );

      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or create default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `tickets_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
    } catch (err) {
      console.error('Error downloading CSV:', err);
      setError('Failed to download CSV file');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <Flex direction="column" className="h-full">
        {/* Header */}
        <Box className="flex-shrink-0">
          <Flex
            align="center"
            justify="between"
            className="h-14 border-b border-[var(--gray-8)] bg-white"
            px="4"
          >
            <Flex align="center" gap="2">
              <ArrowLeftIcon
                className="cursor-pointer"
                onClick={handleBack}
              />
              <Text size="4" weight="medium">
                {title}
              </Text>
            </Flex>
          </Flex>
        </Box>

        {/* Loading content */}
        <Box className="flex-1 overflow-y-auto" p="4">
          <Flex align="center" justify="center" className="h-64">
            <Spinner size="3" />
          </Flex>
        </Box>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex direction="column" className="h-full">
        {/* Header */}
        <Box className="flex-shrink-0">
          <Flex
            align="center"
            justify="between"
            className="h-14 border-b border-[var(--gray-8)] bg-white"
            px="4"
          >
            <Flex align="center" gap="2">
              <ArrowLeftIcon
                className="cursor-pointer"
                onClick={handleBack}
              />
              <Text size="4" weight="medium">
                {title}
              </Text>
            </Flex>
          </Flex>
        </Box>

        {/* Error content */}
        <Box className="flex-1 overflow-y-auto" p="4">
          <Flex align="center" justify="center" className="h-64">
            <Box className="text-center">
              <Text size="4" className="text-red-600 mb-2">
                Error loading tickets
              </Text>
              <Text size="2" className="text-gray-600 mb-4">
                {error}
              </Text>
              <Button onClick={() => fetchTickets(currentPage, rowsPerPage)}>
                Retry
              </Button>
            </Box>
          </Flex>
        </Box>
      </Flex>
    );
  }

  return (
    <Flex direction="column" className="h-full">
      {/* Header */}
      <Box className="flex-shrink-0">
        <Flex
          align="center"
          justify="between"
          className="h-14 border-b border-[var(--gray-8)] bg-white"
          px="4"
        >
          <Flex align="center" gap="2">
            <ArrowLeftIcon
              className="cursor-pointer"
              onClick={handleBack}
            />
            <Text size="4" weight="medium">
              {title}
            </Text>
          </Flex>
          <Flex align="center" gap="4">
            <Button
              onClick={handleDownloadCSV}
              disabled={isDownloading || loading}
              variant="outline"
              size="2"
            >
              {isDownloading ? (
                <>
                  <Spinner size="1" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download CSV
                </>
              )}
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* Main content */}
      <Box className="flex-1 overflow-y-auto" p="4">
        <Box className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Table.Root>
            <Table.Header>
              <Table.Row className="bg-gray-50">
                <Table.ColumnHeaderCell>
                  <Text size="2" weight="medium" className="text-gray-700">
                    Ticket ID
                  </Text>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Text size="2" weight="medium" className="text-gray-700">
                    Description
                  </Text>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Text size="2" weight="medium" className="text-gray-700">
                    Article Name
                  </Text>
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>
                  <Text size="2" weight="medium" className="text-gray-700">
                    Article Number
                  </Text>
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            
            <Table.Body>
              {tickets.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={4}>
                    <Flex align="center" justify="center" className="py-8">
                      <Text size="3" className="text-gray-500">
                        No tickets found
                      </Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ) : (
                tickets.map((ticket) => (
                  <Table.Row key={ticket.id} className="hover:bg-gray-50">
                    <Table.Cell>
                      <Text size="2" className="text-blue-600 font-medium">
                        {ticket.id}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" className="text-gray-900">
                        {ticket.description}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" className="text-gray-700">
                        {ticket.suggestedKBMatch}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" className="text-gray-700">
                        {ticket.suggestedKBMatchNumber}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>

        {/* Pagination */}
        {tickets.length > 0 && (
          <Flex justify="between" align="center" className="mt-4">
            <Flex align="center" gap="2">
              <Text size="2" className="text-gray-700">
                Rows per page
              </Text>
              <Select.Root value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="5">5</Select.Item>
                  <Select.Item value="10">10</Select.Item>
                  <Select.Item value="25">25</Select.Item>
                  <Select.Item value="50">50</Select.Item>
                </Select.Content>
              </Select.Root>
            </Flex>

            <Flex align="center" gap="6">
              <Text size="2" className="text-gray-700">
                Showing {Math.min((pagination.currentPage - 1) * pagination.limit + 1, pagination.totalCount)} to {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of {pagination.totalCount} results
              </Text>
              
              <Flex align="center" gap="1">
                <Button
                  variant="ghost"
                  size="1"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrevious}
                  className="px-3"
                >
                  <ChevronLeftIcon />
                  Previous
                </Button>
                
                <Flex gap="1" mx="2">
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    const page = Math.max(1, Math.min(pagination.totalPages - 4, pagination.currentPage - 2)) + i;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "solid" : "ghost"}
                        size="1"
                        onClick={() => handlePageChange(page)}
                        className={`w-8 h-8 ${currentPage === page ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </Flex>
                
                <Button
                  variant="ghost"
                  size="1"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNext}
                  className="px-3"
                >
                  Next
                  <ChevronRightIcon />
                </Button>
              </Flex>
            </Flex>
          </Flex>
        )}
      </Box>
    </Flex>
  );
} 