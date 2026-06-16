import React, { useState, useEffect } from 'react';
import { Box, Flex, Text, IconButton, DropdownMenu } from '@radix-ui/themes';
import { DotsVerticalIcon, Cross2Icon, ClockIcon } from '@radix-ui/react-icons';
import { useGlobalContext } from 'contexts/store';
import { toast } from 'react-toastify';
import { PostcallTopics } from 'api/postcallTopcs';
import { aiAgentInstance } from 'api/common/axiosInstance';

interface DocumentVersion {
    id: string;
    content: string;
    created_at: string;
    user: {
        email: string | null;
        name: string | null;
    };
}

interface VersionHistoryBarProps {
    isOpen?: boolean;
    onClose?: () => void;
    documentId?: string;
    onVersionRestore?: (content: string) => void;
}

function VersionHistoryBar({ isOpen = true, onClose, documentId, onVersionRestore }: VersionHistoryBarProps) {
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
    const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
    const { user } = useGlobalContext();

    useEffect(() => {
        const fetchVersions = async () => {
            if (!documentId || !isOpen) return;

            setIsLoading(true);
            try {
                const response = await aiAgentInstance.get(`/api/v1/knowledgeassist/document/${documentId}/versions`);
                if (response.status !== 200) {
                    throw new Error('Failed to fetch versions');
                }
                setVersions(response.data);
            } catch (error) {
                console.error('Error fetching version history:', error);
                toast.error('Failed to load version history');
            } finally {
                setIsLoading(false);
            }
        };

        fetchVersions();
    }, [documentId, isOpen]);

    const handleRestore = async (versionId: string) => {
        if (!documentId) return;

        setRestoringVersionId(versionId);
        try {
            const response = await aiAgentInstance.put(`/api/v1/knowledgeassist/update_document`, {
                id: documentId,
                version_id: versionId
            });

            if (response.status !== 200) {
                throw new Error('Failed to restore version');
            }

            const restoredVersion = versions.find(v => v.id === versionId);
            if (restoredVersion && onVersionRestore) {
                onVersionRestore(restoredVersion.content);
            }

            toast.success('Version restored successfully');
            onClose?.();
        } catch (error) {
            console.error('Error restoring version:', error);
            toast.error('Failed to restore version');
        } finally {
            setRestoringVersionId(null);
            setOpenMenuIndex(null);
        }
    };

    const handlePreview = async (content: string) => {
        if (!user) return;

        try {
            const pdfBlob = await PostcallTopics.convertMarkdownToPdf(content, user);
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');

            // Clean up the URL object after the window is opened
            setTimeout(() => {
                URL.revokeObjectURL(pdfUrl);
            }, 100);
        } catch (error) {
            console.error('Error generating PDF preview:', error);
            toast.error('Failed to generate PDF preview');
        }
    };

    return (
        <>
            {isOpen && (
                <Box
                    className="fixed inset-0 bg-[rgba(0,0,0,0.4)] z-[9999]"
                    onClick={onClose}
                />
            )}
            <Box
                className={`fixed right-0 top-0 h-screen w-[300px] border-l border-[var(--gray-6)] bg-[var(--gray-2)] shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col z-[10000] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <Flex justify="between" align="center" className="p-4 border-b border-[var(--gray-6)] flex-shrink-0">
                    <Text size="3" weight="bold">Version History</Text>
                    <IconButton size="2" variant="ghost" onClick={onClose}>
                        <Cross2Icon />
                    </IconButton>
                </Flex>
                <Box className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <Text size="2" className="p-4">Loading version history...</Text>
                    ) : versions.map((version, index) => (
                        <Flex
                            key={version.id}
                            p="4"
                            gap="3"
                            align="start"
                            justify="between"
                            className="border-b border-[var(--gray-6)] hover:bg-[var(--gray-3)]"
                        >
                            <Flex gap="3">
                                <ClockIcon className="text-[var(--gray-8)] mt-1" />
                                <Flex direction="column" gap="1">
                                    <Text size="2" color="gray">
                                        {new Date(version.created_at).toLocaleString()}
                                    </Text>
                                    {index === 0 ? (
                                        <Text size="2" weight="bold">Current Version</Text>
                                    ) : index === versions.length - 1 && (
                                        <Text size="2">First Version</Text>
                                    )}
                                    <Text size="2" color="gray">
                                        {version.user?.name || version.user?.email || 'Unknown user'}
                                    </Text>
                                </Flex>
                            </Flex>
                            {index !== 0 && (
                                <DropdownMenu.Root
                                    open={restoringVersionId === version.id || openMenuIndex === index}
                                    onOpenChange={(open) => {
                                        if (!restoringVersionId) {
                                            setOpenMenuIndex(open ? index : null);
                                        }
                                    }}
                                >
                                    <DropdownMenu.Trigger>
                                        <IconButton size="1" variant="ghost">
                                            <DotsVerticalIcon />
                                        </IconButton>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Content>
                                        <DropdownMenu.Item
                                            onClick={() => handleRestore(version.id)}
                                            disabled={restoringVersionId === version.id}
                                        >
                                            {restoringVersionId === version.id ? 'Restoring...' : 'Restore this version'}
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onClick={() => handlePreview(version.content)}
                                        >
                                            Show preview
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Root>
                            )}
                        </Flex>
                    ))}
                </Box>
            </Box>
        </>
    );
}

export default VersionHistoryBar;
