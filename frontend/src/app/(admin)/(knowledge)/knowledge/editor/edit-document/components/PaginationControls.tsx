'use client';

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Button, Text } from '@radix-ui/themes';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageChange?: (page: number) => void;
  className?: string;
}

export const PaginationControls = memo<PaginationControlsProps>(({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  onPageChange,
  className = '',
}) => {
  const { t } = useTranslation();

  if (totalPages <= 1) {
    return null;
  }

  const handlePageClick = (page: number) => {
    if (onPageChange && page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  // Calculate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <Flex
      align="center"
      justify="center"
      gap="2"
      className={`mt-4 py-2 h-16 ${className}`}
    >
      <Button
        variant="soft"
        size="2"
        onClick={onPrevious}
        disabled={currentPage === 1}
        className="cursor-pointer"
      >
        <ChevronLeft size={16} />
        <Text size="2">{t('knowledge_assist.previous', 'Previous')}</Text>
      </Button>

      <Flex align="center" gap="1">
        {pageNumbers.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <Text key={`ellipsis-${index}`} size="2" color="gray" className="px-2">
                ...
              </Text>
            );
          }

          const pageNum = page as number;
          const isActive = pageNum === currentPage;

          return (
            <Button
              key={pageNum}
              variant={isActive ? 'solid' : 'soft'}
              size="2"
              onClick={() => handlePageClick(pageNum)}
              className={`cursor-pointer min-w-[32px] ${
                isActive ? 'bg-blue-600 text-white' : ''
              }`}
            >
              <Text size="2" weight={isActive ? 'bold' : 'regular'}>
                {pageNum}
              </Text>
            </Button>
          );
        })}
      </Flex>

      <Button
        variant="soft"
        size="2"
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="cursor-pointer"
      >
        <Text size="2">{t('knowledge_assist.next', 'Next')}</Text>
        <ChevronRight size={16} />
      </Button>

      <Text size="2" color="gray" className="ml-2">
        {t('knowledge_assist.pageOf', 'Page {{current}} of {{total}}', {
          current: currentPage,
          total: totalPages,
        })}
      </Text>
    </Flex>
  );
});

PaginationControls.displayName = 'PaginationControls';

