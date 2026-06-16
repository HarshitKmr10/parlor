import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { PaginationFooter } from "./PaginationFooter";

interface UsePaginationProps {
    searchText?: string;
}

const usePagination = ({ searchText }: UsePaginationProps = {}) => {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Initialize state from URL params or defaults
    const [totalCount, setTotalCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState(() =>
        Number(searchParams.get('page')) || 1
    );
    const [pageSize, setPageSize] = useState(() =>
        Number(searchParams.get('pageSize')) || 10
    );

    // Track previous search text to detect actual changes
    const prevSearchTextRef = useRef<string | undefined>(searchText);

    // Update URL when pagination changes
    const updateQueryParams = useCallback((page: number, size: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', page.toString());
        params.set('pageSize', size.toString());
        router.push(`?${params.toString()}`, { scroll: false });
    }, [searchParams, router]);

    // Reset to page 1 when search text actually changes
    useEffect(() => {
        if (searchText !== prevSearchTextRef.current) {
            prevSearchTextRef.current = searchText;
            setCurrentPage(1);
            updateQueryParams(1, pageSize);
        }
    }, [searchText, pageSize, updateQueryParams]);

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        updateQueryParams(newPage, pageSize);
    };

    const handlePageSizeChange = (value: string) => {
        const newSize = parseInt(value, 10);
        setPageSize(newSize);
        setCurrentPage(1);
        updateQueryParams(1, newSize);
    };

    const paginationComponent = (
        <PaginationFooter
            totalCount={totalCount}
            pageSize={pageSize}
            currentPage={currentPage}
            handlePageChange={handlePageChange}
            handlePageSizeChange={handlePageSizeChange}
        />
    );

    return {
        totalCount,
        setTotalCount,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        handlePageChange,
        handlePageSizeChange,
        paginationComponent,
    };
};

export default usePagination;
