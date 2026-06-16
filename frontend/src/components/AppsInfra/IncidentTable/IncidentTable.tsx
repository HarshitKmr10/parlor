'use client';

// ─────────────────────────────────────────────────────────────
// React & Next.js
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────
// UI Libraries & Animation
// ─────────────────────────────────────────────────────────────
import { Box, Flex, Table } from '@radix-ui/themes';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

// ─────────────────────────────────────────────────────────────
// Components & Hooks
// ─────────────────────────────────────────────────────────────
import SeverityBadge from './SeverityBadge';
import StatusBadge from './StatusBadge';
import Shimmer from 'components/common/Shimmer';
import { useIncidentTableData } from 'hooks/AppsInfra/useIncidentTableData';

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
import {
  cellBaseClass,
  dividerSpan,
  pageActiveClass,
  pageDotClass,
  pageNumberClass,
  paginationButtonClass,
  paginationWrapperClass,
} from './IncidentTable.style';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────
// Component: IncidentTable
// ─────────────────────────────────────────────────────────────
const IncidentTable = () => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const { data, loading, error } = useIncidentTableData();

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return data.slice(start, start + rowsPerPage);
  }, [data, currentPage]);

  if (error) toast.error('Failed to fetch Incident');

  // ─────────────────────────────────────────────
  // Render shimmer placeholder while loading
  // ─────────────────────────────────────────────
  const renderShimmerRows = () => (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <Table.Row key={index} className="h-[36px]">
          <Table.Cell className={`w-[10%] ${cellBaseClass}`}>
            <Shimmer width="60px" height="16px" borderRadius="4px" />
            <span className={dividerSpan} />
          </Table.Cell>
          <Table.Cell className={`w-[30%] ${cellBaseClass}`}>
            <Shimmer width="200px" height="16px" borderRadius="4px" />
            <span className={dividerSpan} />
          </Table.Cell>
          <Table.Cell className={cellBaseClass}>
            <Shimmer width="60px" height="20px" borderRadius="12px" />
            <span className={dividerSpan} />
          </Table.Cell>
          <Table.Cell className={cellBaseClass}>
            <Shimmer width="60px" height="20px" borderRadius="12px" />
            <span className={dividerSpan} />
          </Table.Cell>
          <Table.Cell className={cellBaseClass}>
            <Shimmer width="120px" height="16px" borderRadius="4px" />
            <span className={dividerSpan} />
          </Table.Cell>
          <Table.Cell className={cellBaseClass}>
            <Flex align="center" gap="2">
              <Shimmer width="30px" height="30px" borderRadius="999px" />
              <Shimmer width="80px" height="16px" borderRadius="4px" />
            </Flex>
          </Table.Cell>
        </Table.Row>
      ))}
    </>
  );

  // ─────────────────────────────────────────────
  // Render pagination control
  // ─────────────────────────────────────────────
  const renderPagination = useCallback(() => {
    const pages = [];

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
        pages.push(
          <button
            key={i}
            onClick={() => setCurrentPage(i)}
            className={i === currentPage ? pageActiveClass : pageNumberClass}
          >
            {i}
          </button>,
        );
      } else if (
        (i === currentPage - 2 || i === currentPage + 2) &&
        !pages.find((p) => p.key === `ellipsis-${i}`)
      ) {
        pages.push(
          <div key={`ellipsis-${i}`} className={pageDotClass}>
            ..
          </div>,
        );
      }
    }

    return (
      <Flex justify="center" align="center" className={paginationWrapperClass}>
        <Flex gap="2" align="center" className="gap-[10px]">
          <button
            className={paginationButtonClass}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            &lt; Previous
          </button>
          {pages}
          <button
            className={paginationButtonClass}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next &gt;
          </button>
        </Flex>
      </Flex>
    );
  }, [currentPage, totalPages]);

  // ─────────────────────────────────────────────
  // Animation Config
  // ─────────────────────────────────────────────
  const fadeProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <Box>
      <Table.Root variant="surface" className="w-full rounded-sm">
        {/* Table Header */}
        <Table.Header>
          <Table.Row
            className="h-[36px] rounded-t-[4px] border-[#00002F26] px-[9px] py-[2px]"
            style={{ width: '1390.19px' }}
          >
            <Table.ColumnHeaderCell className={`w-[10%] ${cellBaseClass}`}>
              Incident ID <span className={dividerSpan} />
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell className={`w-[30%] ${cellBaseClass}`}>
              Incident Title <span className={dividerSpan} />
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell className={cellBaseClass}>
              Severity <span className={dividerSpan} />
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell className={cellBaseClass}>
              Status <span className={dividerSpan} />
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell className={cellBaseClass}>
              Last Updated <span className={dividerSpan} />
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell className={cellBaseClass}>Action</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>

        {/* Animated Body */}
        <AnimatePresence mode="wait">
          <motion.tbody key={loading ? 'shimmer' : 'data'} {...fadeProps}>
            {loading
              ? renderShimmerRows()
              : paginatedData.map((incident) => (
                  <Table.Row
                    key={incident.id}
                    className="h-[36px] cursor-pointer hover:bg-gray-100"
                  >
                    <Table.Cell className={`w-[10%] max-w-[111px] truncate ${cellBaseClass}`}>
                      <Link
                        href={`apps/incidents/${incident.id}`}
                        className="truncate text-xs text-gray-900"
                      >
                        {incident.number}
                      </Link>
                      <span className={dividerSpan} />
                    </Table.Cell>
                    <Table.Cell className={`w-[30%] max-w-[400px] truncate ${cellBaseClass}`}>
                      <Link
                        href={`apps/incidents/${incident.id}`}
                        className="truncate text-xs text-gray-900"
                      >
                        {incident.description}
                      </Link>
                      <span className={dividerSpan} />
                    </Table.Cell>
                    <Table.Cell className={cellBaseClass}>
                      <Link href={`apps/incidents/${incident.id}`}>
                        <SeverityBadge level={incident?.severity || 'low'} />
                        <span className={dividerSpan} />
                      </Link>
                    </Table.Cell>
                    <Table.Cell className={cellBaseClass}>
                      <Link href={`apps/incidents/${incident.id}`}>
                        <StatusBadge status={incident?.status} />
                        <span className={dividerSpan} />
                      </Link>
                    </Table.Cell>
                    <Table.Cell className={cellBaseClass}>
                      <Link href={`apps/incidents/${incident.id}`}>
                        {new Date(incident?.created_at).toLocaleString()}
                        <span className={dividerSpan} />
                      </Link>
                    </Table.Cell>
                    <Table.Cell className={cellBaseClass}>
                      <Link
                        href={`apps/incidents/${incident.id}`}
                        className="cursor-pointer truncate text-xs text-iris-9"
                      >
                        Start Troubleshooting &gt;
                      </Link>
                    </Table.Cell>
                  </Table.Row>
                ))}
          </motion.tbody>
        </AnimatePresence>
      </Table.Root>

      {/* Pagination */}
      {renderPagination()}
    </Box>
  );
};

export default IncidentTable;
