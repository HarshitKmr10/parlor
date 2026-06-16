import { Text, Tooltip, Button, Flex, Select } from '@radix-ui/themes';



interface PaginationFooterProps {
    totalCount: number;
    pageSize: number;
    currentPage: number;
    handlePageChange: (page: number) => void;
    handlePageSizeChange: (pageSize: string) => void;
}

export const PaginationFooter = ({ totalCount,
    pageSize, currentPage, handlePageChange, handlePageSizeChange }: PaginationFooterProps) => {
    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <Flex justify="between" align="center" mt="2" mb="8" gap="3" px="2">
            <Flex align="center" gap="2">
                <Text size="2">Show:</Text>
                <Select.Root defaultValue={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <Select.Trigger variant="soft" />
                    <Select.Content>
                        <Select.Item value="5">5</Select.Item>
                        <Select.Item value="10">10</Select.Item>
                        <Select.Item value="20">20</Select.Item>
                        <Select.Item value="50">50</Select.Item>
                    </Select.Content>
                </Select.Root>
                <Text size="2">entries</Text>
            </Flex>
            <Text size="2">
                Page {currentPage} of {totalPages} (Total: {totalCount})
            </Text>
            <Flex gap="2">
                <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    variant="soft"
                >
                    Previous
                </Button>
                <Button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    variant="soft"
                >
                    Next
                </Button>
            </Flex>
        </Flex>
    );
};
