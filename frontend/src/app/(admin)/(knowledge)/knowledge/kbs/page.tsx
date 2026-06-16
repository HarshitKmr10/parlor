'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, Flex, Card, AlertDialog, Button, Box, Dialog, Select } from '@radix-ui/themes';
import { ExclamationTriangleIcon, TrashIcon, EyeOpenIcon, DownloadIcon, ArrowUpIcon, CheckIcon } from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';

import { stringUtils } from 'utils/stringUtils';
import { PostcallTopics } from 'api/postcallTopcs';
import { useGlobalContext } from 'contexts/store';
import { PostcallTopicListView } from 'types/postcallTopicTypes';
import { Spinner } from '@radix-ui/themes';
import { API_ENDPOINTS } from 'constants/dashboard';
import OpenTicketIcon from 'components/icons/OpenTicketIcon';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { serviceDeskInstance } from 'api/common/axiosInstance';
import { ArrowLeftIcon } from 'lucide-react';
import SearchBar from 'components/voicevirtualagent/SearchBar';
import CustomTable, { Column } from 'components/common/CustomTable/CustomTable';
import { KbCollectionSource } from 'types/dashboard';

import { useForm } from 'react-hook-form';
import useDebounce from 'hooks/useDebounce';
import Link from 'next/link';

interface FormValues {
  search: string;
}

interface Collection {
    id: string;
    name: string;
    source: string;
    source_config: Record<string, any>;
}

export default function KBsPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [selectedKbs, setSelectedKbs] = useState<string[]>([]);
    const [kbs, setKbs] = useState<PostcallTopicListView[]>([]);
    const [kbsLoading, setKbsLoading] = useState<boolean>(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user, selectedTeam } = useGlobalContext();
    const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
    const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [isLoadingCollections, setIsLoadingCollections] = useState(true);
    const [showCollectionsDialog, setShowCollectionsDialog] = useState(false);
    const [selectedCollectionForAdd, setSelectedCollectionForAdd] = useState('');
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [isAddingToCollection, setIsAddingToCollection] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [kbToDelete, setKbToDelete] = useState<PostcallTopicListView | null>(null);
    const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);

    // Setup react-hook-form for the search input
    const { register, watch } = useForm<FormValues>({ defaultValues: { search: '' } });
    const searchValue = watch('search');
    const debouncedSearchValue = useDebounce<string>(searchValue, 300);

    // Determine if we are in the midst of filtering (waiting on debounce)
    const isFiltering = searchValue !== debouncedSearchValue;

    useEffect(() => {
        const fetchKBs = async () => {
            setKbsLoading(true);
            try {
                setError(null);
                const response = await PostcallTopics.getAllKTPostcallTopics(selectedTeam.id, user);
                setKbs(response);
            } catch (error) {
                setError(t('knowledge_assist.failedToFetchKBs'));
                console.error('Error fetching KBs:', error);
            } finally {
                setTimeout(() => {
                    setKbsLoading(false);
                }, 300);
                setLoading(false);
            }
        };

        fetchKBs();
    }, []);

    const filteredKbs = useMemo(() => {
      const lowerCaseSearch = debouncedSearchValue.toLowerCase();
      return kbs.filter((kb) => {
        if (!debouncedSearchValue) return true;

        const topic = kb.topic?.toLowerCase() || '';
        const meetingTitle = kb.meetings?.title?.toLowerCase() || '';
        return topic.includes(lowerCaseSearch) || meetingTitle.includes(lowerCaseSearch);
      });
    }, [kbs, debouncedSearchValue]);

    useEffect(() => {
        const fetchCollections = async () => {
            try {
                setIsLoadingCollections(true);
                // Use Knowledge Assist collections endpoint with RBAC
                const response = await serviceDeskInstance.get(API_ENDPOINTS.KNOWLEDGE_ASSIST_COLLECTIONS);

                if (response.status !== 200) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = response.data;
                if (data.success && data.data) {
                    setCollections(data.data);
                }
            } catch (error) {
                console.error('Error fetching collections:', error);
                toast.error(t('knowledge_assist.failedToLoadCollections'));
            } finally {
                setIsLoadingCollections(false);
            }
        };

        if (user?.access_token) {
            fetchCollections();
        }
    }, [user?.access_token]);

    const handlePreview = async (kb: PostcallTopicListView) => {
        if (!user) return;

        setPreviewLoadingId(kb.id);
        try {
            const pdfBlob = await PostcallTopics.getPostcallTopicKbEntryPdf(kb.id, user);
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            setTimeout(() => {
                URL.revokeObjectURL(pdfUrl);
            }, 100);
        } catch (error) {
            console.error('Error generating PDF preview:', error);
            toast.error(t('knowledge_assist.failedToGeneratePDFPreview'));
        } finally {
            setPreviewLoadingId(null);
        }
    };

    const handleDelete = async (kb: PostcallTopicListView) => {
        setKbToDelete(kb);
        setShowSingleDeleteConfirm(true);
    };

    const confirmSingleDelete = async () => {
        if (!user || !kbToDelete) return;

        setDeleteLoadingId(kbToDelete.id);
        try {
            await PostcallTopics.deletePostcallTopic(kbToDelete.id, user);
            setKbs(prevKbs => prevKbs.filter(k => k.id !== kbToDelete.id));
            toast.success(t('knowledge_assist.kbDeletedSuccessfully'));
        } catch (error) {
            console.error('Error deleting KB:', error);
            toast.error(t('knowledge_assist.failedToDeleteKB'));
        } finally {
            setDeleteLoadingId(null);
            setShowSingleDeleteConfirm(false);
            setKbToDelete(null);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
          const filteredIds = filteredKbs.map(kb => kb.id);
          setSelectedKbs(filteredIds);
        } else {
          const filteredIds = filteredKbs.map(kb => kb.id);
          setSelectedKbs(prevSelected => prevSelected.filter(id => !filteredIds.includes(id)));
        }
      };

    const handleSelect = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedKbs([...selectedKbs, id]);
        } else {
            setSelectedKbs(selectedKbs.filter(kbId => kbId !== id));
        }
    };

    const handleBulkDownload = async () => {
        if (!user || selectedKbs.length === 0) return;

        setIsDownloading(true);
        try {
            // Show loading toast
            toast.info(t('knowledge_assist.startingDownloadOfSelectedArticles'));

            const response = await serviceDeskInstance.post(`/service_desk/download_postcall_topics`, {
                postcall_topic_ids: selectedKbs
            }, { responseType: 'blob' });

            // Get the blob from the response
            const blob = response.data;

            // Create a download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const timestamp = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `postcall_topics_${timestamp}.zip`);
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 100);

            toast.success(t('knowledge_assist.successfullyDownloadedSelectedArticles'));
        } catch (error) {
            console.error('Error in bulk download:', error);
            toast.error(t('knowledge_assist.failedToDownloadArticles'));
        } finally {
            setIsDownloading(false);
        }
    };

    const handleBulkDelete = async () => {
        setShowDeleteConfirm(true);
    };

    const confirmBulkDelete = async () => {
        if (!user || selectedKbs.length === 0) return;

        try {
            toast.info(t('knowledge_assist.bulkDeleteStarted'));
            await PostcallTopics.deletePostcallTopics(selectedKbs, user);
            setKbs(prevKbs => prevKbs.filter(kb => !selectedKbs.includes(kb.id)));
            setSelectedKbs([]);
            toast.success(t('knowledge_assist.selectedKBsDeletedSuccessfully'));
        } catch (error) {
            console.error('Error in bulk delete:', error);
            toast.error(t('knowledge_assist.failedToDeleteSomeKBs'));
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleDownloadArticle = async (kb: PostcallTopicListView) => {
        if (!user) return;

        try {
            const pdfBlob = await PostcallTopics.getPostcallTopicKbEntryPdf(kb.id, user);
            // Create a download link
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${kb.topic}.pdf`);
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 100);

            toast.success(t('knowledge_assist.downloadStarted'));
        } catch (error) {
            console.error('Error downloading article:', error);
            toast.error(t('knowledge_assist.failedToDownloadArticle'));
        }
    };

    const handleAddToCollection = async () => {
        if (!selectedCollectionForAdd || selectedKbs.length === 0 || !user) return;

        setIsAddingToCollection(true);
        try {
            // Check if any selected KB is already in a collection
            const kbsInCollection = selectedKbs.some(kbId =>
                kbs.find(kb => kb.id === kbId)?.knowledgebase_collection_id
            );

            if (kbsInCollection) {
                toast.error(t('knowledge_assist.oneOrMoreSelectedKBsAlreadyInCollection'));
                return;
            }

            await PostcallTopics.addPostcallTopicsToKbCollection(
                selectedKbs,
                selectedCollectionForAdd,
                user
            );

            // Update local state to reflect the changes
            setKbs(prevKbs => prevKbs.map(kb => {
                if (selectedKbs.includes(kb.id)) {
                    return {
                        ...kb,
                        knowledgebase_collection_id: selectedCollectionForAdd
                    };
                }
                return kb;
            }));

            toast.success(t('knowledge_assist.addedSelectedKBsToCollection'));
            setShowCollectionsDialog(false);
            setSelectedCollectionForAdd('');
            setSelectedKbs([]);
        } catch (error) {
            console.error('Error adding to collection:', error);
            toast.error(t('knowledge_assist.failedToAddToCollection'));
        } finally {
            setIsAddingToCollection(false);
        }
    };

    const handleBulkApprove = () => {
        setShowApproveConfirm(true);
    };

    const confirmBulkApprove = async () => {
        if (!user || selectedKbs.length === 0) return;

        setIsApproving(true);
        try {
            await PostcallTopics.approvePostcallTopics(selectedKbs, user);
            setKbs(prevKbs => prevKbs.map(kb => {
                if (selectedKbs.includes(kb.id)) {
                    return { ...kb, is_approved: true };
                }
                return kb;
            }));
            toast.success(t('knowledge_assist.selectedKBsApprovedSuccessfully'));
            setSelectedKbs([]);
        } catch (error) {
            console.error('Error in bulk approve:', error);
            toast.error(t('knowledge_assist.failedToApproveSomeKBs'));
        } finally {
            setIsApproving(false);
            setShowApproveConfirm(false);
        }
    };

    // CustomTable columns configuration
    const columns: Column<PostcallTopicListView>[] = useMemo(() => [
        {
            header: t('knowledge_assist.articleName'),
            accessor: 'topic',
            width: 'w-[25%]',
            render: (kb) => stringUtils.trimText(kb.topic, 50)
        },
        {
            header: t('knowledge_assist.meetingTitle'),
            accessor: 'meetings.title',
            width: 'w-[25%]',
            render: (kb) => {
                if (!kb.meetings?.title) {
                    return '-';
                }
                return (
                <Link
                    href={`/knowledge/postcall?meetingId=${kb.meeting_id}`}
                    className="hover:text-iris-900 hover:underline cursor-pointer transition-all duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {kb.meetings?.title}
                </Link>
            );}
        },
        {
            header: t('knowledge_assist.createdAt'),
            accessor: 'created_at',
            width: 'w-[20%]',
            render: (kb) => new Date(kb.created_at).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        },
        {
            header: t('knowledge_assist.collectionStatus'),
            accessor: 'knowledgebase_collection_id',
            width: 'w-[20%]',
            render: (kb) => {
                if (kb.knowledgebase_collection_id) {
                    return (
                        <Flex align="center" gap="2">
                            <OpenTicketIcon className="text-[#6E56CF] w-3 h-3" />
                            <Text size="2" className="text-[#6E56CF]">
                                {collections.find(c => c.id === kb.knowledgebase_collection_id)?.name || 'Troubleshooting Documents'}
                            </Text>
                        </Flex>
                    );
                } else if (kb.is_approved) {
                    return (
                        <Flex align="center" gap="1">
                            <CheckIcon className="text-[#30A46C] w-3 h-3" />
                            <Text size="2" className="text-[#30A46C]">
                                {t('knowledge_assist.approved')}
                            </Text>
                        </Flex>
                    );
                } else {
                    return (
                        <Text size="2" className="text-gray-500">
                            {t('knowledge_assist.notInCollection')}
                        </Text>
                    );
                }
            }
        }
    ], [collections, t]);

    // Actions column for CustomTable
    const actionsColumn = useCallback((kb: PostcallTopicListView) => (
        <Flex gap="2">
            <Button 
                variant="ghost" 
                size="1" 
                onClick={() => handlePreview(kb)}
                disabled={previewLoadingId === kb.id}
            >
                <EyeOpenIcon className="text-[#4F52BD] w-5 h-5" />
                {previewLoadingId === kb.id && <Spinner size="1" />}
            </Button>
            <Button
                variant="ghost"
                size="1"
                onClick={() => handleDownloadArticle(kb)}
            >
                <DownloadIcon className="text-[#4F52BD] w-5 h-5" />
            </Button>
            <Button
                variant="ghost"
                size="1"
                disabled={deleteLoadingId === kb.id}
                onClick={() => handleDelete(kb)}
            >
                <TrashIcon className="text-red-500 w-5 h-5" />
                {deleteLoadingId === kb.id && <Spinner size="1" />}
            </Button>
        </Flex>
    ), [previewLoadingId, deleteLoadingId]);

    // Handle row click to redirect to edit document page
    const handleRowClick = useCallback((kb: PostcallTopicListView) => {
        router.push(`/knowledge/kbs/edit-document?id=${kb.id}&meetingId=${kb.meeting_id}`);
    }, [router]);

    // Convert selectedKbs array to Record for CustomTable
    const selectedRowIds = useMemo(() => {
        const record: Record<string, boolean> = {};
        selectedKbs.forEach(id => {
            record[id] = true;
        });
        return record;
    }, [selectedKbs]);

    // Check if all filtered items are selected
    const selectAllState = useMemo(() => {
        if (filteredKbs.length === 0) return false;
        const selectedCount = filteredKbs.filter(kb => selectedKbs.includes(kb.id)).length;
        if (selectedCount === 0) return false;
        if (selectedCount === filteredKbs.length) return true;
        return 'indeterminate';
    }, [filteredKbs, selectedKbs]);

    if (loading) {
        return (
            <div className="p-6 h-full">
                <Flex direction="column" align="center" justify="center" className="h-full">
                    <Spinner />
                </Flex>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 h-full">
                <Card className="p-4">
                    <Flex align="center" gap="2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                        <Text>{error}</Text>
                    </Flex>
                </Card>
            </div>
        );
    }

    if (kbs.length === 0) {
        return (
            <div className="p-6 h-full">
                <Text size="6" weight="bold" className="mb-6">
                    {t('knowledge_assist.kbsCreated')}
                </Text>
                <Card className="p-4">
                    <Text align="center">{t('knowledge_assist.noKBsCreatedYet')}</Text>
                </Card>
            </div>
        );
    }

    return (
        <Flex direction="column" className="h-full">
            <AlertDialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialog.Content>
                    <AlertDialog.Title>{t('knowledge_assist.confirmDeletion')}</AlertDialog.Title>
                    <AlertDialog.Description>
                        {t('knowledge_assist.areYouSureDeleteKBs', { count: selectedKbs.length })}
                    </AlertDialog.Description>
                    <Flex gap="3" mt="4" justify="end">
                        <AlertDialog.Cancel>
                            <Button variant="soft" color="gray">
                                {t('knowledge_assist.cancel')}
                            </Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                            <Button variant="solid" color="red" onClick={confirmBulkDelete}>
                                {t('knowledge_assist.delete')}
                            </Button>
                        </AlertDialog.Action>
                    </Flex>
                </AlertDialog.Content>
            </AlertDialog.Root>

            <AlertDialog.Root open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
                <AlertDialog.Content>
                    <AlertDialog.Title>{t('knowledge_assist.confirmApproval')}</AlertDialog.Title>
                    <AlertDialog.Description>
                        {t('knowledge_assist.areYouSureApproveKBs', { count: selectedKbs.length })}
                    </AlertDialog.Description>
                    <Flex gap="3" mt="4" justify="end">
                        <AlertDialog.Cancel>
                            <Button variant="soft" color="gray">
                                {t('knowledge_assist.cancel')}
                            </Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                            <Button
                                variant="solid"
                                onClick={confirmBulkApprove}
                                disabled={isApproving}
                            >
                                {isApproving ? (
                                    <Flex align="center" gap="2">
                                        <Spinner size="1" />
                                        {t('knowledge_assist.approving')}
                                    </Flex>
                                ) : (
                                    t('knowledge_assist.approve')
                                )}
                            </Button>
                        </AlertDialog.Action>
                    </Flex>
                </AlertDialog.Content>
            </AlertDialog.Root>

            <AlertDialog.Root open={showSingleDeleteConfirm} onOpenChange={setShowSingleDeleteConfirm}>
                <AlertDialog.Content>
                    <AlertDialog.Title>{t('knowledge_assist.confirmDeletion')}</AlertDialog.Title>
                    <AlertDialog.Description>
                        {t('knowledge_assist.areYouSureDeleteThisKB')}
                    </AlertDialog.Description>
                    <Flex gap="3" mt="4" justify="end">
                        <AlertDialog.Cancel>
                            <Button variant="soft" color="gray">
                                {t('knowledge_assist.cancel')}
                            </Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                            <Button variant="solid" color="red" onClick={confirmSingleDelete}>
                                {t('knowledge_assist.delete')}
                            </Button>
                        </AlertDialog.Action>
                    </Flex>
                </AlertDialog.Content>
            </AlertDialog.Root>

            <Dialog.Root open={showCollectionsDialog} onOpenChange={setShowCollectionsDialog}>
                <Dialog.Content style={{ maxWidth: 400 }}>
                    <Dialog.Title>{t('knowledge_assist.addToCollection')}</Dialog.Title>

                    <Flex direction="column" gap="3" className="my-4">
                        {isLoadingCollections ? (
                            <Flex align="center" justify="center" py="4">
                                <Spinner size="2" />
                            </Flex>
                        ) : (
                            <>
                                <Select.Root
                                    value={selectedCollectionForAdd}
                                    onValueChange={setSelectedCollectionForAdd}
                                >
                                    <Select.Trigger
                                        className="w-full"
                                        placeholder={t('knowledge_assist.chooseCollection')}
                                    />
                                    <Select.Content>
                                        <Select.Group>
                                            {collections.map((collection) => (
                                                <Select.Item
                                                    key={collection.id}
                                                    value={collection.id}
                                                    disabled={collection.source === KbCollectionSource.SERVICE_NOW || collection.source === KbCollectionSource.SHAREPOINT}
                                                >
                                                    {collection.name}
                                                </Select.Item>
                                            ))}
                                        </Select.Group>
                                    </Select.Content>
                                </Select.Root>
                                <Text size="2" color="gray">
                                    {t('knowledge_assist.documentsAutoApprovedWhenAddedToCollection')}
                                </Text>
                            </>
                        )}
                    </Flex>

                    <Flex gap="3" justify="end">
                        <Button
                            variant="soft"
                            color="gray"
                            onClick={() => setShowCollectionsDialog(false)}
                        >
                            {t('knowledge_assist.cancel')}
                        </Button>
                        <Button
                            onClick={handleAddToCollection}
                            disabled={
                                isAddingToCollection ||
                                selectedKbs.length === 0
                            }
                        >
                            <Flex align="center" gap="2">
                                {isAddingToCollection && <Spinner size="1" />}
                                {t('knowledge_assist.addToCollection')}
                            </Flex>
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>

            {/* Header Section */}
            <Box className="flex-shrink-0">
                <Flex
                    align="center"
                    justify="between"
                    className="h-14 border-b border-[var(--gray-8)]"
                    px="4"
                >
                    <Flex align="center" gap="2">
                        <ArrowLeftIcon
                            className="cursor-pointer"
                            onClick={() => router.push('/knowledge/logs')}
                        />
                        <Text size="4" weight="medium">
                            {t('knowledge_assist.kbsCreated')}
                        </Text>
                    </Flex>
                    <Box className='float-right'>
                        <SearchBar register={register} placeholder={t('knowledge_assist.search')} />
                    </Box>
                </Flex>

                {/* Action Buttons */}
                <Flex px="4" py="3" gap="3">
                    <Button
                        variant="outline"
                        onClick={() => setShowCollectionsDialog(true)}
                        disabled={selectedKbs.length === 0}
                    >
                        <Flex align="center" gap="2">
                            <ArrowUpIcon />
                            {t('knowledge_assist.addToCollection')}
                        </Flex>
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleBulkDownload}
                        disabled={selectedKbs.length === 0 || isDownloading}
                    >
                        <Flex align="center" gap="2">
                            {isDownloading ? (
                                <>
                                    <Spinner size="1" />
                                    {t('knowledge_assist.downloading')}
                                </>
                            ) : (
                                <>
                                    <DownloadIcon />
                                    {t('knowledge_assist.downloadAll')}
                                </>
                            )}
                        </Flex>
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleBulkApprove}
                        disabled={selectedKbs.length === 0}
                    >
                        <Flex align="center" gap="2">
                            <CheckIcon />
                            {t('knowledge_assist.markAsApproved')}
                        </Flex>
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleBulkDelete}
                        disabled={selectedKbs.length === 0}
                    >
                        <Flex align="center" gap="2">
                            <TrashIcon />
                            {t('knowledge_assist.delete')}
                        </Flex>
                    </Button>
                </Flex>
            </Box>

            {/* Table Content */}
            <Box className="px-4 overflow-y-auto">
                <CustomTable
                    data={filteredKbs}
                    columns={columns}
                    isLoading={kbsLoading || isFiltering}
                    rowKey={(kb) => kb.id}
                    selectable={true}
                    selectedRowIds={selectedRowIds}
                    onRowSelect={handleSelect}
                    onSelectAll={handleSelectAll}
                    selectAllState={selectAllState}
                    actionsColumn={actionsColumn}
                    onRowClick={handleRowClick}
                    emptyMessage={t('knowledge_assist.noKBsFoundMatchingSearch')}
                />
            </Box>
            <ToastContainer />
        </Flex>
    );
}
