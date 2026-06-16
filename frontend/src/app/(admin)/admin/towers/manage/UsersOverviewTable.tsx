import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Flex,
    Text,
    Button,
    TextField,
    Select,
    Table
} from '@radix-ui/themes';
import { MagnifyingGlassIcon, PlusIcon, Cross2Icon } from '@radix-ui/react-icons';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { toast } from 'react-toastify';
import CollectionAssignmentModal from './CollectionAssignmentModal';

interface Collection {
    id: string;
    name: string;
}

interface TowerUser {
    id: string;
    name: string;
    email: string;
    role: string;
    collections: Collection[];
    joined_date: string;
    user_principal_name: string;
}

interface TowerUsersResponse {
    users: TowerUser[];
    total_count: number;
    page: number;
    page_size: number;
    total_pages: number;
}

interface UsersOverviewTableProps {
    towerId: string | null;
    selectedCollections: Collection[];
    onRefresh?: () => void;
    onRefreshCollections?: () => void;
}

function UsersOverviewTable({ towerId, selectedCollections, onRefresh, onRefreshCollections }: UsersOverviewTableProps) {
    const [users, setUsers] = useState<TowerUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>('all');
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

    // Debounced search
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const fetchUsers = useCallback(async () => {
        if (!towerId) {
            setUsers([]);
            setTotalCount(0);
            setTotalPages(0);
            return;
        }

        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                page_size: pageSize.toString(),
            });

            if (debouncedSearchQuery.trim()) {
                params.append('search', debouncedSearchQuery);
            }

            if (selectedCollectionFilter !== 'all') {
                params.append('collection_id', selectedCollectionFilter);
            }

            const response = await serviceDeskInstance.get<TowerUsersResponse>(
                `/service_desk/towers/${towerId}/users?${params}`
            );

            const data = response.data;
            setUsers(data.users);
            setTotalCount(data.total_count);
            setTotalPages(data.total_pages);
        } catch (error) {
            console.log(`error.status: ${error.status}, error.response.data.message: ${error.response.data.message}`);
            if (error.status === 409) {
                toast.error(error.response.data.message);
            }
            else {
                toast.error('Failed to fetch tower users');
            }
            setUsers([]);
            setTotalCount(0);
            setTotalPages(0);
        } finally {
            setLoading(false);
        }
    }, [towerId, currentPage, pageSize, debouncedSearchQuery, selectedCollectionFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Reset to first page when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, selectedCollectionFilter]);

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    const handlePageSizeChange = (newPageSize: string) => {
        setPageSize(parseInt(newPageSize));
        setCurrentPage(1);
    };

    const handleRemoveUser = async (userId: string) => {
        // TODO: Implement user removal API call
        console.log('Remove user:', userId);
        toast.info('User removal functionality to be implemented');
    };

    const handleRemoveCollectionFromUser = async (userId: string, collectionId: string) => {
        try {
            const params = new URLSearchParams();
            if (towerId) {
                params.append('tower_id', towerId);
            }
            
            await serviceDeskInstance.delete(
                `/service_desk/collections/${collectionId}/users/${userId}?${params.toString()}`
            );
            toast.success('Collection removed from user successfully');
            fetchUsers();
        } catch (error) {
            console.error('Error removing collection from user:', error);
            toast.error('Failed to remove collection from user');
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <Box className="mb-8">
            <Flex justify="between" align="center" className="mb-4">
                <Box>
                    <Text size="5" weight="bold">Users Overview</Text>
                    <br />
                    <Text size="2" color="gray" className="mt-1">
                        Users in Selected Tower: {totalCount}
                    </Text>
                </Box>
                {/* Only show Add User button when editing an existing tower */}
                {Boolean(towerId) && (
                    <Flex gap="2">
                        <Button size="2" variant="soft" onClick={() => setIsAssignmentModalOpen(true)}>
                            <PlusIcon />
                            Add User
                        </Button>
                    </Flex>
                )}
            </Flex>

            {/* Search and Filter Bar */}
            <Flex justify="between" align="center" className="mb-4">
                <Flex gap="3" align="center">
                    <Box>
                        <Text size="2" weight="medium" className="mr-2">Collections</Text>
                        <Select.Root value={selectedCollectionFilter} onValueChange={setSelectedCollectionFilter}>
                            <Select.Trigger className="w-48" />
                            <Select.Content>
                                <Select.Item value="all">All Collections</Select.Item>
                                {selectedCollections.map((collection) => (
                                    <Select.Item key={collection.id} value={collection.id}>
                                        {collection.name}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                    </Box>
                </Flex>
                <Box className="relative">
                    <TextField.Root
                        placeholder="Search User"
                        size="2"
                        className="w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    >
                        <TextField.Slot>
                            <MagnifyingGlassIcon height="16" width="16" />
                        </TextField.Slot>
                    </TextField.Root>
                </Box>
            </Flex>

            {/* Users Table */}
            {loading ? (
                <Flex justify="center" align="center" className="h-32">
                    <Text>Loading users...</Text>
                </Flex>
            ) : users.length === 0 ? (
                <Flex direction="column" align="center" justify="center" className="h-32 border border-dashed border-[var(--gray-6)] rounded-lg">
                    <Text size="4" color="gray" className="mb-2">No users found</Text>
                    <Text size="2" color="gray" className="mb-4">
                        {towerId ? 'No users assigned to this tower' : 'Please save the tower first to see users'}
                    </Text>
                </Flex>
            ) : (
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeaderCell>ROLE NAME</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Names</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Collections Assigned</Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell>Joined on</Table.ColumnHeaderCell>
                            {/* <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell> */}
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {users.map((user) => (
                            <Table.Row key={user.id}>
                                <Table.Cell>
                                    <Text size="2" weight="medium">{user.role}</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text size="2" weight="medium">{user.name} ({user.email})</Text>
                                </Table.Cell>
                                <Table.Cell>
                                    <Flex gap="1" wrap="wrap">
                                        {user.collections.map((collection) => (
                                            <Flex
                                                key={collection.id}
                                                align="center"
                                                gap="1"
                                                className="bg-[var(--blue-3)] text-[var(--blue-11)] px-2 py-1 rounded text-xs"
                                            >
                                                <Text size="1">{collection.name}</Text>
                                                <Box
                                                    className="cursor-pointer hover:bg-[var(--blue-4)] rounded p-0.5"
                                                    onClick={() => handleRemoveCollectionFromUser(user.id, collection.id)}
                                                >
                                                    <Cross2Icon width="10" height="10" />
                                                </Box>
                                            </Flex>
                                        ))}
                                    </Flex>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text size="2" color="gray">
                                        {formatDate(user.joined_date)}
                                    </Text>
                                </Table.Cell>
                                {/* <Table.Cell>
                                    <Text size="2" color="gray">—</Text>
                                </Table.Cell> */}
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table.Root>
            )}

            {/* Pagination */}
            {users.length > 0 && (
                <Flex justify="between" align="center" className="mt-4">
                    <Flex align="center" gap="2">
                        <Text size="2" color="gray">Rows per page</Text>
                        <Select.Root value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                            <Select.Trigger className="w-16" />
                            <Select.Content>
                                <Select.Item value="10">10</Select.Item>
                                <Select.Item value="25">25</Select.Item>
                                <Select.Item value="50">50</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    </Flex>
                    <Flex align="center" gap="2">
                        <Button
                            variant="ghost"
                            size="1"
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                        >
                            Previous
                        </Button>
                        <Flex gap="1">
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                const pageNumber = i + 1;
                                return (
                                    <Button
                                        key={pageNumber}
                                        variant={currentPage === pageNumber ? "solid" : "ghost"}
                                        size="1"
                                        onClick={() => handlePageChange(pageNumber)}
                                    >
                                        {pageNumber}
                                    </Button>
                                );
                            })}
                            {totalPages > 5 && (
                                <>
                                    <Text size="2" color="gray">...</Text>
                                    <Button
                                        variant="ghost"
                                        size="1"
                                        onClick={() => handlePageChange(totalPages)}
                                    >
                                        {totalPages}
                                    </Button>
                                </>
                            )}
                        </Flex>
                        <Button
                            variant="ghost"
                            size="1"
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                        >
                            Next
                        </Button>
                    </Flex>
                </Flex>
            )}

            {/* Collection Assignment Modal */}
            {Boolean(towerId) && (
                <CollectionAssignmentModal
                    open={isAssignmentModalOpen}
                    onClose={() => setIsAssignmentModalOpen(false)}
                    towerId={towerId}
                    towerCollections={selectedCollections}
                    onAssignmentComplete={() => {
                        fetchUsers();
                        if (onRefresh) onRefresh();
                    }}
                    onRefreshCollections={onRefreshCollections}
                />
            )}
        </Box>
    );
}

export default UsersOverviewTable; 